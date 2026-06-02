import assert from "node:assert/strict";
import {
  generateAreaPerimeterWorksheet,
  generateFractionWorksheet,
  generateLinearEquationWorksheet,
  generatePercentWorksheet,
  generateProbabilityWorksheet,
  generateRequiredGeneratorWorksheets,
  generatorRegistry
} from "../../src/generators/index.mjs";
import { gcd, simplifyFraction, formatFraction } from "../../src/generators/math-utils.mjs";
import { validateWorksheet } from "../fixtures/validate-fixtures.mjs";

const requiredFamilies = [
  {
    id: "fraction-add-like-denominators",
    generate: generateFractionWorksheet,
    assertInvariants(result) {
      const item = result.manifest[0];
      const { a, b, denominator } = item.variables;
      assert.notEqual(denominator, 0);
      const expected = simplifyFraction(a + b, denominator);
      assert.equal(gcd(expected.numerator, expected.denominator), 1);
      assert.deepEqual(item.correctAnswer.canonical, expected);
      assert.equal(item.correctAnswer.value, formatFraction(expected));
      assert.equal(result.worksheet.sections[0].questions[0].type, "fraction");
      assert.equal(result.worksheet.answerKey[0].normalization, "fraction");
    }
  },
  {
    id: "percent-of-number",
    generate: generatePercentWorksheet,
    assertInvariants(result) {
      const item = result.manifest[0];
      const { base, percent } = item.variables;
      const expected = Number((base * percent / 100).toFixed(2));
      assert.equal(Number(item.correctAnswer.value), expected);
      assert.equal(result.worksheet.answerKey[0].normalization, "decimal");
      assert.equal(result.worksheet.answerKey[0].tolerance, 0.01);
      assert.match(item.workedSolution.map((step) => step.text).join(" "), /Convert/);
    }
  },
  {
    id: "simple-probability",
    generate: generateProbabilityWorksheet,
    assertInvariants(result) {
      const item = result.manifest[0];
      const { favorable, total } = item.variables;
      assert.ok(favorable >= 0);
      assert.ok(total > 0);
      assert.ok(favorable <= total);
      const expected = simplifyFraction(favorable, total);
      assert.deepEqual(item.correctAnswer.canonical, expected);
      assert.equal(item.correctAnswer.value, formatFraction(expected));
      assert.ok(expected.numerator / expected.denominator >= 0);
      assert.ok(expected.numerator / expected.denominator <= 1);
    }
  },
  {
    id: "linear-equation-two-step",
    generate: generateLinearEquationWorksheet,
    assertInvariants(result) {
      const item = result.manifest[0];
      const { a, b, c, x } = item.variables;
      assert.notEqual(a, 0);
      assert.equal(a * x + b, c);
      assert.equal(Number(item.correctAnswer.value), x);
      assert.match(item.workedSolution.at(-1).text, /Check:/);
      assert.equal(result.worksheet.sections[0].questions[0].type, "equation");
    }
  },
  {
    id: "rectangle-area-perimeter",
    generate: generateAreaPerimeterWorksheet,
    assertInvariants(result) {
      const item = result.manifest[0];
      const { length, width, measure } = item.variables;
      assert.ok(length > 0);
      assert.ok(width > 0);
      const expected = measure === "area" ? length * width : 2 * (length + width);
      assert.equal(Number(item.correctAnswer.value), expected);
      assert.equal(item.correctAnswer.canonical.value, expected);
      assert.match(item.correctAnswer.canonical.unit, measure === "area" ? /square units/ : /^units$/);
    }
  }
];

const failures = [];

try {
  assert.deepEqual(
    generatorRegistry.map((entry) => entry.id).sort(),
    requiredFamilies.map((entry) => entry.id).sort()
  );

  for (const family of requiredFamilies) {
    const first = family.generate({ seed: "task-006-seed" });
    const second = family.generate({ seed: "task-006-seed" });
    assert.deepEqual(second, first, `${family.id} must be deterministic for the same seed.`);

    assertGeneratedResult(first, family.id);
    family.assertInvariants(first);

    for (let seedIndex = 1; seedIndex <= 25; seedIndex += 1) {
      const result = family.generate({ seed: `${family.id}:${seedIndex}` });
      assertGeneratedResult(result, family.id);
      family.assertInvariants(result);
    }
  }

  const all = generateRequiredGeneratorWorksheets("all-families");
  assert.equal(all.length, requiredFamilies.length);
  for (const result of all) {
    assertGeneratedResult(result, result.worksheet.metadata.generator.id);
  }
} catch (error) {
  failures.push(error.stack || error.message);
}

console.log(JSON.stringify({
  families: requiredFamilies.length,
  propertySeedsPerFamily: 25,
  failed: failures
}, null, 2));

if (failures.length) process.exit(1);

function assertGeneratedResult(result, expectedGeneratorId) {
  assert.equal(typeof result, "object");
  assert.equal(result.worksheet.metadata.generator.id, expectedGeneratorId);
  assert.equal(result.manifest.length, result.worksheet.sections[0].questions.length);

  const schemaErrors = validateWorksheet(result.worksheet);
  assert.deepEqual(schemaErrors, [], `${expectedGeneratorId} worksheet must validate against canonical schema.`);

  for (const item of result.manifest) {
    assert.equal(typeof item.problemText, "string");
    assert.ok(item.problemText.length > 0);
    assert.equal(typeof item.variables, "object");
    assert.equal(typeof item.correctAnswer.value, "string");
    assert.ok(item.workedSolution.length > 0);
    assert.ok(item.tags.length > 0);
    assert.equal(item.lineage.generatorId, expectedGeneratorId);
    assert.equal(item.lineage.schemaVersion, "1.0.0");
  }
}
