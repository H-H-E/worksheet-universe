#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { inspectStaleArtifacts } from "./agent-cleanup-utils.mjs";
import { commandParseError as commandTokenizationError, commandParts } from "./agent-command-utils.mjs";
import { requiredHarnessDirs, requiredHarnessFiles } from "./agent-harness-files.mjs";

const root = process.cwd();
const staleHeartbeatThresholdMs = 5 * 60 * 1000;
const lockPath = path.join(root, ".agent", "tmp", "runner.lock");
const statuses = new Set(["pending", "running", "passed", "failed", "partial", "blocked"]);
const resultStatuses = new Set(["passed", "failed", "partial", "blocked"]);
const runStatuses = new Set(["running", "passed", "failed", "partial", "blocked"]);
const commandStatuses = new Set(["passed", "failed", "skipped"]);
const acceptanceStatuses = new Set(["passed", "failed", "partial", "blocked", "unverified"]);
const lanes = new Set(["core", "rendering", "frontend", "docs", "review"]);
const sha256Hex = /^[0-9a-f]{64}$/i;
const taskIdPatternText = "^\\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$";
const branchPatternText = "^agent/\\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$";
const taskFields = new Set([
  "id",
  "title",
  "branch",
  "priority",
  "status",
  "lane",
  "allowed_paths",
  "forbidden_paths",
  "goal",
  "context",
  "acceptance",
  "commands",
  "max_attempts",
  "depends_on",
  "notes"
]);
const resultFields = new Set([
  "task_id",
  "status",
  "summary",
  "files_changed",
  "commands_run",
  "acceptance_results",
  "remaining_work",
  "risks",
  "next_recommended_task"
]);
const runManifestFields = new Set([
  "run_id",
  "task_id",
  "status",
  "started_at",
  "updated_at",
  "finished_at",
  "duration_ms",
  "summary",
  "task_contract_hash",
  "task_contract_file",
  "worker_prompt_hash",
  "cwd",
  "worktree",
  "environment",
  "commands",
  "command_gate_preflight",
  "attempts_used",
  "codex_timeout_minutes",
  "command_timeout_minutes",
  "baseline_changed_files",
  "files_changed",
  "commands_run",
  "codex_runs"
]);
const commandGateFields = new Set([
  "command",
  "executable",
  "executable_available",
  "command_parse_error",
  "argv",
  "referenced_file",
  "referenced_file_available",
  "package_json_present",
  "package_json_error",
  "package_script",
  "package_script_available"
]);
const requiredTaskFields = [
  "id",
  "title",
  "branch",
  "priority",
  "status",
  "lane",
  "goal",
  "acceptance",
  "commands",
  "max_attempts"
];
const requiredStateFields = [
  "started_at",
  "updated_at",
  "current_task",
  "completed",
  "failed",
  "partial",
  "blocked",
  "attempts",
  "last_run_summary"
];
const stateFields = new Set(requiredStateFields);
const requiredTaskSchemaFields = [
  "id",
  "title",
  "branch",
  "priority",
  "status",
  "lane",
  "goal",
  "acceptance",
  "commands",
  "max_attempts"
];
const requiredResultSchemaFields = [
  "task_id",
  "status",
  "summary",
  "files_changed",
  "commands_run",
  "acceptance_results",
  "remaining_work"
];
const requiredRunSchemaFields = [
  "run_id",
  "task_id",
  "status",
  "started_at",
  "updated_at",
  "task_contract_hash",
  "task_contract_file",
  "cwd",
  "worktree",
  "environment",
  "commands",
  "command_gate_preflight",
  "attempts_used",
  "codex_timeout_minutes",
  "command_timeout_minutes"
];
const requiredReportSections = [
  "Status:",
  "## Summary",
  "## Files Changed",
  "## Traceability",
  "## Codex Runs",
  "## Commands Run",
  "## Acceptance Checklist",
  "## Remaining Work",
  "## Logs",
  "## Branch / Worktree"
];

function readJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
    return null;
  }
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateSha256Field(rel, object, field, errors) {
  if (!(field in object)) return;
  if (typeof object[field] !== "string" || !sha256Hex.test(object[field])) {
    errors.push(`${rel}: ${field} must be a 64-character sha256 hex string when present`);
  }
}

function validateRepoRelativeFileField(rel, object, field, errors) {
  if (!(field in object)) return;
  const value = object[field];
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${rel}: ${field} must be a non-empty repo-relative path when present`);
    return;
  }
  if (path.isAbsolute(value) || value.replace(/\\/g, "/").split("/").includes("..")) {
    errors.push(`${rel}: ${field} must stay inside the repo when present`);
  }
}

function repoRelativeFilePath(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (path.isAbsolute(value) || value.replace(/\\/g, "/").split("/").includes("..")) return null;
  return path.join(root, value);
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function canonicalJsonFileHash(file) {
  return sha256Text(JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8")), null, 2));
}

function artifactHashCandidates(value, options = {}) {
  const candidates = [];
  const primaryFile = repoRelativeFilePath(value);
  if (primaryFile) candidates.push(primaryFile);
  if (options.fallbackDir && typeof value === "string" && value.trim()) {
    candidates.push(path.join(options.fallbackDir, path.basename(value)));
  }
  return [...new Set(candidates)];
}

function validateArtifactHash(rel, object, fileField, hashField, errors, options = {}) {
  if (!(fileField in object) || !(hashField in object)) return;
  const candidates = artifactHashCandidates(object[fileField], options);
  if (!candidates.length) return;
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) {
    errors.push(`${rel}: ${fileField} references missing file "${object[fileField]}"`);
    return;
  }
  try {
    const actual = options.canonicalJson ? canonicalJsonFileHash(file) : sha256File(file);
    if (actual !== object[hashField]) {
      errors.push(`${rel}: ${fileField} content does not match ${hashField}`);
    }
  } catch (error) {
    errors.push(`${rel}: could not hash ${fileField} "${object[fileField]}" (${error.message})`);
  }
}

function validatePathList(rel, field, paths, errors) {
  if (!Array.isArray(paths)) return;
  for (const entry of paths) {
    if (typeof entry !== "string") continue;
    if (!entry.trim()) {
      errors.push(`${rel}: ${field} must not include empty paths`);
      continue;
    }
    if (path.isAbsolute(entry)) {
      errors.push(`${rel}: ${field} must not include absolute path "${entry}"`);
    }
    const segments = entry.replace(/\\/g, "/").split("/");
    if (segments.includes("..")) {
      errors.push(`${rel}: ${field} must not escape the repo with "${entry}"`);
    }
  }
}

function normalizeTaskPath(entry) {
  return entry.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
}

function pathContainsPath(parent, child) {
  const normalizedParent = normalizeTaskPath(parent);
  const normalizedChild = normalizeTaskPath(child);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}/`);
}

function pathOverlap(left, right) {
  return pathContainsPath(left, right) || pathContainsPath(right, left);
}

function taskMayCreatePath(task, repoPath) {
  return Array.isArray(task.allowed_paths)
    && task.allowed_paths.some((allowedPath) => pathContainsPath(allowedPath, repoPath));
}

function taskOrDependenciesMayCreatePath(task, tasksById, repoPath, seen = new Set()) {
  if (!task || seen.has(task.id)) return false;
  seen.add(task.id);
  if (taskMayCreatePath(task, repoPath)) return true;
  return (task.depends_on || []).some((dependencyId) => {
    return taskOrDependenciesMayCreatePath(tasksById.get(dependencyId), tasksById, repoPath, seen);
  });
}

function referencedNodeScript(command) {
  const parts = commandParts(command);
  if (parts[0] !== "node") return null;
  return parts.find((part, index) => index > 0 && !part.startsWith("-") && /\.(?:mjs|cjs|js)$/.test(part)) || null;
}

function validateCommandFeasibility(rel, task, tasksById, command, errors) {
  const script = referencedNodeScript(command);
  if (script) {
    if (path.isAbsolute(script) || script.replace(/\\/g, "/").split("/").includes("..")) {
      errors.push(`${rel}: command references script outside the repo: ${command}`);
      return;
    }
    if (!fs.existsSync(path.join(root, script)) && !taskOrDependenciesMayCreatePath(task, tasksById, script)) {
      errors.push(`${rel}: command references missing script outside allowed_paths: ${command}`);
    }
  }

  const parts = commandParts(command);
  if (parts[0] === "npm" && parts[1] === "run" && !fs.existsSync(path.join(root, "package.json")) && !taskOrDependenciesMayCreatePath(task, tasksById, "package.json")) {
    errors.push(`${rel}: npm command requires package.json, but package.json is missing and not in allowed_paths: ${command}`);
  }
}

