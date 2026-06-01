import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { taskCommandGatePreflight } from "./agent-preflight.mjs";

export function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function stripRuntimeFields(task) {
  const { file, ...rest } = task;
  return rest;
}

export function taskContractText(task) {
  return JSON.stringify(stripRuntimeFields(task), null, 2);
}

export function taskContractHash(task) {
  return sha256Text(taskContractText(task));
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

export function detectPackageSummary(cwd) {
  const packagePath = path.join(cwd, "package.json");
  const packageManager = detectPackageManager(cwd);
  if (!fs.existsSync(packagePath)) {
    return `package manager: ${packageManager}. No package.json present. Use direct Node scripts until a package is introduced.`;
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (error) {
    return `package manager: ${packageManager}. package.json is malformed: ${error.message}`;
  }
  const scripts = Object.keys(pkg.scripts || {});
  return `package manager: ${packageManager}. package.json scripts: ${scripts.length ? scripts.join(", ") : "none"}`;
}

export function assemblePrompt(task, cwd, mode = "worker", extra = "", root = process.cwd()) {
  const promptFile = mode === "repair" ? "repair.md" : "worker.md";
  const basePrompt = fs.readFileSync(path.join(root, ".agent", "prompts", promptFile), "utf8");
  const commandGatePreflight = taskCommandGatePreflight(task, cwd);
  return [
    basePrompt,
    "",
    "Assigned task JSON:",
    "```json",
    taskContractText(task),
    "```",
    "",
    "Repo instructions:",
    "Follow `AGENTS.md` and the selected task file. If they conflict, the task file controls task-specific scope and AGENTS.md controls repo-wide rules.",
    "",
    "Repo command summary:",
    detectPackageSummary(cwd),
    "",
    "Task command gate preflight:",
    "```json",
    JSON.stringify(commandGatePreflight, null, 2),
    "```",
    "",
    "Write `.agent/reports/<task-id>.md` and JSON matching `.agent/result-schema.json`.",
    extra
  ].join("\n");
}

export function promptHash(task, cwd, mode = "worker", extra = "", root = process.cwd()) {
  return sha256Text(assemblePrompt(task, cwd, mode, extra, root));
}
