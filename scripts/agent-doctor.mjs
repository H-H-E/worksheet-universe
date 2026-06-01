#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectStaleArtifacts } from "./agent-cleanup-utils.mjs";
import { requiredHarnessFiles } from "./agent-harness-files.mjs";
import { findExecutable } from "./agent-preflight.mjs";
import { promptHash, taskContractHash } from "./agent-trace-utils.mjs";
import { validateHarnessFiles } from "./agent-validate.mjs";

const root = process.cwd();
const packageScripts = ["lint", "typecheck", "test", "build", "test:e2e"];

function commandResult(command, args = []) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  return {
    command,
    ok: !result.error && result.status === 0,
    status: result.error ? 1 : result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || result.error?.message || "").trim(),
    error: result.error
  };
}

function detectPackageManager() {
  const lockfiles = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"]
  ];
  for (const [file, manager] of lockfiles) {
    if (fs.existsSync(path.join(root, file))) return manager;
  }
  return fs.existsSync(path.join(root, "package.json")) ? "npm" : "none";
}

function readPackageJson() {
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) return { present: false, value: null, error: null };
  try {
    return { present: true, value: JSON.parse(fs.readFileSync(file, "utf8")), error: null };
  } catch (error) {
    return { present: true, value: null, error: error.message };
  }
}

function listFiles(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(predicate);
}

function hasAny(files) {
  return files.some((file) => fs.existsSync(path.join(root, file)));
}

function detectFramework(pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  if (deps.next) return "Next.js";
  if (deps.vite || fs.existsSync(path.join(root, "vite.config.ts")) || fs.existsSync(path.join(root, "vite.config.js"))) return "Vite";
  if (deps.react) return "React";
  if (fs.existsSync(path.join(root, "index.html")) && fs.existsSync(path.join(root, "app.js"))) return "static HTML/CSS/JS";
  return "unknown";
}

function detectTypeScript() {
  return hasAny(["tsconfig.json"]) || listFiles(root, (file) => file.endsWith(".ts") || file.endsWith(".tsx")).length > 0;
}

