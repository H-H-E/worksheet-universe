import assert from "node:assert/strict";
import test from "node:test";

import {
  answerForQuestion,
  auditWorksheet,
  checkAnswer,
  filterWorksheetTypes,
  generateWorksheet,
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
