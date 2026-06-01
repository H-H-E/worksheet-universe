const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("app.js", "utf8").replace(
  /renderFilters\(\);\s*(?:renderCoverage\(\);\s*)?renderAgents\(\);\s*renderGradeMap\(\);\s*renderFormats\(\);\s*renderBlueprint\(activeType\);\s*bindEvents\(\);\s*$/,
  "{}"
);

const elements = {
  itemCount: { value: "6" },
  seedInput: { value: "42" }
};

const document = {
  getElementById(id) {
    return elements[id] || {
      value: "",
      innerHTML: "",
      textContent: "",
      addEventListener() {}
    };
  }
};

const context = { console, document, window: { print() {} } };
vm.createContext(context);
vm.runInContext(source, context);

const result = vm.runInContext(`
  worksheetTypes.map((type) => {
    const worksheet = generateWorksheet(type);
    const auditOk = worksheet.audit.ok;

    worksheet.items.forEach((item) => {
      item.studentInput = item.answerKey.value;
      checkItem(item);
    });

    worksheet.summary = summarizeItems(worksheet.items);

    return {
      title: type.title,
      auditOk,
      failedAuditItems: worksheet.audit.failed,
      selfCheckOk: worksheet.summary.correct === worksheet.items.length,
      correct: worksheet.summary.correct,
      total: worksheet.items.length
    };
  })
`, context);

const failed = result.filter((entry) => !entry.auditOk || !entry.selfCheckOk);

console.log(JSON.stringify({
  worksheetTypes: result.length,
  generatedItems: result.reduce((total, entry) => total + entry.total, 0),
  failed
}, null, 2));

if (failed.length) {
  process.exit(1);
}
