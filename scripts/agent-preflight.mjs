import fs from "node:fs";
import path from "node:path";
import { commandParseError as getCommandParseError, commandParts } from "./agent-command-utils.mjs";

export function findExecutable(command) {
  const pathValue = process.env.PATH || "";
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = path.join(dir, `${command}${extension}`);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // Continue scanning PATH.
      }
    }
  }
  return null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function commandGatePreview(command, cwd = process.cwd()) {
  const commandParseError = getCommandParseError(command);
  const parts = commandParts(command);
  const executable = parts[0] || "";
  const packagePath = path.join(cwd, "package.json");
  const packageJsonPresent = fs.existsSync(packagePath);
  let packageJson = null;
  let packageJsonError = null;
  if (packageJsonPresent) {
    try {
      packageJson = readJson(packagePath);
    } catch (error) {
      packageJsonError = error.message;
    }
  }
  const preview = {
    command,
    executable,
    executable_available: Boolean(executable && findExecutable(executable)),
    command_parse_error: commandParseError,
    argv: commandParseError ? [] : parts,
    referenced_file: null,
    referenced_file_available: null,
    package_json_present: packageJsonPresent,
    package_json_error: packageJsonError,
    package_script: null,
    package_script_available: null
  };

  if (executable === "node") {
    const script = parts.find((part, index) => index > 0 && !part.startsWith("-") && /\.(?:mjs|cjs|js)$/.test(part));
    if (script) {
      preview.referenced_file = script;
      preview.referenced_file_available = fs.existsSync(path.join(cwd, script));
    }
  }

  if (executable === "npm" && parts[1] === "run" && parts[2]) {
    const scriptName = parts[2];
    preview.package_script = scriptName;
    if (packageJson) {
      preview.package_script_available = Boolean(packageJson.scripts && packageJson.scripts[scriptName]);
    } else {
      preview.package_script_available = false;
    }
  }

  return preview;
}

export function commandGateWarnings(gate) {
  const warnings = [];
  if (gate.command_parse_error) {
    warnings.push(`${gate.command}: command cannot be parsed without a shell (${gate.command_parse_error})`);
  }
  if (!gate.executable_available) {
    warnings.push(`${gate.command}: executable "${gate.executable}" was not found on PATH`);
  }
  if (gate.package_json_error) {
    warnings.push(`${gate.command}: package.json could not be parsed (${gate.package_json_error})`);
  }
  if (gate.referenced_file && gate.referenced_file_available === false) {
    warnings.push(`${gate.command}: referenced file "${gate.referenced_file}" does not exist yet`);
  }
  if (gate.package_script && gate.package_script_available === false) {
    warnings.push(`${gate.command}: npm script "${gate.package_script}" is not available${gate.package_json_present ? "" : " because package.json is missing"}`);
  }
  return warnings;
}

export function taskCommandGatePreflight(task, cwd = process.cwd()) {
  const command_gates = task.commands.map((command) => commandGatePreview(command, cwd));
  return {
    command_gates,
    command_gate_warnings: command_gates.flatMap(commandGateWarnings)
  };
}
