import fs from "node:fs";
import path from "node:path";

export const staleTempThresholdMs = 15 * 60 * 1000;

function agentDir(root) {
  return path.join(root, ".agent");
}

function repoRelative(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function collectStaleTempFilePaths(dir, now = Date.now(), found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectStaleTempFilePaths(fullPath, now, found);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".tmp")) continue;
    const ageMs = now - fs.statSync(fullPath).mtimeMs;
    if (ageMs >= staleTempThresholdMs) found.push(fullPath);
  }
  return found;
}

function collectEmptyTransientDirPaths(dir, stopDir, found = []) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) collectEmptyTransientDirPaths(path.join(dir, entry.name), stopDir, found);
  }
  const removable = new Set(found.map((entry) => path.resolve(entry)));
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const effectivelyEmpty = entries.every((entry) => {
    return entry.isDirectory() && removable.has(path.resolve(dir, entry.name));
  });
  if (path.resolve(dir) !== path.resolve(stopDir) && effectivelyEmpty) found.push(dir);
  return found;
}

function ensureInsideAgentPath(root, file) {
  const resolved = path.resolve(file);
  const resolvedAgent = path.resolve(agentDir(root));
  if (resolved !== resolvedAgent && !resolved.startsWith(`${resolvedAgent}${path.sep}`)) {
    throw new Error(`Refusing to clean path outside .agent: ${file}`);
  }
}

export function inspectStaleArtifacts(root, now = Date.now()) {
  const base = agentDir(root);
  const tempFilePaths = collectStaleTempFilePaths(base, now).sort();
  const emptyDirectoryPaths = [
    ...collectEmptyTransientDirPaths(path.join(base, "logs"), path.join(base, "logs")),
    ...collectEmptyTransientDirPaths(path.join(base, "tmp"), path.join(base, "tmp"))
  ].sort((left, right) => right.length - left.length);

  return {
    stale_temp_file_paths: tempFilePaths,
    empty_directory_paths: emptyDirectoryPaths,
    stale_temp_files: tempFilePaths.map((file) => repoRelative(root, file)),
    empty_directories: emptyDirectoryPaths.map((dir) => repoRelative(root, dir)),
    stale_temp_file_count: tempFilePaths.length,
    empty_directory_count: emptyDirectoryPaths.length,
    cleanup_dry_run_command: "node scripts/agent-runner.mjs --cleanup-stale --dry-run --json",
    cleanup_command: "node scripts/agent-runner.mjs --cleanup-stale"
  };
}

export function removeStaleArtifacts(root, plan = inspectStaleArtifacts(root)) {
  const deletedFiles = [];
  const removedDirectories = [];
  for (const file of plan.stale_temp_file_paths || []) {
    ensureInsideAgentPath(root, file);
    if (!fs.existsSync(file)) continue;
    fs.unlinkSync(file);
    deletedFiles.push(repoRelative(root, file));
  }
  for (const dir of plan.empty_directory_paths || []) {
    ensureInsideAgentPath(root, dir);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      removedDirectories.push(repoRelative(root, dir));
    }
  }
  return {
    deleted_files: deletedFiles,
    removed_directories: removedDirectories
  };
}

export function plural(count, label) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}
