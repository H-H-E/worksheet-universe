export function splitCommandLine(command) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (escaping) current += "\\";
  if (quote) throw new Error(`unterminated ${quote} quote`);
  if (current) parts.push(current);
  if (!parts.length) throw new Error("empty command");
  return parts;
}

export function fallbackCommandParts(command) {
  return command.trim().split(/\s+/).filter(Boolean);
}

export function commandParts(command) {
  try {
    return splitCommandLine(command);
  } catch {
    return fallbackCommandParts(command);
  }
}

export function commandParseError(command) {
  try {
    splitCommandLine(command);
    return null;
  } catch (error) {
    return error.message;
  }
}
