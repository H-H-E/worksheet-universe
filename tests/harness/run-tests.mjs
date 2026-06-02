import { runNode } from "./shared.mjs";

const commands = [
  ["scripts/agent-validate.mjs"],
  ["tests/fixtures/validate-fixtures.mjs"],
  ["scripts/verify-generators.js"]
];

const results = commands.map((args) => {
  const result = runNode(args);
  return {
    command: `node ${args.join(" ")}`,
    status: result.status === 0 ? "passed" : "failed",
    output: result.output.trim()
  };
});

const failed = results.filter((result) => result.status !== "passed");

console.log(JSON.stringify({
  commands: results,
  failed: failed.map((result) => result.command)
}, null, 2));

if (failed.length) process.exit(1);
