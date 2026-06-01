#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { inspectStaleArtifacts, plural, removeStaleArtifacts } from "./agent-cleanup-utils.mjs";
import { splitCommandLine } from "./agent-command-utils.mjs";
import { requiredHarnessFiles as requiredHarnessFileList } from "./agent-harness-files.mjs";
import { commandGatePreview, commandGateWarnings, findExecutable, taskCommandGatePreflight } from "./agent-preflight.mjs";
import { assemblePrompt, sha256Text, stripRuntimeFields, taskContractHash } from "./agent-trace-utils.mjs";
import { validateHarnessFiles } from "./agent-validate.mjs";
import { runDoctor } from "./agent-doctor.mjs";

const root = process.cwd();
const agentDir = path.join(root, ".agent");
const queueDir = path.join(agentDir, "queue");
const statePath = path.join(agentDir, "state.json");
const lockPath = path.join(agentDir, "tmp", "runner.lock");
const statusOrder = ["pending", "running", "passed", "failed", "partial", "blocked"];
const taskIdPattern = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
let lockHeld = false;
let currentRunContext = null;
const activeChildren = new Set();

// TODO: parallel execution needs path-level locking and dependency-aware scheduling.

function parseArgs(argv) {
  const args = {
    doctor: false,
    list: false,
    graph: false,
    show: null,
    logs: null,
    scopeCheck: null,
    task: null,
    next: false,
    all: false,
    status: false,
    resetRunning: false,
    reconcileState: false,
    cleanupStale: false,
    readyOnly: false,
    maxTasks: 1,
    maxTasksSet: false,
    codexTimeoutMinutes: 90,
    codexTimeoutSet: false,
    commandTimeoutMinutes: 30,
    commandTimeoutSet: false,
    dryRun: false,
    noWorktree: false,
    noCodex: false,
    printPrompt: false,
    json: false,
    strict: false,
    allowDirty: false,
    force: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--doctor") args.doctor = true;
    else if (arg === "--list") args.list = true;
    else if (arg === "--graph") args.graph = true;
    else if (arg === "--show") args.show = normalizeTaskId(readOptionValue(argv, index++, arg));
    else if (arg === "--logs") args.logs = normalizeTaskId(readOptionValue(argv, index++, arg));
    else if (arg === "--scope-check") args.scopeCheck = normalizeTaskId(readOptionValue(argv, index++, arg));
    else if (arg === "--task") args.task = normalizeTaskId(readOptionValue(argv, index++, arg));
    else if (arg === "--next") args.next = true;
    else if (arg === "--all") args.all = true;
    else if (arg === "--status") args.status = true;
    else if (arg === "--reset-running") args.resetRunning = true;
    else if (arg === "--reconcile-state") args.reconcileState = true;
    else if (arg === "--cleanup-stale") args.cleanupStale = true;
    else if (arg === "--ready") args.readyOnly = true;
    else if (arg === "--max-tasks") {
      args.maxTasksSet = true;
      args.maxTasks = Number(readOptionValue(argv, index++, arg));
    } else if (arg === "--codex-timeout-minutes") {
      args.codexTimeoutSet = true;
      args.codexTimeoutMinutes = Number(readOptionValue(argv, index++, arg));
    } else if (arg === "--command-timeout-minutes") {
      args.commandTimeoutSet = true;
      args.commandTimeoutMinutes = Number(readOptionValue(argv, index++, arg));
    } else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--no-worktree") args.noWorktree = true;
    else if (arg === "--no-codex") args.noCodex = true;
    else if (arg === "--print-prompt") args.printPrompt = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--strict") args.strict = true;
    else if (arg === "--allow-dirty") args.allowDirty = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.help) return args;

  if (!Number.isInteger(args.maxTasks) || args.maxTasks < 1) {
    throw new Error("--max-tasks must be a positive integer.");
  }
  if (!Number.isFinite(args.commandTimeoutMinutes) || args.commandTimeoutMinutes < 0) {
    throw new Error("--command-timeout-minutes must be a nonnegative number.");
  }
  if (!Number.isFinite(args.codexTimeoutMinutes) || args.codexTimeoutMinutes < 0) {
    throw new Error("--codex-timeout-minutes must be a nonnegative number.");
  }
  const primaryActions = [
    args.doctor,
    args.list,
    args.graph,
    Boolean(args.show),
    Boolean(args.logs),
    Boolean(args.scopeCheck),
    Boolean(args.task),
    args.next,
    args.all,
    args.status,
    args.resetRunning,
    args.reconcileState,
    args.cleanupStale
  ].filter(Boolean);
  if (primaryActions.length > 1) {
    throw new Error("Choose only one primary action.");
  }
  validateOptionCombinations(args);

  return args;
}

function validateOptionCombinations(args) {
  const selectsTasks = Boolean(args.task) || args.next || args.all;
  const supportsDryRun = selectsTasks || args.resetRunning || args.reconcileState || args.cleanupStale;
  if (args.readyOnly && !args.list) {
    throw new Error("--ready can only be used with --list.");
  }
  if (args.maxTasksSet && !args.all) {
    throw new Error("--max-tasks can only be used with --all.");
  }
  if (args.noCodex && !selectsTasks) {
    throw new Error("--no-codex can only be used with --task, --next, or --all.");
  }
  if (args.dryRun && args.noCodex) {
    throw new Error("Choose either --dry-run or --no-codex, not both.");
  }
  if (args.noWorktree && !selectsTasks) {
    throw new Error("--no-worktree can only be used with --task, --next, or --all.");
  }
  if (args.allowDirty && (!args.noWorktree || !selectsTasks)) {
    throw new Error("--allow-dirty can only be used with --no-worktree task runs.");
  }
  if (args.printPrompt && (!selectsTasks || (!args.dryRun && !args.noCodex))) {
    throw new Error("--print-prompt requires --dry-run or --no-codex with --task, --next, or --all.");
  }
  if (args.dryRun && !supportsDryRun) {
    throw new Error("--dry-run can only be used with --task, --next, --all, --reset-running, --reconcile-state, or --cleanup-stale.");
  }
  if (args.json && selectsTasks && !args.dryRun && !args.noCodex) {
    throw new Error("--json is only supported for task selection with --dry-run or --no-codex; real runs write reports to disk.");
  }
  if ((args.codexTimeoutSet || args.commandTimeoutSet) && !selectsTasks) {
    throw new Error("timeout options can only be used with --task, --next, or --all.");
  }
  if (args.force && !(args.task || args.resetRunning || args.reconcileState)) {
    throw new Error("--force can only be used with --task, --reset-running, or --reconcile-state.");
  }
}

function readOptionValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
  return value;
}

function normalizeTaskId(value) {
  const id = String(value).replace(/\.json$/, "");
  if (!taskIdPattern.test(id)) {
    throw new Error(`Task id must use NNN-lowercase-slug format: ${value}`);
  }
  return id;
}

function usage() {
  console.log(`Usage:
  node scripts/agent-runner.mjs --doctor
  node scripts/agent-runner.mjs --list
  node scripts/agent-runner.mjs --graph
  node scripts/agent-runner.mjs --show 001-inspect-repo
  node scripts/agent-runner.mjs --logs 001-inspect-repo
  node scripts/agent-runner.mjs --scope-check 001-inspect-repo
  node scripts/agent-runner.mjs --task 002-schema-and-fixtures
  node scripts/agent-runner.mjs --next
  node scripts/agent-runner.mjs --all --max-tasks 3
  node scripts/agent-runner.mjs --status
  node scripts/agent-runner.mjs --cleanup-stale --dry-run

Options:
  --dry-run       Print the selected task(s), commands, or recovery action without mutating state.
  --no-worktree   Run in the current checkout.
  --no-codex      Validate selection and commands only.
  --print-prompt  Print the assembled worker prompt during dry-run/no-codex.
  --json          Emit JSON for supported inspection and recovery commands.
  --strict        Treat harness validation warnings as fatal before selecting/running tasks.
  --show TASK     Print one task contract.
  --logs TASK     Print task reports, logs, and recent lifecycle events.
  --scope-check TASK
                Check current git changes against one task's allowed_paths and forbidden_paths.
  --graph         Print the dependency graph in Mermaid format.
  --status        Print runner state and lock information.
  --allow-dirty   Allow --no-worktree runs in a dirty checkout.
  --force        Allow a real --task run even when dependencies are incomplete.
  --codex-timeout-minutes N
                Kill a Codex worker after N minutes. Default: 90.
  --command-timeout-minutes N
                Kill a command gate after N minutes. Default: 30.
  --ready        With --list, show only dependency-ready pending tasks.
  --reset-running Clear stale current_task in .agent/state.json.
  --reconcile-state Rebuild state buckets from result JSON reports.
  --cleanup-stale Remove stale atomic temp files and empty transient log/tmp directories.
`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  writeTextFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeTextFileAtomic(file, content) {
  ensureDir(path.dirname(file));
  const tempFile = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  fs.writeFileSync(tempFile, content);
  fs.renameSync(tempFile, file);
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    stdio: options.stdio || "pipe"
  });
  if (result.error) {
    return {
      ...result,
      status: 1,
      stdout: result.stdout || "",
      stderr: result.stderr || result.error.message
    };
  }
  return result;
}

function validateHarness(options = {}) {
  const result = validateHarnessFiles();
  const fatalWarnings = options.strict ? result.warnings : [];
  if (result.errors.length || fatalWarnings.length) {
    console.log("Agent harness validation failed");
    for (const error of result.errors) console.log(`- ${error}`);
    for (const warning of fatalWarnings) console.log(`- ${warning}`);
    throw new Error("Harness validation failed.");
  }
}

function loadTasks() {
  return fs.readdirSync(queueDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const fullPath = path.join(queueDir, file);
      return { ...readJson(fullPath), file: fullPath };
    })
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

function loadState() {
  return readJson(statePath);
}

function saveState(state) {
  writeJson(statePath, state);
}

