import fs from "node:fs";
import path from "node:path";
import { repoRoot, readJson } from "./shared.mjs";

const schema = readJson(path.join(repoRoot, "src/schema/worksheet.schema.json"));
const typesPath = path.join(repoRoot, "src/types/worksheet.d.ts");
const typesSource = fs.readFileSync(typesPath, "utf8");
const failures = [];

const schemaQuestionTypes = schema.$defs.question.properties.type.enum;
const typeUnion = extractStringUnion(typesSource, "WorksheetQuestionType");

for (const value of schemaQuestionTypes) {
  if (!typeUnion.includes(value)) {
    failures.push(`WorksheetQuestionType is missing schema enum value ${value}.`);
  }
}

for (const value of typeUnion) {
  if (!schemaQuestionTypes.includes(value)) {
    failures.push(`WorksheetQuestionType includes ${value}, but schema question type enum does not.`);
  }
}

for (const requiredExport of ["Worksheet", "WorksheetSection", "WorksheetQuestion", "WorksheetAnswerKeyItem", "WorksheetMetadata"]) {
  if (!new RegExp(`export interface ${requiredExport}\\b`).test(typesSource)) {
    failures.push(`src/types/worksheet.d.ts must export interface ${requiredExport}.`);
  }
}

console.log(JSON.stringify({
  schemaQuestionTypes: schemaQuestionTypes.length,
  typeQuestionTypes: typeUnion.length,
  failed: failures
}, null, 2));

if (failures.length) process.exit(1);

function extractStringUnion(source, typeName) {
  const match = source.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
  if (!match) return [];
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1]);
}
