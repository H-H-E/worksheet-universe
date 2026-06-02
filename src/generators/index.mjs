import { buildCanonicalWorksheet } from "./canonical-worksheet.mjs";
import { formatFraction, simplifyFraction } from "./math-utils.mjs";
import { createRng } from "./rng.mjs";

const VERSION = "1.0.0";

export const generatorRegistry = [
  {
    id: "fraction-add-like-denominators",
    family: "fractions",
    generate: generateFractionWorksheet
  },
  {
    id: "percent-of-number",
    family: "percents",
    generate: generatePercentWorksheet
  },
  {
    id: "simple-probability",
    family: "probability",
    generate: generateProbabilityWorksheet
  },
  {
    id: "linear-equation-two-step",
    family: "linear-equations",
    generate: generateLinearEquationWorksheet
  },
  {
    id: "rectangle-area-perimeter",
    family: "area-perimeter",
    generate: generateAreaPerimeterWorksheet
  }
];

export function generateRequiredGeneratorWorksheets(seed = "42") {
  return generatorRegistry.map((generator, index) => generator.generate({ seed: `${seed}:${index + 1}` }));
}

export function generateWorksheetById(id, options = {}) {
  const generator = generatorRegistry.find((entry) => entry.id === id);
  if (!generator) throw new Error(`Unknown generator id: ${id}`);
  return generator.generate(options);
}

export function generateFractionWorksheet(options = {}) {
  const seed = options.seed || "42";
  const rng = createRng(seed);
  const denominator = rng.pick([4, 5, 6, 8, 10, 12]);
  const a = rng.int(1, Math.max(1, Math.floor(denominator / 2)));
  const b = rng.int(1, denominator - a);
  const answer = simplifyFraction(a + b, denominator);
  const answerValue = formatFraction(answer);

  return buildCanonicalWorksheet({
    seed,
    generator: { id: "fraction-add-like-denominators", version: VERSION, variant: "like-denominator-sum" },
    title: "Add Like-Denominator Fractions",
    gradeBand: "4-5",
    topic: "Fractions, Decimals, and Percents",
    learningGoals: ["Add fractions with like denominators.", "Simplify a fraction answer when possible."],
    instructions: "Add the fractions and simplify if possible.",
    format: "worked-practice",
    standards: [{ framework: "CCSS-M", code: "4.NF.B.3", alignment: "primary" }],
    items: [
      {
        questionType: "fraction",
        problemText: `${a}/${denominator} + ${b}/${denominator} =`,
        content: [
          { kind: "math", tex: `\\frac{${a}}{${denominator}} + \\frac{${b}}{${denominator}}`, alt: `${a} over ${denominator} plus ${b} over ${denominator}` },
          { kind: "workspace", style: "ruled", height: "0.75in" }
        ],
        variables: { a, b, denominator },
        correctAnswer: {
          kind: "fraction",
          value: answerValue,
          canonical: answer
        },
        normalization: "fraction",
        workedSolution: [
          { text: "The denominators are the same, so add the numerators." },
          { text: `${a} + ${b} = ${a + b}.` },
          { text: "Keep the denominator and simplify.", math: `\\frac{${a + b}}{${denominator}} = ${answer.denominator === 1 ? answer.numerator : `\\frac{${answer.numerator}}{${answer.denominator}}`}` }
        ],
        difficulty: { band: "core", level: denominator >= 10 ? 3 : 2 },
        tags: ["fractions", "like-denominators", "simplify"]
      }
    ]
  });
}

export function generatePercentWorksheet(options = {}) {
  const seed = options.seed || "42";
  const rng = createRng(seed);
  const percent = rng.pick([5, 10, 15, 20, 25, 30, 40, 50, 75]);
  const base = rng.int(4, 30) * 10;
  const value = Number((base * percent / 100).toFixed(2));

  return buildCanonicalWorksheet({
    seed,
    generator: { id: "percent-of-number", version: VERSION, variant: "friendly-percent" },
    title: "Percent of a Number",
    gradeBand: "6-7",
    topic: "Fractions, Decimals, and Percents",
    learningGoals: ["Convert a percent to a decimal.", "Find a percent of a whole number."],
    instructions: "Find each percent of the number.",
    format: "worked-practice",
    standards: [{ framework: "CCSS-M", code: "6.RP.A.3c", alignment: "primary" }],
    items: [
      {
        questionType: "decimal",
        problemText: `What is ${percent}% of ${base}?`,
        content: [
          { kind: "text", text: `What is ${percent}% of ${base}?` },
          { kind: "workspace", style: "ruled", height: "0.75in" }
        ],
        variables: { percent, base },
        correctAnswer: { kind: "decimal", value: String(value), canonical: { value } },
        normalization: "decimal",
        tolerance: 0.01,
        workedSolution: [
          { text: `Convert ${percent}% to ${percent / 100}.` },
          { text: `Multiply ${base} by ${percent / 100}.` },
          { text: `The answer is ${value}.` }
        ],
        difficulty: { band: "core", level: percent % 25 === 0 ? 2 : 3 },
        tags: ["percents", "rates", "decimal-multiplication"]
      }
    ]
  });
}