function acquireLock() {
  ensureDir(path.dirname(lockPath));
  const payload = {
    pid: process.pid,
    started_at: new Date().toISOString(),
    cwd: root
  };
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`);
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const info = readLockInfo();
    const existing = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, "utf8") : "";
    const alive = info?.process_alive === false
      ? "The recorded process does not appear to be alive. Inspect logs, then run --reset-running if it is stale."
      : "Remove the lock only after confirming no runner is active.";
    throw new Error(`Another agent runner appears to be active. Lock file: ${path.relative(root, lockPath)}\n${existing.trim()}\n${alive}`);
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch (error) {
    console.error(`Could not remove lock file ${lockPath}: ${error.message}`);
  }
}

function shutdownFromSignal(signal) {
  for (const child of activeChildren) killProcessTree(child, "SIGTERM");
  markCurrentRunInterrupted(signal);
  if (lockHeld) {
    releaseLock();
    lockHeld = false;
  }
  setTimeout(() => {
    for (const child of activeChildren) killProcessTree(child, "SIGKILL");
    process.exit(signal === "SIGINT" ? 130 : 143);
  }, 250).unref();
}

function markCurrentRunInterrupted(signal) {
  if (!currentRunContext) return;
  const { task, logBase, manifest } = currentRunContext;
  const attemptsUsed = currentRunContext.attemptsUsed || 0;
  const finishedAt = new Date().toISOString();
  const summary = `Task ${task.id} interrupted by ${signal}.`;
  try {
    appendEvent(logBase, "runner.signal", {
      signal,
      summary,
      duration_ms: durationSinceIso(manifest.started_at)
    });
    manifest.status = "blocked";
    manifest.updated_at = finishedAt;
    manifest.finished_at = finishedAt;
    manifest.duration_ms = durationSinceIso(manifest.started_at);
    manifest.summary = summary;
    manifest.attempts_used = attemptsUsed;
    writeRunManifest(logBase, manifest);
    finishState(loadState(), task, "blocked", summary, attemptsUsed);
  } catch (error) {
    console.error(`Could not record interrupted task state: ${error.message}`);
  }
}

function installSignalHandlers() {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => shutdownFromSignal(signal));
  }
}

function isComplete(taskId, tasks, state) {
  return state.completed.includes(taskId) || tasks.some((task) => task.id === taskId && task.status === "passed");
}

function effectiveStatus(task, state) {
  if (state.current_task === task.id) return "running";
  if (isComplete(task.id, [task], state)) return "passed";
  if (state.failed.includes(task.id)) return "failed";
  if (state.partial.includes(task.id)) return "partial";
  if (state.blocked.includes(task.id)) return "blocked";
  return task.status;
}

function isDependencyReady(task, tasks, state) {
  return task.depends_on.every((dependency) => isComplete(dependency, tasks, state));
}

function pickNextTask(tasks, state) {
  return tasks.find((task) => {
    return effectiveStatus(task, state) === "pending"
      && !isComplete(task.id, tasks, state)
      && isDependencyReady(task, tasks, state);
  });
}

function selectTasks(args, tasks, state) {
  if (args.task) {
    const task = tasks.find((entry) => entry.id === args.task);
    if (!task) throw new Error(`Task not found: ${args.task}`);
    if (!args.dryRun && !args.noCodex && !args.force && !isDependencyReady(task, tasks, state)) {
      throw new Error(`Task ${task.id} has incomplete dependencies: ${task.depends_on.join(", ")}. Use --force only if you intentionally want to bypass dependency order.`);
    }
    return [task];
  }

  if (args.next) {
    const task = pickNextTask(tasks, state);
    if (!task) throw new Error("No pending dependency-ready task found.");
    return [task];
  }

  if (args.all) {
    const selected = [];
    const simulatedState = structuredClone(state);
    const maxTasks = Math.max(1, args.maxTasks || 1);
    for (let index = 0; index < maxTasks; index += 1) {
      const task = pickNextTask(tasks, simulatedState);
      if (!task) break;
      selected.push(task);
      simulatedState.completed.push(task.id);
    }
    if (!selected.length) throw new Error("No pending dependency-ready tasks found.");
    return selected;
  }

  throw new Error("Choose --list, --task <id>, --next, --all, or --doctor.");
}

function taskListEntries(tasks, state) {
  return tasks.map((task) => {
    const deps = task.depends_on.length ? task.depends_on : [];
    const status = effectiveStatus(task, state);
    const blockedBy = deps.filter((dependency) => !isComplete(dependency, tasks, state));
    const warnings = task.commands
      .map((command) => commandGatePreview(command, root))
      .flatMap(commandGateWarnings);
    return {
      id: task.id,
      title: task.title,
      priority: task.priority,
      status,
      lane: task.lane,
      ready: status === "pending" && blockedBy.length === 0,
      depends_on: deps,
      blocked_by: blockedBy,
      branch: task.branch,
      task_contract_hash: taskContractHash(task),
      prompt_hash: sha256Text(assemblePrompt(task, root)),
      command_gate_warning_count: warnings.length,
      command_gate_warnings: warnings
    };
  });
}

function listTasks(tasks, state, options = {}) {
  const entries = taskListEntries(tasks, state).filter((entry) => !options.readyOnly || entry.ready);
  if (options.json) {
    console.log(JSON.stringify({ tasks: entries }, null, 2));
    return;
  }
  console.log("Task queue");
  for (const entry of entries) {
    const deps = entry.depends_on.length ? entry.depends_on.join(", ") : "none";
    const blockedBy = entry.blocked_by.length ? entry.blocked_by.join(", ") : "none";
    const ready = entry.ready ? "ready" : "waiting";
    console.log(`${entry.id.padEnd(30)} priority=${String(entry.priority).padEnd(3)} status=${entry.status.padEnd(8)} ${ready} task_hash=${shortHash(entry.task_contract_hash)} prompt_hash=${shortHash(entry.prompt_hash)} warnings=${entry.command_gate_warning_count} blocked_by=${blockedBy} deps=${deps}`);
  }
}

function showTask(tasks, state, taskId, json = false) {
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const entry = taskListEntries(tasks, state).find((item) => item.id === task.id);
  const prompt = assemblePrompt(task, root);
  if (json) {
    console.log(JSON.stringify({
      task: stripRuntimeFields(task),
      state: entry,
      task_contract_hash: taskContractHash(task),
      prompt_hash: sha256Text(prompt),
      command_gates: task.commands.map((command) => commandGatePreview(command, root))
    }, null, 2));
    return;
  }
  console.log(`${task.id}: ${task.title}`);
  console.log(`status: ${entry.status}`);
  console.log(`ready: ${entry.ready ? "yes" : "no"}`);
  console.log(`lane: ${task.lane}`);
  console.log(`priority: ${task.priority}`);
  console.log(`branch: ${task.branch}`);
  console.log(`task_contract_hash: ${taskContractHash(task)}`);
  console.log(`prompt_hash: ${sha256Text(prompt)}`);
  console.log(`depends_on: ${task.depends_on.length ? task.depends_on.join(", ") : "none"}`);
  console.log(`blocked_by: ${entry.blocked_by.length ? entry.blocked_by.join(", ") : "none"}`);
  console.log(`allowed_paths: ${task.allowed_paths.join(", ")}`);
  console.log(`forbidden_paths: ${task.forbidden_paths.join(", ")}`);
  console.log("acceptance:");
  for (const criterion of task.acceptance) console.log(`- ${criterion}`);
  console.log("commands:");
  for (const command of task.commands) console.log(`- ${command}`);
}

function scopeCheckTask(tasks, taskId, json = false) {
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const statusResult = runSync("git", ["status", "--short"], { cwd: root });
  if (statusResult.status !== 0) {
    const error = `Could not read git status for scope check: ${statusResult.stderr || statusResult.stdout}`;
    if (json) {
      console.log(JSON.stringify({
        task: task.id,
        passed: false,
        blocked: true,
        error,
        files: [],
        violations: []
      }, null, 2));
      return false;
    }
    console.log(`Scope check: ${task.id}`);
    console.log("status: blocked");
    console.log(error);
    return false;
  }
  const statusText = (statusResult.stdout || "").trim();
  const files = changedFilesFromStatus(statusText);
  const violations = scopeViolations(task, files);
  const passed = violations.length === 0;

  if (json) {
    console.log(JSON.stringify({
      task: task.id,
      passed,
      files,
      violations
    }, null, 2));
    return passed;
  }

  console.log(`Scope check: ${task.id}`);
  console.log(`status: ${passed ? "passed" : "failed"}`);
  console.log("changed files:");
  if (files.length) {
    for (const file of files) console.log(`- ${file}`);
  } else {
    console.log("- none");
  }
  console.log("violations:");
  if (violations.length) {
    for (const violation of violations) console.log(`- ${violation.file}: ${violation.reason}`);
  } else {
    console.log("- none");
  }
  return passed;
}

function taskRunPreview(task, args) {
  const workdir = args.noWorktree ? root : worktreeTarget(task);
  const preflight = taskCommandGatePreflight(task, root);
  const prompt = assemblePrompt(task, root);
  const preview = {
    id: task.id,
    title: task.title,
    lane: task.lane,
    branch: task.branch,
    task_contract_hash: taskContractHash(task),
    prompt_hash: sha256Text(prompt),
    workdir,
    depends_on: task.depends_on,
    allowed_paths: task.allowed_paths,
    forbidden_paths: task.forbidden_paths,
    max_attempts: task.max_attempts,
    codex_timeout_minutes: args.codexTimeoutMinutes,
    command_timeout_minutes: args.commandTimeoutMinutes,
    environment: environmentSnapshot(root),
    worktree_preflight: worktreePreflight(task, args),
    commands: task.commands,
    command_gates: preflight.command_gates,
    command_gate_warnings: preflight.command_gate_warnings
  };
  if (args.printPrompt) preview.prompt = prompt;
  return preview;
}

function worktreePreflight(task, args) {
  if (args.noWorktree) {
    return {
      mode: "current-checkout",
      status: args.allowDirty ? "allowed-dirty" : "requires-clean-checkout",
      message: args.allowDirty
        ? "Runner will use the current checkout and allow existing dirty files."
        : "Runner will use the current checkout and require it to be clean before a real run."
    };
  }

  const missing = [];
  for (const file of requiredHarnessFiles(task)) {
    const result = runSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", file]);
    const stderr = String(result.stderr || "");
    if (result.error || stderr.includes("EPERM")) {
      return {
        mode: "worktree",
        status: "unknown",
        message: `Could not verify committed harness files because git is unavailable: ${stderr || result.error?.message || "unknown git error"}`
      };
    }
    if (result.status !== 0 || result.stdout.trim() !== file) missing.push(file);
  }

  if (missing.length) {
    return {
      mode: "worktree",
      status: "blocked",
      missing,
      message: "Default worktree mode needs these harness files committed to HEAD before a real run."
    };
  }

  return {
    mode: "worktree",
    status: "ready",
    message: "Required harness files appear committed for default worktree mode."
  };
}

function printGraph(tasks, state, json = false) {
  const entries = taskListEntries(tasks, state);
  if (json) {
    const nodes = entries.map((task) => ({
      id: task.id,
      title: task.title,
      lane: task.lane,
      priority: task.priority,
      status: task.status,
      ready: task.ready,
      blocked_by: task.blocked_by,
      task_contract_hash: task.task_contract_hash,
      prompt_hash: task.prompt_hash
    }));
    const edges = tasks.flatMap((task) => task.depends_on.map((dependency) => ({
      from: dependency,
      to: task.id
    })));
    console.log(JSON.stringify({ nodes, edges }, null, 2));
    return;
  }
  console.log("graph TD");
  for (const task of entries) {
    const status = task.ready ? "ready" : task.status;
    const label = `${task.id}<br/>${task.title.replace(/"/g, "'")}<br/>${status} / ${task.lane}<br/>${shortHash(task.task_contract_hash)}`;
    console.log(`  ${graphId(task.id)}["${label}"]`);
  }
  for (const task of tasks) {
    for (const dependency of task.depends_on) {
      console.log(`  ${graphId(dependency)} --> ${graphId(task.id)}`);
    }
  }
}

function graphId(taskId) {
  return `task_${taskId.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function statusSummary(tasks, state) {
  const counts = Object.fromEntries(statusOrder.map((status) => [status, 0]));
  for (const task of tasks) {
    const status = effectiveStatus(task, state);
    counts[status] = (counts[status] || 0) + 1;
  }
  const readyTasks = taskListEntries(tasks, state).filter((task) => task.ready).map((task) => task.id);
  const nextTask = readyTasks[0] ? tasks.find((task) => task.id === readyTasks[0]) : null;
  const nextTaskId = nextTask?.id || null;
  const lockInfo = readLockInfo();
  return {
    current_task: state.current_task,
    started_at: state.started_at,
    updated_at: state.updated_at,
    last_run_summary: state.last_run_summary,
    lock: fs.existsSync(lockPath) ? path.relative(root, lockPath) : null,
    lock_info: lockInfo,
    ready_tasks: readyTasks,
    next_task: nextTaskId,
    next_task_contract_hash: nextTask ? taskContractHash(nextTask) : null,
    next_prompt_hash: nextTask ? sha256Text(assemblePrompt(nextTask, root)) : null,
    next_command: nextTaskId ? `node scripts/agent-runner.mjs --task ${nextTaskId}` : null,
    next_dry_run_command: nextTaskId ? `node scripts/agent-runner.mjs --task ${nextTaskId} --dry-run --strict` : null,
    next_current_checkout_command: nextTaskId ? `node scripts/agent-runner.mjs --task ${nextTaskId} --no-worktree --allow-dirty --strict` : null,
    next_current_checkout_dry_run_command: nextTaskId ? `node scripts/agent-runner.mjs --task ${nextTaskId} --no-worktree --allow-dirty --dry-run --strict` : null,
    counts
  };
}

function readLockInfo() {
  if (!fs.existsSync(lockPath)) return null;
  try {
    const info = readJson(lockPath);
    if (info.pid) info.process_alive = isProcessAlive(info.pid);
    return info;
  } catch {
    return { raw: fs.readFileSync(lockPath, "utf8") };
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function printStatus(tasks, state, json = false) {
  const summary = statusSummary(tasks, state);
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log("Agent runner status");
  console.log(`current_task: ${summary.current_task || "none"}`);
  console.log(`started_at: ${summary.started_at || "not started"}`);
  console.log(`updated_at: ${summary.updated_at || "not updated"}`);
  console.log(`last_run_summary: ${summary.last_run_summary || "none"}`);
  console.log(`lock: ${summary.lock || "none"}`);
  if (summary.lock_info) {
    const owner = summary.lock_info.pid ? `pid=${summary.lock_info.pid}` : "pid=unknown";
    const started = summary.lock_info.started_at ? `started_at=${summary.lock_info.started_at}` : "started_at=unknown";
    const alive = typeof summary.lock_info.process_alive === "boolean" ? `alive=${summary.lock_info.process_alive}` : "alive=unknown";
    console.log(`lock owner: ${owner} ${started} ${alive}`);
  }
  console.log(`ready_tasks: ${summary.ready_tasks.length ? summary.ready_tasks.join(", ") : "none"}`);
  console.log(`next_task: ${summary.next_task || "none"}`);
  console.log(`next_task_contract_hash: ${shortHash(summary.next_task_contract_hash)}`);
  console.log(`next_prompt_hash: ${shortHash(summary.next_prompt_hash)}`);
  console.log(`next_command: ${summary.next_command || "none"}`);
  console.log(`next_dry_run_command: ${summary.next_dry_run_command || "none"}`);
  console.log(`next_current_checkout_dry_run_command: ${summary.next_current_checkout_dry_run_command || "none"}`);
  console.log(`counts: ${Object.entries(summary.counts).map(([status, count]) => `${status}=${count}`).join(", ")}`);
}

function recoveryStateSnapshot(state) {
  return {
    current_task: state.current_task || null,
    completed: [...(state.completed || [])],
    failed: [...(state.failed || [])],
    partial: [...(state.partial || [])],
    blocked: [...(state.blocked || [])],
    attempts: { ...(state.attempts || {}) },
    last_run_summary: state.last_run_summary || null
  };
}

function recoveryStateChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function printRecoveryResult(result, args = {}) {
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(result.message);
  if (result.dry_run && result.status !== "noop") {
    console.log("No files were changed because --dry-run was provided.");
  }
}

function resetRunningState(state, args = {}) {
  const lockInfo = readLockInfo();
  const previous = state.current_task || null;
  const lockExists = fs.existsSync(lockPath);
  const before = recoveryStateSnapshot(state);
  const baseResult = {
    action: "reset-running",
    dry_run: Boolean(args.dryRun),
    status: "noop",
    changed: false,
    force: Boolean(args.force),
    previous_state: before,
    next_state: before,
    lock_exists: lockExists,
    lock_info: lockInfo,
    would_clear_current_task: Boolean(previous),
    would_remove_lock: lockExists,
    message: "No current_task or runner lock to clear"
  };

  if (lockInfo?.process_alive === true && !args.force) {
    const result = {
      ...baseResult,
      status: "blocked",
      message: `Refusing to reset running state while lock owner pid ${lockInfo.pid} appears alive. Inspect logs or rerun with --force only if you are sure the runner is stopped.`
    };
    printRecoveryResult(result, args);
    return result;
  }
  if (!previous && !lockExists) {
    printRecoveryResult(baseResult, args);
    return baseResult;
  }

  const nextState = {
    ...state,
    current_task: null,
    updated_at: new Date().toISOString(),
    last_run_summary: previous
      ? `Cleared stale current_task ${previous}`
      : "Cleared stale runner lock"
  };
  const after = recoveryStateSnapshot(nextState);
  const result = {
    ...baseResult,
    status: args.dryRun ? "would-change" : "changed",
    changed: !args.dryRun,
    next_state: after,
    message: args.dryRun
      ? `Would reset running state${previous ? ` for ${previous}` : ""}${lockExists ? " and remove runner lock" : ""}.`
      : nextState.last_run_summary
  };

  if (!args.dryRun) {
    if (lockExists) fs.unlinkSync(lockPath);
    saveState(nextState);
  }
  printRecoveryResult(result, args);
  return result;
}

function reconcileStateFromReports(tasks, state, args = {}) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const reportsDir = path.join(agentDir, "reports");
  const lockInfo = readLockInfo();
  const before = recoveryStateSnapshot(state);
  if (lockInfo?.process_alive === true && !args.force) {
    const result = {
      action: "reconcile-state",
      dry_run: Boolean(args.dryRun),
      status: "blocked",
      changed: false,
      force: Boolean(args.force),
      previous_state: before,
      next_state: before,
      result_reports_considered: 0,
      result_statuses: {},
      lock_info: lockInfo,
      message: `Refusing to reconcile state while lock owner pid ${lockInfo.pid} appears alive. Inspect logs or rerun with --force only if you are sure the runner is stopped.`
    };
    printRecoveryResult(result, args);
    return result;
  }
  const nextState = {
    ...state,
    current_task: null,
    completed: [],
    failed: [],
    partial: [],
    blocked: [],
    updated_at: new Date().toISOString()
  };

  if (!nextState.started_at) nextState.started_at = nextState.updated_at;
  const latestByTask = new Map();
  let resultReportsConsidered = 0;
  if (fs.existsSync(reportsDir)) {
    const resultFiles = fs.readdirSync(reportsDir)
      .filter((file) => file.endsWith(".result.json"))
      .map((file) => path.join(reportsDir, file))
      .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
    for (const file of resultFiles) {
      const result = readJson(file);
      if (!taskIds.has(result.task_id)) continue;
      resultReportsConsidered += 1;
      latestByTask.set(result.task_id, result.status);
    }
  }

  for (const [taskId, status] of latestByTask.entries()) {
    if (status === "passed") nextState.completed.push(taskId);
    else if (status === "failed") nextState.failed.push(taskId);
    else if (status === "partial") nextState.partial.push(taskId);
    else if (status === "blocked") nextState.blocked.push(taskId);
  }
  nextState.last_run_summary = "Reconciled state from result reports";
  const after = recoveryStateSnapshot(nextState);
  const changed = recoveryStateChanged(before, after);
  const result = {
    action: "reconcile-state",
    dry_run: Boolean(args.dryRun),
    status: args.dryRun ? (changed ? "would-change" : "noop") : (changed ? "changed" : "noop"),
    changed: !args.dryRun && changed,
    force: Boolean(args.force),
    previous_state: before,
    next_state: after,
    result_reports_considered: resultReportsConsidered,
    result_statuses: Object.fromEntries(latestByTask),
    lock_info: lockInfo,
    message: args.dryRun
      ? `Would reconcile state from ${resultReportsConsidered} result report(s).`
      : "Reconciled state from result reports"
  };
  if (!args.dryRun) saveState(nextState);
  printRecoveryResult(result, args);
  return result;
}

function cleanupStaleArtifacts(args = {}) {
  const plan = inspectStaleArtifacts(root);
  const result = {
    action: "cleanup-stale",
    dry_run: Boolean(args.dryRun),
    status: args.dryRun ? "would-change" : "changed",
    stale_temp_files: plan.stale_temp_files,
    empty_directories: plan.empty_directories,
    deleted_files: [],
    removed_directories: [],
    message: ""
  };

  if (!plan.stale_temp_file_count && !plan.empty_directory_count) {
    result.status = "noop";
    result.message = "No stale harness temp files or empty transient directories found.";
    printRecoveryResult(result, args);
    return result;
  }

  if (!args.dryRun) {
    const removed = removeStaleArtifacts(root, plan);
    result.deleted_files = removed.deleted_files;
    result.removed_directories = removed.removed_directories;
  }
  result.message = args.dryRun
    ? `Would remove ${plural(plan.stale_temp_file_count, "stale temp file")} and ${plural(plan.empty_directory_count, "empty transient directory")}.`
    : `Removed ${plural(result.deleted_files.length, "stale temp file")} and ${plural(result.removed_directories.length, "empty transient directory")}.`;
  printRecoveryResult(result, args);
  return result;
}

function detectPackageManager(cwd) {
  const lockfiles = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"]
  ];
  for (const [file, manager] of lockfiles) {
    if (fs.existsSync(path.join(cwd, file))) return manager;
  }
  return fs.existsSync(path.join(cwd, "package.json")) ? "npm" : "none";
}

function environmentSnapshot(cwd) {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    package_manager: detectPackageManager(cwd),
    package_json_present: fs.existsSync(path.join(cwd, "package.json")),
    codex_executable: findExecutable("codex"),
    git_executable: findExecutable("git")
  };
}

function markRunning(state, task) {
  const now = new Date().toISOString();
  if (!state.started_at) state.started_at = now;
  state.updated_at = now;
  state.current_task = task.id;
  state.last_run_summary = `Running ${task.id}`;
  saveState(state);
}

function finishState(state, task, status, summary, attemptsUsed) {
  const buckets = ["completed", "failed", "partial", "blocked"];
  for (const bucket of buckets) {
    state[bucket] = state[bucket].filter((id) => id !== task.id);
  }

  if (status === "passed") state.completed.push(task.id);
  else if (status === "failed") state.failed.push(task.id);
  else if (status === "partial") state.partial.push(task.id);
  else if (status === "blocked") state.blocked.push(task.id);

  state.attempts[task.id] = attemptsUsed;
  state.current_task = null;
  state.updated_at = new Date().toISOString();
  state.last_run_summary = summary;
  saveState(state);
}

function makeTaskLogDirs(task) {
  const base = path.join(agentDir, "logs", task.id);
  ensureDir(base);
  ensureDir(path.join(base, "commands"));
  return base;
}

function directoryHasEntries(dir) {
  if (!fs.existsSync(dir)) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile()) return true;
    if (entry.isDirectory() && directoryHasEntries(fullPath)) return true;
  }
  return false;
}

function archiveExistingTaskLogDir(logBase, task, runId) {
  const logsRoot = path.resolve(agentDir, "logs");
  const resolvedBase = path.resolve(logBase);
  if (!resolvedBase.startsWith(`${logsRoot}${path.sep}`)) {
    throw new Error(`Refusing to archive log directory outside .agent/logs: ${logBase}`);
  }
  if (!directoryHasEntries(resolvedBase)) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = path.join(agentDir, "logs", "archive", task.id, `${stamp}-${runId.slice(0, 8)}`);
  ensureDir(archiveDir);
  for (const entry of fs.readdirSync(resolvedBase)) {
    fs.renameSync(path.join(resolvedBase, entry), path.join(archiveDir, entry));
  }
  return archiveDir;
}

function cleanTaskLogDir(logBase) {
  const logsRoot = path.resolve(agentDir, "logs");
  const resolvedBase = path.resolve(logBase);
  if (!resolvedBase.startsWith(`${logsRoot}${path.sep}`)) {
    throw new Error(`Refusing to clean log directory outside .agent/logs: ${logBase}`);
  }
  if (fs.existsSync(resolvedBase)) {
    for (const entry of fs.readdirSync(resolvedBase)) {
      fs.rmSync(path.join(resolvedBase, entry), { recursive: true, force: true });
    }
  }
  ensureDir(resolvedBase);
  ensureDir(path.join(resolvedBase, "commands"));
}

function writeRunManifest(logBase, manifest) {
  writeJson(path.join(logBase, "run.json"), manifest);
}

function eventLogPath(logBase) {
  return path.join(logBase, "events.jsonl");
}

function resetEventLog(logBase) {
  writeTextFileAtomic(eventLogPath(logBase), "");
}

function taskIdFromLogBase(logBase) {
  const logsRoot = path.resolve(agentDir, "logs");
  const relative = path.relative(logsRoot, path.resolve(logBase));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const [taskId] = relative.replace(/\\/g, "/").split("/");
  return taskId && taskId !== "archive" ? taskId : null;
}

function appendEvent(logBase, type, details = {}) {
  const taskId = taskIdFromLogBase(logBase);
  const event = {
    at: new Date().toISOString(),
    type,
    ...(taskId ? { task_id: taskId } : {}),
    ...details
  };
  fs.appendFileSync(eventLogPath(logBase), `${JSON.stringify(event)}\n`);
}

function startHeartbeat(logBase, type, details = {}, intervalMs = 60_000) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const detailPayload = typeof details === "function" ? details() : details;
    appendEvent(logBase, type, {
      elapsed_ms: Date.now() - startedAt,
      ...detailPayload
    });
  }, intervalMs);
  timer.unref();
  return timer;
}

function stopHeartbeat(timer) {
  if (timer) clearInterval(timer);
}

function repoName() {
  return path.basename(root);
}

function worktreeTarget(task) {
  return path.resolve(root, "..", `${repoName()}-${task.id}`);
}

function branchExists(branch) {
  const result = runSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  return result.status === 0;
}

function createWorktree(task) {
  const target = worktreeTarget(task);
  if (fs.existsSync(target)) {
    const branch = runSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: target });
    if (branch.status !== 0) {
      throw new Error(`Worktree target already exists but its branch could not be verified: ${target}\n${branch.stderr || branch.stdout}`);
    }
    const actualBranch = branch.stdout.trim();
    if (actualBranch !== task.branch) {
      throw new Error(`Worktree target ${target} is on branch ${actualBranch}, expected ${task.branch}.`);
    }
    return target;
  }

  const args = branchExists(task.branch)
    ? ["worktree", "add", target, task.branch]
    : ["worktree", "add", "-b", task.branch, target];
  const result = runSync("git", args);
  if (result.status !== 0) {
    const message = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Failed to create worktree for ${task.id}.\n${message}\nRun with --no-worktree only if you intend to use the current checkout.`);
  }
  return target;
}

