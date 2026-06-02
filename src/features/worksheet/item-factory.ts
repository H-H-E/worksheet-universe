import type { WorksheetType } from "./catalog";

export type Rng = () => number;

type GeneratedItemFormat = "numeric" | "decimal" | "money" | "percent" | "fraction" | "coordinate" | "text";
type GeneratedAnswerNormalization = "number" | "fraction" | "coordinate" | "text";
type GeneratedItemData = Record<string, unknown>;

interface FractionValue {
  numerator: number;
  denominator: number;
}

export type GeneratedVisual =
  | { kind: "dots"; count: number }
  | { kind: "fractionBar"; numerator: number; denominator: number };

export interface GeneratedAnswerKey {
  value: string;
  alternates: string[];
  tolerance: number;
  normalize: GeneratedAnswerNormalization;
  orderInsensitive: boolean;
}

export interface GeneratedItemDraft {
  id: string;
  kind: string;
  number: number;
  prompt: string;
  format: GeneratedItemFormat;
  data: GeneratedItemData;
  visual?: GeneratedVisual;
  feedback: string;
  steps: string[];
  alternates?: string[];
  orderInsensitive?: boolean;
}

export interface GeneratedItem extends GeneratedItemDraft {
  answerKey: GeneratedAnswerKey;
}

