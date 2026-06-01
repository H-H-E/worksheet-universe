#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { inspectStaleArtifacts } from "./agent-cleanup-utils.mjs";
import { commandGatePreview, commandGateWarnings } from "./agent-preflight.mjs";
import { promptHash, taskContractHash } from "./agent-trace-utils.mjs";
import { validateHarnessFiles } from "./agent-validate.mjs";

const root = process.cwd();
const agentDir = path.join(root, ".agent");
const queueDir = path.join(agentDir, "queue");
const reportsDir = path.join(agentDir, "reports");
const logsDir = path.join(agentDir, "logs");
const statePath = path.join(agentDir, "state.json");
const statusOrder = ["pending", "running", "passed", "failed", "partial", "blocked"];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonResult(file) {
  try {
    return { value: readJson(file), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

function writeJson(file, value) {
  writeTextFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempFile, content);
  fs.renameSync(tempFile, file);
}

function loadTasks() {
  return fs.readdirSync(queueDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => readJson(path.join(queueDir, file)))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

function isComplete(taskId, tasks, state) {
  return state.completed.includes(taskId) || tasks.some((task) => task.id === taskId && task.status === "passed");
}

function effectiveStatus(task, tasks, state) {
  if (state.current_task === task.id) return "running";
  if (isComplete(task.id, tasks, state)) return "passed";
  if (state.failed.includes(task.id)) return "failed";
  if (state.partial.includes(task.id)) return "partial";
  if (state.blocked.includes(task.id)) return "blocked";
  return task.status;
}

function isReady(task, tasks, state) {
  return effectiveStatus(task, tasks, state) === "pending"
    && task.depends_on.every((dependency) => isComplete(dependency, tasks, state));
}

function loadResults() {
  if (!fs.existsSync(reportsDir)) return [];
  return fs.readdirSync(reportsDir)
    .filter((file) => file.endsWith(".result.json"))
    .map((file) => {
      const fullPath = path.join(reportsDir, file);
      const parsed = readJsonResult(fullPath);
      return { file: fullPath, result: parsed.value, error: parsed.error };
    })
    .sort((a, b) => {
      const left = a.result?.task_id || path.basename(a.file);
      const right = b.result?.task_id || path.basename(b.file);
      return left.localeCompare(right);
    });
}

function loadRunManifests() {
  if (!fs.existsSync(logsDir)) return [];
  return fs.readdirSync(logsDir)
    .map((entry) => path.join(logsDir, entry, "run.json"))
    .filter((file) => fs.existsSync(file))
    .map((file) => {
      const parsed = readJsonResult(file);
      return { file, manifest: parsed.value, error: parsed.error };
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.manifest?.updated_at || a.manifest?.started_at || "");
      const bTime = Date.parse(b.manifest?.updated_at || b.manifest?.started_at || "");
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
}

function loadArchivedRunManifests() {
  const archiveRoot = path.join(logsDir, "archive");
  if (!fs.existsSync(archiveRoot)) return [];
  const archived = [];
  for (const taskEntry of fs.readdirSync(archiveRoot, { withFileTypes: true })) {
    if (!taskEntry.isDirectory()) continue;
    const taskArchiveDir = path.join(archiveRoot, taskEntry.name);
    for (const runEntry of fs.readdirSync(taskArchiveDir, { withFileTypes: true })) {
      if (!runEntry.isDirectory()) continue;
      const archiveDir = path.join(taskArchiveDir, runEntry.name);
      const file = path.join(archiveDir, "run.json");
      if (!fs.existsSync(file)) continue;
      const parsed = readJsonResult(file);
      archived.push({
        file,
        archive_dir: archiveDir,
        archive_task_id: taskEntry.name,
        manifest: parsed.value,
        error: parsed.error
      });
    }
  }
  return archived.sort((a, b) => {
    const aTime = Date.parse(a.manifest?.updated_at || a.manifest?.started_at || "");
    const bTime = Date.parse(b.manifest?.updated_at || b.manifest?.started_at || "");
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

function readEventSummary(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.trim());
  let latest = null;
  let invalid = 0;
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const time = Date.parse(event?.at || "");
      if (!Number.isNaN(time) && (!latest || time > Date.parse(latest.at || ""))) latest = event;
    } catch {
      invalid += 1;
    }
  }
  return {
    file: path.relative(root, file),
    task_id: path.basename(path.dirname(file)),
    event_count: lines.length,
    invalid_event_count: invalid,
    latest_at: latest?.at || null,
    latest_type: latest?.type || null
  };
}

function loadEventSummaries() {
  if (!fs.existsSync(logsDir)) return [];
  return fs.readdirSync(logsDir)
    .map((entry) => path.join(logsDir, entry, "events.jsonl"))
    .filter((file) => fs.existsSync(file))
    .map(readEventSummary)
    .sort((left, right) => {
      const leftTime = Date.parse(left.latest_at || "");
      const rightTime = Date.parse(right.latest_at || "");
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });
}

function shortHash(hash) {
  return typeof hash === "string" && hash.length >= 12 ? hash.slice(0, 12) : "none";
}

function buildSummary(options = {}) {
  const validation = validateHarnessFiles();
  const validationFailed = validation.errors.length > 0 || (options.strict && validation.warnings.length > 0);
  const tasks = loadTasks();
  const state = readJson(statePath);
  const results = loadResults();
  const runManifests = loadRunManifests();
  const archivedRunManifests = loadArchivedRunManifests();
  const events = loadEventSummaries();
  const cleanup = inspectStaleArtifacts(root);
  const taskRows = tasks.map((task) => {
    const warnings = task.commands.map((command) => commandGatePreview(command, root)).flatMap(commandGateWarnings);
    return {
      id: task.id,
      title: task.title,
      lane: task.lane,
      priority: task.priority,
      status: effectiveStatus(task, tasks, state),
      ready: isReady(task, tasks, state),
      depends_on: task.depends_on,
      blocked_by: task.depends_on.filter((dependency) => !isComplete(dependency, tasks, state)),
      branch: task.branch,
      task_contract_hash: taskContractHash(task),
      prompt_hash: promptHash(task, root),
      command_gate_warning_count: warnings.length,
      command_gate_warnings: warnings
    };
  });
  const counts = taskRows.reduce((memo, task) => {
    memo[task.status] = (memo[task.status] || 0) + 1;
    return memo;
  }, Object.fromEntries(statusOrder.map((status) => [status, 0])));
  const readyTasks = taskRows.filter((task) => task.ready).map((task) => task.id);
  const nextTask = readyTasks[0] || null;
  const nextTaskContract = nextTask ? tasks.find((task) => task.id === nextTask) : null;
  const nextTaskCommandGates = nextTaskContract ? nextTaskContract.commands.map((command) => commandGatePreview(command, root)) : [];

  return {
    generated_at: new Date().toISOString(),
    strict: Boolean(options.strict),
    validation: {
      status: validationFailed ? "fail" : "pass",
      tasks_checked: validation.taskFiles.length,
      results_checked: validation.resultFiles.length,
      markdown_reports_checked: validation.markdownReportFiles.length,
      run_manifests_checked: validation.runManifestFiles.length,
      archived_run_manifests_checked: validation.archivedRunManifestFiles.length,
      event_files_checked: validation.eventFiles.length,
      archived_event_files_checked: validation.archivedEventFiles.length,
      errors: validation.errors,
      warnings: validation.warnings,
      path_overlaps_checked: validation.pathOverlaps.length,
      archived_run_manifests_found: archivedRunManifests.length
    },
    current_task: state.current_task,
    counts,
    ready_tasks: readyTasks,
    next_task: nextTask,
    next_task_contract_hash: nextTaskContract ? taskContractHash(nextTaskContract) : null,
    next_prompt_hash: nextTaskContract ? promptHash(nextTaskContract, root) : null,
    next_command: nextTask ? `node scripts/agent-runner.mjs --task ${nextTask}` : null,
    next_dry_run_command: nextTask ? `node scripts/agent-runner.mjs --task ${nextTask} --dry-run` : null,
    next_strict_command: nextTask ? `node scripts/agent-runner.mjs --task ${nextTask} --strict` : null,
    next_strict_dry_run_command: nextTask ? `node scripts/agent-runner.mjs --task ${nextTask} --dry-run --strict` : null,
    next_current_checkout_command: nextTask ? `node scripts/agent-runner.mjs --task ${nextTask} --no-worktree --allow-dirty --strict` : null,
    next_current_checkout_dry_run_command: nextTask ? `node scripts/agent-runner.mjs --task ${nextTask} --no-worktree --allow-dirty --dry-run --strict` : null,
    next_scope_check_command: nextTask ? `node scripts/agent-runner.mjs --scope-check ${nextTask}` : null,
    next_batch_dry_run_command: "node scripts/agent-runner.mjs --all --max-tasks 3 --dry-run",
    next_strict_batch_dry_run_command: "node scripts/agent-runner.mjs --all --max-tasks 3 --dry-run --strict",
    next_task_command_gates: nextTaskCommandGates,
    next_task_command_gate_warnings: nextTaskCommandGates.flatMap(commandGateWarnings),
    cleanup,
    queue_path_overlaps: validation.pathOverlaps,
    tasks: taskRows,
    results: results.map(({ file, result, error }) => ({
      file: path.relative(root, file),
      task_id: result?.task_id || path.basename(file, ".result.json"),
      status: error ? "invalid" : result.status,
      summary: error ? `Invalid JSON: ${error}` : result.summary
    })),
    run_manifests: runManifests.map(({ file, manifest, error }) => ({
      file: path.relative(root, file),
      task_id: manifest?.task_id || path.basename(path.dirname(file)),
      status: error ? "invalid" : manifest.status,
      updated_at: error ? null : (manifest.updated_at || null),
      duration_ms: error ? null : (manifest.duration_ms ?? null),
      attempts_used: error ? null : (manifest.attempts_used ?? null),
      task_contract_hash: error ? null : (manifest.task_contract_hash || null),
      worker_prompt_hash: error ? null : (manifest.worker_prompt_hash || null),
      environment: error ? null : (manifest.environment || null),
      command_gate_warning_count: error ? null : (manifest.command_gate_preflight?.command_gate_warnings?.length ?? null),
      summary: error ? `Invalid JSON: ${error}` : (manifest.summary || "")
    })),
    archived_run_manifests: archivedRunManifests.map(({ file, archive_dir, archive_task_id, manifest, error }) => ({
      file: path.relative(root, file),
      archive_dir: path.relative(root, archive_dir),
      task_id: error ? archive_task_id : (manifest.task_id || archive_task_id),
      status: error ? "invalid" : manifest.status,
      updated_at: error ? null : (manifest.updated_at || null),
      duration_ms: error ? null : (manifest.duration_ms ?? null),
      task_contract_hash: error ? null : (manifest.task_contract_hash || null),
      worker_prompt_hash: error ? null : (manifest.worker_prompt_hash || null),
      summary: error ? `Invalid JSON: ${error}` : (manifest.summary || "")
    })),
    events
  };
}

function markdown(summary) {
  const ready = summary.ready_tasks.length ? summary.ready_tasks.join(", ") : "none";
  const counts = Object.entries(summary.counts).map(([status, count]) => `${status}: ${count}`).join(", ");
  const taskRows = summary.tasks.map((task) => {
    const readyMark = task.ready ? "yes" : "no";
    return `| ${task.id} | ${task.status} | ${readyMark} | ${task.lane} | ${shortHash(task.task_contract_hash)} | ${shortHash(task.prompt_hash)} | ${task.command_gate_warning_count} | ${task.blocked_by.join(", ") || "none"} | ${task.depends_on.join(", ") || "none"} |`;
  }).join("\n");
  const resultRows = summary.results.length
    ? summary.results.map((result) => `| ${result.task_id} | ${result.status} | ${result.summary.replace(/\|/g, "\\|")} |`).join("\n")
    : "| none | none | No result reports yet. |";
  const runRows = summary.run_manifests.length
    ? summary.run_manifests.map((run) => `| ${run.task_id || "unknown"} | ${run.status || "unknown"} | ${run.updated_at || "unknown"} | ${run.duration_ms ?? "unknown"} | ${run.attempts_used ?? "unknown"} | ${shortHash(run.task_contract_hash)} | ${shortHash(run.worker_prompt_hash)} | ${run.command_gate_warning_count ?? "unknown"} | ${run.summary.replace(/\|/g, "\\|")} |`).join("\n")
    : "| none | none | none | none | none | none | none | none | No run manifests yet. |";
  const archivedRunRows = summary.archived_run_manifests.length
    ? summary.archived_run_manifests.map((run) => `| ${run.task_id || "unknown"} | ${run.status || "unknown"} | ${run.updated_at || "unknown"} | ${run.duration_ms ?? "unknown"} | ${shortHash(run.task_contract_hash)} | ${shortHash(run.worker_prompt_hash)} | ${run.archive_dir} | ${run.summary.replace(/\|/g, "\\|")} |`).join("\n")
    : "| none | none | none | none | none | none | none | No archived run manifests yet. |";
  const eventRows = summary.events.length
    ? summary.events.map((event) => `| ${event.task_id} | ${event.event_count} | ${event.invalid_event_count} | ${event.latest_at || "none"} | ${event.latest_type || "none"} | ${event.file} |`).join("\n")
    : "| none | 0 | 0 | none | none | No lifecycle event files yet. |";
  const gateRows = summary.next_task_command_gates.length
    ? summary.next_task_command_gates.map((gate) => {
      const target = gate.referenced_file || gate.package_script || "";
      const targetStatus = gate.referenced_file
        ? (gate.referenced_file_available ? "ok" : "missing")
        : gate.package_script
          ? (gate.package_script_available ? "ok" : "missing")
          : "";
      const parseStatus = gate.command_parse_error ? `error: ${gate.command_parse_error}` : "ok";
      return `| ${gate.command} | ${parseStatus} | ${gate.executable_available ? "ok" : "missing"} | ${target} | ${targetStatus} |`;
    }).join("\n")
    : "| none | none | none | none | none |";
  const gateWarnings = summary.next_task_command_gate_warnings.length
    ? summary.next_task_command_gate_warnings.map((warning) => `- ${warning}`).join("\n")
    : "- none";
  const validationErrors = summary.validation.errors.length
    ? summary.validation.errors.map((error) => `- ${error}`).join("\n")
    : "- none";
  const validationWarnings = summary.validation.warnings.length
    ? summary.validation.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- none";
  const cleanupFiles = summary.cleanup.stale_temp_files.length
    ? summary.cleanup.stale_temp_files.map((file) => `- ${file}`).join("\n")
    : "- none";
  const cleanupDirs = summary.cleanup.empty_directories.length
    ? summary.cleanup.empty_directories.map((dir) => `- ${dir}`).join("\n")
    : "- none";
  const overlapRows = summary.queue_path_overlaps.length
    ? summary.queue_path_overlaps.map((overlap) => `| ${overlap.left} | ${overlap.right} | ${overlap.shared.join("<br>")} |`).join("\n")
    : "| none | none | none |";

  return `# Agent Harness Summary

Generated: ${summary.generated_at}

Strict: ${summary.strict ? "yes" : "no"}

Validation: ${summary.validation.status}

Validation coverage: tasks=${summary.validation.tasks_checked}, results=${summary.validation.results_checked}, markdown_reports=${summary.validation.markdown_reports_checked}, run_manifests=${summary.validation.run_manifests_checked}, archived_run_manifests=${summary.validation.archived_run_manifests_checked}, event_files=${summary.validation.event_files_checked}, archived_event_files=${summary.validation.archived_event_files_checked}, archived_run_manifests_found=${summary.validation.archived_run_manifests_found}, path_overlaps=${summary.validation.path_overlaps_checked}

Current task: ${summary.current_task || "none"}

Counts: ${counts || "none"}

Ready tasks: ${ready}

Next task: ${summary.next_task || "none"}

Next task hash: ${shortHash(summary.next_task_contract_hash)}

Next prompt hash: ${shortHash(summary.next_prompt_hash)}

Next command: ${summary.next_command || "none"}

Next dry run: ${summary.next_dry_run_command || "none"}

Next strict command: ${summary.next_strict_command || "none"}

Next strict dry run: ${summary.next_strict_dry_run_command || "none"}

Next current-checkout run: ${summary.next_current_checkout_command || "none"}

Next current-checkout dry run: ${summary.next_current_checkout_dry_run_command || "none"}

Next scope check: ${summary.next_scope_check_command || "none"}

Batch dry run: ${summary.next_batch_dry_run_command}

Strict batch dry run: ${summary.next_strict_batch_dry_run_command}

## Validation Errors

${validationErrors}

## Validation Warnings

${validationWarnings}

## Cleanup

Stale temp files: ${summary.cleanup.stale_temp_file_count}

Empty transient directories: ${summary.cleanup.empty_directory_count}

Dry-run command: ${summary.cleanup.cleanup_dry_run_command}

Stale temp file list:

${cleanupFiles}

Empty transient directory list:

${cleanupDirs}

## Queue

| Task | Status | Ready | Lane | Task Hash | Prompt Hash | Gate Warnings | Blocked By | Dependencies |
|---|---|---|---|---|---|---|---|---|
${taskRows}

## Next Task Command Gates

| Command | Parse | Executable | Referenced target | Target status |
|---|---|---|---|---|
${gateRows}

Command gate warnings:

${gateWarnings}

## Queue Path Overlaps

Unordered task pairs below share allowed paths. This does not block sequential v1 runs, but parallel execution must lock or sequence these paths.

| Left Task | Right Task | Shared Allowed Paths |
|---|---|---|
${overlapRows}

## Results

| Task | Status | Summary |
|---|---|---|
${resultRows}

## Run Manifests

| Task | Status | Updated | Duration ms | Attempts | Task Hash | Prompt Hash | Gate Warnings | Summary |
|---|---|---|---|---|---|---|---|---|
${runRows}

## Archived Run Manifests

| Task | Status | Updated | Duration ms | Task Hash | Prompt Hash | Archive Dir | Summary |
|---|---|---|---|---|---|---|---|
${archivedRunRows}

## Lifecycle Events

| Task | Events | Invalid | Latest At | Latest Type | File |
|---|---:|---:|---|---|---|
${eventRows}
`;
}

function main() {
  const write = process.argv.includes("--write");
  const json = process.argv.includes("--json");
  const strict = process.argv.includes("--strict");
  const summary = buildSummary({ strict });

  if (write) {
    writeJson(path.join(reportsDir, "summary.json"), summary);
    writeTextFileAtomic(path.join(reportsDir, "summary.md"), markdown(summary));
  }

  if (json) console.log(JSON.stringify(summary, null, 2));
  else console.log(markdown(summary));

  if (summary.validation.status !== "pass") process.exit(1);
}

main();
