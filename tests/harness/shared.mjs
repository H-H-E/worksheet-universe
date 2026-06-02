import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

export function assertFile(file) {
  if (!fs.existsSync(file)) {
    return { ok: false, size: 0, message: `${path.relative(repoRoot, file)} is missing.` };
  }
  const stat = fs.statSync(file);
  if (!stat.isFile()) {
    return { ok: false, size: 0, message: `${path.relative(repoRoot, file)} is not a file.` };
  }
  return { ok: true, size: stat.size, message: "" };
}

export function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return {
    status: result.status,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n")
  };
}