export function generateProbabilityWorksheet(options = {}) {
  const seed = options.seed || "42";
  const rng = createRng(seed);
  const favorable = rng.int(1, 6);
  const other = rng.int(1, 8);
  const total = favorable + other;
  const answer = simplifyFraction(favorable, total);
  const answerValue = formatFraction(answer);

  return buildCanonicalWorksheet({
    seed,
    generator: { id: "simple-probability", version: VERSION, variant: "bag-draw" },
    title: "Simple Probability",
    gradeBand: "6-7",
    topic: "Data, Statistics, and Probability",
    learningGoals: ["Identify favorable outcomes.", "Write probability as a simplified fraction."],
    instructions: "Write each probability as a simplified fraction.",
    format: "quick-check",
    standards: [{ framework: "CCSS-M", code: "7.SP.C.5", alignment: "primary" }],
    items: [
      {
        questionType: "fraction",
        problemText: `A bag has ${favorable} blue marbles and ${other} red marbles. What is the probability of drawing a blue marble?`,
        content: [
          { kind: "text", text: `A bag has ${favorable} blue marbles and ${other} red marbles.` },
          { kind: "text", text: "What is the probability of drawing a blue marble?" }
        ],
        variables: { favorable, other, total },
        correctAnswer: {
          kind: "fraction",
          value: answerValue,
          canonical: answer
        },
        normalization: "fraction",
        workedSolution: [
          { text: `Favorable outcomes: ${favorable}.` },
          { text: `Total outcomes: ${favorable} + ${other} = ${total}.` },
          { text: "Write favorable over total and simplify.", math: `\\frac{${favorable}}{${total}} = ${answer.denominator === 1 ? answer.numerator : `\\frac{${answer.numerator}}{${answer.denominator}}`}` }
        ],
        difficulty: { band: "core", level: total > 10 ? 3 : 2 },
        tags: ["probability", "fractions", "sample-space"]
      }
    ]
  });
}

export function generateLinearEquationWorksheet(options = {}) {
  const seed = options.seed || "42";
  const rng = createRng(seed);
  const x = rng.int(-8, 12);
  const a = rng.pick([2, 3, 4, 5, 6, 7, 8, 9]);
  const b = rng.int(-12, 15);
  const c = a * x + b;
  const sign = b >= 0 ? "+" : "-";

  return buildCanonicalWorksheet({
    seed,
    generator: { id: "linear-equation-two-step", version: VERSION, variant: "integer-solution" },
    title: "Two-Step Linear Equation",
    gradeBand: "7-8",
    topic: "Algebra and Functions",
    learningGoals: ["Solve a two-step equation.", "Verify a solution by substitution."],
    instructions: "Solve for x and check your answer.",
    format: "worked-practice",
    standards: [{ framework: "CCSS-M", code: "8.EE.C.7", alignment: "primary" }],
    items: [
      {
        questionType: "equation",
        problemText: `Solve for x: ${a}x ${sign} ${Math.abs(b)} = ${c}`,
        content: [
          { kind: "math", tex: `${a}x ${sign} ${Math.abs(b)} = ${c}`, alt: `${a} x ${sign === "+" ? "plus" : "minus"} ${Math.abs(b)} equals ${c}` },
          { kind: "workspace", style: "ruled", height: "1.25in" }
        ],
        variables: { a, b, c, x },
        correctAnswer: { kind: "integer", value: String(x), canonical: { variable: "x", value: x } },
        normalization: "integer",
        workedSolution: [
          { text: `${b >= 0 ? "Subtract" : "Add"} ${Math.abs(b)} to both sides.`, math: `${a}x = ${c - b}` },
          { text: `Divide both sides by ${a}.`, math: `x = ${x}` },
          { text: `Check: ${a}(${x}) ${sign} ${Math.abs(b)} = ${c}.` }
        ],
        difficulty: { band: "core", level: b < 0 || x < 0 ? 4 : 3 },
        tags: ["linear-equations", "inverse-operations", "integer-solution"]
      }
    ]
  });
}

export function generateAreaPerimeterWorksheet(options = {}) {
  const seed = options.seed || "42";
  const rng = createRng(seed);
  const length = rng.int(4, 18);
  const width = rng.int(3, 14);
  const measure = rng.pick(["area", "perimeter"]);
  const value = measure === "area" ? length * width : 2 * (length + width);
  const unit = measure === "area" ? "square units" : "units";

  return buildCanonicalWorksheet({
    seed,
    generator: { id: "rectangle-area-perimeter", version: VERSION, variant: measure },
    title: "Rectangle Area and Perimeter",
    gradeBand: "4-6",
    topic: "Geometry and Spatial Reasoning",
    learningGoals: ["Use rectangle dimensions to compute area or perimeter.", "Label measurement answers with units."],
    instructions: "Use the rectangle dimensions to answer the question.",
    format: "visual-model",
    standards: [{ framework: "CCSS-M", code: "4.MD.A.3", alignment: "primary" }],
    items: [
      {
        questionType: "integer",
        problemText: `Find the ${measure} of a rectangle with length ${length} units and width ${width} units.`,
        content: [
          {
            kind: "visual",
            visualType: "geometryFigure",
            data: { shape: "rectangle", length, width },
            alt: `Rectangle with length ${length} units and width ${width} units.`
          },
          { kind: "workspace", style: "grid", height: "1in" }
        ],
        variables: { length, width, measure },
        correctAnswer: { kind: "integer", value: String(value), canonical: { value, unit } },
        normalization: "integer",
        alternates: [`${value} ${unit}`],
        workedSolution: measure === "area"
          ? [
              { text: "Area equals length times width." },
              { text: `${length} x ${width} = ${value} ${unit}.` }
            ]
          : [
              { text: "Perimeter equals twice the sum of length and width." },
              { text: `2 x (${length} + ${width}) = ${value} ${unit}.` }
            ],
        difficulty: { band: "core", level: Math.max(length, width) > 12 ? 3 : 2 },
        tags: ["geometry", "measurement", measure]
      }
    ]
  });
}