function requiredHarnessFiles(task) {
  return requiredHarnessFileList(root, task?.id || null);
}

function assertHarnessCommittedForWorktree(task) {
  const missing = [];
  for (const file of requiredHarnessFiles(task)) {
    const result = runSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", file]);
    if ((result.stderr || "").includes("EPERM")) {
      throw new Error(`Could not verify committed harness files because git is blocked: ${result.stderr}`);
    }
    if (result.status !== 0 || result.stdout.trim() !== file) missing.push(file);
  }
  if (!missing.length) return;
  throw new Error([
    `Worktree run for ${task.id} requires committed harness files missing from HEAD: ${missing.join(", ")}.`,
    "Commit the harness before using default worktree mode, or run with --no-worktree --allow-dirty intentionally."
  ].join(" "));
}

function assertHarnessAvailable(cwd, task) {
  const required = requiredHarnessFiles(task);
  const missing = required.filter((file) => !fs.existsSync(path.join(cwd, file)));
  if (!missing.length) return;
  throw new Error([
    `Worktree is missing harness files required for ${task.id}: ${missing.join(", ")}.`,
    "Commit the harness files before using worktrees, or run with --no-worktree --allow-dirty intentionally."
  ].join(" "));
}

function safeCommandName(command, index) {
  const slug = command.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "command";
  const hash = crypto.createHash("sha1").update(command).digest("hex").slice(0, 8);
  return `${String(index + 1).padStart(2, "0")}-${slug}-${hash}.log`;
}

