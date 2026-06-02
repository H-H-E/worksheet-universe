import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(repoRoot, "src/schema/worksheet.schema.json");
const validDir = path.join(__dirname, "valid");
const invalidDir = path.join(__dirname, "invalid");

const schema = readJson(schemaPath);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}

export function validateWorksheet(value) {
  const schemaErrors = validateSchema(schema, value, "$", schema);
  const semanticErrors = schemaErrors.length ? [] : validateWorksheetSemantics(value);
  return [...schemaErrors, ...semanticErrors];
}

function runCli() {
  const validFiles = listJsonFiles(validDir);
  const invalidFiles = listJsonFiles(invalidDir);
  const failures = [];

  if (validFiles.length < 3) {
    failures.push(`Expected at least 3 valid fixtures, found ${validFiles.length}.`);
  }

  if (invalidFiles.length < 1) {
    failures.push(`Expected at least 1 invalid fixture, found ${invalidFiles.length}.`);
  }

  for (const file of validFiles) {
    const value = readJson(file);
    const errors = validateWorksheet(value);
    if (errors.length) {
      failures.push(`${relative(file)} should validate but failed:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
    }
  }

  for (const file of invalidFiles) {
    const value = readJson(file);
    const errors = validateWorksheet(value);
    if (!errors.length) {
      failures.push(`${relative(file)} should fail validation but passed.`);
    }
  }

  const result = {
    validFixtures: validFiles.length,
    invalidFixtures: invalidFiles.length,
    failed: failures
  };

  console.log(JSON.stringify(result, null, 2));

  if (failures.length) {
    process.exit(1);
  }
}

function validateWorksheetSemantics(worksheet) {
  const errors = [];
  const questionIds = new Set();
  const answerIds = new Set();
  const answerQuestionIds = new Set();

  for (const section of worksheet.sections) {
    for (const question of section.questions) {
      if (questionIds.has(question.id)) {
        errors.push(`Duplicate question id ${question.id}.`);
      }
      questionIds.add(question.id);
    }
  }

  for (const answer of worksheet.answerKey) {
    if (answerIds.has(answer.id)) {
      errors.push(`Duplicate answer key id ${answer.id}.`);
    }
    answerIds.add(answer.id);
    answerQuestionIds.add(answer.questionId);
    if (!questionIds.has(answer.questionId)) {
      errors.push(`Answer key ${answer.id} references missing question ${answer.questionId}.`);
    }
  }

  for (const section of worksheet.sections) {
    for (const question of section.questions) {
      if (!answerQuestionIds.has(question.answerRef)) {
        errors.push(`Question ${question.id} answerRef ${question.answerRef} has no matching answerKey.questionId.`);
      }
    }
  }

  if (worksheet.schemaVersion !== worksheet.metadata.versioning.schemaVersion) {
    errors.push("Root schemaVersion must match metadata.versioning.schemaVersion.");
  }

  return errors;
}

function validateSchema(currentSchema, value, pointer, rootSchema) {
  if (currentSchema.$ref) {
    return validateSchema(resolveRef(currentSchema.$ref, rootSchema), value, pointer, rootSchema);
  }

  if (currentSchema.oneOf) {
    const matches = currentSchema.oneOf.filter((candidate) => validateSchema(candidate, value, pointer, rootSchema).length === 0);
    return matches.length === 1 ? [] : [`${pointer} must match exactly one schema variant; matched ${matches.length}.`];
  }

  if (currentSchema.const !== undefined && value !== currentSchema.const) {
    return [`${pointer} must equal ${JSON.stringify(currentSchema.const)}.`];
  }

  const errors = [];

  if (currentSchema.type && !matchesType(value, currentSchema.type)) {
    errors.push(`${pointer} must be ${typeLabel(currentSchema.type)}.`);
    return errors;
  }

  if (currentSchema.enum && !currentSchema.enum.includes(value)) {
    errors.push(`${pointer} must be one of ${currentSchema.enum.map((entry) => JSON.stringify(entry)).join(", ")}.`);
  }

  if (typeof value === "string") {
    if (currentSchema.minLength !== undefined && value.length < currentSchema.minLength) {
      errors.push(`${pointer} must have length >= ${currentSchema.minLength}.`);
    }
    if (currentSchema.pattern && !new RegExp(currentSchema.pattern).test(value)) {
      errors.push(`${pointer} must match /${currentSchema.pattern}/.`);
    }
  }

  if (typeof value === "number" && currentSchema.minimum !== undefined && value < currentSchema.minimum) {
    errors.push(`${pointer} must be >= ${currentSchema.minimum}.`);
  }

  if (Array.isArray(value)) {
    if (currentSchema.minItems !== undefined && value.length < currentSchema.minItems) {
      errors.push(`${pointer} must contain at least ${currentSchema.minItems} item(s).`);
    }
    if (currentSchema.items) {
      value.forEach((item, index) => {
        errors.push(...validateSchema(currentSchema.items, item, `${pointer}[${index}]`, rootSchema));
      });
    }
  }

  if (isObject(value)) {
    const properties = currentSchema.properties || {};
    for (const requiredKey of currentSchema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        errors.push(`${pointer}.${requiredKey} is required.`);
      }
    }
    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = properties[key];
      if (!childSchema) {
        if (currentSchema.additionalProperties === false) {
          errors.push(`${pointer}.${key} is not allowed.`);
        }
        continue;
      }
      errors.push(...validateSchema(childSchema, childValue, `${pointer}.${key}`, rootSchema));
    }
  }

  return errors;
}

function resolveRef(ref, rootSchema) {
  if (!ref.startsWith("#/")) {
    throw new Error(`Only local JSON Schema refs are supported: ${ref}`);
  }

  return ref
    .slice(2)
    .split("/")
    .reduce((node, rawPart) => {
      const part = rawPart.replace(/~1/g, "/").replace(/~0/g, "~");
      return node[part];
    }, rootSchema);
}

function matchesType(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === "array") return Array.isArray(value);
    if (type === "object") return isObject(value);
    if (type === "integer") return Number.isInteger(value);
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    if (type === "string") return typeof value === "string";
    if (type === "boolean") return typeof value === "boolean";
    if (type === "null") return value === null;
    return false;
  });
}

function typeLabel(type) {
  return Array.isArray(type) ? type.join(" or ") : type;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(dir, file));
}

function relative(file) {
  return path.relative(repoRoot, file);
}
