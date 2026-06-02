import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { repoRoot, readJson, runNode, assertFile } from "./shared.mjs";

const requiredStaticFiles = ["index.html", "styles.css", "app.js", "vercel.json"];
const failures = [];

for (const file of requiredStaticFiles) {
  const absolute = path.join(repoRoot, file);
  const stat = assertFile(absolute);
  if (!stat.ok) {
    failures.push(stat.message);
  } else if (stat.size === 0) {
    failures.push(`${file} must not be empty.`);
  }
}

if (!failures.length) {
  const indexHtml = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
  if (!indexHtml.includes('<link rel="stylesheet" href="styles.css">')) {
    failures.push("index.html must reference styles.css.");
  }
  if (!indexHtml.includes('<script src="app.js"></script>')) {
    failures.push("index.html must reference app.js.");
  }
}

if (!failures.length) {
  const vercel = readJson(path.join(repoRoot, "vercel.json"));
  if (vercel.cleanUrls !== true) failures.push("vercel.json cleanUrls must be true.");
  if (!Array.isArray(vercel.headers) || vercel.headers.length === 0) {
    failures.push("vercel.json must define static headers.");
  }
}

const syntax = spawnSync(process.execPath, ["--check", "app.js"], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (syntax.status !== 0) {
  failures.push(`app.js syntax check failed:\n${syntax.stderr || syntax.stdout}`);
}

const fixtureResult = runNode(["tests/fixtures/validate-fixtures.mjs"]);
if (fixtureResult.status !== 0) {
  failures.push(`Fixture validation failed:\n${fixtureResult.output}`);
}

const result = {
  staticFiles: requiredStaticFiles,
  fixtureValidation: fixtureResult.status === 0 ? "passed" : "failed",
  failed: failures
};

console.log(JSON.stringify(result, null, 2));

if (failures.length) process.exit(1);