function killProcessTree(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process already exited.
    }
  }
}

function runTaskCommand(command, cwd, logFile, timeoutMs) {
  return new Promise((resolve) => {
    const startedAtMs = Date.now();
    const stream = fs.createWriteStream(logFile, { flags: "w" });
    stream.write(`$ ${command}${os.EOL}`);

    let argv;
    try {
      argv = splitCommandLine(command);
    } catch (error) {
      const durationMs = Date.now() - startedAtMs;
      stream.write(`${os.EOL}[command parse error] ${error.message}${os.EOL}`);
      stream.write(`[duration_ms ${durationMs}]${os.EOL}`);
      stream.end(() => resolve({ command, code: 127, logFile, durationMs }));
      return;
    }

    const [executable, ...args] = argv;
    const resolvedExecutable = findExecutable(executable) || executable;
    const heartbeat = startHeartbeat(logFileRoot(logFile), "command.heartbeat", {
      command,
      log: path.relative(root, logFile)
    });
    const child = spawn(resolvedExecutable, args, {
      cwd,
      shell: false,
      env: process.env,
      detached: process.platform !== "win32"
    });
    activeChildren.add(child);
    let settled = false;
    let killTimer = null;
    const timer = timeoutMs > 0
      ? setTimeout(() => {
        if (settled) return;
        killProcessTree(child, "SIGTERM");
        stream.write(`${os.EOL}[timeout] Command exceeded ${Math.round(timeoutMs / 60000)} minute(s).${os.EOL}`);
        killTimer = setTimeout(() => {
          if (settled) return;
          killProcessTree(child, "SIGKILL");
          stream.write(`[timeout] Sent SIGKILL after grace period.${os.EOL}`);
        }, 5000);
      }, timeoutMs)
      : null;
    stream.write(`[spawn] ${resolvedExecutable}${args.length ? ` ${args.join(" ")}` : ""}${os.EOL}`);
    child.stdout.on("data", (chunk) => stream.write(chunk));
    child.stderr.on("data", (chunk) => stream.write(chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      stopHeartbeat(heartbeat);
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      stream.write(`${os.EOL}[spawn error] ${error.message}${os.EOL}`);
      const durationMs = Date.now() - startedAtMs;
      stream.write(`[duration_ms ${durationMs}]${os.EOL}`);
      activeChildren.delete(child);
      stream.end(() => resolve({ command, code: 127, logFile, durationMs }));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      stopHeartbeat(heartbeat);
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      const timedOut = Boolean(killTimer);
      const finalCode = timedOut ? 124 : code;
      const durationMs = Date.now() - startedAtMs;
      stream.write(`${os.EOL}[exit ${code}]${os.EOL}`);
      stream.write(`[duration_ms ${durationMs}]${os.EOL}`);
      activeChildren.delete(child);
      stream.end(() => resolve({ command, code: finalCode, logFile, timedOut, durationMs }));
    });
  });
}

