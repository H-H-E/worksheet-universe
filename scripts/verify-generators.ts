import { checkAnswer, auditWorksheet, generateWorksheet, worksheetTypes } from "../src/features/worksheet/index";
import { validateWorksheet } from "../tests/fixtures/validate-fixtures.mjs";

const result = worksheetTypes.map((type) => {
  const worksheet = generateWorksheet(type, {
    itemCount: 6,
    seed: 42,
    format: type.formats[0]
  });
  const schemaErrors = validateWorksheet(worksheet);
  const audit = auditWorksheet(worksheet);
  const selfChecks = worksheet.answerKey.map((entry) => checkAnswer(entry.answer.value, entry));
  const failedSelfChecks = selfChecks.filter((entry) => entry.status !== "correct");

  return {
    title: type.title,
    id: type.id,
    schemaOk: schemaErrors.length === 0,
    schemaErrors,
    auditOk: audit.ok,
    failedAuditItems: audit.failed,
    selfCheckOk: failedSelfChecks.length === 0,
    failedSelfChecks: failedSelfChecks.length,
    total: worksheet.answerKey.length
  };
});

const failed = result.filter((entry) => !entry.schemaOk || !entry.auditOk || !entry.selfCheckOk);

console.log(JSON.stringify({
  worksheetTypes: result.length,
  generatedItems: result.reduce((total, entry) => total + entry.total, 0),
  failed
}, null, 2));

if (failed.length) {
  process.exit(1);
}
