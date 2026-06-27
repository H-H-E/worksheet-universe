import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

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

const setupPanelSource = readFileSync(
  new URL("../../src/features/worksheet/command-center/setup-panel.tsx", import.meta.url),
  "utf8"
);
const trustPanelSource = readFileSync(
  new URL("../../src/features/worksheet/command-center/trust-panel.tsx", import.meta.url),
  "utf8"
);
const worksheetCommandCenterSource = readFileSync(
  new URL("../../src/features/worksheet/command-center/WorksheetCommandCenter.tsx", import.meta.url),
  "utf8"
);
const worksheetPreviewSource = readFileSync(
  new URL("../../src/features/worksheet/command-center/worksheet-preview.tsx", import.meta.url),
  "utf8"
);
const globalsSource = readFileSync(
  new URL("../../src/app/globals.css", import.meta.url),
  "utf8"
);

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
    skillQuery: "fraction",
    itemCount: 10,
    seed: 104,
    pageSize: "a4" as const
  };

  const params = intentToSearchParams(intent, defaultCommandCenterIntent(worksheetTypes));
  const restored = intentFromSearchParams(params, worksheetTypes);

  assert.equal(params.get("panel"), "export");
  assert.equal(params.get("skill"), "fraction");
  assert.equal(restored.activePanel, "export");
  assert.equal(restored.skillQuery, "fraction");
  assert.equal(restored.itemCount, 10);
  assert.equal(restored.seed, 104);
  assert.equal(restored.pageSize, "a4");
});

test("command center URL state sanitizes out-of-range values without flow regressions", () => {
  const fallback = defaultCommandCenterIntent(worksheetTypes);
  const rawParams = new URLSearchParams([
    ["grade", "99"],
    ["skill", "fractions fluency"],
    ["count", "99"],
    ["seed", "-7"],
    ["difficulty", "impossible"],
    ["page", "not-a-page"],
    ["panel", "not-a-panel"],
    ["format", "quick-check"]
  ]);

  const normalized = intentFromSearchParams(rawParams, worksheetTypes);

  assert.equal(normalized.exactGrade, fallback.exactGrade);
  assert.equal(normalized.skillQuery, "fractions fluency");
  assert.equal(normalized.itemCount, 12);
  assert.equal(normalized.seed, 1);
  assert.equal(normalized.difficulty, fallback.difficulty);
  assert.equal(normalized.pageSize, fallback.pageSize);
  assert.equal(normalized.activePanel, fallback.activePanel);
  assert.equal(normalized.format, "quick-check");
});

test("command center controls keep minimum 40px targets in core UI panels", () => {
  const setupTargetCount = setupPanelSource.match(/min-h-\[40px\]/g)?.length || 0;
  const trustTargetCount = trustPanelSource.match(/min-h-\[40px\]/g)?.length || 0;
  const questionActionRevealRule = globalsSource.match(/\.worksheet-item:hover \.question-actions,[\s\S]*?\.worksheet-item:focus-within \.question-actions \{[\s\S]*?\}/)?.[0] || "";

  assert.ok(setupTargetCount >= 5, `Setup panel minimum-target marker count was ${setupTargetCount}`);
  assert.ok(trustTargetCount >= 3, `Trust panel minimum-target marker count was ${trustTargetCount}`);
  assert.ok(globalsSource.includes(".command-center-shell button"), "Command center CSS enforces button target size at runtime");
  assert.ok(globalsSource.includes(".question-actions button"), "Contextual question actions keep explicit 40px targets");
  assert.ok(globalsSource.includes(".answer-checker summary"), "Native answer checker summary keeps a touch-sized target");
  assert.ok(globalsSource.includes(".fine-tuning-panel summary"), "Native fine-tuning summary keeps a touch-sized target");
  assert.ok(questionActionRevealRule.includes("pointer-events: auto"), "Question actions stay clickable without motion-safe utilities");
  assert.ok(questionActionRevealRule.includes("filter: none"), "Question actions remove blur in the non-motion reveal path");
  assert.ok(!worksheetPreviewSource.includes("question-actions no-print opacity-0 scale-95"), "Question action controls should not shrink below target size while hidden");
  assert.ok(setupPanelSource.includes('className="eyebrow">Setup</p>'), "Setup section keeps eyebrow class on section heading");
  assert.ok(trustPanelSource.includes('className="eyebrow">Review</p>'), "Trust section keeps eyebrow class on section heading");
});

test("desktop command deck exposes a workflow rail and keeps the draft summary", () => {
  assert.ok(worksheetCommandCenterSource.includes('className="workflow-panel"'));
  assert.ok(worksheetCommandCenterSource.includes('className="workflow-rail" aria-label="Workflow status"'));
  for (const label of ["Teacher intent", "Setup", "Preview", "Review", "Export"]) {
    assert.ok(worksheetCommandCenterSource.includes(`label="${label}"`), `Missing workflow step ${label}`);
  }

  assert.ok(worksheetCommandCenterSource.includes('aria-label="Current draft summary"'));
  for (const label of ["Skill", "Format", "Grade", "Status"]) {
    assert.ok(worksheetCommandCenterSource.includes(`label="${label}"`));
  }
  assert.ok(globalsSource.includes(".workflow-rail"));
});