function validateTask(file, task, errors, counts) {
  const rel = path.relative(root, file);
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    errors.push(`${rel}: task must be a JSON object`);
    return;
  }

  for (const field of requiredTaskFields) {
    if (!(field in task)) errors.push(`${rel}: missing required field "${field}"`);
  }

  for (const field of Object.keys(task)) {
    if (!taskFields.has(field)) errors.push(`${rel}: unexpected field "${field}"`);
  }

  const expectedId = path.basename(file, ".json");
  const filenamePriority = Number.parseInt(expectedId.slice(0, 3), 10);
  if (!/^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(path.basename(file))) {
    errors.push(`${rel}: filename must use NNN-lowercase-slug.json`);
  }
  if (task.id !== expectedId) errors.push(`${rel}: id "${task.id}" must match filename "${expectedId}"`);
  if (typeof task.title !== "string" || !task.title.trim()) errors.push(`${rel}: title must be a non-empty string`);
  if (typeof task.branch !== "string" || !task.branch.trim()) errors.push(`${rel}: branch must be present`);
  if (!Number.isInteger(task.priority) || task.priority < 1) errors.push(`${rel}: priority must be a positive integer`);
  if (typeof task.branch === "string" && /\s/.test(task.branch)) errors.push(`${rel}: branch must not contain whitespace`);
  if (Number.isInteger(task.priority) && Number.isInteger(filenamePriority) && task.priority !== filenamePriority) {
    errors.push(`${rel}: priority ${task.priority} must match filename prefix ${String(filenamePriority).padStart(3, "0")}`);
  }
  if (typeof task.branch === "string" && !/^[A-Za-z0-9._/-]+$/.test(task.branch)) {
    errors.push(`${rel}: branch must contain only letters, numbers, slash, dot, underscore, or dash`);
  }
  if (typeof task.branch === "string" && task.branch.startsWith("-")) {
    errors.push(`${rel}: branch must not start with dash`);
  }
  if (typeof task.branch === "string" && (task.branch.includes("..") || task.branch.includes("@{") || task.branch.includes("//") || /[/.]$/.test(task.branch) || task.branch.endsWith(".lock"))) {
    errors.push(`${rel}: branch has an invalid git ref shape`);
  }
  if (typeof task.branch === "string" && typeof task.id === "string" && !task.branch.includes(task.id)) {
    errors.push(`${rel}: branch "${task.branch}" must include task id "${task.id}"`);
  }
  if (typeof task.branch === "string" && typeof task.id === "string" && task.branch !== `agent/${task.id}`) {
    errors.push(`${rel}: branch "${task.branch}" must equal "agent/${task.id}"`);
  }
  if (!statuses.has(task.status)) errors.push(`${rel}: invalid status "${task.status}"`);
  if (!lanes.has(task.lane)) errors.push(`${rel}: invalid lane "${task.lane}"`);
  if (!isStringArray(task.allowed_paths)) errors.push(`${rel}: allowed_paths must be an array of strings`);
  validatePathList(rel, "allowed_paths", task.allowed_paths, errors);
  if (Array.isArray(task.allowed_paths)) {
    if (task.allowed_paths.length === 0) {
      errors.push(`${rel}: allowed_paths must not be empty`);
    }
    for (const allowedPath of task.allowed_paths) {
      if ([".", "./", "/", "*", "**"].includes(allowedPath)) {
        errors.push(`${rel}: allowed_paths must not include broad path "${allowedPath}"`);
      }
    }
  }
  if (!isStringArray(task.forbidden_paths)) errors.push(`${rel}: forbidden_paths must be an array of strings`);
  validatePathList(rel, "forbidden_paths", task.forbidden_paths, errors);
  if (Array.isArray(task.forbidden_paths) && task.forbidden_paths.length === 0) {
    errors.push(`${rel}: forbidden_paths must not be empty`);
  }
  for (const requiredForbiddenPath of [".git", "node_modules", ".env"]) {
    if (Array.isArray(task.forbidden_paths) && !task.forbidden_paths.includes(requiredForbiddenPath)) {
      errors.push(`${rel}: forbidden_paths must include ${requiredForbiddenPath}`);
    }
  }
  if (Array.isArray(task.allowed_paths) && Array.isArray(task.forbidden_paths)) {
    for (const allowedPath of task.allowed_paths) {
      const conflict = task.forbidden_paths.find((forbiddenPath) => {
        return pathContainsPath(allowedPath, forbiddenPath) || pathContainsPath(forbiddenPath, allowedPath);
      });
      if (conflict) errors.push(`${rel}: allowed path "${allowedPath}" conflicts with forbidden path "${conflict}"`);
    }
  }
  if (typeof task.goal !== "string" || !task.goal.trim()) errors.push(`${rel}: goal must be a non-empty string`);
  if (!isStringArray(task.acceptance) || task.acceptance.length === 0) {
    errors.push(`${rel}: acceptance must be a non-empty array of strings`);
  } else {
    for (const criterion of task.acceptance) {
      if (!criterion.trim()) errors.push(`${rel}: acceptance must not contain empty criteria`);
    }
  }
  if (!isStringArray(task.commands) || task.commands.length === 0) {
    errors.push(`${rel}: commands must be a non-empty array of strings`);
  }
  if (Array.isArray(task.commands)) {
    if (!task.commands.includes("node scripts/agent-validate.mjs")) {
      errors.push(`${rel}: commands must include "node scripts/agent-validate.mjs" as a harness gate`);
    }
    const seenCommands = new Set();
    const dangerousPatterns = [
      /danger-full-access/,
      /\brm\s+-rf\b/,
      /\bgit\s+reset\s+--hard\b/,
      /\bgit\s+clean\b/,
      /\bgit\s+push\b/,
      /\bsudo\b/,
      /\bchmod\s+-R\s+777\b/,
      /\bdd\s+if=/
    ];
    for (const command of task.commands) {
      if (typeof command === "string" && !command.trim()) {
        errors.push(`${rel}: commands must not contain empty command strings`);
        continue;
      }
      if (seenCommands.has(command)) {
        errors.push(`${rel}: commands must not contain duplicate command "${command}"`);
      }
      seenCommands.add(command);
      const tokenizationError = commandTokenizationError(command);
      if (tokenizationError) {
        errors.push(`${rel}: command cannot be parsed without a shell: ${command} (${tokenizationError})`);
      }
      if (dangerousPatterns.some((pattern) => pattern.test(command))) {
        errors.push(`${rel}: command is too destructive for an unattended task: ${command}`);
      }
      if (/&&|\|\||;|\|/.test(command)) {
        errors.push(`${rel}: command must be a single command without shell chaining: ${command}`);
      }
      if (/[<>`]/.test(command) || /\$\(/.test(command)) {
        errors.push(`${rel}: command must not rely on shell redirection, backticks, or command substitution: ${command}`);
      }
      const parts = commandParts(command);
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[0] || "")) {
        errors.push(`${rel}: command must not use leading environment assignments because commands run without a shell: ${command}`);
      }
    }
  }
  if (!Number.isInteger(task.max_attempts) || task.max_attempts < 1 || task.max_attempts > 5) {
    errors.push(`${rel}: max_attempts must be an integer from 1 to 5`);
  }
  if (!isStringArray(task.depends_on)) errors.push(`${rel}: depends_on must be an array of strings`);
  if (Array.isArray(task.depends_on)) {
    const seenDependencies = new Set();
    for (const dependency of task.depends_on) {
      if (dependency === task.id) errors.push(`${rel}: depends_on must not include the task itself`);
      if (seenDependencies.has(dependency)) errors.push(`${rel}: depends_on must not contain duplicate dependency "${dependency}"`);
      seenDependencies.add(dependency);
    }
  }
  if (typeof task.context !== "string") errors.push(`${rel}: context must be a string`);
  if (typeof task.notes !== "string") errors.push(`${rel}: notes must be a string`);

  counts[task.status] = (counts[task.status] || 0) + 1;
}

function validateState(file, state, errors) {
  const rel = path.relative(root, file);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    errors.push(`${rel}: state must be a JSON object`);
    return;
  }

  for (const field of requiredStateFields) {
    if (!(field in state)) errors.push(`${rel}: missing required field "${field}"`);
  }
  for (const field of Object.keys(state)) {
    if (!stateFields.has(field)) errors.push(`${rel}: unexpected field "${field}"`);
  }

  for (const field of ["completed", "failed", "partial", "blocked"]) {
    if (!isStringArray(state[field])) errors.push(`${rel}: ${field} must be an array of strings`);
  }
  if (state.current_task !== null && typeof state.current_task !== "string") {
    errors.push(`${rel}: current_task must be null or a string`);
  }
  for (const field of ["started_at", "updated_at"]) {
    if (state[field] !== null && (typeof state[field] !== "string" || Number.isNaN(Date.parse(state[field])))) {
      errors.push(`${rel}: ${field} must be null or an ISO-compatible date string`);
    }
  }
  if (state.last_run_summary !== null && typeof state.last_run_summary !== "string") {
    errors.push(`${rel}: last_run_summary must be null or a string`);
  }
  if (!state.attempts || typeof state.attempts !== "object" || Array.isArray(state.attempts)) {
    errors.push(`${rel}: attempts must be an object`);
  }
}

function validateSchemaFile(file, schema, requiredFields, knownFields, errors) {
  const rel = path.relative(root, file);
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  if (typeof schema.$schema !== "string" || !schema.$schema.includes("json-schema.org")) {
    errors.push(`${rel}: $schema must declare a JSON Schema dialect`);
  }
  if (schema.type !== "object") {
    errors.push(`${rel}: type must be "object"`);
  }
  if (schema.additionalProperties !== false) {
    errors.push(`${rel}: additionalProperties must be false`);
  }
  if (!Array.isArray(schema.required)) {
    errors.push(`${rel}: required must be an array`);
    return;
  }
  for (const field of requiredFields) {
    if (!schema.required.includes(field)) errors.push(`${rel}: required is missing "${field}"`);
  }
  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    errors.push(`${rel}: properties must be an object`);
    return;
  }
  for (const field of knownFields) {
    if (!(field in schema.properties)) errors.push(`${rel}: properties is missing "${field}"`);
  }
  for (const field of Object.keys(schema.properties)) {
    if (!knownFields.has(field)) errors.push(`${rel}: properties contains unknown field "${field}"`);
  }
}

function validateEventSchemaFile(file, schema, errors) {
  const rel = path.relative(root, file);
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  if (typeof schema.$schema !== "string" || !schema.$schema.includes("json-schema.org")) {
    errors.push(`${rel}: $schema must declare a JSON Schema dialect`);
  }
  if (schema.type !== "object") {
    errors.push(`${rel}: type must be "object"`);
  }
  if (schema.additionalProperties !== true) {
    errors.push(`${rel}: additionalProperties must be true because lifecycle events carry event-specific details`);
  }
  if (!Array.isArray(schema.required) || !schema.required.includes("at") || !schema.required.includes("type")) {
    errors.push(`${rel}: required must include "at" and "type"`);
  }
  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    errors.push(`${rel}: properties must be an object`);
    return;
  }
  for (const field of ["at", "type"]) {
    if (!(field in schema.properties)) errors.push(`${rel}: properties is missing "${field}"`);
  }
}

function validateEventSchemaCommonFields(file, schema, errors) {
  const rel = path.relative(root, file);
  if (!schema?.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) return;
  for (const field of [
    "task_id",
    "command",
    "duration_ms",
    "elapsed_ms",
    "timeout_minutes",
    "code",
    "timed_out",
    "log",
    "prompt_file",
    "stdout",
    "stderr",
    "output",
    "result_copy",
    "task_contract_file"
  ]) {
    if (!(field in schema.properties)) {
      errors.push(`${rel}: lifecycle event schema is missing common field "${field}"`);
    }
  }
}

function schemaValueAt(schema, segments) {
  return segments.reduce((value, segment) => {
    if (!value || typeof value !== "object") return undefined;
    return value[segment];
  }, schema);
}

function validateSchemaEnum(file, schema, segments, expectedValues, errors) {
  const rel = path.relative(root, file);
  const actual = schemaValueAt(schema, segments);
  const label = segments.join(".");
  if (!Array.isArray(actual)) {
    errors.push(`${rel}: ${label}.enum must be an array`);
    return;
  }
  const actualSet = new Set(actual);
  for (const value of expectedValues) {
    if (!actualSet.has(value)) errors.push(`${rel}: ${label}.enum is missing "${value}"`);
  }
  for (const value of actualSet) {
    if (!expectedValues.has(value)) errors.push(`${rel}: ${label}.enum contains unsupported value "${value}"`);
  }
}

function validateTaskSchemaArrayContracts(file, taskSchema, errors) {
  const rel = path.relative(root, file);
  for (const field of ["allowed_paths", "forbidden_paths", "acceptance", "commands", "depends_on"]) {
    const arraySchema = schemaValueAt(taskSchema, ["properties", field]);
    if (!arraySchema || typeof arraySchema !== "object" || Array.isArray(arraySchema)) {
      errors.push(`${rel}: properties.${field} must be an array schema`);
      continue;
    }
    if (arraySchema.type !== "array") {
      errors.push(`${rel}: properties.${field}.type must be "array"`);
    }
    if (!arraySchema.items || arraySchema.items.type !== "string") {
      errors.push(`${rel}: properties.${field}.items.type must be "string"`);
    }
  }
}

function validateTaskSchemaIdentityContract(file, taskSchema, errors) {
  const rel = path.relative(root, file);
  const idPattern = schemaValueAt(taskSchema, ["properties", "id", "pattern"]);
  const branchPattern = schemaValueAt(taskSchema, ["properties", "branch", "pattern"]);
  const dependencyPattern = schemaValueAt(taskSchema, ["properties", "depends_on", "items", "pattern"]);
  if (idPattern !== taskIdPatternText) {
    errors.push(`${rel}: properties.id.pattern must enforce NNN-lowercase-slug task ids`);
  }
  if (branchPattern !== branchPatternText) {
    errors.push(`${rel}: properties.branch.pattern must enforce agent/<task-id> branch names`);
  }
  if (dependencyPattern !== taskIdPatternText) {
    errors.push(`${rel}: properties.depends_on.items.pattern must enforce NNN-lowercase-slug task ids`);
  }
}

function validateRunSchemaCommandGateContract(file, runSchema, errors) {
  const rel = path.relative(root, file);
  const preflight = schemaValueAt(runSchema, ["properties", "command_gate_preflight"]);
  if (!preflight || typeof preflight !== "object" || Array.isArray(preflight)) {
    errors.push(`${rel}: properties.command_gate_preflight must be an object schema`);
    return;
  }
  if (preflight.type !== "object") {
    errors.push(`${rel}: properties.command_gate_preflight.type must be "object"`);
  }
  if (preflight.additionalProperties !== false) {
    errors.push(`${rel}: properties.command_gate_preflight.additionalProperties must be false`);
  }
  if (!Array.isArray(preflight.required)) {
    errors.push(`${rel}: properties.command_gate_preflight.required must be an array`);
  } else {
    for (const field of ["command_gates", "command_gate_warnings"]) {
      if (!preflight.required.includes(field)) {
        errors.push(`${rel}: properties.command_gate_preflight.required is missing "${field}"`);
      }
    }
  }

  const gateItems = schemaValueAt(runSchema, ["properties", "command_gate_preflight", "properties", "command_gates", "items"]);
  if (!gateItems || typeof gateItems !== "object" || Array.isArray(gateItems)) {
    errors.push(`${rel}: command-gate schema properties are missing command_gates.items`);
    return;
  }
  if (gateItems.type !== "object") {
    errors.push(`${rel}: command-gate schema properties must describe object items`);
  }
  if (gateItems.additionalProperties !== false) {
    errors.push(`${rel}: command-gate schema properties must set additionalProperties false`);
  }
  if (!Array.isArray(gateItems.required) || !gateItems.required.includes("command")) {
    errors.push(`${rel}: command-gate schema properties must require "command"`);
  }
  const gateProperties = gateItems.properties;
  if (!gateProperties || typeof gateProperties !== "object" || Array.isArray(gateProperties)) {
    errors.push(`${rel}: command-gate schema properties must be an object`);
    return;
  }
  for (const field of commandGateFields) {
    if (!(field in gateProperties)) {
      errors.push(`${rel}: command-gate schema properties are missing "${field}"`);
    }
  }
}

function validateResultSchemaArrayItemContract(file, resultSchema, arrayField, expectedFields, errors) {
  const rel = path.relative(root, file);
  const itemSchema = schemaValueAt(resultSchema, ["properties", arrayField, "items"]);
  if (!itemSchema || typeof itemSchema !== "object" || Array.isArray(itemSchema)) {
    errors.push(`${rel}: properties.${arrayField}.items must be an object schema`);
    return;
  }
  if (itemSchema.type !== "object") {
    errors.push(`${rel}: properties.${arrayField}.items.type must be "object"`);
  }
  if (itemSchema.additionalProperties !== false) {
    errors.push(`${rel}: properties.${arrayField}.items.additionalProperties must be false`);
  }
  if (!Array.isArray(itemSchema.required)) {
    errors.push(`${rel}: properties.${arrayField}.items.required must be an array`);
  } else {
    for (const field of expectedFields) {
      if (!itemSchema.required.includes(field)) {
        errors.push(`${rel}: properties.${arrayField}.items.required is missing "${field}"`);
      }
    }
  }
  if (!itemSchema.properties || typeof itemSchema.properties !== "object" || Array.isArray(itemSchema.properties)) {
    errors.push(`${rel}: properties.${arrayField}.items.properties must be an object`);
    return;
  }
  for (const field of expectedFields) {
    if (!(field in itemSchema.properties)) {
      errors.push(`${rel}: properties.${arrayField}.items.properties is missing "${field}"`);
    }
  }
}

function validateResultSchemaReportContracts(file, resultSchema, errors) {
  validateResultSchemaArrayItemContract(file, resultSchema, "commands_run", ["command", "status", "notes"], errors);
  validateResultSchemaArrayItemContract(file, resultSchema, "acceptance_results", ["criterion", "status", "notes"], errors);
}

function validateResultSchemaIdentityContract(file, resultSchema, errors) {
  const rel = path.relative(root, file);
  const taskIdPattern = schemaValueAt(resultSchema, ["properties", "task_id", "pattern"]);
  const nextTaskPattern = schemaValueAt(resultSchema, ["properties", "next_recommended_task", "pattern"]);
  if (taskIdPattern !== taskIdPatternText) {
    errors.push(`${rel}: properties.task_id.pattern must enforce NNN-lowercase-slug task ids`);
  }
  if (nextTaskPattern !== taskIdPatternText) {
    errors.push(`${rel}: properties.next_recommended_task.pattern must enforce NNN-lowercase-slug task ids`);
  }
}

function validateSchemaEnums(taskSchemaPath, taskSchema, resultSchemaPath, resultSchema, runSchemaPath, runSchema, errors) {
  if (taskSchema) {
    validateSchemaEnum(taskSchemaPath, taskSchema, ["properties", "status", "enum"], statuses, errors);
    validateSchemaEnum(taskSchemaPath, taskSchema, ["properties", "lane", "enum"], lanes, errors);
    validateTaskSchemaArrayContracts(taskSchemaPath, taskSchema, errors);
    validateTaskSchemaIdentityContract(taskSchemaPath, taskSchema, errors);
  }
  if (resultSchema) {
    validateSchemaEnum(resultSchemaPath, resultSchema, ["properties", "status", "enum"], resultStatuses, errors);
    validateSchemaEnum(resultSchemaPath, resultSchema, ["properties", "commands_run", "items", "properties", "status", "enum"], commandStatuses, errors);
    validateSchemaEnum(resultSchemaPath, resultSchema, ["properties", "acceptance_results", "items", "properties", "status", "enum"], acceptanceStatuses, errors);
    validateResultSchemaReportContracts(resultSchemaPath, resultSchema, errors);
    validateResultSchemaIdentityContract(resultSchemaPath, resultSchema, errors);
  }
  if (runSchema) {
    validateSchemaEnum(runSchemaPath, runSchema, ["properties", "status", "enum"], runStatuses, errors);
    validateSchemaEnum(runSchemaPath, runSchema, ["properties", "commands_run", "items", "properties", "status", "enum"], commandStatuses, errors);
    validateSchemaEnum(runSchemaPath, runSchema, ["properties", "codex_runs", "items", "properties", "status", "enum"], new Set(["passed", "failed"]), errors);
    validateRunSchemaCommandGateContract(runSchemaPath, runSchema, errors);
  }
}

function validateHarnessLayout(errors) {
  for (const dir of requiredHarnessDirs) {
    const fullPath = path.join(root, dir);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      errors.push(`${dir}: required harness directory is missing`);
    }
  }
  for (const file of requiredHarnessFiles(root)) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      errors.push(`${file}: required harness file is missing`);
    }
  }
}

function validateHarnessIgnoreFiles(errors) {
  for (const file of [".agent/logs/.gitignore", ".agent/tmp/.gitignore"]) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const requiredLine of ["*", "!.gitignore", "!.gitkeep"]) {
      if (!lines.includes(requiredLine)) {
        errors.push(`${file}: must include "${requiredLine}" to keep transient harness artifacts out of git`);
      }
    }
  }
}

function validatePromptFile(file, requiredPhrases, errors) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) return;
  const text = fs.readFileSync(fullPath, "utf8").toLowerCase();
  for (const phrase of requiredPhrases) {
    if (!text.includes(phrase.toLowerCase())) {
      errors.push(`${file}: prompt must include "${phrase}"`);
    }
  }
}

function validatePrompts(errors) {
  validatePromptFile("AGENTS.md", [
    "open-source worksheet compiler",
    "teacher input -> worksheet JSON -> editable preview -> exports -> tests",
    "JSON is the source of truth",
    "Read your assigned `.agent/queue/*.json` task",
    "Only modify paths listed in `allowed_paths`",
    "Do not build accounts, payments, auth",
    "Run all checks listed by the task",
    "Write `.agent/reports/<task-id>.md`",
    "Prefer small tested changes",
    "Do not delete working functionality",
    "Do not rewrite the architecture",
    "`passed`, `failed`, `partial`, or `blocked`"
  ], errors);
  validatePromptFile(".agent/prompts/worker.md", [
    "Read `AGENTS.md` before editing",
    "Complete exactly the assigned task",
    "Only modify allowed_paths",
    "Do not build unrelated features",
    "Do not add accounts, payments, auth",
    "Preserve JSON as the source of truth",
    ".agent/reports/<task-id>.md",
    ".agent/result-schema.json"
  ], errors);
  validatePromptFile(".agent/prompts/repair.md", [
    "Read `AGENTS.md`",
    "Fix only the failures shown in the logs",
    "Do not add new features",
    "Do not rewrite unrelated files",
    "Do not change task scope",
    ".agent/reports/<task-id>.md"
  ], errors);
  validatePromptFile(".agent/prompts/reviewer.md", [
    "Read `AGENTS.md`",
    "every acceptance criterion",
    "unrelated file changes",
    "scope creep",
    "whether JSON remains the source of truth",
    "whether commands pass"
  ], errors);
  validatePromptFile(".github/codex/prompts/review.md", [
    "task",
    "scope creep",
    "unsafe secrets",
    "JSON remaining the source of truth",
    "accounts, payments, auth"
  ], errors);
}

function validateReadme(errors) {
  validatePromptFile(".agent/README.md", [
    "What the harness is",
    "Why Short-Lived Tasks",
    "JSON Contracts",
    ".agent/run-schema.json",
    ".agent/event-schema.json",
    ".agent/state-schema.json",
    "scripts/agent-cleanup-utils.mjs",
    "npm run agent:doctor",
    "npm run agent:validate",
    "npm run agent:list",
    "npm run agent:next",
    "node scripts/agent-runner.mjs --task 002-schema-and-fixtures",
    "node scripts/agent-runner.mjs --all --max-tasks 3 --dry-run",
    "codex exec --sandbox workspace-write",
    ".agent/logs/<task-id>/",
    ".agent/reports/<task-id>.md",
    "../<repo-name>-<task-id>",
    "--reset-running",
    "JSON is the source of truth",
    "Do not build accounts"
  ], errors);
}

function validateNoHardcodedSecrets(errors) {
  const files = requiredHarnessFiles(root);
  const secretPatterns = [
    /sk-[A-Za-z0-9_-]{16,}/,
    /sk-proj-[A-Za-z0-9_-]{16,}/,
    /ghp_[A-Za-z0-9_]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /npm_[A-Za-z0-9_-]{20,}/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
    /AIza[0-9A-Za-z_-]{35}/,
    /AKIA[0-9A-Z]{16}/
  ];
  for (const file of files) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) continue;
    const text = fs.readFileSync(fullPath, "utf8");
    if (secretPatterns.some((pattern) => pattern.test(text))) {
      errors.push(`${file}: appears to contain a hardcoded API key`);
    }
  }
}

function validateWorkflowFiles(errors) {
  const ciPath = path.join(root, ".github", "workflows", "ci.yml");
  if (fs.existsSync(ciPath)) {
    const ci = fs.readFileSync(ciPath, "utf8");
    for (const phrase of [
      "actions/checkout@v4",
      "actions/setup-node@v4",
      "node-version: \"20\"",
      "timeout-minutes:",
      "node scripts/agent-validate.mjs --strict",
      "node scripts/agent-doctor.mjs --strict --json",
      "node scripts/agent-selftest.mjs",
      "node scripts/agent-summary.mjs --strict --json"
    ]) {
      if (!ci.includes(phrase)) errors.push(`.github/workflows/ci.yml: missing required workflow content "${phrase}"`);
    }
  }

  const reviewPath = path.join(root, ".github", "workflows", "agent-review.yml");
  if (fs.existsSync(reviewPath)) {
    const review = fs.readFileSync(reviewPath, "utf8");
    for (const phrase of [
      "openai/codex-action@v1",
      "OPENAI_API_KEY",
      "sandbox: read-only",
      "persist-credentials: false",
      "timeout-minutes:",
      "actions/upload-artifact@v4",
      ".github/codex/prompts/review.md"
    ]) {
      if (!review.includes(phrase)) errors.push(`.github/workflows/agent-review.yml: missing required workflow content "${phrase}"`);
    }
    if (/pull_request_target:/.test(review)) {
      errors.push(".github/workflows/agent-review.yml: must not use pull_request_target for untrusted PR review");
    }
    if (/contents:\s*write/.test(review) || /pull-requests:\s*write/.test(review)) {
      errors.push(".github/workflows/agent-review.yml: Codex review workflow must keep repository and PR permissions read-only");
    }
  }
}

function validateTaskGraph(tasks, errors) {
  const byId = new Map();
  const priorities = new Map();
  const branches = new Map();

  for (const task of tasks) {
    if (!task?.id) continue;
    if (byId.has(task.id)) errors.push(`${task.id}: duplicate task id`);
    byId.set(task.id, task);

    if (typeof task.priority === "number") {
      const matches = priorities.get(task.priority) || [];
      matches.push(task.id);
      priorities.set(task.priority, matches);
    }

    if (typeof task.branch === "string") {
      const matches = branches.get(task.branch) || [];
      matches.push(task.id);
      branches.set(task.branch, matches);
    }
  }

  for (const [priority, ids] of priorities.entries()) {
    if (ids.length > 1) errors.push(`queue: duplicate priority ${priority} (${ids.join(", ")})`);
  }

  for (const [branch, ids] of branches.entries()) {
    if (ids.length > 1) errors.push(`queue: duplicate branch "${branch}" (${ids.join(", ")})`);
  }

  for (const task of tasks) {
    if (!Array.isArray(task.depends_on)) continue;
    for (const dependency of task.depends_on) {
      if (dependency === task.id) errors.push(`${task.id}: task cannot depend on itself`);
      if (!byId.has(dependency)) errors.push(`${task.id}: unknown dependency "${dependency}"`);
      const dependencyTask = byId.get(dependency);
      if (dependencyTask && Number.isInteger(task.priority) && Number.isInteger(dependencyTask.priority) && task.priority <= dependencyTask.priority) {
        errors.push(`${task.id}: priority must be greater than dependency ${dependency}`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(task, stack) {
    if (!task?.id || visited.has(task.id)) return;
    if (visiting.has(task.id)) {
      errors.push(`queue: dependency cycle detected (${[...stack, task.id].join(" -> ")})`);
      return;
    }
    visiting.add(task.id);
    for (const dependency of task.depends_on || []) visit(byId.get(dependency), [...stack, task.id]);
    visiting.delete(task.id);
    visited.add(task.id);
  }
  for (const task of tasks) visit(task, []);
}

function dependsOnTask(task, targetId, tasksById, seen = new Set()) {
  if (!task || seen.has(task.id)) return false;
  seen.add(task.id);
  for (const dependencyId of task.depends_on || []) {
    if (dependencyId === targetId) return true;
    if (dependsOnTask(tasksById.get(dependencyId), targetId, tasksById, seen)) return true;
  }
  return false;
}

function taskPathOverlaps(tasks) {
  const overlaps = [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  for (let leftIndex = 0; leftIndex < tasks.length; leftIndex += 1) {
    const left = tasks[leftIndex];
    if (!Array.isArray(left.allowed_paths)) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < tasks.length; rightIndex += 1) {
      const right = tasks[rightIndex];
      if (!Array.isArray(right.allowed_paths)) continue;
      const ordered = dependsOnTask(left, right.id, tasksById) || dependsOnTask(right, left.id, tasksById);
      if (ordered) continue;
      const shared = [];
      for (const leftPath of left.allowed_paths) {
        for (const rightPath of right.allowed_paths) {
          if (pathOverlap(leftPath, rightPath)) shared.push(`${leftPath} <-> ${rightPath}`);
        }
      }
      if (shared.length) {
        overlaps.push({ left: left.id, right: right.id, shared });
      }
    }
  }
  return overlaps;
}

function isTaskCompleteForValidation(task, state) {
  return task?.status === "passed" || (Array.isArray(state?.completed) && state.completed.includes(task.id));
}

function taskEffectiveStatusForValidation(task, state) {
  if (state?.current_task === task.id) return "running";
  if (isTaskCompleteForValidation(task, state)) return "passed";
  for (const [bucket, status] of [["failed", "failed"], ["partial", "partial"], ["blocked", "blocked"]]) {
    if (Array.isArray(state?.[bucket]) && state[bucket].includes(task.id)) return status;
  }
  return task.status;
}

function isTaskReadyForValidation(task, tasksById, state) {
  return taskEffectiveStatusForValidation(task, state) === "pending"
    && (task.depends_on || []).every((dependencyId) => isTaskCompleteForValidation(tasksById.get(dependencyId), state));
}

function warnReadyTaskPathOverlaps(tasks, state, warnings) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const readyTasks = tasks.filter((task) => isTaskReadyForValidation(task, tasksById, state));
  for (const overlap of taskPathOverlaps(readyTasks)) {
    warnings.push(`queue: ready tasks ${overlap.left} and ${overlap.right} share allowed_paths (${overlap.shared.join(", ")}); run sequentially or add a dependency before parallel execution`);
  }
}

function validateTaskCommandFeasibility(tasks, errors) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    if (!Array.isArray(task.commands)) continue;
    const file = path.join(root, ".agent", "queue", `${task.id}.json`);
    const rel = path.relative(root, file);
    for (const command of task.commands) {
      if (typeof command !== "string") continue;
      validateCommandFeasibility(rel, task, tasksById, command, errors);
    }
  }
}

function validateStateReferences(state, tasks, errors) {
  if (!state || !tasks.length) return;
  const ids = new Set(tasks.map((task) => task.id));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seenBuckets = new Map();
  for (const field of ["completed", "failed", "partial", "blocked"]) {
    const seenInBucket = new Set();
    for (const id of state[field] || []) {
      if (!ids.has(id)) errors.push(`.agent/state.json: ${field} references unknown task "${id}"`);
      if (seenInBucket.has(id)) errors.push(`.agent/state.json: ${field} must not contain duplicate task "${id}"`);
      seenInBucket.add(id);
      if (seenBuckets.has(id)) {
        errors.push(`.agent/state.json: task "${id}" appears in both ${seenBuckets.get(id)} and ${field}`);
      }
      seenBuckets.set(id, field);
    }
  }
  if (state.current_task && !ids.has(state.current_task)) {
    errors.push(`.agent/state.json: current_task references unknown task "${state.current_task}"`);
  }
  if (state.current_task && seenBuckets.has(state.current_task)) {
    errors.push(`.agent/state.json: current_task "${state.current_task}" also appears in ${seenBuckets.get(state.current_task)}`);
  }
  for (const [id, attempts] of Object.entries(state.attempts || {})) {
    if (!ids.has(id)) errors.push(`.agent/state.json: attempts references unknown task "${id}"`);
    if (!Number.isInteger(attempts) || attempts < 0) {
      errors.push(`.agent/state.json: attempts.${id} must be a nonnegative integer`);
    }
    const task = byId.get(id);
    if (task && Number.isInteger(attempts) && attempts > task.max_attempts) {
      errors.push(`.agent/state.json: attempts.${id} exceeds task max_attempts ${task.max_attempts}`);
    }
  }
}

function validateResultFile(file, result, tasksById, errors) {
  const rel = path.relative(root, file);
  const expectedTaskId = path.basename(file, ".result.json");
  const expectedMarkdown = file.replace(/\.result\.json$/, ".md");
  if (!fs.existsSync(expectedMarkdown)) {
    errors.push(`${rel}: matching Markdown report is missing (${path.relative(root, expectedMarkdown)})`);
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    errors.push(`${rel}: result must be a JSON object`);
    return;
  }
  for (const field of requiredResultSchemaFields) {
    if (!(field in result)) errors.push(`${rel}: missing required field "${field}"`);
  }
  for (const field of Object.keys(result)) {
    if (!resultFields.has(field)) errors.push(`${rel}: unexpected field "${field}"`);
  }
  if (!["passed", "failed", "partial", "blocked"].includes(result.status)) {
    errors.push(`${rel}: invalid status "${result.status}"`);
  }
  if (typeof result.summary !== "string" || !result.summary.trim()) {
    errors.push(`${rel}: summary must be a non-empty string`);
  }
  if (typeof result.task_id === "string" && tasksById.size && !tasksById.has(result.task_id)) {
    errors.push(`${rel}: task_id references unknown task "${result.task_id}"`);
  }
  if (typeof result.task_id === "string" && result.task_id !== expectedTaskId) {
    errors.push(`${rel}: task_id "${result.task_id}" must match filename "${expectedTaskId}"`);
  }
  for (const field of ["files_changed", "commands_run", "acceptance_results", "remaining_work"]) {
    if (!Array.isArray(result[field])) errors.push(`${rel}: ${field} must be an array`);
  }
  if (Array.isArray(result.files_changed) && !result.files_changed.every((item) => typeof item === "string")) {
    errors.push(`${rel}: files_changed must contain only strings`);
  }
  const task = typeof result.task_id === "string" ? tasksById.get(result.task_id) : null;
  if (task && Array.isArray(result.files_changed)) {
    const allowed = [...(task.allowed_paths || []), ".agent/reports"];
    const forbidden = task.forbidden_paths || [];
    for (const file of result.files_changed) {
      if (typeof file !== "string") continue;
      if (path.isAbsolute(file) || file.replace(/\\/g, "/").split("/").includes("..")) {
        errors.push(`${rel}: files_changed must stay repo-relative (${file})`);
        continue;
      }
      const forbiddenMatch = forbidden.find((entry) => pathContainsPath(entry, file));
      if (forbiddenMatch) {
        errors.push(`${rel}: files_changed includes forbidden path "${file}" (${forbiddenMatch})`);
        continue;
      }
      if (!allowed.some((entry) => pathContainsPath(entry, file))) {
        errors.push(`${rel}: files_changed includes path outside allowed_paths "${file}"`);
      }
    }
  }
  if (Array.isArray(result.remaining_work) && !result.remaining_work.every((item) => typeof item === "string")) {
    errors.push(`${rel}: remaining_work must contain only strings`);
  }
  if (result.status === "passed" && Array.isArray(result.remaining_work) && result.remaining_work.length > 0) {
    errors.push(`${rel}: passed result must not include remaining_work`);
  }
  if (result.status !== "passed" && Array.isArray(result.remaining_work) && result.remaining_work.length === 0) {
    errors.push(`${rel}: non-passed result should include remaining_work`);
  }
  if ("risks" in result && (!Array.isArray(result.risks) || !result.risks.every((item) => typeof item === "string"))) {
    errors.push(`${rel}: risks must be an array of strings`);
  }
  if ("next_recommended_task" in result && result.next_recommended_task !== null && typeof result.next_recommended_task !== "string") {
    errors.push(`${rel}: next_recommended_task must be a string or null`);
  }
  if (typeof result.next_recommended_task === "string" && tasksById.size && !tasksById.has(result.next_recommended_task)) {
    errors.push(`${rel}: next_recommended_task references unknown task "${result.next_recommended_task}"`);
  }
  if (Array.isArray(result.commands_run)) {
    validateCommandReportEntries(rel, result.commands_run, task, errors, "commands_run", result.status);
  }
  if (Array.isArray(result.acceptance_results)) {
    const reportedCriteria = new Set();
    result.acceptance_results.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`${rel}: acceptance_results[${index}] must be an object`);
        return;
      }
      for (const field of ["criterion", "status", "notes"]) {
        if (typeof entry[field] !== "string") errors.push(`${rel}: acceptance_results[${index}].${field} must be a string`);
      }
      if (!["passed", "failed", "partial", "blocked", "unverified"].includes(entry.status)) {
        errors.push(`${rel}: acceptance_results[${index}].status is invalid`);
      }
      if (typeof entry.criterion === "string") {
        if (!entry.criterion.trim()) {
          errors.push(`${rel}: acceptance_results[${index}].criterion must be non-empty`);
        }
        if (reportedCriteria.has(entry.criterion)) {
          errors.push(`${rel}: acceptance_results must not contain duplicate criterion "${entry.criterion}"`);
        }
        reportedCriteria.add(entry.criterion);
        if (task && !(task.acceptance || []).includes(entry.criterion)) {
          errors.push(`${rel}: acceptance_results includes criterion outside task acceptance "${entry.criterion}"`);
        }
      }
      if (result.status === "passed" && entry.status !== "passed") {
        errors.push(`${rel}: passed result must mark all acceptance results passed`);
      }
    });
  }
  if (task && Array.isArray(result.acceptance_results)) {
    const reportedCriteria = new Set(result.acceptance_results.map((entry) => entry?.criterion).filter(Boolean));
    for (const criterion of task.acceptance || []) {
      if (!reportedCriteria.has(criterion)) {
        errors.push(`${rel}: acceptance_results is missing task criterion "${criterion}"`);
      }
    }
  }
}

function validateMarkdownReportFile(file, errors) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  for (const section of requiredReportSections) {
    if (!text.includes(section)) {
      errors.push(`${rel}: Markdown report is missing required section "${section}"`);
    }
  }
  const status = markdownReportStatus(text);
  if (!status) {
    errors.push(`${rel}: Markdown report Status line must be "Status: <passed|failed|partial|blocked>"`);
  } else if (!resultStatuses.has(status)) {
    errors.push(`${rel}: Markdown report status "${status}" is invalid`);
  }
}

function markdownReportStatus(text) {
  const match = text.match(/^Status:\s*([A-Za-z-]+)\s*$/m);
  return match ? match[1] : null;
}

function validateMarkdownResultStatusConsistency(markdownReportFiles, resultReports, errors) {
  const resultStatusByTask = new Map(resultReports
    .filter(({ result }) => typeof result?.task_id === "string" && resultStatuses.has(result.status))
    .map(({ result }) => [result.task_id, result.status]));
  for (const file of markdownReportFiles) {
    const taskId = path.basename(file, ".md");
    const expectedStatus = resultStatusByTask.get(taskId);
    if (!expectedStatus) continue;
    const actualStatus = markdownReportStatus(fs.readFileSync(file, "utf8"));
    if (actualStatus && actualStatus !== expectedStatus) {
      errors.push(`${path.relative(root, file)}: Markdown report status ${actualStatus} disagrees with result status ${expectedStatus}`);
    }
  }
}

function validateCommandReportEntries(rel, entries, task, errors, fieldName, resultStatus = null) {
  const reportedCommands = new Set();
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${rel}: ${fieldName}[${index}] must be an object`);
      return;
    }
    for (const field of ["command", "status", "notes"]) {
      if (typeof entry[field] !== "string") errors.push(`${rel}: ${fieldName}[${index}].${field} must be a string`);
    }
    if (!["passed", "failed", "skipped"].includes(entry.status)) {
      errors.push(`${rel}: ${fieldName}[${index}].status is invalid`);
    }
    if (task && typeof entry.command === "string" && !task.commands.includes(entry.command)) {
      errors.push(`${rel}: ${fieldName}[${index}].command is not declared by task ${task.id}`);
    }
    if (typeof entry.command === "string") {
      if (reportedCommands.has(entry.command)) {
        errors.push(`${rel}: ${fieldName} contains duplicate command "${entry.command}"`);
      }
      reportedCommands.add(entry.command);
    }
    if (resultStatus === "passed" && entry.status === "failed") {
      errors.push(`${rel}: passed result must not contain failed commands`);
    }
    if (resultStatus === "passed" && entry.status === "skipped") {
      errors.push(`${rel}: passed result must not contain skipped commands`);
    }
  });
  if (task) {
    for (const command of task.commands || []) {
      if (!reportedCommands.has(command)) {
        errors.push(`${rel}: ${fieldName} is missing task command "${command}"`);
      }
    }
  }
}

function validateCommandGateEntry(rel, gate, index, task, errors) {
  const base = `command_gate_preflight.command_gates[${index}]`;
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) {
    errors.push(`${rel}: ${base} must be an object`);
    return;
  }
  for (const field of Object.keys(gate)) {
    if (!commandGateFields.has(field)) errors.push(`${rel}: ${base}.${field} is unexpected`);
  }
  if (typeof gate.command !== "string" || !gate.command.trim()) {
    errors.push(`${rel}: ${base}.command must be a non-empty string`);
  } else if (task && typeof task.commands[index] === "string" && gate.command !== task.commands[index]) {
    errors.push(`${rel}: ${base}.command must match task command at index ${index}`);
  } else if (task && typeof task.commands[index] !== "string") {
    errors.push(`${rel}: ${base}.command has no matching task command at index ${index}`);
  }
  if ("executable" in gate && typeof gate.executable !== "string") {
    errors.push(`${rel}: ${base}.executable must be a string when present`);
  }
  if ("executable_available" in gate && typeof gate.executable_available !== "boolean") {
    errors.push(`${rel}: ${base}.executable_available must be a boolean when present`);
  }
  for (const field of ["command_parse_error", "package_json_error", "package_script"]) {
    if (field in gate && gate[field] !== null && typeof gate[field] !== "string") {
      errors.push(`${rel}: ${base}.${field} must be null or a string when present`);
    }
  }
  if ("argv" in gate && !isStringArray(gate.argv)) {
    errors.push(`${rel}: ${base}.argv must be an array of strings when present`);
  }
  if ("referenced_file" in gate) {
    const value = gate.referenced_file;
    if (value !== null && (typeof value !== "string" || !value.trim())) {
      errors.push(`${rel}: ${base}.referenced_file must be null or a non-empty repo-relative path when present`);
    } else if (typeof value === "string" && (path.isAbsolute(value) || value.replace(/\\/g, "/").split("/").includes(".."))) {
      errors.push(`${rel}: ${base}.referenced_file must stay inside the repo when present`);
    }
  }
  for (const field of ["referenced_file_available", "package_script_available"]) {
    if (field in gate && gate[field] !== null && typeof gate[field] !== "boolean") {
      errors.push(`${rel}: ${base}.${field} must be null or a boolean when present`);
    }
  }
  if ("package_json_present" in gate && typeof gate.package_json_present !== "boolean") {
    errors.push(`${rel}: ${base}.package_json_present must be a boolean when present`);
  }
}

function validateRunManifestFile(file, manifest, tasksById, errors, options = {}) {
  const rel = path.relative(root, file);
  const expectedTaskId = options.expectedTaskId || path.basename(path.dirname(file));
  const artifactFallbackDir = options.artifactFallbackDir || null;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    errors.push(`${rel}: run manifest must be a JSON object`);
    return;
  }
  for (const field of requiredRunSchemaFields) {
    if (!(field in manifest)) errors.push(`${rel}: missing required field "${field}"`);
  }
  for (const field of Object.keys(manifest)) {
    if (!runManifestFields.has(field)) errors.push(`${rel}: unexpected field "${field}"`);
  }
  if (typeof manifest.run_id !== "string" || !/^[0-9a-fA-F-]{16,}$/.test(manifest.run_id)) {
    errors.push(`${rel}: run_id must be a stable string identifier`);
  }
  if (manifest.task_id !== expectedTaskId) {
    errors.push(`${rel}: task_id "${manifest.task_id}" must match log task id "${expectedTaskId}"`);
  }
  const task = typeof manifest.task_id === "string" ? tasksById.get(manifest.task_id) : null;
  if (!task) {
    errors.push(`${rel}: task_id references unknown task "${manifest.task_id}"`);
  }
  validateSha256Field(rel, manifest, "task_contract_hash", errors);
  validateSha256Field(rel, manifest, "worker_prompt_hash", errors);
  validateRepoRelativeFileField(rel, manifest, "task_contract_file", errors);
  validateArtifactHash(rel, manifest, "task_contract_file", "task_contract_hash", errors, {
    canonicalJson: true,
    fallbackDir: artifactFallbackDir
  });
  if (!statuses.has(manifest.status)) {
    errors.push(`${rel}: invalid status "${manifest.status}"`);
  } else if (manifest.status === "pending") {
    errors.push(`${rel}: run manifest status cannot be pending`);
  }
  for (const field of ["started_at", "updated_at"]) {
    if (typeof manifest[field] !== "string" || Number.isNaN(Date.parse(manifest[field]))) {
      errors.push(`${rel}: ${field} must be an ISO-compatible date string`);
    }
  }
  if ("finished_at" in manifest && (typeof manifest.finished_at !== "string" || Number.isNaN(Date.parse(manifest.finished_at)))) {
    errors.push(`${rel}: finished_at must be an ISO-compatible date string when present`);
  }
  if ("duration_ms" in manifest && (!Number.isFinite(manifest.duration_ms) || manifest.duration_ms < 0)) {
    errors.push(`${rel}: duration_ms must be a nonnegative number when present`);
  }
  if (typeof manifest.cwd !== "string" || !manifest.cwd.trim()) {
    errors.push(`${rel}: cwd must be a non-empty string`);
  }
  if ("worktree" in manifest && manifest.worktree !== null && typeof manifest.worktree !== "string") {
    errors.push(`${rel}: worktree must be null or a string`);
  }
  if ("environment" in manifest && (!manifest.environment || typeof manifest.environment !== "object" || Array.isArray(manifest.environment))) {
    errors.push(`${rel}: environment must be an object when present`);
  }
  if (!isStringArray(manifest.commands)) {
    errors.push(`${rel}: commands must be an array of strings`);
  } else if (task && JSON.stringify(manifest.commands) !== JSON.stringify(task.commands)) {
    errors.push(`${rel}: commands must match task command list`);
  }
  if ("command_gate_preflight" in manifest) {
    const preflight = manifest.command_gate_preflight;
    if (!preflight || typeof preflight !== "object" || Array.isArray(preflight)) {
      errors.push(`${rel}: command_gate_preflight must be an object when present`);
    } else {
      if (!Array.isArray(preflight.command_gates)) {
        errors.push(`${rel}: command_gate_preflight.command_gates must be an array`);
      } else {
        if (task && preflight.command_gates.length !== task.commands.length) {
          errors.push(`${rel}: command_gate_preflight.command_gates must match task command count`);
        }
        preflight.command_gates.forEach((gate, index) => validateCommandGateEntry(rel, gate, index, task, errors));
      }
      if (!Array.isArray(preflight.command_gate_warnings) || !preflight.command_gate_warnings.every((entry) => typeof entry === "string")) {
        errors.push(`${rel}: command_gate_preflight.command_gate_warnings must be an array of strings`);
      }
    }
  }
  if (!Number.isInteger(manifest.attempts_used) || manifest.attempts_used < 0) {
    errors.push(`${rel}: attempts_used must be a nonnegative integer`);
  } else if (task && manifest.attempts_used > task.max_attempts) {
    errors.push(`${rel}: attempts_used exceeds task max_attempts ${task.max_attempts}`);
  }
  for (const field of ["codex_timeout_minutes", "command_timeout_minutes"]) {
    if (typeof manifest[field] !== "number" || manifest[field] < 0) {
      errors.push(`${rel}: ${field} must be a nonnegative number`);
    }
  }
  if ("files_changed" in manifest && !isStringArray(manifest.files_changed)) {
    errors.push(`${rel}: files_changed must be an array of strings`);
  }
  if ("baseline_changed_files" in manifest && !isStringArray(manifest.baseline_changed_files)) {
    errors.push(`${rel}: baseline_changed_files must be an array of strings`);
  }
  if ("commands_run" in manifest && !Array.isArray(manifest.commands_run)) {
    errors.push(`${rel}: commands_run must be an array`);
  } else if (Array.isArray(manifest.commands_run)) {
    validateCommandReportEntries(rel, manifest.commands_run, task, errors, "commands_run", manifest.status);
  }
  if ("codex_runs" in manifest) {
    if (!Array.isArray(manifest.codex_runs)) {
      errors.push(`${rel}: codex_runs must be an array`);
    } else {
      manifest.codex_runs.forEach((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          errors.push(`${rel}: codex_runs[${index}] must be an object`);
          return;
        }
        if (typeof entry.suffix !== "string" || !entry.suffix.trim()) {
          errors.push(`${rel}: codex_runs[${index}].suffix must be a non-empty string`);
        }
        if (!["passed", "failed"].includes(entry.status)) {
          errors.push(`${rel}: codex_runs[${index}].status is invalid`);
        }
        if (!Number.isInteger(entry.exit_code)) {
          errors.push(`${rel}: codex_runs[${index}].exit_code must be an integer`);
        }
        if (typeof entry.timed_out !== "boolean") {
          errors.push(`${rel}: codex_runs[${index}].timed_out must be a boolean`);
        }
        if (!Number.isFinite(entry.duration_ms) || entry.duration_ms < 0) {
          errors.push(`${rel}: codex_runs[${index}].duration_ms must be a nonnegative number`);
        }
        validateSha256Field(`${rel}: codex_runs[${index}]`, entry, "prompt_hash", errors);
        validateRepoRelativeFileField(`${rel}: codex_runs[${index}]`, entry, "prompt_file", errors);
        validateArtifactHash(`${rel}: codex_runs[${index}]`, entry, "prompt_file", "prompt_hash", errors, {
          fallbackDir: artifactFallbackDir
        });
        if ("result_copy" in entry && entry.result_copy !== null && typeof entry.result_copy !== "string") {
          errors.push(`${rel}: codex_runs[${index}].result_copy must be a string or null`);
        }
      });
    }
  }
}

function stateBucketForStatus(status) {
  if (status === "passed") return "completed";
  if (status === "failed") return "failed";
  if (status === "partial") return "partial";
  if (status === "blocked") return "blocked";
  return null;
}

function stateBucketForTask(state, taskId) {
  if (!state || !taskId) return null;
  for (const bucket of ["completed", "failed", "partial", "blocked"]) {
    if (Array.isArray(state[bucket]) && state[bucket].includes(taskId)) return bucket;
  }
  return null;
}

function warnStateResultConsistency(state, resultReports, runManifests, warnings) {
  if (!state) return;
  const resultByTask = new Map(resultReports
    .filter(({ result }) => result?.task_id)
    .map(({ result, file }) => [result.task_id, { result, file }]));
  const manifestByTask = new Map(runManifests
    .filter(({ manifest }) => manifest?.task_id)
    .map(({ manifest, file }) => [manifest.task_id, { manifest, file }]));

  for (const [taskId, { result, file }] of resultByTask.entries()) {
    const expectedBucket = stateBucketForStatus(result.status);
    const actualBucket = stateBucketForTask(state, taskId);
    if (expectedBucket && actualBucket !== expectedBucket) {
      warnings.push(`${path.relative(root, file)}: result status ${result.status} disagrees with .agent/state.json bucket ${actualBucket || "none"}`);
    }
    const manifestEntry = manifestByTask.get(taskId);
    if (manifestEntry && manifestEntry.manifest.status !== "running" && manifestEntry.manifest.status !== result.status) {
      warnings.push(`${path.relative(root, manifestEntry.file)}: manifest status ${manifestEntry.manifest.status} disagrees with result status ${result.status}`);
    }
  }

  for (const bucket of ["completed", "failed", "partial", "blocked"]) {
    for (const taskId of state[bucket] || []) {
      if (!resultByTask.has(taskId)) {
        warnings.push(`.agent/state.json: ${bucket} contains ${taskId}, but .agent/reports/${taskId}.result.json is missing`);
      }
    }
  }

  for (const [taskId, { manifest, file }] of manifestByTask.entries()) {
    if (manifest.status !== "running" && !resultByTask.has(taskId)) {
      warnings.push(`${path.relative(root, file)}: finished manifest has no matching .agent/reports/${taskId}.result.json`);
    }
    if (manifest.status === "running" && state.current_task !== taskId) {
      warnings.push(`${path.relative(root, file)}: running manifest disagrees with .agent/state.json current_task ${state.current_task || "none"}`);
    }
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

function validateRunnerLock(warnings) {
  if (!fs.existsSync(lockPath)) return;
  const rel = path.relative(root, lockPath);
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (error) {
    warnings.push(`${rel}: runner lock is not valid JSON (${error.message})`);
    return;
  }
  if (!lock || typeof lock !== "object" || Array.isArray(lock)) {
    warnings.push(`${rel}: runner lock must be a JSON object`);
    return;
  }
  if (!Number.isInteger(lock.pid) || lock.pid <= 0) {
    warnings.push(`${rel}: runner lock pid is missing or invalid`);
  } else if (!isProcessAlive(lock.pid)) {
    warnings.push(`${rel}: runner lock process ${lock.pid} does not appear to be alive`);
  }
  if (typeof lock.started_at !== "string" || Number.isNaN(Date.parse(lock.started_at))) {
    warnings.push(`${rel}: runner lock started_at is missing or invalid`);
  }
}

function latestEventTime(file, errors) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  let latest = null;
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      const time = Date.parse(event?.at || "");
      if (!Number.isNaN(time) && (latest === null || time > latest)) latest = time;
    } catch {
      errors.push(`${rel}:${index + 1}: cannot inspect lifecycle event age because event JSON is invalid`);
    }
  });
  return latest;
}

function warnStaleRunningManifest(file, manifest, warnings, errors) {
  if (manifest?.status !== "running") return;
  const eventFile = path.join(path.dirname(file), "events.jsonl");
  if (!fs.existsSync(eventFile)) {
    warnings.push(`${path.relative(root, file)}: running manifest has no lifecycle event log`);
    return;
  }
  const latest = latestEventTime(eventFile, errors);
  if (latest === null) {
    warnings.push(`${path.relative(root, file)}: running manifest has no timestamped lifecycle events`);
    return;
  }
  const ageMs = Date.now() - latest;
  if (ageMs > staleHeartbeatThresholdMs) {
    warnings.push(`${path.relative(root, file)}: latest lifecycle event is ${Math.round(ageMs / 1000)}s old; inspect for a stuck runner`);
  }
}

function collectArchivedRunManifestFiles(logsDir) {
  const archiveRoot = path.join(logsDir, "archive");
  if (!fs.existsSync(archiveRoot)) return [];
  const manifests = [];
  for (const taskEntry of fs.readdirSync(archiveRoot, { withFileTypes: true })) {
    if (!taskEntry.isDirectory()) continue;
    const taskArchiveDir = path.join(archiveRoot, taskEntry.name);
    for (const runEntry of fs.readdirSync(taskArchiveDir, { withFileTypes: true })) {
      if (!runEntry.isDirectory()) continue;
      const archiveDir = path.join(taskArchiveDir, runEntry.name);
      const file = path.join(archiveDir, "run.json");
      if (fs.existsSync(file)) {
        manifests.push({
          file,
          taskId: taskEntry.name,
          archiveDir
        });
      }
    }
  }
  return manifests.sort((left, right) => left.file.localeCompare(right.file));
}

function collectEventFiles(logsDir) {
  if (!fs.existsSync(logsDir)) return [];
  return fs.readdirSync(logsDir)
    .map((entry) => path.join(logsDir, entry, "events.jsonl"))
    .filter((file) => fs.existsSync(file))
    .sort();
}

function collectArchivedEventFiles(logsDir) {
  const archiveRoot = path.join(logsDir, "archive");
  if (!fs.existsSync(archiveRoot)) return [];
  const files = [];
  for (const taskEntry of fs.readdirSync(archiveRoot, { withFileTypes: true })) {
    if (!taskEntry.isDirectory()) continue;
    const taskArchiveDir = path.join(archiveRoot, taskEntry.name);
    for (const runEntry of fs.readdirSync(taskArchiveDir, { withFileTypes: true })) {
      if (!runEntry.isDirectory()) continue;
      const file = path.join(taskArchiveDir, runEntry.name, "events.jsonl");
      if (fs.existsSync(file)) files.push(file);
    }
  }
  return files.sort();
}

function expectedTaskIdFromEventFile(file) {
  const segments = path.relative(root, file).replace(/\\/g, "/").split("/");
  if (segments[0] !== ".agent" || segments[1] !== "logs") return null;
  if (segments[2] === "archive") return segments[3] || null;
  return segments[2] || null;
}

function validateEventFileField(rel, lineNumber, event, field, errors) {
  if (!(field in event)) return;
  const value = event[field];
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${rel}:${lineNumber}: lifecycle event ${field} must be a non-empty string when present`);
    return;
  }
  if (path.isAbsolute(value) || value.replace(/\\/g, "/").split("/").includes("..")) {
    errors.push(`${rel}:${lineNumber}: lifecycle event ${field} must stay inside the repo when present`);
  }
}

function validateEventFile(file, errors) {
  const rel = path.relative(root, file);
  const expectedTaskId = expectedTaskIdFromEventFile(file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const lineNumber = index + 1;
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      errors.push(`${rel}:${lineNumber}: lifecycle event is not valid JSON (${error.message})`);
      return;
    }
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      errors.push(`${rel}:${lineNumber}: lifecycle event must be a JSON object`);
      return;
    }
    if (typeof event.at !== "string" || Number.isNaN(Date.parse(event.at))) {
      errors.push(`${rel}:${lineNumber}: lifecycle event at must be an ISO-compatible date string`);
    }
    if (typeof event.type !== "string" || !event.type.trim()) {
      errors.push(`${rel}:${lineNumber}: lifecycle event type must be a non-empty string`);
    }
    if ("task_id" in event) {
      if (typeof event.task_id !== "string" || !event.task_id.trim()) {
        errors.push(`${rel}:${lineNumber}: lifecycle event task_id must be a non-empty string when present`);
      } else if (expectedTaskId && event.task_id !== expectedTaskId) {
        errors.push(`${rel}:${lineNumber}: lifecycle event task_id "${event.task_id}" must match log task id "${expectedTaskId}"`);
      }
    }
    if ("command" in event && (typeof event.command !== "string" || !event.command.trim())) {
      errors.push(`${rel}:${lineNumber}: lifecycle event command must be a non-empty string when present`);
    }
    for (const field of ["duration_ms", "elapsed_ms"]) {
      if (field in event && (!Number.isFinite(event[field]) || event[field] < 0)) {
        errors.push(`${rel}:${lineNumber}: lifecycle event ${field} must be a nonnegative number when present`);
      }
    }
    if ("timeout_minutes" in event && (!Number.isFinite(event.timeout_minutes) || event.timeout_minutes < 0)) {
      errors.push(`${rel}:${lineNumber}: lifecycle event timeout_minutes must be a nonnegative number when present`);
    }
    if ("code" in event && !Number.isInteger(event.code)) {
      errors.push(`${rel}:${lineNumber}: lifecycle event code must be an integer when present`);
    }
    if ("timed_out" in event && typeof event.timed_out !== "boolean") {
      errors.push(`${rel}:${lineNumber}: lifecycle event timed_out must be a boolean when present`);
    }
    for (const field of ["log", "prompt_file", "stdout", "stderr", "output", "result_copy", "task_contract_file"]) {
      validateEventFileField(rel, lineNumber, event, field, errors);
    }
  });
}

export function validateHarnessFiles() {
  const errors = [];
  const warnings = [];
  const counts = Object.fromEntries([...statuses].map((status) => [status, 0]));

  validateHarnessLayout(errors);
  validateHarnessIgnoreFiles(errors);
  validatePrompts(errors);
  validateReadme(errors);
  validateNoHardcodedSecrets(errors);
  validateWorkflowFiles(errors);

  const taskSchemaPath = path.join(root, ".agent", "task-schema.json");
  const resultSchemaPath = path.join(root, ".agent", "result-schema.json");
  const runSchemaPath = path.join(root, ".agent", "run-schema.json");
  const eventSchemaPath = path.join(root, ".agent", "event-schema.json");
  const stateSchemaPath = path.join(root, ".agent", "state-schema.json");
  const statePath = path.join(root, ".agent", "state.json");
  const queueDir = path.join(root, ".agent", "queue");

  const taskSchema = readJson(taskSchemaPath, errors);
  const resultSchema = readJson(resultSchemaPath, errors);
  const runSchema = readJson(runSchemaPath, errors);
  const eventSchema = readJson(eventSchemaPath, errors);
  const stateSchema = readJson(stateSchemaPath, errors);
  validateSchemaFile(taskSchemaPath, taskSchema, requiredTaskSchemaFields, taskFields, errors);
  validateSchemaFile(resultSchemaPath, resultSchema, requiredResultSchemaFields, resultFields, errors);
  validateSchemaFile(runSchemaPath, runSchema, requiredRunSchemaFields, runManifestFields, errors);
  validateSchemaFile(stateSchemaPath, stateSchema, requiredStateFields, stateFields, errors);
  validateEventSchemaFile(eventSchemaPath, eventSchema, errors);
  validateEventSchemaCommonFields(eventSchemaPath, eventSchema, errors);
  validateSchemaEnums(taskSchemaPath, taskSchema, resultSchemaPath, resultSchema, runSchemaPath, runSchema, errors);

  const state = readJson(statePath, errors);
  if (state) validateState(statePath, state, errors);

  let taskFiles = [];
  const tasks = [];
  try {
    taskFiles = fs.readdirSync(queueDir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => path.join(queueDir, file));
  } catch (error) {
    errors.push(`${path.relative(root, queueDir)}: cannot read queue directory (${error.message})`);
  }

  for (const file of taskFiles) {
    const task = readJson(file, errors);
    if (task) {
      tasks.push(task);
      validateTask(file, task, errors, counts);
    }
  }

  validateTaskGraph(tasks, errors);
  warnReadyTaskPathOverlaps(tasks, state, warnings);
  validateTaskCommandFeasibility(tasks, errors);
  validateStateReferences(state, tasks, errors);

  const reportsDir = path.join(root, ".agent", "reports");
  const logsDir = path.join(root, ".agent", "logs");
  let resultFiles = [];
  let markdownReportFiles = [];
  let runManifestFiles = [];
  let archivedRunManifestFiles = [];
  let eventFiles = [];
  let archivedEventFiles = [];
  const resultReports = [];
  const runManifests = [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  if (fs.existsSync(reportsDir)) {
    markdownReportFiles = fs.readdirSync(reportsDir)
      .filter((file) => file.endsWith(".md"))
      .sort()
      .map((file) => path.join(reportsDir, file));
    for (const file of markdownReportFiles) {
      const id = path.basename(file, ".md");
      if (id !== "summary" && !tasksById.has(id)) {
        errors.push(`${path.relative(root, file)}: Markdown report does not match a queued task`);
      }
      if (tasksById.has(id)) validateMarkdownReportFile(file, errors);
    }
    resultFiles = fs.readdirSync(reportsDir)
      .filter((file) => file.endsWith(".result.json"))
      .sort()
      .map((file) => path.join(reportsDir, file));
    for (const file of resultFiles) {
      const result = readJson(file, errors);
      validateResultFile(file, result, tasksById, errors);
      if (result) resultReports.push({ file, result });
    }
    validateMarkdownResultStatusConsistency(markdownReportFiles, resultReports, errors);
  }
  if (fs.existsSync(logsDir)) {
    runManifestFiles = fs.readdirSync(logsDir)
      .map((entry) => path.join(logsDir, entry, "run.json"))
      .filter((file) => fs.existsSync(file))
      .sort();
    for (const file of runManifestFiles) {
      const manifest = readJson(file, errors);
      validateRunManifestFile(file, manifest, tasksById, errors);
      if (manifest) runManifests.push({ file, manifest });
      if (manifest?.status === "running" && !fs.existsSync(lockPath)) {
        warnings.push(`${path.relative(root, file)}: run manifest is still running but runner lock is absent`);
      }
      warnStaleRunningManifest(file, manifest, warnings, errors);
    }
    archivedRunManifestFiles = collectArchivedRunManifestFiles(logsDir);
    for (const entry of archivedRunManifestFiles) {
      const manifest = readJson(entry.file, errors);
      validateRunManifestFile(entry.file, manifest, tasksById, errors, {
        expectedTaskId: entry.taskId,
        artifactFallbackDir: entry.archiveDir
      });
    }
    eventFiles = collectEventFiles(logsDir);
    archivedEventFiles = collectArchivedEventFiles(logsDir);
    for (const file of [...eventFiles, ...archivedEventFiles]) {
      validateEventFile(file, errors);
    }
  }
  warnStateResultConsistency(state, resultReports, runManifests, warnings);
  for (const file of inspectStaleArtifacts(root).stale_temp_files) {
    warnings.push(`${file}: stale temporary file from an interrupted atomic write`);
  }
  validateRunnerLock(warnings);

  return { errors, warnings, counts, taskFiles, resultFiles, markdownReportFiles, runManifestFiles, archivedRunManifestFiles, eventFiles, archivedEventFiles, pathOverlaps: taskPathOverlaps(tasks) };
}

function main() {
  const { errors, warnings, counts, taskFiles, resultFiles, markdownReportFiles, runManifestFiles, archivedRunManifestFiles, eventFiles, archivedEventFiles, pathOverlaps } = validateHarnessFiles();
  const json = process.argv.includes("--json");
  const strict = process.argv.includes("--strict");
  const failed = errors.length > 0 || (strict && warnings.length > 0);

  if (json) {
    console.log(JSON.stringify({
      status: failed ? "fail" : "pass",
      strict,
      tasks_checked: taskFiles.length,
      results_checked: resultFiles.length,
      markdown_reports_checked: markdownReportFiles.length,
      run_manifests_checked: runManifestFiles.length,
      archived_run_manifests_checked: archivedRunManifestFiles.length,
      event_files_checked: eventFiles.length,
      archived_event_files_checked: archivedEventFiles.length,
      counts,
      errors,
      warnings,
      path_overlaps: pathOverlaps
    }, null, 2));
    if (failed) process.exit(1);
    return;
  }

  console.log("Agent harness validation");
  console.log(`Tasks checked: ${taskFiles.length}`);
  console.log(`Result reports checked: ${resultFiles.length}`);
  console.log(`Markdown reports checked: ${markdownReportFiles.length}`);
  console.log(`Run manifests checked: ${runManifestFiles.length}`);
  console.log(`Archived run manifests checked: ${archivedRunManifestFiles.length}`);
  console.log(`Lifecycle event files checked: ${eventFiles.length}`);
  console.log(`Archived lifecycle event files checked: ${archivedEventFiles.length}`);
  console.log(`Unordered path overlaps: ${pathOverlaps.length}`);
  console.log(`Status counts: ${[...statuses].map((status) => `${status}=${counts[status]}`).join(", ")}`);

  if (failed) {
    console.log("FAIL");
    for (const error of errors) console.log(`- ${error}`);
    if (strict && warnings.length) {
      console.log("Strict warnings:");
      for (const warning of warnings) console.log(`- ${warning}`);
    }
    process.exit(1);
  }

  console.log("PASS");
  if (warnings.length) {
    console.log("Warnings:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