export function createRng(seed: number): Rng {
  let state = Math.max(1, Math.floor(seed) % 2147483647);
  return function next() {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function hashString(value: string): number {
  return value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function int(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: Rng, values: readonly T[]): T {
  return values[int(rng, 0, values.length - 1)];
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function simplifyFraction(numerator: number, denominator: number): FractionValue {
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: Math.abs(denominator / divisor)
  };
}

function formatFraction(fraction: FractionValue): string {
  if (fraction.denominator === 1) return String(fraction.numerator);
  return `${fraction.numerator}/${fraction.denominator}`;
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatTime(totalMinutes: number): string {
  const minutesInDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(minutesInDay / 60);
  const minute = minutesInDay % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function buildItem(type: WorksheetType, index: number, rng: Rng): GeneratedItem {
  const number = index + 1;
  switch (type.generatorKind) {
    case "numberSense": {
      const count = int(rng, 2, type.grades.includes("1") ? 20 : 10);
      return finalizeItem({
        id: `q${number}`,
        kind: "numberSense",
        number,
        prompt: "How many dots are shown?",
        format: "numeric",
        data: { count },
        visual: { kind: "dots", count },
        feedback: "Count each dot once, then enter the total.",
        steps: [`There are ${count} dots in the model.`, `The numeral is ${count}.`]
      });
    }
    case "numberPattern": {
      const start = int(rng, 4, 60);
      const step = pick(rng, [2, 3, 5, 10]);
      const missingIndex = int(rng, 2, 4);
      const values = [0, 1, 2, 3, 4].map((offset) => start + offset * step);
      return finalizeItem({
        id: `q${number}`,
        kind: "numberPattern",
        number,
        prompt: `Complete the pattern: ${values.map((value, i) => i === missingIndex ? "__" : value).join(", ")}`,
        format: "numeric",
        data: { answer: values[missingIndex], start, step, missingIndex },
        feedback: `The pattern changes by ${step} each time.`,
        steps: [`Start at ${start}.`, `Add ${step} for each move.`, `The blank is ${values[missingIndex]}.`]
      });
    }
    case "compare": {
      const allowNegative = type.grades.some((grade) => Number(grade) >= 6);
      const a = int(rng, allowNegative ? -50 : 1, 999);
      const b = int(rng, allowNegative ? -50 : 1, 999);
      return finalizeItem({
        id: `q${number}`,
        kind: "compare",
        number,
        prompt: `Fill in the comparison sign: ${a} __ ${b}`,
        format: "text",
        data: { a, b },
        feedback: "Use >, <, or =.",
        steps: [`Compare ${a} and ${b}.`, `${a} is ${a > b ? "greater than" : a < b ? "less than" : "equal to"} ${b}.`]
      });
    }
    case "placeValue": {
      const hundreds = int(rng, 2, 8);
      const tens = int(rng, 1, 9);
      const ones = int(rng, 1, 9);
      const num = hundreds * 100 + tens * 10 + ones;
      const target = pick(rng, [
        { digit: hundreds, value: hundreds * 100, place: "hundreds" },
        { digit: tens, value: tens * 10, place: "tens" },
        { digit: ones, value: ones, place: "ones" }
      ]);
      return finalizeItem({
        id: `q${number}`,
        kind: "placeValue",
        number,
        prompt: `In ${num}, what is the value of the digit ${target.digit} in the ${target.place} place?`,
        format: "numeric",
        data: { value: target.value },
        feedback: "Match the digit to its place-value column.",
        steps: [`The digit ${target.digit} is in the ${target.place} place.`, `Its value is ${target.value}.`]
      });
    }
    case "rounding": {
      const place = pick(rng, [10, 100]);
      const value = int(rng, 100, 9999);
      return finalizeItem({
        id: `q${number}`,
        kind: "rounding",
        number,
        prompt: `Round ${value} to the nearest ${place}.`,
        format: "numeric",
        data: { value, place },
        feedback: "Check the digit to the right of the rounding place.",
        steps: [`Find the ${place} place.`, `Use the digit to its right to decide whether to round up or down.`]
      });
    }
    case "arithmetic": {
      const operation = String(type.params.operation || "add");
      const min = Number(type.params.min || 1);
      const max = Number(type.params.max || 20);
      let a = int(rng, min, max);
      let b = int(rng, min, max);
      if (operation === "subtract" && b > a) [a, b] = [b, a];
      const symbol = operation === "add" ? "+" : operation === "subtract" ? "-" : "x";
      return finalizeItem({
        id: `q${number}`,
        kind: "arithmetic",
        number,
        prompt: `${a} ${symbol} ${b} =`,
        format: "numeric",
        data: { a, b, operation },
        feedback: "Recheck the operation and each place value.",
        steps: arithmeticSteps(a, b, operation)
      });
    }
    case "mixedOperations": {
      const operation = pick(rng, ["add", "subtract", "multiply"]);
      let a = int(rng, 5, 80);
      let b = int(rng, 2, 25);
      if (operation === "subtract" && b > a) [a, b] = [b, a];
      const symbol = operation === "add" ? "+" : operation === "subtract" ? "-" : "x";
      return finalizeItem({
        id: `q${number}`,
        kind: "arithmetic",
        number,
        prompt: `${a} ${symbol} ${b} =`,
        format: "numeric",
        data: { a, b, operation },
        feedback: "Check the operation sign before solving.",
        steps: arithmeticSteps(a, b, operation)
      });
    }
    case "factFamily": {
      const a = int(rng, 3, 12);
      const b = int(rng, 2, 12);
      const sum = a + b;
      return finalizeItem({
        id: `q${number}`,
        kind: "factFamily",
        number,
        prompt: `Complete the fact family: ${a} + ${b} = ${sum}; ${sum} - ${a} = __`,
        format: "numeric",
        data: { answer: b },
        feedback: "Use the inverse subtraction fact.",
        steps: [`The addition fact is ${a} + ${b} = ${sum}.`, `The related subtraction fact is ${sum} - ${a} = ${b}.`]
      });
    }
    case "division": {
      const divisor = int(rng, 2, 12);
      const quotient = int(rng, 2, 15);
      const dividend = divisor * quotient;
      return finalizeItem({
        id: `q${number}`,
        kind: "division",
        number,
        prompt: `${dividend} / ${divisor} =`,
        format: "numeric",
        data: { dividend, divisor, quotient },
        feedback: "Use multiplication to check your quotient.",
        steps: [`Ask: ${divisor} times what equals ${dividend}?`, `${divisor} x ${quotient} = ${dividend}.`]
      });
    }
    case "orderOps": {
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 9);
      const c = int(rng, 2, 6);
      return finalizeItem({
        id: `q${number}`,
        kind: "orderOps",
        number,
        prompt: `(${a} + ${b}) x ${c} =`,
        format: "numeric",
        data: { a, b, c },
        feedback: "Simplify inside parentheses first.",
        steps: [`Parentheses: ${a} + ${b} = ${a + b}.`, `Multiply: ${a + b} x ${c} = ${(a + b) * c}.`]
      });
    }
    case "fractionModel": {
      const denominator = int(rng, 3, 10);
      const numerator = int(rng, 1, denominator - 1);
      return finalizeItem({
        id: `q${number}`,
        kind: "fractionModel",
        number,
        prompt: "What fraction of the bar is shaded?",
        format: "fraction",
        data: { numerator, denominator },
        visual: { kind: "fractionBar", numerator, denominator },
        feedback: "Write shaded parts over total equal parts.",
        steps: [`There are ${numerator} shaded parts.`, `There are ${denominator} total equal parts.`, `The fraction is ${numerator}/${denominator}.`]
      });
    }
    case "simplifyFraction": {
      const numerator = int(rng, 2, 8);
      const denominator = int(rng, numerator + 1, 12);
      const multiplier = int(rng, 2, 5);
      const rawN = numerator * multiplier;
      const rawD = denominator * multiplier;
      return finalizeItem({
        id: `q${number}`,
        kind: "simplifyFraction",
        number,
        prompt: `Simplify ${rawN}/${rawD}.`,
        format: "fraction",
        data: { numerator: rawN, denominator: rawD },
        feedback: "Divide numerator and denominator by their greatest common factor.",
        steps: [`The GCF of ${rawN} and ${rawD} is ${gcd(rawN, rawD)}.`, `Divide both parts by ${gcd(rawN, rawD)}.`]
      });
    }
    case "fractionOps": {
      const denominator = int(rng, 4, 12);
      const a = int(rng, 1, denominator - 2);
      const b = int(rng, 1, denominator - a - 1);
      return finalizeItem({
        id: `q${number}`,
        kind: "fractionAdd",
        number,
        prompt: `${a}/${denominator} + ${b}/${denominator} =`,
        format: "fraction",
        data: { a, b, denominator },
        feedback: "The denominators match, so add the numerators.",
        steps: [`Add numerators: ${a} + ${b} = ${a + b}.`, `Keep denominator ${denominator}.`, `Simplify if possible.`]
      });
    }
    case "decimalOps": {
      const aCents = int(rng, 125, 950);
      const bCents = int(rng, 25, 875);
      return finalizeItem({
        id: `q${number}`,
        kind: "decimalAdd",
        number,
        prompt: `${money(aCents)} + ${money(bCents)} =`,
        format: "decimal",
        data: { aCents, bCents },
        feedback: "Line up the decimal points before adding.",
        steps: [`Add cents: ${aCents} + ${bCents} = ${aCents + bCents}.`, `Write as dollars: ${money(aCents + bCents)}.`]
      });
    }
    case "conversion": {
      const denominator = pick(rng, [4, 5, 10, 20]);
      const numerator = int(rng, 1, denominator - 1);
      return finalizeItem({
        id: `q${number}`,
        kind: "fractionToPercent",
        number,
        prompt: `Convert ${numerator}/${denominator} to a percent.`,
        format: "percent",
        data: { numerator, denominator },
        feedback: "Scale the denominator to 100 or divide.",
        steps: [`${numerator} / ${denominator} = ${numerator / denominator}.`, `Multiply by 100 to get the percent.`]
      });
    }
    case "ratio": {
      const unit = int(rng, 2, 9);
      const start = int(rng, 2, 6);
      const target = int(rng, 7, 14);
      return finalizeItem({
        id: `q${number}`,
        kind: "ratio",
        number,
        prompt: `${start} notebooks cost $${start * unit}. How much do ${target} notebooks cost?`,
        format: "money",
        data: { unit, target },
        feedback: "Find the cost of one notebook first.",
        steps: [`Unit rate: $${start * unit} / ${start} = $${unit}.`, `${target} notebooks cost ${target} x $${unit}.`]
      });
    }
    case "percent": {
      const percent = pick(rng, [10, 15, 20, 25, 30, 40, 50]);
      const base = int(rng, 20, 200);
      return finalizeItem({
        id: `q${number}`,
        kind: "percent",
        number,
        prompt: `What is ${percent}% of ${base}?`,
        format: "decimal",
        data: { percent, base },
        feedback: "Convert the percent to a decimal, then multiply.",
        steps: [`${percent}% = ${percent / 100}.`, `${percent / 100} x ${base} = ${base * percent / 100}.`]
      });
    }
    case "integerOps": {
      const a = int(rng, -30, 30);
      const b = int(rng, -30, 30);
      return finalizeItem({
        id: `q${number}`,
        kind: "integerAdd",
        number,
        prompt: `${a} + (${b}) =`,
        format: "numeric",
        data: { a, b },
        feedback: "Think of the second integer as movement on the number line.",
        steps: [`Start at ${a}.`, `Move ${Math.abs(b)} ${b >= 0 ? "right" : "left"}.`]
      });
    }
    case "gcf": {
      const factor = int(rng, 2, 9);
      const a = factor * int(rng, 2, 8);
      const b = factor * int(rng, 2, 8);
      return finalizeItem({
        id: `q${number}`,
        kind: "gcf",
        number,
        prompt: `Find the greatest common factor of ${a} and ${b}.`,
        format: "numeric",
        data: { a, b },
        feedback: "List factors of both numbers, then choose the greatest shared one.",
        steps: [`Factors of ${a} and ${b} share at least ${factor}.`, `Compare all shared factors to find the greatest.`]
      });
    }
    case "exponent": {
      const base = int(rng, 2, 9);
      const exponent = int(rng, 2, 4);
      return finalizeItem({
        id: `q${number}`,
        kind: "exponent",
        number,
        prompt: `${base}^${exponent} =`,
        format: "numeric",
        data: { base, exponent },
        feedback: "Multiply the base by itself repeatedly.",
        steps: [`Use ${exponent} factors of ${base}.`, `${base}^${exponent} = ${base ** exponent}.`]
      });
    }
    case "algebra": {
      const x = int(rng, -8, 12);
      const a = int(rng, 2, 9);
      const b = int(rng, -10, 15);
      const c = a * x + b;
      const sign = b >= 0 ? "+" : "-";
      return finalizeItem({
        id: `q${number}`,
        kind: "algebra",
        number,
        prompt: `Solve for x: ${a}x ${sign} ${Math.abs(b)} = ${c}`,
        format: "numeric",
        data: { a, b, c },
        feedback: "Undo the constant first, then divide by the coefficient.",
        steps: [`Subtract ${b} from both sides: ${a}x = ${c - b}.`, `Divide by ${a}: x = ${(c - b) / a}.`]
      });
    }
    case "functionTable": {
      const m = int(rng, 2, 8);
      const b = int(rng, -5, 9);
      const x = int(rng, -4, 10);
      const sign = b >= 0 ? "+" : "-";
      return finalizeItem({
        id: `q${number}`,
        kind: "functionTable",
        number,
        prompt: `For y = ${m}x ${sign} ${Math.abs(b)}, find y when x = ${x}.`,
        format: "numeric",
        data: { m, b, x },
        feedback: "Substitute the x-value into the rule.",
        steps: [`Replace x with ${x}: y = ${m}(${x}) ${sign} ${Math.abs(b)}.`, `Compute y = ${m * x + b}.`]
      });
    }
    case "coordinate": {
      const x = int(rng, -6, 6);
      const y = int(rng, -6, 6);
      const dx = int(rng, -4, 4) || 2;
      const dy = int(rng, -4, 4) || -3;
      return finalizeItem({
        id: `q${number}`,
        kind: "coordinate",
        number,
        prompt: `Point A is (${x}, ${y}). Translate it ${Math.abs(dx)} ${dx >= 0 ? "right" : "left"} and ${Math.abs(dy)} ${dy >= 0 ? "up" : "down"}. What is the new point?`,
        format: "coordinate",
        data: { x, y, dx, dy },
        feedback: "Horizontal movement changes x; vertical movement changes y.",
        steps: [`New x: ${x} ${dx >= 0 ? "+" : "-"} ${Math.abs(dx)} = ${x + dx}.`, `New y: ${y} ${dy >= 0 ? "+" : "-"} ${Math.abs(dy)} = ${y + dy}.`]
      });
    }
    case "geometry": {
      const facts = [
        { shape: "triangle", property: "sides", answer: 3 },
        { shape: "quadrilateral", property: "sides", answer: 4 },
        { shape: "pentagon", property: "sides", answer: 5 },
        { shape: "hexagon", property: "sides", answer: 6 },
        { shape: "octagon", property: "sides", answer: 8 }
      ];
      const fact = pick(rng, facts);
      return finalizeItem({
        id: `q${number}`,
        kind: "knownFact",
        number,
        prompt: `How many ${fact.property} does a ${fact.shape} have?`,
        format: "numeric",
        data: { answer: fact.answer },
        feedback: "Use the shape name and count its sides.",
        steps: [`A ${fact.shape} has ${fact.answer} sides.`]
      });
    }
    case "area": {
      const length = int(rng, 3, 18);
      const width = int(rng, 2, 12);
      return finalizeItem({
        id: `q${number}`,
        kind: "area",
        number,
        prompt: `Find the area of a rectangle with length ${length} units and width ${width} units.`,
        format: "numeric",
        data: { length, width },
        feedback: "Area of a rectangle is length times width.",
        steps: [`A = length x width.`, `A = ${length} x ${width} = ${length * width}.`]
      });
    }
    case "measurement": {
      const meters = int(rng, 2, 25);
      return finalizeItem({
        id: `q${number}`,
        kind: "measurement",
        number,
        prompt: `Convert ${meters} meters to centimeters.`,
        format: "numeric",
        data: { meters },
        feedback: "One meter equals 100 centimeters.",
        steps: [`${meters} x 100 = ${meters * 100}.`, `${meters} meters = ${meters * 100} centimeters.`]
      });
    }
    case "time": {
      const start = int(rng, 8 * 60, 16 * 60);
      const duration = pick(rng, [25, 30, 45, 60, 75, 90, 120]);
      return finalizeItem({
        id: `q${number}`,
        kind: "time",
        number,
        prompt: `A lesson starts at ${formatTime(start)} and lasts ${duration} minutes. What time does it end?`,
        format: "text",
        data: { start, duration },
        feedback: "Add the minutes to the start time.",
        steps: [`Start at ${formatTime(start)}.`, `Add ${duration} minutes.`, `End time: ${formatTime(start + duration)}.`]
      });
    }
    case "money": {
      const price = int(rng, 125, 1975);
      const payment = Math.ceil((price + int(rng, 100, 900)) / 500) * 500;
      return finalizeItem({
        id: `q${number}`,
        kind: "money",
        number,
        prompt: `An item costs $${money(price)}. You pay $${money(payment)}. How much change should you get?`,
        format: "money",
        data: { price, payment },
        feedback: "Subtract the price from the payment.",
        steps: [`Change = $${money(payment)} - $${money(price)}.`, `Change = $${money(payment - price)}.`]
      });
    }
    case "mean": {
      const values = [int(rng, 4, 20), int(rng, 4, 20), int(rng, 4, 20), int(rng, 4, 20)];
      const sum = values.reduce((total, value) => total + value, 0);
      values[3] += (4 - sum % 4) % 4;
      return finalizeItem({
        id: `q${number}`,
        kind: "mean",
        number,
        prompt: `Find the mean of: ${values.join(", ")}.`,
        format: "decimal",
        data: { values },
        feedback: "Add all values, then divide by how many values there are.",
        steps: [`Sum: ${values.join(" + ")} = ${values.reduce((total, value) => total + value, 0)}.`, `Divide by ${values.length}.`]
      });
    }
    case "probability": {
      const favorable = int(rng, 1, 6);
      const total = int(rng, favorable + 1, 12);
      return finalizeItem({
        id: `q${number}`,
        kind: "probability",
        number,
        prompt: `A bag has ${favorable} blue marbles and ${total - favorable} red marbles. What is the probability of drawing a blue marble?`,
        format: "fraction",
        data: { favorable, total },
        feedback: "Probability is favorable outcomes over total outcomes.",
        steps: [`Favorable outcomes: ${favorable}.`, `Total outcomes: ${total}.`, `Probability: ${favorable}/${total}, simplified if possible.`]
      });
    }
    case "wordProblem": {
      const boxes = int(rng, 3, 12);
      const perBox = int(rng, 4, 24);
      return finalizeItem({
        id: `q${number}`,
        kind: "wordProblem",
        number,
        prompt: `A teacher has ${boxes} boxes with ${perBox} pencils in each box. How many pencils are there altogether?`,
        format: "numeric",
        data: { boxes, perBox },
        feedback: "Equal groups usually mean multiplication.",
        steps: [`There are ${boxes} equal groups.`, `Each group has ${perBox}.`, `${boxes} x ${perBox} = ${boxes * perBox}.`]
      });
    }
    case "patternPuzzle": {
      const start = int(rng, 2, 18);
      const firstDiff = int(rng, 2, 6);
      const values = [start];
      for (let i = 1; i < 5; i += 1) values.push(values[i - 1] + firstDiff * i);
      return finalizeItem({
        id: `q${number}`,
        kind: "knownFact",
        number,
        prompt: `Find the next number: ${values.slice(0, 4).join(", ")}, __`,
        format: "numeric",
        data: { answer: values[4] },
        feedback: "Look at how the differences change.",
        steps: [`The differences are ${firstDiff}, ${firstDiff * 2}, ${firstDiff * 3}, then ${firstDiff * 4}.`, `Add ${firstDiff * 4} to ${values[3]}.`]
      });
    }
    default:
      return finalizeItem({
        id: `q${number}`,
        kind: "knownFact",
        number,
        prompt: "Solve the generated math item.",
        format: "numeric",
        data: { answer: 0 },
        feedback: "Check the generated model.",
        steps: ["No solution method is configured yet."]
      });
  }
}

function arithmeticSteps(a: number, b: number, operation: string): string[] {
  if (operation === "add") return [`Add ${a} and ${b}.`, `The sum is ${a + b}.`];
  if (operation === "subtract") return [`Subtract ${b} from ${a}.`, `The difference is ${a - b}.`];
  return [`Multiply ${a} by ${b}.`, `The product is ${a * b}.`];
}

function finalizeItem(item: GeneratedItemDraft): GeneratedItem {
  const answer = solveItem(item);
  const normalizer = item.format === "fraction"
    ? "fraction"
    : item.format === "coordinate"
      ? "coordinate"
      : ["decimal", "money", "percent"].includes(item.format)
        ? "number"
        : item.format === "numeric"
          ? "number"
          : "text";
  return {
    ...item,
    answerKey: {
      value: String(answer),
      alternates: item.alternates || [],
      tolerance: item.format === "decimal" || item.format === "money" ? 0.01 : 0,
      normalize: normalizer,
      orderInsensitive: Boolean(item.orderInsensitive)
    }
  };
}

export function solveItem(item: Pick<GeneratedItemDraft, "kind" | "data">): string | number {
  const data = item.data as Record<string, number> & {
    answer?: string | number;
    count?: number;
    operation?: string;
    quotient?: number;
    values?: number[];
  };
  switch (item.kind) {
    case "numberSense":
    case "numberPattern":
    case "placeValue":
    case "factFamily":
    case "knownFact":
      return data.answer ?? data.value ?? data.count;
    case "compare":
      return data.a > data.b ? ">" : data.a < data.b ? "<" : "=";
    case "rounding":
      return Math.round(data.value / data.place) * data.place;
    case "arithmetic":
      if (data.operation === "add") return data.a + data.b;
      if (data.operation === "subtract") return data.a - data.b;
      return data.a * data.b;
    case "division":
      return data.quotient ?? 0;
    case "orderOps":
      return (data.a + data.b) * data.c;
    case "fractionModel":
      return formatFraction(simplifyFraction(data.numerator, data.denominator));
    case "simplifyFraction":
      return formatFraction(simplifyFraction(data.numerator, data.denominator));
    case "fractionAdd":
      return formatFraction(simplifyFraction(data.a + data.b, data.denominator));
    case "decimalAdd":
      return money(data.aCents + data.bCents);
    case "fractionToPercent":
      return `${Number((data.numerator / data.denominator * 100).toFixed(2))}%`;
    case "ratio":
      return money(data.unit * data.target * 100);
    case "percent":
      return Number((data.base * data.percent / 100).toFixed(2));
    case "integerAdd":
      return data.a + data.b;
    case "gcf":
      return gcd(data.a, data.b);
    case "exponent":
      return data.base ** data.exponent;
    case "algebra":
      return (data.c - data.b) / data.a;
    case "functionTable":
      return data.m * data.x + data.b;
    case "coordinate":
      return `(${data.x + data.dx}, ${data.y + data.dy})`;
    case "area":
      return data.length * data.width;
    case "measurement":
      return data.meters * 100;
    case "time":
      return formatTime(data.start + data.duration);
    case "money":
      return money(data.payment - data.price);
    case "mean":
      return Number(((data.values || []).reduce((total: number, value: number) => total + value, 0) / (data.values || [1]).length).toFixed(2));
    case "probability":
      return formatFraction(simplifyFraction(data.favorable, data.total));
    case "wordProblem":
      return data.boxes * data.perBox;
    default:
      return "";
  }
}