function checkHarnessFolders() {
  return [".agent", ".agent/queue", ".agent/prompts", ".agent/reports", ".agent/logs", ".agent/tmp"]
    .map((dir) => ({ dir, exists: fs.existsSync(path.join(root, dir)) }));
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
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

function readLockInfo() {
  const lockPath = path.join(root, ".agent", "tmp", "runner.lock");
  if (!fs.existsSync(lockPath)) return null;
  const lock = readJsonIfExists(lockPath);
  if (!lock || typeof lock !== "object" || Array.isArray(lock)) {
    return { present: true, readable: false };
  }
  return {
    ...lock,
    present: true,
    readable: true,
    process_alive: Number.isInteger(lock.pid) ? isProcessAlive(lock.pid) : null
  };
}

function stateSummary() {
  const state = readJsonIfExists(path.join(root, ".agent", "state.json"));
  if (!state) return { present: false };
  const lockInfo = readLockInfo();
  const bucketCounts = {
    running: state.current_task ? 1 : 0,
    completed: Array.isArray(state.completed) ? state.completed.length : 0,
    failed: Array.isArray(state.failed) ? state.failed.length : 0,
    partial: Array.isArray(state.partial) ? state.partial.length : 0,
    blocked: Array.isArray(state.blocked) ? state.blocked.length : 0
  };
  return {
    present: true,
    current_task: state.current_task || null,
    started_at: state.started_at || null,
    updated_at: state.updated_at || null,
    last_run_summary: state.last_run_summary || null,
    bucket_counts: bucketCounts,
    lock_exists: Boolean(lockInfo),
    lock_info: lockInfo
  };
}

function loadQueueTasks() {
  const queueDir = path.join(root, ".agent", "queue");
  if (!fs.existsSync(queueDir)) return [];
  return fs.readdirSync(queueDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => readJsonIfExists(path.join(queueDir, file)))
    .filter((task) => task && typeof task === "object" && !Array.isArray(task))
    .sort((a, b) => (a.priority || 0) - (b.priority || 0) || String(a.id).localeCompare(String(b.id)));
}

function queueStatusForTask(task, tasks, state) {
  if (state?.current_task === task.id) return "running";
  if (Array.isArray(state?.completed) && state.completed.includes(task.id)) return "passed";
  if (Array.isArray(state?.failed) && state.failed.includes(task.id)) return "failed";
  if (Array.isArray(state?.partial) && state.partial.includes(task.id)) return "partial";
  if (Array.isArray(state?.blocked) && state.blocked.includes(task.id)) return "blocked";
  if (task.status === "passed") return "passed";
  return task.status || "pending";
}

function queueTaskComplete(taskId, tasks, state) {
  return (Array.isArray(state?.completed) && state.completed.includes(taskId))
    || tasks.some((task) => task.id === taskId && task.status === "passed");
}

function taskRunCommand(taskId, suffix = "") {
  return taskId ? `node scripts/agent-runner.mjs --task ${taskId}${suffix}` : null;
}

function queueSummary() {
  const tasks = loadQueueTasks();
  const state = readJsonIfExists(path.join(root, ".agent", "state.json")) || {};
  const counts = { pending: 0, running: 0, passed: 0, failed: 0, partial: 0, blocked: 0 };
  const rows = tasks.map((task) => {
    const status = queueStatusForTask(task, tasks, state);
    if (status in counts) counts[status] += 1;
    const blockedBy = Array.isArray(task.depends_on)
      ? task.depends_on.filter((dependency) => !queueTaskComplete(dependency, tasks, state))
      : [];
    return {
      id: task.id,
      status,
      ready: status === "pending" && blockedBy.length === 0,
      blocked_by: blockedBy
    };
  });
  const ready = rows.filter((task) => task.ready).map((task) => task.id);
  const nextTask = ready[0] ? tasks.find((task) => task.id === ready[0]) : null;
  const nextTaskId = nextTask?.id || null;
  return {
    total: tasks.length,
    counts,
    ready,
    next_task: nextTaskId,
    next_task_contract_hash: nextTask ? taskContractHash(nextTask) : null,
    next_prompt_hash: nextTask ? promptHash(nextTask, root) : null,
    next_command: taskRunCommand(nextTaskId),
    next_dry_run_command: taskRunCommand(nextTaskId, " --dry-run --strict"),
    next_current_checkout_command: taskRunCommand(nextTaskId, " --no-worktree --allow-dirty --strict"),
    next_current_checkout_dry_run_command: taskRunCommand(nextTaskId, " --no-worktree --allow-dirty --dry-run --strict")
  };
}

function checkHarnessCommittedForWorktrees() {
  if (!fs.existsSync(path.join(root, ".git"))) {
    return { status: "not_git_repo", missing: [], note: "No .git directory found." };
  }
  const missing = [];
  for (const file of requiredHarnessFiles(root)) {
    const result = commandResult("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", file]);
    if (result.error?.code === "EPERM") {
      return {
        status: "unknown",
        missing: [],
        note: `Git check blocked: ${result.stderr || result.error.message}`
      };
    }
    if (result.status !== 0 || result.stdout.trim() !== file) missing.push(file);
  }
  return {
    status: missing.length ? "fail" : "pass",
    missing,
    note: missing.length
      ? "Commit these files before using default worktree mode."
      : "Harness files needed by worktree mode are present in HEAD."
  };
}

function formatCommandCheck(result, okFallback) {
  if (result.ok) return result.stdout || okFallback;
  if (result.error?.code === "EPERM") {
    const executable = findExecutable(result.command);
    return executable
      ? `found at ${executable}; version check blocked (${result.stderr})`
      : `version check blocked (${result.stderr})`;
  }
  return result.stderr ? `not available (${result.stderr})` : "not available";
}

function formatGitRepoCheck(result) {
  if (result.ok) return result.stdout;
  if (fs.existsSync(path.join(root, ".git"))) {
    return `.git present; command check blocked (${result.stderr || "unknown error"})`;
  }
  return formatCommandCheck(result, "yes");
}

