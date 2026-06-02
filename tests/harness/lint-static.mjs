import path from "node:path";
import { spawnSync } from "node:child_process";
import { repoRoot, readJson, walkFiles } from "./shared.mjs";

const failures = [];
const jsonFiles = [
  "vercel.json",
  "src/schema/worksheet.schema.json",
  ...walkFiles(path.join(repoRoot, ".agent/queue")).filter((file) => file.endsWith(".json")),
  ...walkFiles(path.join(repoRoot, ".agent/reports")).filter((file) => file.endsWith(".result.json")),
  ...walkFiles(path.join(repoRoot, "tests/fixtures")).filter((file) => file.endsWith(".json"))
];

for (const file of jsonFiles) {
  try {
    readJson(path.isAbsolute(file) ? file : path.join(repoRoot, file));
  } catch (error) {
    failures.push(`${relative(file)} is invalid JSON: ${error.message}`);
  }
}

const syntaxFiles = [
  "app.js",
  "tests/fixtures/validate-fixtures.mjs",
  "tests/generators/validate-generators.mjs",
  "tests/harness/build-static.mjs",
  "tests/harness/lint-static.mjs",
  "tests/harness/run-tests.mjs",
  "tests/harness/shared.mjs",
  "tests/harness/typecheck-types.mjs"
];

for (const file of syntaxFiles) {
  const syntax = spawnSync(process.execPath, ["--check", file], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (syntax.status !== 0) {
    failures.push(`${file} syntax check failed:\n${syntax.stderr || syntax.stdout}`);
  }
}

const vercelProjectTracked = spawnSync("git", ["ls-files", "--error-unmatch", ".vercel/project.json"], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (vercelProjectTracked.status === 0) {
  failures.push(".vercel/project.json must not be tracked by git.");
}

console.log(JSON.stringify({
  jsonFilesChecked: jsonFiles.length,
  syntaxFilesChecked: syntaxFiles.length,
  failed: failures
}, null, 2));

if (failures.length) process.exit(1);

function relative(file) {
  return path.isAbsolute(file) ? path.relative(repoRoot, file) : file;
}
