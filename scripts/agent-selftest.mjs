#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { commandParseError, splitCommandLine } from "./agent-command-utils.mjs";
import { validateHarnessFiles } from "./agent-validate.mjs";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function runNodeScript(script) {
  return spawnSync(process.execPath, Array.isArray(script) ? script : [script], {
    cwd: root,
    encoding: "utf8"
  });
}

function parseJsonOutput(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} should emit valid JSON (${error.message})`);
    return null;
  }
}

function isSpawnBlocked(result) {
  return result.error?.code === "EPERM";
}

function listTaskFiles() {
  return fs.readdirSync(path.join(root, ".agent", "queue"))
    .filter((file) => file.endsWith(".json"))
    .sort();
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function removeDirIfEmpty(dir) {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch {
    // Best-effort cleanup for ignored self-test log directories.
  }
}

function exerciseArchivedManifestValidation(task) {
  const archiveRoot = path.join(root, ".agent", "logs", "archive");
  const taskArchiveDir = path.join(archiveRoot, task.id);
  const archiveDir = path.join(taskArchiveDir, `selftest-${process.pid}`);
  fs.mkdirSync(archiveDir, { recursive: true });
  try {
    const taskContractText = `${JSON.stringify(task, null, 2)}\n`;
    const taskContractCanonicalText = JSON.stringify(task, null, 2);
    const promptText = "Self-test archived prompt artifact.\n";
    const eventsPath = path.join(archiveDir, "events.jsonl");
    fs.writeFileSync(path.join(archiveDir, "task.json"), taskContractText);
    fs.writeFileSync(path.join(archiveDir, "worker.prompt.md"), promptText);
    fs.writeFileSync(eventsPath, `${JSON.stringify({
      at: "2026-06-01T00:00:00.000Z",
      type: "selftest.event",
      task_id: task.id
    })}\n`);
    const runManifest = {
      run_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      task_id: task.id,
      status: "blocked",
      started_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:01.000Z",
      finished_at: "2026-06-01T00:00:01.000Z",
      duration_ms: 1000,
      cwd: root,
      worktree: null,
      environment: {
        node: process.version,
        selftest: true
      },
      commands: task.commands,
      command_gate_preflight: {
        command_gates: task.commands.map((command) => ({ command })),
        command_gate_warnings: []
      },
      attempts_used: 0,
      codex_timeout_minutes: 90,
      command_timeout_minutes: 30,
      task_contract_hash: sha256Text(taskContractCanonicalText),
      worker_prompt_hash: sha256Text(promptText),
      task_contract_file: `.agent/logs/${task.id}/task.json`,
      codex_runs: [
        {
          suffix: "worker",
          status: "failed",
          exit_code: 1,
          timed_out: false,
          duration_ms: 1000,
          prompt_hash: sha256Text(promptText),
          prompt_file: `.agent/logs/${task.id}/worker.prompt.md`,
          result_copy: null
        }
      ]
    };
    const runManifestPath = path.join(archiveDir, "run.json");
    writeJson(runManifestPath, runManifest);
    const validation = validateHarnessFiles();
    assert(validation.archivedRunManifestFiles.some((entry) => path.resolve(entry.file) === path.join(archiveDir, "run.json")), "validator should discover archived run manifest fixtures");
    assert(validation.archivedEventFiles.some((file) => path.resolve(file) === path.join(archiveDir, "events.jsonl")), "validator should discover archived event log fixtures");
    assert(validation.errors.length === 0, `archived run manifest fixture should validate cleanly (${validation.errors.join("; ")})`);
    const mismatchedGateManifest = JSON.parse(JSON.stringify(runManifest));
    mismatchedGateManifest.command_gate_preflight.command_gates[0].command = "node scripts/not-the-task.mjs";
    writeJson(runManifestPath, mismatchedGateManifest);
    const mismatchedValidation = validateHarnessFiles();
    assert(
      mismatchedValidation.errors.some((error) => error.includes("command_gate_preflight.command_gates[0].command must match task command at index 0")),
      "validator should reject command-gate preflight entries that drift from task commands"
    );
    writeJson(runManifestPath, runManifest);
    fs.writeFileSync(eventsPath, `${JSON.stringify({
      at: "2026-06-01T00:00:00.000Z",
      type: "selftest.event",
      task_id: "not-the-task"
    })}\n`);
    const mismatchedEventValidation = validateHarnessFiles();
    assert(
      mismatchedEventValidation.errors.some((error) => error.includes("lifecycle event task_id \"not-the-task\" must match log task id")),
      "validator should reject lifecycle events whose task_id drifts from the log directory"
    );
  } finally {
    fs.rmSync(archiveDir, { recursive: true, force: true });
    removeDirIfEmpty(taskArchiveDir);
    removeDirIfEmpty(archiveRoot);
  }
  assert(!fs.existsSync(archiveDir), "archived run manifest self-test should remove its temporary run directory");
}

function exerciseResultReportValidation(task) {
  const markdownPath = path.join(root, ".agent", "reports", `${task.id}.md`);
  const resultPath = path.join(root, ".agent", "reports", `${task.id}.result.json`);
  if (fs.existsSync(markdownPath) || fs.existsSync(resultPath)) return;

  const markdown = [
    "Status: blocked",
    "## Summary",
    "Self-test report fixture.",
    "## Files Changed",
    "- .agent/reports/self-test",
    "## Traceability",
    "Self-test traceability fixture.",
    "## Codex Runs",
    "No Codex runs.",
    "## Commands Run",
    "No commands run.",
    "## Acceptance Checklist",
    "Self-test acceptance fixture.",
    "## Remaining Work",
    "Remove fixture.",
    "## Logs",
    ".agent/logs/self-test",
    "## Branch / Worktree",
    "No branch."
  ].join("\n\n");
  const result = {
    task_id: task.id,
    status: "blocked",
    summary: "Self-test result fixture.",
    files_changed: [
      `.agent/reports/${task.id}.md`,
      `.agent/reports/${task.id}.result.json`
    ],
    commands_run: task.commands.map((command) => ({
      command,
      status: "skipped",
      notes: "Self-test fixture did not run command gates."
    })),
    acceptance_results: task.acceptance.map((criterion) => ({
      criterion,
      status: "blocked",
      notes: "Self-test fixture only."
    })),
    remaining_work: ["Remove self-test fixture."],
    risks: [],
    next_recommended_task: null
  };

  try {
    fs.writeFileSync(markdownPath, `${markdown}\n`);
    writeJson(resultPath, result);
    const validValidation = validateHarnessFiles();
    assert(validValidation.errors.length === 0, `result report fixture should validate cleanly (${validValidation.errors.join("; ")})`);

    const duplicateResult = JSON.parse(JSON.stringify(result));
    duplicateResult.acceptance_results.push({ ...duplicateResult.acceptance_results[0] });
    writeJson(resultPath, duplicateResult);
    const duplicateValidation = validateHarnessFiles();
    assert(
      duplicateValidation.errors.some((error) => error.includes("acceptance_results must not contain duplicate criterion")),
      "validator should reject duplicate result acceptance criteria"
    );

    const extraResult = JSON.parse(JSON.stringify(result));
    extraResult.acceptance_results[0].criterion = "self-test.not-in-task";
    writeJson(resultPath, extraResult);
    const extraValidation = validateHarnessFiles();
    assert(
      extraValidation.errors.some((error) => error.includes("acceptance_results includes criterion outside task acceptance")),
      "validator should reject result acceptance criteria outside task scope"
    );

    writeJson(resultPath, result);
    fs.writeFileSync(markdownPath, `${markdown.replace("Status: blocked", "Status: passed")}\n`);
    const mismatchedMarkdownValidation = validateHarnessFiles();
    assert(
      mismatchedMarkdownValidation.errors.some((error) => error.includes("Markdown report status passed disagrees with result status blocked")),
      "validator should reject Markdown report statuses that drift from result JSON"
    );
  } finally {
    fs.rmSync(markdownPath, { force: true });
    fs.rmSync(resultPath, { force: true });
  }
  assert(!fs.existsSync(markdownPath) && !fs.existsSync(resultPath), "result report self-test should remove temporary reports");
}

function main() {
  assert(JSON.stringify(splitCommandLine("node scripts/agent-validate.mjs --strict")) === JSON.stringify(["node", "scripts/agent-validate.mjs", "--strict"]), "command parser should split simple Node commands");
  assert(JSON.stringify(splitCommandLine("node -e \"console.log(1)\"")) === JSON.stringify(["node", "-e", "console.log(1)"]), "command parser should preserve quoted arguments");
  assert(commandParseError("node \"unterminated") === "unterminated \" quote", "command parser should report unterminated quotes");

  const validation = validateHarnessFiles();
  if (validation.errors.length) {
    fail(`validator reported errors: ${validation.errors.join("; ")}`);
  }
  const validatorCli = runNodeScript("scripts/agent-validate.mjs");
  if (!isSpawnBlocked(validatorCli)) {
    assert(validatorCli.status === 0, `validator CLI should pass (${validatorCli.stderr || validatorCli.stdout})`);
  }
  const validatorStrictCli = runNodeScript(["scripts/agent-validate.mjs", "--strict", "--json"]);
  if (!isSpawnBlocked(validatorStrictCli)) {
    assert(validatorStrictCli.status === 0 && validatorStrictCli.stdout.includes("\"strict\": true"), `validator strict CLI should pass clean harnesses (${validatorStrictCli.stderr || validatorStrictCli.stdout})`);
  }
  const runnerHelp = runNodeScript(["scripts/agent-runner.mjs", "--help"]);
  if (!isSpawnBlocked(runnerHelp)) {
    assert(runnerHelp.status === 0 && runnerHelp.stdout.includes("Usage:"), "runner help CLI should print usage");
  }
  const runnerConflict = runNodeScript(["scripts/agent-runner.mjs", "--list", "--next"]);
  if (!isSpawnBlocked(runnerConflict)) {
    assert(runnerConflict.status !== 0 && `${runnerConflict.stderr}${runnerConflict.stdout}`.includes("Choose only one primary action"), "runner should reject conflicting primary actions");
  }
  const runnerMissingValue = runNodeScript(["scripts/agent-runner.mjs", "--task"]);
  if (!isSpawnBlocked(runnerMissingValue)) {
    assert(runnerMissingValue.status !== 0 && `${runnerMissingValue.stderr}${runnerMissingValue.stdout}`.includes("--task requires a value"), "runner should reject missing option values");
  }
  const runnerInvalidTaskId = runNodeScript(["scripts/agent-runner.mjs", "--logs", "../001-inspect-repo"]);
  if (!isSpawnBlocked(runnerInvalidTaskId)) {
    assert(runnerInvalidTaskId.status !== 0 && `${runnerInvalidTaskId.stderr}${runnerInvalidTaskId.stdout}`.includes("Task id must use NNN-lowercase-slug format"), "runner should reject unsafe task id arguments");
  }
  const runnerInvalidReady = runNodeScript(["scripts/agent-runner.mjs", "--next", "--ready"]);
  if (!isSpawnBlocked(runnerInvalidReady)) {
    assert(runnerInvalidReady.status !== 0 && `${runnerInvalidReady.stderr}${runnerInvalidReady.stdout}`.includes("--ready can only be used with --list"), "runner should reject --ready outside list mode");
  }
  const runnerInvalidMaxTasks = runNodeScript(["scripts/agent-runner.mjs", "--next", "--max-tasks", "2"]);
  if (!isSpawnBlocked(runnerInvalidMaxTasks)) {
    assert(runnerInvalidMaxTasks.status !== 0 && `${runnerInvalidMaxTasks.stderr}${runnerInvalidMaxTasks.stdout}`.includes("--max-tasks can only be used with --all"), "runner should reject --max-tasks outside batch mode");
  }
  const runnerInvalidNoCodex = runNodeScript(["scripts/agent-runner.mjs", "--list", "--no-codex"]);
  if (!isSpawnBlocked(runnerInvalidNoCodex)) {
    assert(runnerInvalidNoCodex.status !== 0 && `${runnerInvalidNoCodex.stderr}${runnerInvalidNoCodex.stdout}`.includes("--no-codex can only be used with --task, --next, or --all"), "runner should reject --no-codex outside task selection");
  }
  const runnerInvalidPreviewModes = runNodeScript(["scripts/agent-runner.mjs", "--next", "--dry-run", "--no-codex"]);
  if (!isSpawnBlocked(runnerInvalidPreviewModes)) {
    assert(runnerInvalidPreviewModes.status !== 0 && `${runnerInvalidPreviewModes.stderr}${runnerInvalidPreviewModes.stdout}`.includes("Choose either --dry-run or --no-codex, not both"), "runner should reject ambiguous preview modes");
  }
  const runnerInvalidPrompt = runNodeScript(["scripts/agent-runner.mjs", "--task", "001-inspect-repo", "--print-prompt"]);
  if (!isSpawnBlocked(runnerInvalidPrompt)) {
    assert(runnerInvalidPrompt.status !== 0 && `${runnerInvalidPrompt.stderr}${runnerInvalidPrompt.stdout}`.includes("--print-prompt requires --dry-run or --no-codex"), "runner should reject prompt printing during real runs");
  }
  const runnerInvalidDryRun = runNodeScript(["scripts/agent-runner.mjs", "--list", "--dry-run"]);
  if (!isSpawnBlocked(runnerInvalidDryRun)) {
    assert(runnerInvalidDryRun.status !== 0 && `${runnerInvalidDryRun.stderr}${runnerInvalidDryRun.stdout}`.includes("--dry-run can only be used with --task, --next, --all"), "runner should reject dry-run where it has no effect");
  }
  const runnerInvalidRealJson = runNodeScript(["scripts/agent-runner.mjs", "--next", "--json"]);
  if (!isSpawnBlocked(runnerInvalidRealJson)) {
    assert(runnerInvalidRealJson.status !== 0 && `${runnerInvalidRealJson.stderr}${runnerInvalidRealJson.stdout}`.includes("--json is only supported for task selection with --dry-run or --no-codex"), "runner should reject JSON stdout for real task runs");
  }
  const runnerNoCodex = runNodeScript(["scripts/agent-runner.mjs", "--next", "--no-codex", "--json"]);
  if (!isSpawnBlocked(runnerNoCodex)) {
    assert(runnerNoCodex.status === 0 && runnerNoCodex.stdout.includes("\"mode\": \"no-codex\""), "runner --no-codex should be a successful validation mode");
  }
  const runnerStatusJson = runNodeScript(["scripts/agent-runner.mjs", "--status", "--json"]);
  if (!isSpawnBlocked(runnerStatusJson)) {
    assert(runnerStatusJson.status === 0, `runner status JSON should pass (${runnerStatusJson.stderr || runnerStatusJson.stdout})`);
    const status = parseJsonOutput(runnerStatusJson, "runner status JSON");
    assert(status?.next_task === "001-inspect-repo", "runner status JSON should report the next ready task");
    assert(/^[0-9a-f]{64}$/i.test(status?.next_task_contract_hash || ""), "runner status JSON should include next task contract hash");
    assert(/^[0-9a-f]{64}$/i.test(status?.next_prompt_hash || ""), "runner status JSON should include next prompt hash");
    assert(status?.next_dry_run_command?.includes("--dry-run --strict"), "runner status JSON should include the next strict dry-run command");
    assert(status?.next_current_checkout_dry_run_command?.includes("--no-worktree --allow-dirty --dry-run --strict"), "runner status JSON should include the current-checkout dry-run command");
  }
  const runnerReadyListJson = runNodeScript(["scripts/agent-runner.mjs", "--list", "--ready", "--json"]);
  if (!isSpawnBlocked(runnerReadyListJson)) {
    assert(runnerReadyListJson.status === 0, `runner ready list JSON should pass (${runnerReadyListJson.stderr || runnerReadyListJson.stdout})`);
    const readyList = parseJsonOutput(runnerReadyListJson, "runner ready list JSON");
    assert(readyList?.tasks?.length === 1 && readyList.tasks[0].id === "001-inspect-repo", "runner --list --ready should return only the first ready task in a fresh queue");
  }
  const runnerGraphJson = runNodeScript(["scripts/agent-runner.mjs", "--graph", "--json"]);
  if (!isSpawnBlocked(runnerGraphJson)) {
    assert(runnerGraphJson.status === 0, `runner graph JSON should pass (${runnerGraphJson.stderr || runnerGraphJson.stdout})`);
    const graph = parseJsonOutput(runnerGraphJson, "runner graph JSON");
    assert(Array.isArray(graph?.nodes) && graph.nodes.length >= 12, "runner graph JSON should include task nodes");
    assert(Array.isArray(graph?.edges) && graph.edges.length > 0, "runner graph JSON should include dependency edges");
    assert(/^[0-9a-f]{64}$/i.test(graph?.nodes?.[0]?.task_contract_hash || ""), "runner graph JSON nodes should include task hashes");
  }
  const runnerLogsJson = runNodeScript(["scripts/agent-runner.mjs", "--logs", "001-inspect-repo", "--json"]);
  if (!isSpawnBlocked(runnerLogsJson)) {
    assert(runnerLogsJson.status === 0, `runner logs JSON should pass (${runnerLogsJson.stderr || runnerLogsJson.stdout})`);
    const logs = parseJsonOutput(runnerLogsJson, "runner logs JSON");
    assert(logs?.task_id === "001-inspect-repo", "runner logs JSON should report the requested task id");
    assert(Array.isArray(logs?.reports), "runner logs JSON should include reports array");
    assert(Array.isArray(logs?.archived_runs), "runner logs JSON should include archived runs array");
  }
  const runnerStrictDryRun = runNodeScript(["scripts/agent-runner.mjs", "--next", "--dry-run", "--strict", "--json"]);
  if (!isSpawnBlocked(runnerStrictDryRun)) {
    assert(runnerStrictDryRun.status === 0 && runnerStrictDryRun.stdout.includes("\"mode\": \"dry-run\""), "runner --strict should allow clean dry-runs");
    const dryRun = parseJsonOutput(runnerStrictDryRun, "runner strict dry-run");
    const firstTask = dryRun?.tasks?.[0];
    assert(/^[0-9a-f]{64}$/i.test(firstTask?.task_contract_hash || ""), "runner dry-run JSON should include a sha256 task contract hash");
    assert(/^[0-9a-f]{64}$/i.test(firstTask?.prompt_hash || ""), "runner dry-run JSON should include a sha256 prompt hash");
    assert(firstTask?.environment?.node && firstTask.environment.package_manager, "runner dry-run JSON should include an environment snapshot");
    assert(Array.isArray(firstTask?.command_gate_warnings), "runner dry-run JSON should include command gate warning details");
  }
  const runnerResetPreview = runNodeScript(["scripts/agent-runner.mjs", "--reset-running", "--dry-run", "--json"]);
  if (!isSpawnBlocked(runnerResetPreview)) {
    assert(runnerResetPreview.status === 0 && runnerResetPreview.stdout.includes("\"action\": \"reset-running\"") && runnerResetPreview.stdout.includes("\"dry_run\": true"), "runner reset-running should support JSON dry-runs");
  }
  const runnerReconcilePreview = runNodeScript(["scripts/agent-runner.mjs", "--reconcile-state", "--dry-run", "--json"]);
  if (!isSpawnBlocked(runnerReconcilePreview)) {
    assert(runnerReconcilePreview.status === 0 && runnerReconcilePreview.stdout.includes("\"action\": \"reconcile-state\"") && runnerReconcilePreview.stdout.includes("\"dry_run\": true"), "runner reconcile-state should support JSON dry-runs");
  }
  const runnerCleanupPreview = runNodeScript(["scripts/agent-runner.mjs", "--cleanup-stale", "--dry-run", "--json"]);
  if (!isSpawnBlocked(runnerCleanupPreview)) {
    assert(runnerCleanupPreview.status === 0 && runnerCleanupPreview.stdout.includes("\"action\": \"cleanup-stale\"") && runnerCleanupPreview.stdout.includes("\"dry_run\": true"), "runner cleanup-stale should support JSON dry-runs");
  }
  const doctorCli = runNodeScript(["scripts/agent-doctor.mjs", "--json"]);
  if (!isSpawnBlocked(doctorCli)) {
    assert(doctorCli.status === 0, `doctor CLI should pass (${doctorCli.stderr || doctorCli.stdout})`);
  }
  const doctorStrictCli = runNodeScript(["scripts/agent-doctor.mjs", "--strict", "--json"]);
  if (!isSpawnBlocked(doctorStrictCli)) {
    assert(doctorStrictCli.status === 0 && doctorStrictCli.stdout.includes("\"strict\": true"), `doctor strict CLI should pass clean harnesses (${doctorStrictCli.stderr || doctorStrictCli.stdout})`);
  }
  const summaryCli = runNodeScript(["scripts/agent-summary.mjs", "--json"]);
  if (!isSpawnBlocked(summaryCli)) {
    assert(summaryCli.status === 0, `summary CLI should pass (${summaryCli.stderr || summaryCli.stdout})`);
  }
  const summaryStrictCli = runNodeScript(["scripts/agent-summary.mjs", "--strict", "--json"]);
  if (!isSpawnBlocked(summaryStrictCli)) {
    assert(summaryStrictCli.status === 0 && summaryStrictCli.stdout.includes("\"strict\": true"), `summary strict CLI should pass clean harnesses (${summaryStrictCli.stderr || summaryStrictCli.stdout})`);
  }
  for (const script of [
    "scripts/agent-cleanup-utils.mjs",
    "scripts/agent-command-utils.mjs",
    "scripts/agent-harness-files.mjs",
    "scripts/agent-preflight.mjs",
    "scripts/agent-runner.mjs",
    "scripts/agent-trace-utils.mjs",
    "scripts/agent-validate.mjs",
    "scripts/agent-doctor.mjs",
    "scripts/agent-summary.mjs",
    "scripts/agent-selftest.mjs"
  ]) {
    const syntax = runNodeScript(["--check", script]);
    if (!isSpawnBlocked(syntax)) {
      assert(syntax.status === 0, `${script} should pass node --check (${syntax.stderr || syntax.stdout})`);
    }
  }

  const taskFiles = listTaskFiles();
  assert(taskFiles.length >= 12, "expected at least 12 queue tasks");
  assert(taskFiles[0] === "001-inspect-repo.json", "first task should be 001-inspect-repo.json");

  const tasks = taskFiles.map((file) => readJson(path.join(".agent", "queue", file)));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  assert(byId.has("001-inspect-repo"), "queue should include 001-inspect-repo");
  assert(byId.has("002-schema-and-fixtures"), "queue should include 002-schema-and-fixtures");
  assert(byId.has("011-playwright-smoke-tests"), "queue should include 011-playwright-smoke-tests");
  assert(byId.get("001-inspect-repo")?.depends_on.length === 0, "001-inspect-repo should have no dependencies");
  assert(byId.get("002-schema-and-fixtures")?.depends_on.includes("001-inspect-repo"), "schema task should depend on inspect task");
  assert(byId.get("011-playwright-smoke-tests")?.depends_on.includes("008-editor-ui"), "smoke tests should depend on editor UI");

  for (const task of tasks) {
    assert(task.commands.length > 0, `${task.id} should have command gates`);
    assert(task.allowed_paths.length > 0, `${task.id} should declare allowed_paths`);
    assert(task.forbidden_paths.includes(".git"), `${task.id} should forbid .git`);
    assert(task.forbidden_paths.includes("node_modules"), `${task.id} should forbid node_modules`);
    assert(task.forbidden_paths.includes(".env"), `${task.id} should forbid .env`);
  }
  exerciseArchivedManifestValidation(byId.get("001-inspect-repo"));
  exerciseResultReportValidation(byId.get("001-inspect-repo"));

  const runner = fs.readFileSync(path.join(root, "scripts", "agent-runner.mjs"), "utf8");
  const doctor = fs.readFileSync(path.join(root, "scripts", "agent-doctor.mjs"), "utf8");
  const summary = fs.readFileSync(path.join(root, "scripts", "agent-summary.mjs"), "utf8");
  const cleanupUtils = fs.readFileSync(path.join(root, "scripts", "agent-cleanup-utils.mjs"), "utf8");
  const commandUtils = fs.readFileSync(path.join(root, "scripts", "agent-command-utils.mjs"), "utf8");
  const harnessFiles = fs.readFileSync(path.join(root, "scripts", "agent-harness-files.mjs"), "utf8");
  const preflight = fs.readFileSync(path.join(root, "scripts", "agent-preflight.mjs"), "utf8");
  const traceUtils = fs.readFileSync(path.join(root, "scripts", "agent-trace-utils.mjs"), "utf8");
  assert(runner.includes("--sandbox") && runner.includes("workspace-write"), "runner should use workspace-write sandbox");
  assert(runner.includes("--strict"), "runner should support warning-fatal strict validation");
  assert(runner.includes("fatalWarnings"), "runner strict mode should treat validation warnings as fatal");
  assert(!runner.includes("danger-full-access"), "runner must not use danger-full-access");
  assert(runner.includes("runner.lock"), "runner should use a lock file");
  assert(runner.includes("validateOptionCombinations"), "runner should reject ignored or contradictory modifier flags");
  assert(runner.includes("taskIdPattern"), "runner should validate task id arguments before filesystem-oriented commands");
  assert(runner.includes("writeTextFileAtomic"), "runner should write JSON and reports atomically");
  assert(runner.includes("lock_info"), "runner status should expose lock owner details");
  assert(runner.includes("process_alive"), "runner status should report whether lock owner appears alive");
  assert(runner.includes("next_command"), "runner status should include next runnable command");
  assert(runner.includes("next_task_contract_hash"), "runner status should include next task contract hash");
  assert(runner.includes("next_prompt_hash"), "runner status should include next prompt hash");
  assert(runner.includes("prompt_hash: sha256Text(prompt)"), "runner task inspection should expose prompt fingerprints");
  assert(runner.includes("--logs"), "runner should expose a task log inspection command");
  assert(runner.includes("--scope-check"), "runner should expose a task scope inspection command");
  assert(runner.includes("scopeCheckTask"), "runner should implement standalone task scope checks");
  assert(runner.includes("blocked: true"), "runner scope checks should emit structured blocked results when git is unavailable");
  assert(runner.includes("manifest_status"), "runner log inspection should surface run manifest status");
  assert(runner.includes("worker_prompt_hash"), "runner log inspection should surface traceability hashes");
  assert(runner.includes("command_gate_warnings:"), "runner log inspection should surface command gate warning counts");
  assert(runner.includes("archiveExistingTaskLogDir"), "runner should archive prior task logs before resetting current logs");
  assert(runner.includes("archived_previous_log_dir"), "runner should record archived prior log directories in lifecycle events");
  assert(runner.includes("archived_runs"), "runner log inspection should list archived task log bundles");
  assert(runner.includes("directoryHasEntries"), "runner should avoid archiving empty placeholder log directories");
  assert(runner.includes("events.jsonl"), "runner should write structured lifecycle events");
  assert(runner.includes("taskIdFromLogBase"), "runner should attach task ids to lifecycle events from log paths");
  assert(runner.includes("startHeartbeat"), "runner should emit heartbeat lifecycle events during long-running work");
  assert(runner.includes("command.heartbeat"), "runner should heartbeat command gates while they are running");
  assert(runner.includes("codex.heartbeat"), "runner should heartbeat Codex workers while they are running");
  assert(runner.includes("elapsed_ms"), "runner heartbeat events should include elapsed time");
  assert(runner.includes("tryReadChangedFiles"), "runner should not silently trust failed git status reads");
  assert(runner.includes("git.status_failed"), "runner should record git status failures in lifecycle events");
  assert(runner.includes("cleanTaskLogDir"), "runner should clean stale task logs before real runs");
  assert(runner.includes("crypto.randomUUID"), "runner should assign a run_id for each real task run");
  assert(runner.includes("Refusing to clean log directory outside .agent/logs"), "runner log cleanup should be path-guarded");
  assert(runner.includes("activeChildren"), "runner should track child processes for signal cleanup");
  assert(runner.includes("installSignalHandlers"), "runner should install signal handlers for lock cleanup");
  assert(runner.includes("markCurrentRunInterrupted"), "runner should record interrupted task state on signals");
  assert(runner.includes("runner.signal"), "runner should write signal events for interrupted runs");
  assert(runner.includes("Refusing to reset running state while lock owner pid"), "runner should protect live locks during reset-running");
  assert(runner.includes("rerun with --force"), "runner reset-running should document the force override");
  assert(runner.includes("No current_task or runner lock to clear"), "runner reset-running should avoid mutating state when there is nothing to clear");
  assert(runner.includes("recoveryStateSnapshot"), "runner recovery actions should report previous and next state");
  assert(runner.includes("printRecoveryResult"), "runner recovery actions should support JSON output");
  assert(runner.includes("No files were changed because --dry-run was provided."), "runner recovery actions should honor dry-run");
  assert(runner.includes("--cleanup-stale"), "runner should expose stale artifact cleanup");
  assert(runner.includes("cleanupStaleArtifacts"), "runner should implement stale artifact cleanup");
  assert(runner.includes("agent-cleanup-utils.mjs"), "runner should use shared stale cleanup utilities");
  assert(runner.includes("stale_temp_files"), "runner cleanup should report stale temp files");
  assert(runner.includes("empty_directories"), "runner cleanup should report empty transient directories");
  assert(runner.includes("formatDurationMs"), "runner reports should format elapsed durations");
  assert(runner.includes("duration_ms"), "runner should record elapsed durations in events and manifests");
  assert(runner.includes("finished_at"), "runner should record task finish timestamps in manifests");
  assert(runner.includes("codexRunReport"), "runner manifests should summarize Codex worker attempts");
  assert(runner.includes("Command gate did not run."), "runner should report skipped command gates instead of omitting them");
  assert(runner.includes("copyCodexResult"), "runner should preserve raw Codex result JSON in logs");
  assert(runner.includes("codex.result_copied"), "runner should record raw result copies in lifecycle events");
  assert(runner.includes("normalizeWorkerAcceptance"), "runner should preserve worker acceptance details");
  assert(runner.includes("acceptance.partial"), "runner should downgrade incomplete worker acceptance reports");
  assert(runner.includes("## Codex Runs"), "runner reports should include Codex worker runs");
  assert(runner.includes("## Traceability"), "runner reports should include task and prompt traceability");
  assert(runner.includes("savedPromptFiles"), "runner reports should list saved prompt files even without Codex run summaries");
  assert(runner.includes("scopeViolations"), "runner should enforce path scope");
  assert(runner.includes("file.split(\" -> \")"), "runner scope parsing should account for renamed files");
  assert(runner.includes("agent-command-utils.mjs"), "runner should share task command parsing with other harness tools");
  assert(runner.includes("shell: false"), "runner should spawn task command gates without shell mode");
  assert(!runner.includes("shell: true"), "runner must not run task command gates through a shell");
  assert(runner.includes("SIGTERM") && runner.includes("SIGKILL"), "runner should terminate timed-out commands robustly");
  assert(runner.includes("killProcessTree"), "runner should kill process groups for timed-out work");
  assert(runner.includes("codexTimeoutMinutes"), "runner should have a Codex worker timeout");
  assert(runner.includes("assertHarnessAvailable"), "runner should preflight worktree harness availability");
  assert(runner.includes("assertHarnessCommittedForWorktree"), "runner should fail before creating worktrees when the harness is uncommitted");
  assert(runner.includes("requiredHarnessFileList"), "runner should use the shared required harness file list");
  assert(runner.includes("agent-harness-files.mjs"), "runner worktree preflight should include shared harness file utilities");
  assert(runner.includes("codexOutputFile"), "runner should keep intermediate Codex outputs out of final reports");
  assert(runner.includes(".agent/tmp/${task.id}.${suffix}.result.json"), "runner should write repair result JSON to .agent/tmp");
  assert(runner.includes("taskRunPreview"), "runner should expose structured dry-run previews");
  assert(runner.includes("sha256Text"), "runner should hash text for task and prompt traceability");
  assert(runner.includes("taskContractHash"), "runner should hash the exact task contract workers receive");
  assert(runner.includes("agent-trace-utils.mjs"), "runner should use shared task/prompt trace helpers");
  assert(runner.includes("task_contract_hash"), "runner previews and manifests should include task contract hashes");
  assert(runner.includes("task_hash=${shortHash(entry.task_contract_hash)}"), "runner task lists should show compact task hashes");
  assert(runner.includes("prompt_hash=${shortHash(entry.prompt_hash)}"), "runner task lists should show compact prompt hashes");
  assert(runner.includes("task_contract_file"), "runner manifests should point to the snapshotted task contract file");
  assert(runner.includes("task.snapshot"), "runner should write lifecycle events for snapshotted task contracts");
  assert(runner.includes("prompt_hash"), "runner Codex telemetry should include prompt hashes");
  assert(runner.includes("prompt_file"), "runner Codex telemetry should include prompt file paths");
  assert(runner.includes("${suffix}.prompt.md"), "runner should persist every worker and repair prompt");
  assert(runner.includes("codex.unavailable"), "runner should log prompt details even when Codex is unavailable");
  assert(runner.includes("worker_prompt_hash"), "runner manifests should preserve the worker prompt hash");
  assert(runner.includes("prompt.ready"), "runner should write a lifecycle event when the worker prompt is assembled");
  assert(runner.includes("environmentSnapshot"), "runner should snapshot environment details in dry-runs and manifests");
  assert(runner.includes("worktreePreflight"), "runner dry-runs should preflight default worktree readiness");
  assert(runner.includes("worktree_preflight"), "runner dry-runs should print worktree readiness");
  assert(runner.includes("taskCommandGatePreflight"), "runner should reuse command-gate preflight for dry-runs, prompts, and manifests");
  assert(traceUtils.includes("Task command gate preflight:"), "shared prompt assembly should include task command-gate preflight");
  assert(runner.includes("commandGatePreview"), "runner dry-runs should preflight command gates");
  assert(runner.includes("commandGateWarnings"), "runner dry-runs should summarize command-gate warnings");
  assert(runner.includes("command_parse_error"), "runner dry-runs should surface shell-free command parse errors");
  assert(runner.includes("command_gate_warning_count"), "runner task listings should expose command-gate warning counts");
  assert(runner.includes("command_gate_warnings: warnings"), "runner JSON task listings should expose command-gate warning details");
  assert(runner.includes("blocked_by"), "runner task listings should expose incomplete dependencies");
  assert(preflight.includes("package_script_available"), "shared preflight should report missing npm scripts");
  assert(preflight.includes("package_json_error"), "shared preflight should warn about malformed package.json");
  assert(preflight.includes("referenced_file_available"), "shared preflight should report missing Node command files");
  assert(runner.includes("nodes, edges"), "runner should expose structured graph output");
  assert(runner.includes("blocked_by: task.blocked_by"), "runner graph JSON should include dependency blockers");
  assert(runner.includes("task_contract_hash: task.task_contract_hash"), "runner graph JSON should include task contract hashes");
  assert(runner.includes("prompt_hash: task.prompt_hash"), "runner graph JSON should include prompt hashes");
  assert(runner.includes("expected ${task.branch}"), "runner should verify existing worktree branches before reuse");
  assert(runner.includes("findExecutable"), "runner should fall back to PATH checks for CLI detection");
  assert(doctor.includes("harness_committed_for_worktrees"), "doctor should report worktree commit readiness");
  assert(doctor.includes("inspectStaleArtifacts"), "doctor should report stale cleanup candidates");
  assert(doctor.includes("cleanup_dry_run_command"), "doctor should expose cleanup dry-run command");
  assert(doctor.includes("strict: Boolean(options.strict)"), "doctor should report strict mode");
  assert(doctor.includes("strict validation warnings"), "doctor strict mode should make validation warnings visible");
  assert(doctor.includes("requiredHarnessFiles(root)"), "doctor should use the shared required harness file list");
  assert(doctor.includes("agent-harness-files.mjs"), "doctor worktree readiness should include shared harness file utilities");
  assert(doctor.includes("node: process.version"), "doctor should report local Node version");
  assert(doctor.includes("package_json_error"), "doctor should report malformed package.json without crashing");
  assert(doctor.includes("stateSummary"), "doctor should report state and lock summary");
  assert(doctor.includes("queueSummary"), "doctor should report queue readiness summary");
  assert(doctor.includes("archived_run_manifests_checked"), "doctor should report archived run manifest validation coverage");
  assert(doctor.includes("event_files_checked"), "doctor should report lifecycle event validation coverage");
  assert(doctor.includes("path_overlaps_checked"), "doctor should report path-overlap validation coverage");
  assert(doctor.includes("next_task"), "doctor queue summary should include the next ready task");
  assert(doctor.includes("next_task_contract_hash"), "doctor queue summary should include next task contract hash");
  assert(doctor.includes("next_prompt_hash"), "doctor queue summary should include next prompt hash");
  assert(doctor.includes("next_dry_run_command"), "doctor queue summary should include the next dry-run command");
  assert(doctor.includes("next_current_checkout_dry_run_command"), "doctor queue summary should include current-checkout dry-run fallback");
  assert(doctor.includes("readLockInfo"), "doctor should inspect runner lock details");
  assert(doctor.includes("lock_process_alive"), "doctor should report lock process liveness");
  assert(doctor.includes("doctorWarnings"), "doctor should surface operator warnings");
  assert(doctor.includes("Harness validation warning"), "doctor should surface validator warnings");
  assert(summary.includes("Agent Harness Summary"), "summary script should render a Markdown report");
  assert(summary.includes("Strict: ${summary.strict ? \"yes\" : \"no\"}"), "summary Markdown should render strict mode");
  assert(summary.includes("validationFailed"), "summary strict mode should treat validation warnings as fatal");
  assert(summary.includes("readJsonResult"), "summary script should tolerate malformed JSON artifacts");
  assert(summary.includes("Invalid JSON:"), "summary script should surface malformed JSON artifacts instead of crashing");
  assert(summary.includes("writeTextFileAtomic"), "summary script should write summary artifacts atomically");
  assert(summary.includes("Validation Warnings"), "summary script should render validation warnings");
  assert(summary.includes("loadRunManifests"), "summary script should include local run manifests");
  assert(summary.includes("loadArchivedRunManifests"), "summary script should include archived run manifests");
  assert(summary.includes("loadEventSummaries"), "summary script should include lifecycle event summaries");
  assert(summary.includes("Lifecycle Events"), "summary Markdown should render lifecycle event summaries");
  assert(summary.includes("inspectStaleArtifacts"), "summary script should report stale cleanup candidates");
  assert(summary.includes("## Cleanup"), "summary Markdown should render cleanup candidates");
  assert(summary.includes("archived_run_manifests"), "summary JSON should expose archived run manifests");
  assert(summary.includes("archived_run_manifests_checked"), "summary validation coverage should include archived run manifests");
  assert(summary.includes("event_files_checked"), "summary validation coverage should include lifecycle event files");
  assert(summary.includes("Archived Run Manifests"), "summary Markdown should render archived run manifests");
  assert(summary.includes("task_contract_hash"), "summary script should expose task contract hashes from run manifests");
  assert(summary.includes("next_task_contract_hash"), "summary script should expose the next planned task hash");
  assert(summary.includes("prompt_hash"), "summary script should expose planned prompt hashes for queued tasks");
  assert(summary.includes("worker_prompt_hash"), "summary script should expose worker prompt hashes from run manifests");
  assert(summary.includes("environment"), "summary script should expose run-manifest environment snapshots");
  assert(summary.includes("shortHash"), "summary Markdown should render compact traceability hashes");
  assert(summary.includes("next_dry_run_command"), "summary script should expose the next dry-run command");
  assert(summary.includes("next_strict_command"), "summary script should expose the next strict command");
  assert(summary.includes("next_strict_dry_run_command"), "summary script should expose the next strict dry-run command");
  assert(summary.includes("next_current_checkout_command"), "summary script should expose current-checkout fallback commands");
  assert(summary.includes("--no-worktree --allow-dirty --strict"), "summary current-checkout command should require intentional dirty-checkout mode");
  assert(summary.includes("next_strict_batch_dry_run_command"), "summary script should expose the strict batch dry-run command");
  assert(summary.includes("next_scope_check_command"), "summary script should expose the next scope-check command");
  assert(summary.includes("next_task_command_gates"), "summary script should expose next task command-gate preflight");
  assert(summary.includes("command_parse_error"), "summary script should expose shell-free command parse errors");
  assert(summary.includes("command_gate_warning_count: error ? null"), "summary script should surface run-manifest gate warning counts");
  assert(summary.includes("next_task_command_gate_warnings"), "summary script should expose next task command-gate warnings");
  assert(summary.includes("command_gate_warning_count"), "summary script should include per-task command-gate warning counts");
  assert(summary.includes("command_gate_warnings: warnings"), "summary JSON should include per-task command-gate warning details");
  assert(summary.includes("blocked_by"), "summary script should include incomplete dependencies");
  assert(summary.includes("commandGatePreview"), "summary script should use shared command-gate preflight");
  assert(summary.includes("queue_path_overlaps"), "summary script should expose unordered task path overlaps");
  assert(summary.includes("Queue Path Overlaps"), "summary Markdown should render queue path overlap planning data");
  const validator = fs.readFileSync(path.join(root, "scripts", "agent-validate.mjs"), "utf8");
  const taskSchema = fs.readFileSync(path.join(root, ".agent", "task-schema.json"), "utf8");
  const resultSchema = fs.readFileSync(path.join(root, ".agent", "result-schema.json"), "utf8");
  const runSchema = fs.readFileSync(path.join(root, ".agent", "run-schema.json"), "utf8");
  const eventSchema = fs.readFileSync(path.join(root, ".agent", "event-schema.json"), "utf8");
  const ciWorkflow = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  assert(validator.includes('branch "${task.branch}" must equal "agent/${task.id}"'), "validator should require predictable agent/<task-id> branch names");
  assert(commandUtils.includes("export function splitCommandLine"), "shared command utility should export the shell-free parser");
  assert(commandUtils.includes("export function commandParseError"), "shared command utility should expose parse errors for preflight tools");
  assert(harnessFiles.includes("export const requiredStaticHarnessFiles"), "shared harness file utility should export static required files");
  assert(harnessFiles.includes("export function requiredHarnessFiles"), "shared harness file utility should export the full required file list");
  assert(harnessFiles.includes("\".agent/prompts\""), "shared harness directory list should require prompt directories");
  assert(harnessFiles.includes("queueTaskFiles"), "shared harness file utility should include queued task files");
  assert(harnessFiles.includes("scripts/agent-cleanup-utils.mjs"), "shared harness file list should include cleanup utilities");
  assert(harnessFiles.includes("scripts/agent-doctor.mjs"), "shared harness file list should include command-gate harness scripts");
  assert(harnessFiles.includes("scripts/agent-command-utils.mjs"), "shared harness file list should include command utilities");
  assert(harnessFiles.includes("scripts/agent-preflight.mjs"), "shared harness file list should include preflight utilities");
  assert(harnessFiles.includes("scripts/agent-trace-utils.mjs"), "shared harness file list should include trace utilities");
  assert(harnessFiles.includes(".agent/run-schema.json"), "shared harness file list should include run manifest schema");
  assert(harnessFiles.includes(".agent/event-schema.json"), "shared harness file list should include lifecycle event schema");
  assert(harnessFiles.includes(".agent/state-schema.json"), "shared harness file list should include runner state schema");
  assert(harnessFiles.includes(".agent/tmp/.gitkeep"), "shared harness file list should include tmp directory placeholders");
  assert(harnessFiles.includes(".github/workflows/agent-review.yml"), "shared harness file list should include review workflow files");
  assert(harnessFiles.includes("queueTaskFiles"), "shared harness file list should include every queued task file");
  assert(preflight.includes("export function commandGatePreview"), "shared preflight utility should export command-gate previews");
  assert(preflight.includes("export function taskCommandGatePreflight"), "shared preflight utility should export task command-gate preflight");
  assert(preflight.includes("export function findExecutable"), "shared preflight utility should export executable lookup");
  assert(cleanupUtils.includes("export function inspectStaleArtifacts"), "shared cleanup utility should expose stale artifact inspection");
  assert(cleanupUtils.includes("export function removeStaleArtifacts"), "shared cleanup utility should expose guarded cleanup");
  assert(cleanupUtils.includes("Refusing to clean path outside .agent"), "shared cleanup utility should guard against deleting outside .agent");
  assert(traceUtils.includes("export function assemblePrompt"), "shared trace utility should export prompt assembly");
  assert(traceUtils.includes("export function taskContractHash"), "shared trace utility should export task contract hashing");
  assert(traceUtils.includes("export function promptHash"), "shared trace utility should export prompt hashing");
  assert(traceUtils.includes("package.json is malformed"), "shared trace utility should tolerate malformed package.json while assembling prompts");
  assert(validator.includes("danger-full-access") && validator.includes("git\\s+reset"), "validator should reject dangerous unattended commands");
  assert(validator.includes("requiredHarnessFiles(root)"), "validator should require and scan the shared harness file list");
  assert(validator.includes("agent-harness-files.mjs"), "validator should require and scan shared harness file utilities");
  assert(validator.includes("stateFields"), "validator should reject unexpected state.json fields");
  assert(validator.includes("must not contain duplicate task"), "validator should reject duplicate task ids inside state buckets");
  assert(validator.includes("path.isAbsolute") && validator.includes("segments.includes(\"..\")"), "validator should reject paths outside the repo");
  assert(validator.includes("\\bsudo\\b"), "validator should reject sudo in unattended task commands");
  assert(validator.includes("branch must contain only"), "validator should constrain unattended branch names");
  assert(validator.includes("must include task id"), "validator should require task branches to include task ids");
  assert(validator.includes("allowed_paths must not be empty"), "validator should reject empty task scopes");
  assert(validator.includes("[\".git\", \"node_modules\", \".env\"]"), "validator should require tasks to forbid .git, node_modules, and .env");
  assert(validator.includes("commands must include \"node scripts/agent-validate.mjs\""), "validator should require the harness validator command gate");
  assert(validator.includes("acceptance must not contain empty criteria"), "validator should reject empty acceptance criteria");
  assert(validator.includes("depends_on must not contain duplicate dependency"), "validator should reject duplicate task dependencies");
  assert(validator.includes("validateCommandFeasibility"), "validator should detect impossible command gates");
  assert(validator.includes("--strict"), "validator should support warning-fatal strict mode");
  assert(validator.includes("taskPathOverlaps"), "validator should analyze allowed path overlap between queued tasks");
  assert(validator.includes("warnReadyTaskPathOverlaps"), "validator should warn only when currently ready tasks overlap");
  assert(validator.includes("path_overlaps"), "validator JSON output should expose path overlap analysis");
  assert(validator.includes("command cannot be parsed without a shell"), "validator should reject task commands the shell-free runner cannot parse");
  assert(validator.includes("command must not rely on shell redirection"), "validator should reject shell-only redirection and substitution syntax");
  assert(validator.includes("command must not use leading environment assignments"), "validator should reject leading env assignments in shell-free command gates");
  assert(validator.includes("validateSchemaEnums"), "validator should verify task and result schema enum contracts");
  assert(validator.includes("validateTaskSchemaArrayContracts"), "validator should protect task-schema array contracts");
  assert(validator.includes("validateTaskSchemaIdentityContract"), "validator should protect task-schema task-id patterns");
  assert(validator.includes("properties.${field}.items.type must be \"string\""), "validator should require string arrays in task-schema contracts");
  assert(taskSchema.includes("\"pattern\": \"^\\\\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$\""), "task schema should enforce task-id slug patterns");
  assert(taskSchema.includes("\"pattern\": \"^agent/\\\\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$\""), "task schema should enforce predictable agent branch patterns");
  assert(validator.includes("validateResultSchemaReportContracts"), "validator should protect nested result-schema report contracts");
  assert(validator.includes("validateResultSchemaIdentityContract"), "validator should protect result-schema task-id patterns");
  assert(resultSchema.includes("\"pattern\": \"^\\\\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$\""), "result schema should enforce task-id slug patterns");
  assert(validator.includes("properties.${arrayField}.items.additionalProperties must be false"), "validator should require closed nested result-schema item contracts");
  assert(validator.includes("requiredRunSchemaFields"), "validator should verify run manifest schema required fields");
  assert(validator.includes("state-schema.json"), "validator should load the runner state schema");
  assert(validator.includes("requiredStateFields"), "validator should verify runner state schema required fields");
  assert(validator.includes("runManifestFields"), "validator should reject unknown run manifest fields");
  assert(validator.includes("run-schema.json"), "validator should load the run manifest schema");
  assert(validator.includes("validateEventSchemaFile"), "validator should verify lifecycle event schema shape");
  assert(validator.includes("validateEventSchemaCommonFields"), "validator should protect lifecycle event schema common fields");
  assert(validator.includes("validateEventFile"), "validator should validate lifecycle event JSONL files");
  assert(validator.includes("expectedTaskIdFromEventFile"), "validator should derive lifecycle task ids from event log paths");
  assert(validator.includes("lifecycle event task_id"), "validator should validate lifecycle event task ids");
  assert(validator.includes("lifecycle event ${field} must be a nonnegative number"), "validator should validate lifecycle event durations");
  assert(validator.includes("lifecycle event timed_out must be a boolean"), "validator should validate lifecycle event booleans");
  assert(validator.includes("event-schema.json"), "validator should load the lifecycle event schema");
  assert(eventSchema.includes("\"task_id\""), "lifecycle event schema should document task ids");
  assert(eventSchema.includes("\"duration_ms\""), "lifecycle event schema should document durations");
  assert(eventSchema.includes("\"timed_out\""), "lifecycle event schema should document timeout booleans");
  assert(validator.includes("acceptance_results\", \"items\", \"properties\", \"status\", \"enum"), "validator should verify nested acceptance status enums");
  assert(validator.includes("validateCommandReportEntries"), "validator should reuse command-report validation for results and manifests");
  assert(validator.includes("taskOrDependenciesMayCreatePath"), "validator should account for dependency-created command gates");
  assert(validator.includes("command references missing script outside allowed_paths"), "validator should reject missing command scripts outside allowed paths");
  assert(validator.includes("npm command requires package.json"), "validator should reject npm gates when package.json cannot exist");
  assert(validator.includes("commands must not contain duplicate command"), "validator should reject duplicate task commands");
  assert(validator.includes("${fieldName} is missing task command"), "validator should require reports to account for every task command");
  assert(validator.includes("passed result must not contain skipped commands"), "validator should reject passed reports with skipped command gates");
  assert(validator.includes("acceptance_results is missing task criterion"), "validator should ensure result reports cover task acceptance criteria");
  assert(validator.includes("acceptance_results must not contain duplicate criterion"), "validator should reject duplicate acceptance criteria");
  assert(validator.includes("acceptance_results includes criterion outside task acceptance"), "validator should reject out-of-scope acceptance criteria");
  assert(validator.includes("matching Markdown report is missing"), "validator should require human reports beside result JSON");
  assert(validator.includes("Markdown report does not match a queued task"), "validator should reject orphan Markdown reports");
  assert(validator.includes("validateMarkdownReportFile"), "validator should validate human report structure");
  assert(validator.includes("validateMarkdownResultStatusConsistency"), "validator should compare Markdown report status with result JSON");
  assert(validator.includes("Markdown report status ${actualStatus} disagrees with result status"), "validator should reject Markdown/result status drift");
  assert(validator.includes("Markdown report is missing required section"), "validator should explain missing report sections");
  assert(validator.includes("## Traceability"), "validator should require traceability in Markdown reports");
  assert(validator.includes("validateHarnessIgnoreFiles"), "validator should check transient artifact ignore files");
  assert(validator.includes("validateReadme"), "validator should protect required harness README content");
  assert(validator.includes("to keep transient harness artifacts out of git"), "validator should explain log/tmp ignore requirements");
  assert(validator.includes("inspectStaleArtifacts"), "validator should use shared stale artifact detection");
  assert(validator.includes("stale temporary file from an interrupted atomic write"), "validator should explain stale temp warnings");
  assert(validator.includes("validateRunnerLock"), "validator should inspect runner lock files");
  assert(validator.includes("runner lock process"), "validator should warn about stale runner locks");
  assert(validator.includes("staleHeartbeatThresholdMs"), "validator should detect stale lifecycle heartbeat streams");
  assert(validator.includes("warnStaleRunningManifest"), "validator should warn when running manifests stop emitting events");
  assert(validator.includes("latest lifecycle event is"), "validator should explain stale lifecycle event warnings");
  assert(validator.includes("run manifest is still running but runner lock is absent"), "validator should warn about orphan running manifests");
  assert(validator.includes("warnStateResultConsistency"), "validator should cross-check state, result reports, and run manifests");
  assert(validator.includes("result status ${result.status} disagrees with .agent/state.json bucket"), "validator should warn when state buckets disagree with results");
  assert(validator.includes("manifest status ${manifestEntry.manifest.status} disagrees with result status"), "validator should warn when manifest and result statuses disagree");
  assert(validator.includes("finished manifest has no matching .agent/reports"), "validator should warn when a finished manifest has no result report");
  assert(validator.includes("running manifest disagrees with .agent/state.json current_task"), "validator should warn when running manifest and state current task disagree");
  assert(validator.includes("files_changed includes path outside allowed_paths"), "validator should reject out-of-scope reported file changes");
  assert(validator.includes("passed result must not contain failed commands"), "validator should reject contradictory passed reports");
  assert(validator.includes("validateRunManifestFile"), "validator should validate local run manifests");
  assert(validator.includes("collectArchivedRunManifestFiles"), "validator should discover archived run manifests");
  assert(validator.includes("artifactFallbackDir"), "validator should validate archived manifest artifacts in their moved bundle directory");
  assert(validator.includes("archivedRunManifestFiles"), "validator output should include archived run manifest coverage");
  assert(validator.includes("sha256Hex"), "validator should validate sha256 traceability hash shapes");
  assert(validator.includes("task_contract_hash"), "validator should validate manifest task contract hashes");
  assert(validator.includes("task_contract_file"), "validator should validate manifest task contract file paths");
  assert(validator.includes("worker_prompt_hash"), "validator should validate manifest worker prompt hashes");
  assert(validator.includes("environment must be an object"), "validator should validate manifest environment snapshot shape");
  assert(validator.includes("prompt_file"), "validator should validate Codex prompt file paths");
  assert(validator.includes("validateRepoRelativeFileField"), "validator should keep manifest artifact paths repo-relative");
  assert(validator.includes("validateArtifactHash"), "validator should verify traceability artifact hashes");
  assert(validator.includes("canonicalJsonFileHash"), "validator should hash task contract snapshots canonically");
  assert(validator.includes("content does not match"), "validator should report traceability hash mismatches");
  assert(validator.includes("codex_runs[${index}]") && validator.includes("prompt_hash"), "validator should validate Codex run prompt hashes");
  assert(validator.includes("commands_run\", manifest.status"), "validator should require run manifests to account for command gates when present");
  assert(validator.includes("command_gate_preflight.command_gates must match task command count"), "validator should validate manifest command-gate preflight shape");
  assert(validator.includes("validateCommandGateEntry"), "validator should validate each manifest command-gate preflight entry");
  assert(validator.includes(".command must match task command at index"), "validator should reject command-gate preflight drift");
  assert(validator.includes(".referenced_file must stay inside the repo when present"), "validator should reject unsafe command-gate referenced files");
  assert(validator.includes("validateRunSchemaCommandGateContract"), "validator should protect run-schema command-gate contracts");
  assert(validator.includes("command-gate schema properties are missing"), "validator should explain missing command-gate schema fields");
  assert(runSchema.includes("\"executable_available\""), "run manifest schema should describe command-gate executable checks");
  assert(runSchema.includes("\"command_parse_error\""), "run manifest schema should describe command-gate parse errors");
  assert(runSchema.includes("\"package_script_available\""), "run manifest schema should describe package-script checks");
  assert(validator.includes("run_id must be a stable string identifier"), "validator should require run_id in run manifests");
  assert(validator.includes("run manifest status cannot be pending"), "validator should reject pending run manifests");
  assert(validator.includes("finished_at must be an ISO-compatible date string"), "validator should validate run finish timestamps");
  assert(validator.includes("codex_runs[${index}].duration_ms"), "validator should validate Codex run durations");
  assert(validator.includes("run_manifests_checked"), "validator output should include run manifest coverage");
  assert(validator.includes("priority must be greater than dependency"), "validator should enforce dependency priority order");
  assert(validator.includes("priority ${task.priority} must match filename prefix"), "validator should require filename prefixes to match task priorities");
  assert(validator.includes("hardcoded API key"), "validator should scan harness prompts and workflows for hardcoded API keys");
  assert(validator.includes("github_pat_"), "validator should scan for GitHub personal access tokens");
  assert(validator.includes("npm_"), "validator should scan for npm access tokens");
  assert(validator.includes("AKIA"), "validator should scan for AWS access key ids");
  assert(validator.includes("pull_request_target"), "validator should reject unsafe PR review triggers");
  assert(validator.includes("permissions read-only"), "validator should reject writable Codex review permissions");
  assert(validator.includes("openai/codex-action@v1"), "validator should protect agent review workflow content");
  assert(validator.includes("node scripts/agent-selftest.mjs"), "validator should protect CI self-test execution");
  assert(validator.includes("node scripts/agent-summary.mjs --strict --json"), "validator should protect strict summary execution in CI");
  assert(ciWorkflow.includes("node scripts/agent-doctor.mjs --strict --json"), "CI should run doctor in strict JSON mode");
  assert(validator.includes(".agent/logs/.gitignore"), "validator should require tracked log ignore files");
  assert(validator.includes("without shell chaining"), "validator should reject chained unattended task commands");
  assert(ciWorkflow.includes("node scripts/agent-validate.mjs --strict"), "CI should run harness validation in strict mode");
  assert(ciWorkflow.includes("node scripts/agent-summary.mjs --strict --json"), "CI should run summary in strict mode");

  const reviewWorkflow = fs.readFileSync(path.join(root, ".github", "workflows", "agent-review.yml"), "utf8");
  assert(reviewWorkflow.includes("OPENAI_API_KEY"), "agent review workflow should reference OPENAI_API_KEY secret");
  assert(!/sk-[A-Za-z0-9]/.test(reviewWorkflow), "agent review workflow must not hardcode API keys");

  if (failures.length) {
    console.log("Agent harness self-test FAIL");
    for (const failure of failures) console.log(`- ${failure}`);
    process.exit(1);
  }

  console.log("Agent harness self-test PASS");
  console.log(`Tasks checked: ${tasks.length}`);
}

main();