function logFileRoot(logFile) {
  return path.dirname(path.dirname(logFile));
}

async function runTaskCommands(task, cwd, logBase, timeoutMs) {
  const results = [];
  for (let index = 0; index < task.commands.length; index += 1) {
    const command = task.commands[index];
    const logFile = path.join(logBase, "commands", safeCommandName(command, index));
    appendEvent(logBase, "command.start", {
      command,
      log: path.relative(root, logFile)
    });
    const result = await runTaskCommand(command, cwd, logFile, timeoutMs);
    appendEvent(logBase, "command.finish", {
      command,
      code: result.code,
      timed_out: Boolean(result.timedOut),
      duration_ms: result.durationMs || 0,
      log: path.relative(root, logFile)
    });
    results.push(result);
    if (result.code !== 0) break;
  }
  return results;
}

function commandExists(command) {
  const result = runSync(command, ["--version"]);
  return result.status === 0 || Boolean(findExecutable(command));
}

function runCodex(prompt, cwd, logBase, task, suffix = "codex", timeoutMs = 0) {
  const promptHash = sha256Text(prompt);
  const promptFile = path.join(logBase, `${suffix}.prompt.md`);
  writeTextFileAtomic(promptFile, prompt);

  if (!commandExists("codex")) {
    appendEvent(logBase, "codex.unavailable", {
      suffix,
      prompt_hash: promptHash,
      prompt_file: path.relative(root, promptFile)
    });
    throw new Error("Codex CLI is not installed or not on PATH. Install/auth Codex or run with --no-codex.");
  }

  const outputFile = codexOutputFile(task, suffix);
  ensureDir(path.join(cwd, ".agent", suffix === "codex" ? "reports" : "tmp"));
  const args = [
    "exec",
    "--sandbox",
    "workspace-write",
    "--json",
    "--output-schema",
    ".agent/result-schema.json",
    "-o",
    outputFile,
    prompt
  ];

  return new Promise((resolve) => {
    const startedAtMs = Date.now();
    const stdoutFile = path.join(logBase, `${suffix}.jsonl`);
    const stderrFile = path.join(logBase, `${suffix}.stderr.log`);
    const resultCopyFile = path.join(logBase, `${suffix}.result.json`);
    appendEvent(logBase, "codex.start", {
      suffix,
      cwd,
      prompt_hash: promptHash,
      prompt_file: path.relative(root, promptFile),
      stdout: path.relative(root, stdoutFile),
      stderr: path.relative(root, stderrFile),
      output: outputFile,
      result_copy: path.relative(root, resultCopyFile),
      timeout_minutes: timeoutMs > 0 ? timeoutMs / 60000 : 0
    });
    const stdoutStream = fs.createWriteStream(stdoutFile, { flags: "w" });
    const stderrStream = fs.createWriteStream(stderrFile, { flags: "w" });
    const heartbeat = startHeartbeat(logBase, "codex.heartbeat", {
      suffix,
      prompt_hash: promptHash,
      stdout: path.relative(root, stdoutFile),
      stderr: path.relative(root, stderrFile)
    });
    const child = spawn("codex", args, {
      cwd,
      env: process.env,
      detached: process.platform !== "win32"
    });
    activeChildren.add(child);
    let settled = false;
    let killTimer = null;
    const timer = timeoutMs > 0
      ? setTimeout(() => {
        if (settled) return;
        killProcessTree(child, "SIGTERM");
        stderrStream.write(`[timeout] Codex worker exceeded ${Math.round(timeoutMs / 60000)} minute(s).${os.EOL}`);
        killTimer = setTimeout(() => {
          if (settled) return;
          killProcessTree(child, "SIGKILL");
          stderrStream.write("[timeout] Sent SIGKILL after grace period.\n");
        }, 5000);
      }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => stdoutStream.write(chunk));
    child.stderr.on("data", (chunk) => stderrStream.write(chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      stopHeartbeat(heartbeat);
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      stderrStream.write(`[spawn error] ${error.message}${os.EOL}`);
      const durationMs = Date.now() - startedAtMs;
      appendEvent(logBase, "codex.error", {
        suffix,
        code: 127,
        prompt_hash: promptHash,
        error: error.message,
        duration_ms: durationMs
      });
      activeChildren.delete(child);
      stdoutStream.end();
      stderrStream.end();
      const copiedResultFile = copyCodexResult(outputFile, cwd, resultCopyFile, logBase, suffix);
      resolve({ suffix, code: 127, promptHash, promptFile, stdoutFile, stderrFile, outputFile: path.join(cwd, outputFile), resultCopyFile: copiedResultFile, durationMs });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      stopHeartbeat(heartbeat);
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      const timedOut = Boolean(killTimer);
      const durationMs = Date.now() - startedAtMs;
      appendEvent(logBase, "codex.finish", {
        suffix,
        code: timedOut ? 124 : code,
        timed_out: timedOut,
        prompt_hash: promptHash,
        output: outputFile,
        duration_ms: durationMs
      });
      activeChildren.delete(child);
      stdoutStream.end();
      stderrStream.end();
      const copiedResultFile = copyCodexResult(outputFile, cwd, resultCopyFile, logBase, suffix);
      resolve({ suffix, code: timedOut ? 124 : code, promptHash, promptFile, stdoutFile, stderrFile, outputFile: path.join(cwd, outputFile), resultCopyFile: copiedResultFile, timedOut, durationMs });
    });
  });
}

function copyCodexResult(outputFile, cwd, resultCopyFile, logBase, suffix) {
  const absoluteOutput = path.join(cwd, outputFile);
  if (!fs.existsSync(absoluteOutput)) return null;
  try {
    fs.copyFileSync(absoluteOutput, resultCopyFile);
    appendEvent(logBase, "codex.result_copied", {
      suffix,
      source: relativeToCwdOrRoot(absoluteOutput, cwd),
      copy: path.relative(root, resultCopyFile)
    });
    return resultCopyFile;
  } catch (error) {
    appendEvent(logBase, "codex.result_copy_failed", {
      suffix,
      source: relativeToCwdOrRoot(absoluteOutput, cwd),
      error: error.message
    });
    return null;
  }
}

function codexOutputFile(task, suffix) {
  return suffix === "codex"
    ? `.agent/reports/${task.id}.result.json`
    : `.agent/tmp/${task.id}.${suffix}.result.json`;
}

function tailLines(file, count = 20) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .trimEnd()
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-count);
}

function taskLogSummary(taskId) {
  const logBase = path.join(agentDir, "logs", taskId);
  const commandDir = path.join(logBase, "commands");
  const manifestPath = path.join(logBase, "run.json");
  const archiveDir = path.join(agentDir, "logs", "archive", taskId);
  const reportFiles = [
    path.join(agentDir, "reports", `${taskId}.md`),
    path.join(agentDir, "reports", `${taskId}.result.json`)
  ].filter((file) => fs.existsSync(file));
  const commandLogs = fs.existsSync(commandDir)
    ? fs.readdirSync(commandDir).filter((file) => file.endsWith(".log")).sort().map((file) => path.join(commandDir, file))
    : [];
  const rootLogFiles = fs.existsSync(logBase)
    ? fs.readdirSync(logBase)
      .map((file) => path.join(logBase, file))
      .filter((file) => fs.statSync(file).isFile())
      .sort()
    : [];
  const files = [...rootLogFiles, ...commandLogs];
  const archived_runs = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir)
      .sort()
      .map((entry) => path.join(archiveDir, entry))
      .filter((entryPath) => fs.statSync(entryPath).isDirectory())
      .map((entryPath) => ({
        dir: path.relative(root, entryPath),
        manifest: readJsonIfExists(path.join(entryPath, "run.json")),
        events: fs.existsSync(path.join(entryPath, "events.jsonl"))
          ? path.relative(root, path.join(entryPath, "events.jsonl"))
          : null
      }))
    : [];
  return {
    task_id: taskId,
    log_dir: path.relative(root, logBase),
    exists: fs.existsSync(logBase),
    reports: reportFiles.map((file) => path.relative(root, file)),
    files: files.filter((file) => fs.existsSync(file)).map((file) => path.relative(root, file)),
    archived_runs,
    manifest: readJsonIfExists(manifestPath),
    latest_events: tailLines(eventLogPath(logBase), 20).map(parseEventLine)
  };
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function parseEventLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return { raw: line };
  }
}

function formatEvent(event) {
  if (event.raw) return event.raw;
  const details = Object.entries(event)
    .filter(([key]) => key !== "at" && key !== "type")
    .map(([key, value]) => `${key}=${formatEventValue(value)}`)
    .join(" ");
  return `- ${event.at || "unknown-time"} ${event.type || "event"}${details ? ` ${details}` : ""}`;
}

