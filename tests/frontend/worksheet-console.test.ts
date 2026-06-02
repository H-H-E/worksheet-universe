import assert from "node:assert/strict";
import test from "node:test";

import {
  answerForQuestion,
  auditWorksheet,
  checkAnswer,
  defaultCommandCenterIntent,
  filterWorksheetTypes,
  generateWorksheet,
  intentFromSearchParams,
  intentToSearchParams,
  nextSeed,
  parseWorksheetPrompt,
  worksheetTypes
} from "../../src/features/worksheet/index";

test("combined filters narrow worksheet types by query, grade, strand, and format", () => {
  const result = filterWorksheetTypes(worksheetTypes, {
    query: "fraction",
    exactGrade: "4",
    strand: "Fractions, Decimals, and Percents",
    format: "worked-practice"
  });

  assert.ok(result.length > 0);
  assert.ok(result.every((type) => type.grades.includes("4")));
  assert.ok(result.every((type) => type.strand === "Fractions, Decimals, and Percents"));
  assert.ok(result.every((type) => type.formats.includes("worked-practice")));
});

test("prompt parser maps teacher language to deterministic worksheet controls", () => {
  const parsed = parseWorksheetPrompt(
    "Make a Grade 5 fractions worksheet with visual models, 12 questions, easy difficulty, with answers.",
    worksheetTypes
  );

  assert.equal(parsed.exactGrade, "5");
  assert.equal(parsed.strand, "Fractions, Decimals, and Percents");
  assert.equal(parsed.format, "visual-model");
  assert.equal(parsed.itemCount, 12);
  assert.equal(parsed.difficulty, "readiness");

  const filtered = filterWorksheetTypes(worksheetTypes, {
    exactGrade: parsed.exactGrade,
    strand: parsed.strand,
    format: parsed.format
  });
  assert.ok(filtered.length > 0);
});

test("prompt parser clamps oversized counts and can identify exact worksheet titles", () => {
  const parsed = parseWorksheetPrompt(
    "Grade 2 addition facts fluency exit ticket with 20 problems hard",
    worksheetTypes
  );

  assert.equal(parsed.exactGrade, "2");
  assert.equal(parsed.worksheetTypeId, "addition-facts-fluency");
  assert.equal(parsed.format, "quick-check");
  assert.equal(parsed.itemCount, 12);
  assert.equal(parsed.difficulty, "challenge");
});

test("command center URL state round-trips changed controls", () => {
  const intent = {
    ...defaultCommandCenterIntent(worksheetTypes),
    activePanel: "export" as const,
    itemCount: 10,
    seed: 104,
    pageSize: "a4" as const
  };

  const params = intentToSearchParams(intent, defaultCommandCenterIntent(worksheetTypes));
  const restored = intentFromSearchParams(params, worksheetTypes);

  assert.equal(params.get("panel"), "export");
  assert.equal(restored.activePanel, "export");
  assert.equal(restored.itemCount, 10);
  assert.equal(restored.seed, 104);
  assert.equal(restored.pageSize, "a4");
});

test("make another like this advances the deterministic seed", () => {
  const intent = defaultCommandCenterIntent(worksheetTypes);
  const first = generateWorksheet(
    worksheetTypes.find((type) => type.id === intent.typeId) || worksheetTypes[0],
    { itemCount: intent.itemCount, seed: intent.seed, format: intent.format }
  );
  const second = generateWorksheet(
    worksheetTypes.find((type) => type.id === intent.typeId) || worksheetTypes[0],
    { itemCount: intent.itemCount, seed: nextSeed(intent.seed), format: intent.format }
  );

  assert.equal(nextSeed(42), 43);
  assert.notEqual(first.id, second.id);
});

test("empty filter state returns no worksheet types", () => {
  const result = filterWorksheetTypes(worksheetTypes, { query: "nonexistent-rubric-planet" });
  assert.deepEqual(result, []);
});

test("generator selection returns canonical worksheet JSON", () => {
  const selected = worksheetTypes.find((type) => type.id === "fraction-models-and-manipulatives");
  assert.ok(selected);

  const worksheet = generateWorksheet(selected, { itemCount: 4, seed: 9, format: selected.formats[0] });
  assert.equal(worksheet.schemaVersion, "1.0.0");
  assert.equal(worksheet.title, selected.title);
  assert.equal(worksheet.sections[0].questions.length, 4);
  assert.equal(worksheet.answerKey.length, 4);
});

test("format switching and settings change the generated worksheet", () => {
  const selected = worksheetTypes.find((type) => type.formats.length > 1);
  assert.ok(selected);

  const first = generateWorksheet(selected, { itemCount: 3, seed: 1, format: selected.formats[0] });
  const second = generateWorksheet(selected, { itemCount: 5, seed: 2, format: selected.formats[1] });

  assert.equal(first.metadata.format, selected.formats[0]);
  assert.equal(second.metadata.format, selected.formats[1]);
  assert.equal(first.answerKey.length, 3);
  assert.equal(second.answerKey.length, 5);
  assert.notEqual(first.id, second.id);
});

test("single-answer and all-answer checking use answer key items", () => {
  const selected = worksheetTypes.find((type) => type.id === "addition-facts-fluency");
  assert.ok(selected);

  const worksheet = generateWorksheet(selected, { itemCount: 6, seed: 42, format: selected.formats[0] });
  const firstQuestion = worksheet.sections[0].questions[0];
  const firstAnswer = answerForQuestion(worksheet, firstQuestion);
  assert.ok(firstAnswer);

  assert.equal(checkAnswer(firstAnswer.answer.value, firstAnswer).status, "correct");
  assert.equal(checkAnswer("not the answer", firstAnswer).status, "incorrect");

  const allChecks = worksheet.answerKey.map((entry) => checkAnswer(entry.answer.value, entry));
  assert.equal(allChecks.filter((entry) => entry.status === "correct").length, worksheet.answerKey.length);
  assert.equal(auditWorksheet(worksheet).ok, true);
});