function buildDoctorSummary(options = {}) {
  const packageManager = detectPackageManager();
  const packageJson = readPackageJson();
  const pkg = packageJson.value;
  const scripts = pkg?.scripts || {};
  const git = commandResult("git", ["--version"]);
  const inRepo = commandResult("git", ["rev-parse", "--is-inside-work-tree"]);
  const codex = commandResult("codex", ["--version"]);
  const validation = validateHarnessFiles();
  const harnessCommitted = checkHarnessCommittedForWorktrees();
  const workflowDir = path.join(root, ".github", "workflows");
  const workflows = listFiles(workflowDir, (file) => file.endsWith(".yml") || file.endsWith(".yaml"));

  const validationFailed = validation.errors.length > 0 || (options.strict && validation.warnings.length > 0);
  const summary = {
    cwd: root,
    strict: Boolean(options.strict),
    node: process.version,
    package_manager: packageManager,
    package_json: packageJson.present,
    package_json_error: packageJson.error,
    framework: detectFramework(pkg),
    typescript: detectTypeScript(),
    agents_md: fs.existsSync(path.join(root, "AGENTS.md")),
    github_actions: workflows,
    queue: queueSummary(),
    scripts,
    recommended_missing_scripts: pkg ? packageScripts.filter((name) => !scripts[name]) : [],
    codex_cli: formatCommandCheck(codex, "available"),
    git: formatCommandCheck(git, "available"),
    inside_git_repo: formatGitRepoCheck(inRepo),
    harness_committed_for_worktrees: harnessCommitted,
    harness_folders: checkHarnessFolders(),
    state: stateSummary(),
    cleanup: inspectStaleArtifacts(root),
    validation: {
      status: validationFailed ? "fail" : "pass",
      tasks_checked: validation.taskFiles.length,
      results_checked: validation.resultFiles.length,
      markdown_reports_checked: validation.markdownReportFiles.length,
      run_manifests_checked: validation.runManifestFiles.length,
      archived_run_manifests_checked: validation.archivedRunManifestFiles.length,
      event_files_checked: validation.eventFiles.length,
      archived_event_files_checked: validation.archivedEventFiles.length,
      path_overlaps_checked: validation.pathOverlaps.length,
      errors: validation.errors,
      warnings: validation.warnings
    }
  };
  summary.warnings = doctorWarnings(summary);
  return summary;
}

function doctorWarnings(summary) {
  const warnings = [];
  if (!summary.package_json) {
    warnings.push("No package.json is present; use direct Node harness commands until a future task introduces package scripts.");
  }
  if (summary.package_json_error) {
    warnings.push(`package.json could not be parsed: ${summary.package_json_error}`);
  }
  if (summary.harness_committed_for_worktrees.status !== "pass") {
    warnings.push(`Default worktree mode may not be ready: ${summary.harness_committed_for_worktrees.note || summary.harness_committed_for_worktrees.status}`);
  }
  if (summary.state.present && summary.state.current_task && !summary.state.lock_exists) {
    warnings.push(`State has current_task ${summary.state.current_task} but no runner lock; inspect logs before --reset-running.`);
  }
  if (summary.state.present && !summary.state.current_task && summary.state.lock_exists) {
    warnings.push("Runner lock exists but state has no current task; inspect .agent/tmp/runner.lock before removing it.");
  }
  if (summary.state.lock_info?.readable === false) {
    warnings.push("Runner lock exists but is not readable JSON.");
  }
  if (summary.state.lock_info?.process_alive === false) {
    warnings.push(`Runner lock process ${summary.state.lock_info.pid} does not appear to be alive.`);
  }
  if (summary.validation.errors.length) {
    warnings.push("Harness validation is failing; fix validator errors before launching workers.");
  }
  if (summary.cleanup.stale_temp_file_count || summary.cleanup.empty_directory_count) {
    warnings.push(`Stale harness artifacts found; preview cleanup with ${summary.cleanup.cleanup_dry_run_command}.`);
  }
  for (const warning of summary.validation.warnings || []) {
    warnings.push(`Harness validation warning: ${warning}`);
  }
  return warnings;
}