test("setup fine tuning and preview digital checks are collapsed behind native disclosures", () => {
  assert.ok(setupPanelSource.includes('<details className="fine-tuning-panel">'));
  assert.ok(setupPanelSource.includes("<summary>Fine-tune worksheet details</summary>"));
  assert.ok(setupPanelSource.includes('htmlFor={`${idPrefix}-format`}'));
  assert.ok(setupPanelSource.includes('htmlFor={`${idPrefix}-count`}'));
  assert.ok(setupPanelSource.includes('htmlFor={`${idPrefix}-seed`}'));
  assert.ok(setupPanelSource.includes('htmlFor={`${idPrefix}-page-size`}'));

  assert.ok(worksheetPreviewSource.includes('<details className="answer-checker no-print">'));
  assert.ok(worksheetPreviewSource.includes("<summary>Digital answer check</summary>"));
  assert.ok(worksheetPreviewSource.includes('className="answer-checker-body"'));
  assert.ok(!worksheetPreviewSource.includes('<div className="answer-checker no-print">'));
});

test("review export actions keep student print as the primary visible action", () => {
  assert.ok(trustPanelSource.includes('label: "Print student copy"'));
  assert.ok(trustPanelSource.includes('variant={option.id === "print-student" ? "default" : "outline"}'));
  assert.ok(trustPanelSource.includes("primary-export-button"));
  assert.ok(trustPanelSource.includes('id: "copy-json"'));
  assert.ok(trustPanelSource.includes('id: "print-key"'));
  assert.ok(worksheetCommandCenterSource.includes('if (step === "export") setActivePanel("export")'));
  assert.ok(!worksheetCommandCenterSource.includes('activePanel="export"'));
});

test("command center headings and labels keep stable polish hooks", () => {
  assert.ok(setupPanelSource.includes("aria-labelledby={`${idPrefix}-setup-title`}"));
  assert.ok(trustPanelSource.includes("aria-labelledby={`${idPrefix}-trust-title`}"));
  assert.ok(setupPanelSource.includes("<Label htmlFor={`${idPrefix}-skill-search`}>"));
  assert.ok(worksheetCommandCenterSource.includes("command-desktop-frame"));
  assert.ok(setupPanelSource.includes("className=\"panel-heading\""));
  assert.ok(trustPanelSource.includes("className=\"panel-heading\""));
  assert.ok(globalsSource.includes("@media (min-width: 1024px)"));
  assert.ok(globalsSource.includes(".command-mobile,"));
  assert.ok(globalsSource.includes(".mobile-action-bar,"));
  assert.ok(globalsSource.includes(".command-desktop-frame"));
  assert.ok(globalsSource.includes(".panel-heading h2"));
  assert.ok(globalsSource.includes(".eyebrow"));
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

test("incompatible combined filters stay empty instead of falling back to the full catalog", () => {
  const result = filterWorksheetTypes(worksheetTypes, {
    query: "fraction",
    exactGrade: "4",
    strand: "Operations and Fluency",
    format: "quick-check"
  });

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

test("legacy generator registry exposes required canonical worksheets", async () => {
  const legacyGenerators = await import(new URL("../../src/generators/index.mjs", import.meta.url).href);
  const expectedIds = [
    "fraction-add-like-denominators",
    "percent-of-number",
    "simple-probability",
    "linear-equation-two-step",
    "rectangle-area-perimeter"
  ];

  assert.deepEqual(legacyGenerators.generatorRegistry.map((entry: { id: string }) => entry.id), expectedIds);
  assert.equal(legacyGenerators.generateRequiredGeneratorWorksheets("audit").length, expectedIds.length);

  for (const id of expectedIds) {
    const { worksheet, manifest } = legacyGenerators.generateWorksheetById(id, { seed: "audit" });
    assert.equal(worksheet.schemaVersion, "1.0.0");
    assert.equal(worksheet.metadata.generator.id, id);
    assert.equal(worksheet.sections[0].questions.length, worksheet.answerKey.length);
    assert.equal(manifest.length, worksheet.answerKey.length);
  }

  assert.throws(() => legacyGenerators.generateWorksheetById("unknown-generator-id"), /Unknown generator id/);
});

test("printable answer key and desktop draft summary stay wired", () => {
  const printMediaStart = globalsSource.indexOf("@media print");
  const printBlock = printMediaStart >= 0 ? globalsSource.slice(printMediaStart) : "";

  assert.ok(worksheetPreviewSource.includes("function AnswerKeyPrintPage"));
  assert.ok(worksheetPreviewSource.includes('aria-label="Printable answer key"'));
  assert.ok(worksheetPreviewSource.includes("answer-key-print-list"));
  assert.ok(globalsSource.includes('html[data-print-mode="answer-key"] .answer-key-page'));
  assert.ok(globalsSource.includes('html[data-print-mode="all"] .answer-key-page'));
  assert.ok(printBlock.includes(".command-desktop-frame"), "Print CSS must restore the desktop frame wrapper");
});
