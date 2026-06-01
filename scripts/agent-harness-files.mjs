import fs from "node:fs";
import path from "node:path";

export const requiredHarnessDirs = [
  ".agent/queue",
  ".agent/prompts",
  ".agent/reports",
  ".agent/logs",
  ".agent/tmp"
];

export const requiredStaticHarnessFiles = [
  "AGENTS.md",
  ".agent/README.md",
  ".agent/task-schema.json",
  ".agent/result-schema.json",
  ".agent/run-schema.json",
  ".agent/event-schema.json",
  ".agent/state-schema.json",
  ".agent/state.json",
  ".agent/reports/.gitkeep",
  ".agent/logs/.gitkeep",
  ".agent/logs/.gitignore",
  ".agent/tmp/.gitkeep",
  ".agent/tmp/.gitignore",
  ".agent/prompts/worker.md",
  ".agent/prompts/repair.md",
  ".agent/prompts/reviewer.md",
  "scripts/agent-cleanup-utils.mjs",
  "scripts/agent-command-utils.mjs",
  "scripts/agent-harness-files.mjs",
  "scripts/agent-preflight.mjs",
  "scripts/agent-runner.mjs",
  "scripts/agent-trace-utils.mjs",
  "scripts/agent-validate.mjs",
  "scripts/agent-doctor.mjs",
  "scripts/agent-summary.mjs",
  "scripts/agent-selftest.mjs",
  ".github/workflows/ci.yml",
  ".github/workflows/agent-review.yml",
  ".github/codex/prompts/review.md"
];

export function queueTaskFiles(root, fallbackTaskId = null) {
  const queueDir = path.join(root, ".agent", "queue");
  if (!fs.existsSync(queueDir)) {
    return fallbackTaskId ? [`.agent/queue/${fallbackTaskId}.json`] : [];
  }
  return fs.readdirSync(queueDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => `.agent/queue/${file}`);
}

export function requiredHarnessFiles(root, fallbackTaskId = null) {
  return [...requiredStaticHarnessFiles, ...queueTaskFiles(root, fallbackTaskId)];
}