export function runDoctor(options = {}) {
  const summary = buildDoctorSummary(options);
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return summary.validation.status === "fail" ? 1 : 0;
  }

  console.log("Agent harness doctor");
  console.log(`cwd: ${summary.cwd}`);
  console.log(`node: ${summary.node}`);
  console.log(`package manager: ${summary.package_manager}`);
  console.log(`package.json: ${summary.package_json ? (summary.package_json_error ? "malformed" : "present") : "not found"}`);
  if (summary.package_json_error) console.log(`package.json error: ${summary.package_json_error}`);
  console.log(`framework: ${summary.framework}`);
  console.log(`typescript: ${summary.typescript ? "present" : "not detected"}`);
  console.log(`AGENTS.md: ${summary.agents_md ? "present" : "not found"}`);
  console.log(`github actions: ${summary.github_actions.length ? summary.github_actions.join(", ") : "none"}`);
  console.log(`queue: ${summary.queue.total} task(s), next=${summary.queue.next_task || "none"}, next_task_hash=${shortHash(summary.queue.next_task_contract_hash)}, next_prompt_hash=${shortHash(summary.queue.next_prompt_hash)}, ready=${summary.queue.ready.length ? summary.queue.ready.join(", ") : "none"}`);
  if (summary.queue.next_task) {
    console.log(`next dry-run: ${summary.queue.next_dry_run_command}`);
    console.log(`next current-checkout dry-run: ${summary.queue.next_current_checkout_dry_run_command}`);
  }

  if (summary.package_json) {
    const scriptNames = Object.keys(summary.scripts);
    console.log(`scripts: ${scriptNames.length ? scriptNames.join(", ") : "none"}`);
    const missing = summary.recommended_missing_scripts;
    console.log(`recommended missing scripts: ${missing.length ? missing.join(", ") : "none"}`);
  } else {
    console.log("scripts: none (no package.json)");
    console.log("recommended missing scripts: add package.json later if the app adopts npm scripts");
  }

  console.log(`codex cli: ${summary.codex_cli}`);
  console.log(`git: ${summary.git}`);
  console.log(`inside git repo: ${summary.inside_git_repo}`);
  console.log(`harness committed for worktrees: ${summary.harness_committed_for_worktrees.status}`);
  if (summary.harness_committed_for_worktrees.note) {
    console.log(`worktree note: ${summary.harness_committed_for_worktrees.note}`);
  }
  if (summary.harness_committed_for_worktrees.missing.length) {
    console.log("worktree missing files:");
    for (const file of summary.harness_committed_for_worktrees.missing) console.log(`- ${file}`);
  }
  console.log("warnings:");
  if (summary.warnings.length) {
    for (const warning of summary.warnings) console.log(`- ${warning}`);
  } else {
    console.log("- none");
  }
  console.log("harness folders:");
  for (const entry of summary.harness_folders) {
    console.log(`- ${entry.dir}: ${entry.exists ? "ok" : "missing"}`);
  }
  console.log("state:");
  if (!summary.state.present) {
    console.log("- missing or unreadable");
  } else {
    console.log(`- current_task: ${summary.state.current_task || "none"}`);
    console.log(`- lock_exists: ${summary.state.lock_exists ? "yes" : "no"}`);
    if (summary.state.lock_info) {
      const lock = summary.state.lock_info;
      console.log(`- lock_pid: ${lock.pid || "unknown"}`);
      console.log(`- lock_process_alive: ${typeof lock.process_alive === "boolean" ? lock.process_alive : "unknown"}`);
    }
    console.log(`- bucket_counts: ${Object.entries(summary.state.bucket_counts).map(([status, count]) => `${status}=${count}`).join(", ")}`);
  }
  console.log("cleanup:");
  console.log(`- stale_temp_files: ${summary.cleanup.stale_temp_file_count}`);
  console.log(`- empty_transient_directories: ${summary.cleanup.empty_directory_count}`);
  console.log(`- dry_run: ${summary.cleanup.cleanup_dry_run_command}`);

  console.log("validation:");
  if (summary.validation.status === "fail") {
    console.log("FAIL");
    for (const error of summary.validation.errors) console.log(`- ${error}`);
    if (summary.strict && summary.validation.warnings?.length) {
      console.log("strict validation warnings:");
      for (const warning of summary.validation.warnings) console.log(`- ${warning}`);
    }
  } else {
    console.log(`PASS (${summary.validation.tasks_checked} tasks checked, ${summary.validation.results_checked} result reports checked, ${summary.validation.markdown_reports_checked} Markdown reports checked, ${summary.validation.run_manifests_checked} run manifests checked, ${summary.validation.archived_run_manifests_checked} archived run manifests checked, ${summary.validation.event_files_checked} event files checked, ${summary.validation.archived_event_files_checked} archived event files checked, ${summary.validation.path_overlaps_checked} path overlaps checked)`);
  }
  if (summary.validation.warnings?.length) {
    console.log("validation warnings:");
    for (const warning of summary.validation.warnings) console.log(`- ${warning}`);
  }

  return summary.validation.status === "fail" ? 1 : 0;
}

function shortHash(hash) {
  return typeof hash === "string" && hash.length >= 12 ? hash.slice(0, 12) : "none";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runDoctor({
    json: process.argv.includes("--json"),
    strict: process.argv.includes("--strict")
  });
}