function formatEventValue(value) {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDurationMs(durationMs) {
  if (!Number.isFinite(durationMs)) return "unknown duration";
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function shortHash(hash) {
  return typeof hash === "string" && hash.length >= 12 ? hash.slice(0, 12) : "none";
}

function durationSinceIso(startedAt) {
  const startedMs = Date.parse(startedAt || "");
  if (Number.isNaN(startedMs)) return 0;
  return Math.max(0, Date.now() - startedMs);
}

function printTaskLogs(tasks, taskId, json = false) {
  if (!tasks.some((task) => task.id === taskId)) throw new Error(`Task not found: ${taskId}`);
  const summary = taskLogSummary(taskId);
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log(`Logs for ${taskId}`);
  console.log(`directory: ${summary.log_dir}`);
  if (!summary.exists) {
    console.log("No logs found for this task yet.");
    return;
  }
  console.log("reports:");
  if (summary.reports.length) {
    for (const file of summary.reports) console.log(`- ${file}`);
  } else {
    console.log("- none");
  }
  console.log("files:");
  if (summary.files.length) {
    for (const file of summary.files) console.log(`- ${file}`);
  } else {
    console.log("- none");
  }
  if (summary.manifest) {
    console.log(`manifest_status: ${summary.manifest.status || "unknown"}`);
    console.log(`manifest_updated_at: ${summary.manifest.updated_at || "unknown"}`);
    console.log(`manifest_duration: ${Number.isFinite(summary.manifest.duration_ms) ? formatDurationMs(summary.manifest.duration_ms) : "unknown"}`);
    console.log(`task_contract_hash: ${shortHash(summary.manifest.task_contract_hash)}`);
    console.log(`worker_prompt_hash: ${shortHash(summary.manifest.worker_prompt_hash)}`);
    console.log(`cwd: ${summary.manifest.cwd || "unknown"}`);
    console.log(`worktree: ${summary.manifest.worktree || "none"}`);
    if (summary.manifest.summary) console.log(`summary: ${summary.manifest.summary}`);
    const gateWarnings = summary.manifest.command_gate_preflight?.command_gate_warnings || [];
    console.log(`command_gate_warnings: ${gateWarnings.length}`);
    for (const warning of gateWarnings.slice(0, 5)) console.log(`- ${warning}`);
  }
  console.log(`archived_runs: ${summary.archived_runs.length}`);
  for (const archive of summary.archived_runs.slice(-5)) {
    const status = archive.manifest?.status || "unknown";
    const updated = archive.manifest?.updated_at || "unknown";
    console.log(`- ${archive.dir} status=${status} updated_at=${updated}`);
  }
  console.log("latest events:");
  if (!summary.latest_events.length) {
    console.log("- none");
    return;
  }
  for (const event of summary.latest_events) console.log(formatEvent(event));
}

function failingCommandSummary(commandResults) {
  return commandResults
    .filter((result) => result.code !== 0)
    .map((result) => {
      const excerpt = fs.existsSync(result.logFile)
        ? fs.readFileSync(result.logFile, "utf8").split(/\r?\n/).slice(-80).join("\n")
        : "";
      return `Command failed: ${result.command}\nLog: ${result.logFile}\nExcerpt:\n${excerpt}`;
    })
    .join("\n\n");
}

function gitStatus(cwd) {
  const result = runSync("git", ["status", "--short"], { cwd });
  if (result.status !== 0) {
    throw new Error(`Could not read git status in ${cwd}: ${result.stderr || result.stdout || "unknown git error"}`);
  }
  return (result.stdout || "").trim();
}

function readChangedFiles(cwd) {
  return changedFilesFromStatus(gitStatus(cwd));
}

function tryReadChangedFiles(cwd) {
  try {
    return { files: readChangedFiles(cwd), error: null };
  } catch (error) {
    return { files: [], error: error.message };
  }
}

function changedFilesFromStatus(status) {
  if (!status) return [];
  return status.split(/\r?\n/)
    .flatMap((line) => {
      const file = line.slice(3).trim();
      if (!file) return [];
      const rename = file.split(" -> ");
      return rename.length === 2 ? rename : [file];
    })
    .filter(Boolean);
}

function normalizeRepoPath(file) {
  return file.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function isWithinPath(file, allowedPath) {
  const normalizedFile = normalizeRepoPath(file);
  const normalizedAllowed = normalizeRepoPath(allowedPath).replace(/\/+$/, "");
  return normalizedFile === normalizedAllowed || normalizedFile.startsWith(`${normalizedAllowed}/`);
}

function newChangedFiles(beforeFiles, afterFiles) {
  const before = new Set(beforeFiles.map(normalizeRepoPath));
  return afterFiles.map(normalizeRepoPath).filter((file) => !before.has(file));
}

function scopeViolations(task, files) {
  const implicitAllowed = [".agent/reports"];
  const allowed = [...(task.allowed_paths || []), ...implicitAllowed];
  const forbidden = task.forbidden_paths || [];
  const violations = [];

  for (const file of files) {
    const forbiddenMatch = forbidden.find((entry) => isWithinPath(file, entry));
    if (forbiddenMatch) {
      violations.push({ file, reason: `matches forbidden path ${forbiddenMatch}` });
      continue;
    }
    if (allowed.length && !allowed.some((entry) => isWithinPath(file, entry))) {
      violations.push({ file, reason: "outside allowed_paths" });
    }
  }

  return violations;
}

function relativeToCwdOrRoot(file, cwd) {
  const target = path.resolve(file);
  if (target.startsWith(`${cwd}${path.sep}`)) return path.relative(cwd, target);
  if (target.startsWith(`${root}${path.sep}`)) return path.relative(root, target);
  return target;
}

function commitIfNeeded(task, cwd) {
  let status;
  try {
    status = gitStatus(cwd);
  } catch (error) {
    return { committed: false, status: "", error: error.message };
  }
  if (!status) return { committed: false, status };

  const add = runSync("git", ["add", "-A"], { cwd });
  if (add.status !== 0) return { committed: false, status, error: add.stderr || add.stdout };

  const commit = runSync("git", ["commit", "-m", `agent: complete ${task.id} ${task.title}`], { cwd });
  if (commit.status !== 0) return { committed: false, status, error: commit.stderr || commit.stdout };
  const hash = runSync("git", ["rev-parse", "--short", "HEAD"], { cwd });
  return { committed: true, status, commit: (hash.stdout || "").trim() };
}

function reportMarkdown({ task, status, summary, filesChanged, commandResults, codexRuns = [], logBase, cwd, worktree, workerResult }) {
  const commandLines = commandReport(task, commandResults)
    .map((entry) => `- \`${entry.command}\`: ${entry.status}${entry.notes ? ` - ${entry.notes}` : ""}`)
    .join("\n");
  const codexLines = codexRuns.length
    ? codexRuns.map((result) => {
      const state = result.code === 0 ? "passed" : "failed";
      const timeout = result.timedOut ? " timed out" : "";
      const resultCopy = result.resultCopyFile ? `, result: ${relativeToCwdOrRoot(result.resultCopyFile, root)}` : "";
      const promptFile = result.promptFile ? `prompt: ${relativeToCwdOrRoot(result.promptFile, root)}, ` : "";
      return `- \`${result.suffix}\`: ${state}${timeout} in ${formatDurationMs(result.durationMs)} (${promptFile}stdout: ${relativeToCwdOrRoot(result.stdoutFile, cwd)}, stderr: ${relativeToCwdOrRoot(result.stderrFile, cwd)}${resultCopy})`;
    }).join("\n")
    : "- No Codex workers run.";
  const acceptanceLines = acceptanceReport(task, status, workerResult)
    .map((entry) => `- [${entry.status === "passed" ? "x" : " "}] ${entry.criterion} (${entry.status})${entry.notes ? ` - ${entry.notes}` : ""}`)
    .join("\n");
  const files = filesChanged.length ? filesChanged.map((file) => `- ${file}`).join("\n") : "- None detected.";
  const savedPromptFiles = fs.existsSync(logBase)
    ? fs.readdirSync(logBase).filter((file) => file.endsWith(".prompt.md")).sort().map((file) => path.join(logBase, file))
    : [];
  const promptTrace = codexRuns.length
    ? codexRuns.map((result) => {
      const promptFile = result.promptFile ? relativeToCwdOrRoot(result.promptFile, root) : "unknown";
      return `- \`${result.suffix}\`: prompt_hash=${result.promptHash || "unknown"}, prompt_file=${promptFile}`;
    }).join("\n")
    : savedPromptFiles.length
      ? savedPromptFiles.map((file) => `- \`${path.basename(file, ".prompt.md")}\`: prompt_hash=${sha256Text(fs.readFileSync(file, "utf8"))}, prompt_file=${relativeToCwdOrRoot(file, root)}`).join("\n")
      : "- No Codex prompt saved.";
  const failures = commandResults.filter((result) => result.code !== 0);
  const failureDetails = failures.length
    ? failures.map((result) => {
      const excerpt = fs.existsSync(result.logFile)
        ? fs.readFileSync(result.logFile, "utf8").split(/\r?\n/).slice(-40).join("\n")
        : "No log file found.";
      return `### ${result.command}\n\n\`\`\`text\n${excerpt}\n\`\`\``;
    }).join("\n\n")
    : "No failing command logs.";

  return `# ${task.id}: ${task.title}

Status: ${status}

## Summary

${summary}

## Files Changed

${files}

## Traceability

- task_contract_hash: ${taskContractHash(task)}
- task_contract_file: ${path.relative(root, path.join(logBase, "task.json"))}

Codex prompts:

${promptTrace}

## Codex Runs

${codexLines}

## Commands Run

${commandLines}

## Acceptance Checklist

${acceptanceLines}

## Remaining Work

${status === "passed" ? "- None." : "- Review failed command logs and rerun after repair."}

## Failure Details

${failureDetails}

## Logs

- ${path.relative(root, logBase)}
- manifest: ${path.relative(root, path.join(logBase, "run.json"))}
- events: ${path.relative(root, eventLogPath(logBase))}
- command logs: ${path.relative(root, path.join(logBase, "commands"))}

## Branch / Worktree

- branch: ${task.branch}
- worktree: ${worktree || cwd}
`;
}

function writeMarkdownReport(input) {
  const content = reportMarkdown(input);
  const reportTargets = [path.join(root, ".agent", "reports", `${input.task.id}.md`)];
  if (!input.rootOnly && input.cwd !== root) reportTargets.push(path.join(input.cwd, ".agent", "reports", `${input.task.id}.md`));
  for (const reportPath of reportTargets) {
    ensureDir(path.dirname(reportPath));
    writeTextFileAtomic(reportPath, content);
  }
}

function commandReport(task, commandResults) {
  const byCommand = new Map(commandResults.map((result) => [result.command, result]));
  const reported = new Set();
  const entries = task.commands.map((command) => {
    const result = byCommand.get(command);
    if (!result) {
      return {
        command,
        status: "skipped",
        notes: "Command gate did not run."
      };
    }
    reported.add(command);
    return {
      command: result.command,
      status: result.code === 0 ? "passed" : "failed",
      notes: [
        result.timedOut ? "Timed out." : "",
        Number.isFinite(result.durationMs) ? `Duration: ${formatDurationMs(result.durationMs)}.` : "",
        result.logFile ? `Log: ${relativeToCwdOrRoot(result.logFile, root)}` : ""
      ].filter(Boolean).join(" ")
    };
  });

  for (const result of commandResults) {
    if (reported.has(result.command) || task.commands.includes(result.command)) continue;
    entries.push({
      command: result.command,
      status: result.code === 0 ? "passed" : "failed",
      notes: [
        "Command was not declared in the task contract.",
        result.timedOut ? "Timed out." : "",
        Number.isFinite(result.durationMs) ? `Duration: ${formatDurationMs(result.durationMs)}.` : "",
        result.logFile ? `Log: ${relativeToCwdOrRoot(result.logFile, root)}` : ""
      ].filter(Boolean).join(" ")
    });
  }

  return entries;
}

function codexRunReport(codexRuns, cwd) {
  return codexRuns.map((result) => ({
    suffix: result.suffix,
    status: result.code === 0 ? "passed" : "failed",
    exit_code: result.code,
    timed_out: Boolean(result.timedOut),
    duration_ms: result.durationMs || 0,
    ...(result.promptHash ? { prompt_hash: result.promptHash } : {}),
    prompt_file: result.promptFile ? relativeToCwdOrRoot(result.promptFile, root) : "",
    stdout: result.stdoutFile ? relativeToCwdOrRoot(result.stdoutFile, cwd) : "",
    stderr: result.stderrFile ? relativeToCwdOrRoot(result.stderrFile, cwd) : "",
    output: result.outputFile ? relativeToCwdOrRoot(result.outputFile, cwd) : "",
    result_copy: result.resultCopyFile ? relativeToCwdOrRoot(result.resultCopyFile, root) : null
  }));
}

const acceptanceStatuses = new Set(["passed", "failed", "partial", "blocked", "unverified"]);

function normalizeWorkerAcceptance(task, workerResult) {
  if (!workerResult || !Array.isArray(workerResult.acceptance_results)) return null;
  const byCriterion = new Map();
  for (const entry of workerResult.acceptance_results) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.criterion !== "string" || !acceptanceStatuses.has(entry.status)) continue;
    byCriterion.set(entry.criterion, {
      criterion: entry.criterion,
      status: entry.status,
      notes: typeof entry.notes === "string" ? entry.notes : "Worker report."
    });
  }
  const normalized = [];
  for (const criterion of task.acceptance) {
    const entry = byCriterion.get(criterion);
    if (!entry) return null;
    normalized.push(entry);
  }
  return normalized;
}

function workerAcceptanceIssues(task, workerResult) {
  if (!workerResult) return ["Worker result JSON was missing or unreadable."];
  const normalized = normalizeWorkerAcceptance(task, workerResult);
  if (!normalized) return ["Worker result JSON did not cover every task acceptance criterion."];
  return normalized
    .filter((entry) => entry.status !== "passed")
    .map((entry) => `${entry.criterion}: ${entry.status}`);
}

function acceptanceReport(task, status, workerResult = null) {
  const workerAcceptance = normalizeWorkerAcceptance(task, workerResult);
  if (workerAcceptance) return workerAcceptance;
  return task.acceptance.map((criterion) => ({
    criterion,
    status: status === "passed" ? "passed" : "unverified",
    notes: status === "passed" ? "Command gates passed." : "Review the Markdown report and command logs."
  }));
}

function writeResultJson({ task, status, summary, filesChanged, commandResults, cwd, rootOnly = false, workerResult = null }) {
  const result = {
    task_id: task.id,
    status,
    summary,
    files_changed: filesChanged,
    commands_run: commandReport(task, commandResults),
    acceptance_results: acceptanceReport(task, status, workerResult),
    remaining_work: status === "passed" ? [] : ["Review logs and rerun after fixing the blocker or failing command."],
    risks: status === "passed" ? [] : [summary],
    next_recommended_task: null
  };
  const targets = [path.join(root, ".agent", "reports", `${task.id}.result.json`)];
  if (!rootOnly && cwd !== root) targets.push(path.join(cwd, ".agent", "reports", `${task.id}.result.json`));
  for (const target of targets) {
    ensureDir(path.dirname(target));
    writeJson(target, result);
  }
}

async function executeTask(task, args) {
  if (args.dryRun || args.noCodex) {
    const preview = taskRunPreview(task, args);
    const target = preview.workdir;
    console.log(`${args.dryRun ? "Dry run" : "No Codex"}: ${task.id}`);
    console.log(`title: ${task.title}`);
    console.log(`lane: ${task.lane}`);
    console.log(`branch: ${task.branch}`);
    console.log(`task_contract_hash: ${preview.task_contract_hash}`);
    console.log(`prompt_hash: ${preview.prompt_hash}`);
    console.log(`workdir: ${target}`);
    console.log(`depends_on: ${task.depends_on.length ? task.depends_on.join(", ") : "none"}`);
    console.log(`allowed_paths: ${task.allowed_paths.length ? task.allowed_paths.join(", ") : "none"}`);
    console.log(`forbidden_paths: ${task.forbidden_paths.length ? task.forbidden_paths.join(", ") : "none"}`);
    console.log(`max_attempts: ${task.max_attempts}`);
    console.log(`codex_timeout_minutes: ${args.codexTimeoutMinutes}`);
    console.log(`command_timeout_minutes: ${args.commandTimeoutMinutes}`);
    console.log(`worktree_preflight: ${preview.worktree_preflight.status} - ${preview.worktree_preflight.message}`);
    if (preview.worktree_preflight.missing?.length) {
      console.log("worktree_preflight_missing:");
      for (const file of preview.worktree_preflight.missing) console.log(`- ${file}`);
    }
    console.log("commands:");
    for (const command of task.commands) console.log(`- ${command}`);
    console.log("command gate preflight:");
    for (const gate of preview.command_gates) {
      const executable = gate.executable_available ? "executable ok" : "executable missing";
      const parse = gate.command_parse_error ? `parse error: ${gate.command_parse_error}` : "parse ok";
      const referencedFile = gate.referenced_file
        ? `, file ${gate.referenced_file_available ? "ok" : "missing"}`
        : "";
      const script = gate.package_script
        ? `, npm script ${gate.package_script_available ? "ok" : "missing"}`
        : "";
      console.log(`- ${gate.command}: ${parse}, ${executable}${referencedFile}${script}`);
    }
    console.log("command gate warnings:");
    if (preview.command_gate_warnings.length) {
      for (const warning of preview.command_gate_warnings) console.log(`- ${warning}`);
    } else {
      console.log("- none");
    }
    if (args.printPrompt) {
      console.log("\n--- worker prompt ---");
      console.log(assemblePrompt(task, root));
      console.log("--- end worker prompt ---");
    }
    return { status: args.dryRun ? "dry-run" : "no-codex", attempts: 0 };
  }

  const logBase = makeTaskLogDirs(task);
  const state = loadState();
  const runId = crypto.randomUUID();

  const archivedLogDir = archiveExistingTaskLogDir(logBase, task, runId);
  cleanTaskLogDir(logBase);
  resetEventLog(logBase);
  const taskContractFile = path.join(logBase, "task.json");
  writeJson(taskContractFile, stripRuntimeFields(task));
  appendEvent(logBase, "logs.reset", {
    run_id: runId,
    log_dir: path.relative(root, logBase),
    archived_previous_log_dir: archivedLogDir ? path.relative(root, archivedLogDir) : null
  });
  appendEvent(logBase, "task.snapshot", {
    file: path.relative(root, taskContractFile),
    task_contract_hash: taskContractHash(task)
  });
  appendEvent(logBase, "task.start", {
    run_id: runId,
    task_id: task.id,
    title: task.title,
    branch: task.branch,
    task_contract_hash: taskContractHash(task),
    no_worktree: Boolean(args.noWorktree)
  });
  markRunning(state, task);
  appendEvent(logBase, "state.running", { task_id: task.id });
  const manifest = {
    run_id: runId,
    task_id: task.id,
    status: "running",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    task_contract_hash: taskContractHash(task),
    task_contract_file: path.relative(root, taskContractFile),
    cwd: root,
    worktree: null,
    environment: environmentSnapshot(root),
    commands: task.commands,
    command_gate_preflight: taskCommandGatePreflight(task, root),
    attempts_used: 0,
    codex_timeout_minutes: args.codexTimeoutMinutes,
    command_timeout_minutes: args.commandTimeoutMinutes
  };
  writeRunManifest(logBase, manifest);
  currentRunContext = {
    task,
    logBase,
    manifest,
    attemptsUsed: 0
  };

  let commandResults = [];
  let attemptsUsed = 0;
  let cwd = root;
  let worktree = null;
  let status = "failed";
  let summary = "";
  let baselineFiles = [];
  let codexRuns = [];
  let workerResult = null;

  try {
    if (!args.noWorktree) assertHarnessCommittedForWorktree(task);
    cwd = args.noWorktree ? root : createWorktree(task);
    worktree = args.noWorktree ? null : cwd;
    appendEvent(logBase, "worktree.ready", {
      cwd,
      worktree
    });
    assertHarnessAvailable(cwd, task);
    manifest.cwd = cwd;
    manifest.worktree = worktree;
    manifest.environment = environmentSnapshot(cwd);
    manifest.command_gate_preflight = taskCommandGatePreflight(task, cwd);
    manifest.updated_at = new Date().toISOString();
    writeRunManifest(logBase, manifest);
    baselineFiles = readChangedFiles(cwd);
    manifest.baseline_changed_files = baselineFiles;
    manifest.updated_at = new Date().toISOString();
    writeRunManifest(logBase, manifest);
    appendEvent(logBase, "git.baseline", {
      changed_files: baselineFiles
    });
    if (args.noWorktree && baselineFiles.length && !args.allowDirty) {
      throw new Error(`Current checkout has uncommitted changes: ${baselineFiles.join(", ")}. Use a worktree or pass --allow-dirty intentionally.`);
    }
    const prompt = assemblePrompt(task, cwd);
    manifest.worker_prompt_hash = sha256Text(prompt);
    manifest.updated_at = new Date().toISOString();
    writeRunManifest(logBase, manifest);
    appendEvent(logBase, "prompt.ready", {
      task_contract_hash: manifest.task_contract_hash,
      prompt_hash: manifest.worker_prompt_hash
    });
    const codexTimeoutMs = Math.max(0, args.codexTimeoutMinutes || 0) * 60 * 1000;
    const codexResult = await runCodex(prompt, cwd, logBase, task, "codex", codexTimeoutMs);
    codexRuns.push(codexResult);
    workerResult = readJsonIfExists(codexResult.resultCopyFile || codexResult.outputFile);

    status = codexResult.code === 0 ? "passed" : "failed";
    summary = codexResult.code === 0
      ? `Worker completed for ${task.id}.`
      : `Worker failed for ${task.id} with exit code ${codexResult.code}${codexResult.timedOut ? " after timeout" : ""}.`;

    if (codexResult.code === 0) {
      const commandTimeoutMs = Math.max(0, args.commandTimeoutMinutes || 0) * 60 * 1000;
      commandResults = await runTaskCommands(task, cwd, logBase, commandTimeoutMs);
      let failing = commandResults.filter((result) => result.code !== 0);

      while (failing.length && attemptsUsed < task.max_attempts) {
        attemptsUsed += 1;
        currentRunContext.attemptsUsed = attemptsUsed;
        appendEvent(logBase, "repair.start", {
          attempt: attemptsUsed,
          failing_commands: failing.map((result) => result.command)
        });
        const repairPrompt = assemblePrompt(
          task,
          cwd,
          "repair",
          `\nFailed command logs:\n\n${failingCommandSummary(commandResults)}`
        );
        const repair = await runCodex(repairPrompt, cwd, logBase, task, `repair-${attemptsUsed}`, codexTimeoutMs);
        codexRuns.push(repair);
        if (repair.code === 0) workerResult = readJsonIfExists(repair.resultCopyFile || repair.outputFile) || workerResult;
        appendEvent(logBase, "repair.finish", {
          attempt: attemptsUsed,
          code: repair.code,
          timed_out: Boolean(repair.timedOut)
        });
        if (repair.code !== 0) break;
        commandResults = await runTaskCommands(task, cwd, logBase, commandTimeoutMs);
        failing = commandResults.filter((result) => result.code !== 0);
      }

      status = failing.length ? "failed" : "passed";
      summary = status === "passed"
        ? `Task ${task.id} passed all command gates.`
        : `Task ${task.id} still has failing command gates after ${attemptsUsed} repair attempt(s).`;
    }
  } catch (error) {
    status = "blocked";
    summary = `Task ${task.id} blocked: ${error.message}`;
    appendEvent(logBase, "task.blocked", {
      summary,
      duration_ms: durationSinceIso(manifest.started_at)
    });
    const finishedAt = new Date().toISOString();
    manifest.status = status;
    manifest.updated_at = finishedAt;
    manifest.finished_at = finishedAt;
    manifest.duration_ms = durationSinceIso(manifest.started_at);
    manifest.summary = summary;
    manifest.attempts_used = attemptsUsed;
    manifest.codex_runs = codexRunReport(codexRuns, cwd);
    manifest.commands_run = commandReport(task, commandResults);
    writeRunManifest(logBase, manifest);
    writeResultJson({ task, status, summary, filesChanged: [], commandResults, cwd, workerResult });
    writeMarkdownReport({
      task,
      status,
      summary,
      filesChanged: [],
      commandResults,
      codexRuns,
      logBase,
      cwd,
      worktree,
      workerResult
    });
    finishState(loadState(), task, status, summary, attemptsUsed);
    currentRunContext = null;
    throw error;
  }

  const finalStatus = tryReadChangedFiles(cwd);
  if (finalStatus.error) {
    status = status === "passed" ? "partial" : status;
    summary = `${summary} Could not read final git status: ${finalStatus.error}`;
    appendEvent(logBase, "git.status_failed", { error: finalStatus.error });
  }
  let filesChanged = typeof baselineFiles === "undefined"
    ? finalStatus.files
    : newChangedFiles(baselineFiles, finalStatus.files);
  const violations = scopeViolations(task, filesChanged);
  if (violations.length) {
    status = status === "passed" ? "partial" : status;
    summary = `${summary} Scope violations: ${violations.map((item) => `${item.file} (${item.reason})`).join("; ")}`;
    appendEvent(logBase, "scope.violation", {
      violations
    });
  }
  const acceptanceIssues = status === "passed" ? workerAcceptanceIssues(task, workerResult) : [];
  if (acceptanceIssues.length) {
    status = "partial";
    summary = `${summary} Worker acceptance report was incomplete or not fully passed: ${acceptanceIssues.join("; ")}`;
    appendEvent(logBase, "acceptance.partial", {
      issues: acceptanceIssues
    });
  }

  writeResultJson({ task, status, summary, filesChanged, commandResults, cwd, workerResult });
  writeMarkdownReport({
    task,
    status,
    summary,
    filesChanged,
    commandResults,
    codexRuns,
    logBase,
    cwd,
    worktree,
    workerResult
  });

  const postReportStatus = tryReadChangedFiles(cwd);
  if (postReportStatus.error) {
    status = status === "passed" ? "partial" : status;
    summary = `${summary} Could not read post-report git status: ${postReportStatus.error}`;
    appendEvent(logBase, "git.status_failed", { phase: "post-report", error: postReportStatus.error });
  } else {
    filesChanged = newChangedFiles(baselineFiles, postReportStatus.files);
  }
  writeMarkdownReport({
    task,
    status,
    summary,
    filesChanged,
    commandResults,
    codexRuns,
    logBase,
    cwd,
    worktree,
    workerResult
  });
  writeResultJson({ task, status, summary, filesChanged, commandResults, cwd, workerResult });

  if (status === "passed" && worktree) {
    appendEvent(logBase, "commit.start", {
      branch: task.branch,
      cwd
    });
    const commit = commitIfNeeded(task, cwd);
    appendEvent(logBase, "commit.finish", {
      committed: Boolean(commit.committed),
      commit: commit.commit || null,
      error: commit.error || null
    });
    if (commit.error) {
      status = "partial";
      summary = `Checks passed, but committing changes failed: ${commit.error}`;
      filesChanged = tryReadChangedFiles(cwd).files;
      writeMarkdownReport({
        task,
        status,
        summary,
        filesChanged,
        commandResults,
        codexRuns,
        logBase,
        cwd,
        worktree,
        workerResult
      });
      writeResultJson({ task, status, summary, filesChanged, commandResults, cwd, workerResult });
    } else if (commit.committed) {
      summary = `${summary} Committed ${commit.commit}.`;
      writeMarkdownReport({
        task,
        status,
        summary,
        filesChanged,
        commandResults,
        codexRuns,
        logBase,
        cwd,
        worktree,
        workerResult,
        rootOnly: true
      });
      writeResultJson({ task, status, summary, filesChanged, commandResults, cwd, rootOnly: true, workerResult });
    }
  }

  finishState(loadState(), task, status, summary, attemptsUsed);
  currentRunContext = null;
  appendEvent(logBase, "state.finished", {
    status,
    attempts_used: attemptsUsed,
    duration_ms: durationSinceIso(manifest.started_at)
  });
  const finishedAt = new Date().toISOString();
  manifest.status = status;
  manifest.updated_at = finishedAt;
  manifest.finished_at = finishedAt;
  manifest.duration_ms = durationSinceIso(manifest.started_at);
  manifest.summary = summary;
  manifest.attempts_used = attemptsUsed;
  manifest.codex_runs = codexRunReport(codexRuns, cwd);
  manifest.commands_run = commandReport(task, commandResults);
  manifest.files_changed = filesChanged;
  writeRunManifest(logBase, manifest);
  return { status, attempts: attemptsUsed };
}

async function main() {
  installSignalHandlers();
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(1);
  }

  if (args.help) {
    usage();
    return;
  }

  if (args.doctor) {
    process.exit(runDoctor({ json: args.json, strict: args.strict }));
  }

  validateHarness({ strict: args.strict });
  const tasks = loadTasks();
  const state = loadState();

  if (args.resetRunning) {
    const result = resetRunningState(state, args);
    if (result.status === "blocked") process.exitCode = 1;
    return;
  }

  if (args.reconcileState) {
    const result = reconcileStateFromReports(tasks, state, args);
    if (result.status === "blocked") process.exitCode = 1;
    return;
  }

  if (args.cleanupStale) {
    cleanupStaleArtifacts(args);
    return;
  }

  if (args.status) {
    printStatus(tasks, state, args.json);
    return;
  }

  if (args.list) {
    listTasks(tasks, state, { json: args.json, readyOnly: args.readyOnly });
    return;
  }

  if (args.show) {
    showTask(tasks, state, args.show, args.json);
    return;
  }

  if (args.logs) {
    printTaskLogs(tasks, args.logs, args.json);
    return;
  }

  if (args.scopeCheck) {
    const passed = scopeCheckTask(tasks, args.scopeCheck, args.json);
    if (!passed) process.exitCode = 1;
    return;
  }

  if (args.graph) {
    printGraph(tasks, state, args.json);
    return;
  }

  const selected = selectTasks(args, tasks, state);
  if ((args.dryRun || args.noCodex) && args.json) {
    console.log(JSON.stringify({
      mode: args.dryRun ? "dry-run" : "no-codex",
      tasks: selected.map((task) => taskRunPreview(task, args))
    }, null, 2));
    return;
  }
  const needsLock = !args.dryRun && !args.noCodex;
  if (needsLock) acquireLock();
  if (needsLock) lockHeld = true;
  let lastStatus = "passed";
  for (const task of selected) {
    const result = await executeTask(task, args);
    lastStatus = result.status;
    if (args.all && !["passed", "dry-run", "no-codex"].includes(result.status)) break;
  }
  if (lockHeld) {
    releaseLock();
    lockHeld = false;
  }
  if (!["passed", "dry-run", "no-codex"].includes(lastStatus)) process.exitCode = 1;
}

main().catch((error) => {
  if (lockHeld) releaseLock();
  console.error(error.message);
  process.exit(1);
});
