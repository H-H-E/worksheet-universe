# Deterministic Question Generator Architecture

For math, code generates the problem and the answer. LLMs may help with wording, taxonomy, and style later, but they must not be the calculator. Every generated worksheet item should be coherent by construction and reproducible by seed.

Core rule:

```text
seed + generator spec + constraints
  -> variables
  -> derived prompt
  -> derived answer
  -> derived worked solution
  -> verified worksheet item JSON
```

## Proposed Modules

Likely future paths:

- `src/generators/rng.ts`: stable seeded RNG, `fork(label)`, `int`, `choice`, `shuffle`.
- `src/generators/types.ts`: generator, item, answer, solution, and difficulty interfaces.
- `src/generators/constraints.ts`: reusable constraints and retry budgets.
- `src/generators/answers.ts`: typed answer normalization and checking.
- `src/generators/registry.ts`: maps generator family and variant to specs.
- `src/generators/families/*.ts`: deterministic generator plugins.
- `tests/generators/*.test.*`: seeded snapshots, property-style loops, answer checker tests.
- `tests/fixtures/generated/*.json`: canonical generated worksheet/item examples.

The current static app already prototypes the essentials in `app.js`: seeded RNG, generator kinds, answer derivation, self-checking, and `scripts/verify-generators.js`. The next step is to move that logic into typed modules once the repo has a test/build harness.

## Generator Interface

```ts
type Seed = string | number;

type GeneratorSpec<TVars, TAnswer> = {
  id: string;
  family: string;
  version: string;
  grades: string[];
  strands: string[];
  variants: string[];
  defaultDifficulty: DifficultyBand;
  constraints: ConstraintSpec<TVars>;
  generateVariables(ctx: GeneratorContext): TVars;
  deriveAnswer(vars: TVars): TAnswer;
  deriveSolution(vars: TVars, answer: TAnswer): WorkedSolution;
  renderPrompt(vars: TVars): PromptBlock[];
  checkAnswer(input: unknown, answer: TAnswer): AnswerCheck;
  validate(item: GeneratedItem<TVars, TAnswer>): ValidationResult;
  calibrate(vars: TVars): DifficultyProfile;
  tags(vars: TVars): string[];
};

type GeneratedItem<TVars, TAnswer> = {
  id: string;
  prompt: PromptBlock[];
  variables: TVars;
  answer: TAnswer;
  answerKey: {
    value: string;
    canonical: TAnswer;
    alternates: string[];
    normalize:
      | "number"
      | "integer"
      | "decimal"
      | "fraction"
      | "percent"
      | "coordinate"
      | "equation"
      | "text";
    tolerance?: number;
  };
  workedSolution: WorkedSolution;
  difficulty: DifficultyProfile;
  tags: string[];
  lineage: {
    seed: Seed;
    generatorId: string;
    generatorVersion: string;
    variant: string;
    itemIndex: number;
    rngPath: string[];
    schemaVersion: string;
  };
  checks: {
    valid: boolean;
    invariants: string[];
  };
};
```

## Constructive Generation

Use constructive generation first and rejection only as a guard. A generator should usually choose the hidden correct answer or canonical relationship before rendering the visible problem.

Pattern:

1. Choose a variant from grade, skill, and difficulty.
2. Generate hidden canonical values first.
3. Derive display values from those values.
4. Enforce invariants before rendering.
5. Retry with a forked RNG path up to a small fixed budget.
6. Fail loudly with generator id, seed, variant, and failed invariant.

Example for linear equations:

```ts
const x = rng.int(-12, 12);
const a = rng.choice([-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9]);
const b = rng.int(-20, 20);
const c = a * x + b;

// Visible prompt: solve ax + b = c
// Answer: x
```

The equation is coherent because the solution was chosen before the visible equation.

## Answer And Solution Derivation

Each family owns pure derivation functions:

```ts
deriveAnswer(vars) -> canonical answer
deriveSolution(vars, answer) -> steps generated from the same variables
renderPrompt(vars) -> display-only prompt blocks
checkAnswer(input, answer) -> normalized comparison
validate(item) -> recompute answer and run invariants
```

Fractions should use structured canonical answers rather than only strings:

```ts
type FractionAnswer = {
  kind: "fraction";
  numerator: number;
  denominator: number;
  reduced: true;
};
```

Display can become `2/3` or `\frac{2}{3}`, but checking should compare normalized values.

## Difficulty, Tags, And Lineage

Difficulty should be computed from family-specific drivers:

```ts
type DifficultyProfile = {
  band: "intro" | "core" | "stretch" | "challenge";
  score: number;
  gradeBand: string;
  factors: Record<string, number | boolean | string>;
};
```

Examples:

- Addition/subtraction: digit count, regrouping, negative numbers.
- Fractions: unlike denominators, simplification required, mixed numbers.
- Linear equations: negative coefficients, two-step, distribution.
- Geometry: formula count, unit conversion, composite figures.
- Probability: replacement, compound events, conditional denominator.

Lineage metadata should make every bad item reproducible:

- seed
- generator id and version
- variant
- item index
- RNG fork path
- schema version

## Verification Strategy

Use three layers:

1. Unit tests for answer derivation, normalizers, checkers, fraction reduction, and substitution.
2. Seeded snapshot tests where fixed seeds produce stable item JSON.
3. Property-style loops over many seeds for each family.

Minimum invariants:

- Prompt includes all needed data.
- Variables satisfy declared constraints.
- Answer is derived from variables.
- Worked solution final step matches canonical answer.
- `checkAnswer(answerKey.value)` passes.
- Family-specific inverse checks pass.
- No division by zero, invalid denominator, impossible probability, ambiguous wording, or unsimplified canonical fraction.

The existing `scripts/verify-generators.js` should remain the app-level regression check as the static prototype evolves.

## Generator Family Examples

### Addition And Subtraction

- Grades: K-5.
- Variables: `a`, `b`, `operation`, regrouping flag.
- Construction: choose result constraints; swap terms for nonnegative subtraction.
- Answer: integer.
- Checks: operation recomputation and regrouping variant match.

### Fractions

- Grades: 3-7.
- Variables: numerator, denominator, operation, common denominator.
- Construction: choose reduced base fraction and multiplier.
- Answer: structured reduced fraction.
- Checks: denominator nonzero, reduced by gcd, equivalent forms accepted.

### Ratios And Percents

- Grades: 5-8.
- Variables: base, percent, rate, quantity, unit.
- Construction: choose friendly percents and bases that produce exact or controlled decimals.
- Answer: number, money, or percent.
- Checks: scale factor and unit-rate recomputation.

### Linear Equations

- Grades: 6-9.
- Variables: `x`, `a`, `b`, `c`, equation form.
- Construction: choose solution first, then set `c = ax + b`.
- Answer: integer or rational.
- Checks: substituting the answer makes both sides equal.

### Geometry Measurement

- Grades: 3-10.
- Variables: shape, dimensions, units, requested measure.
- Construction: generate valid dimensions; build composite shapes from aligned rectangles.
- Answer: area, perimeter, angle, volume, or surface area.
- Checks: positive dimensions, formula recomputation, unit label.

### Probability And Statistics

- Grades: 4-12.
- Variables: counts, sample space, favorable outcomes, dataset.
- Construction: choose total first, then category counts; for mean, choose values with desired divisibility.
- Answer: fraction, decimal, mean, median, range, or IQR.
- Checks: favorable outcomes do not exceed total, probabilities stay in `[0, 1]`, statistics recompute.

### Word Problems

- Grades: 1-9.
- Variables: scenario template id, quantities, operation model, unit labels.
- Construction: build math model first, then render scenario text from templates.
- Answer: typed quantity.
- Checks: every number in prompt maps to a variable; no unused distractors unless a variant explicitly allows them.

### Graph And Function Tasks

- Grades: 6-12.
- Variables: function rule, points, slope, intercept, domain values.
- Construction: choose the rule first, then derive tables, graph points, or prompts.
- Answer: y-value, slope, intercept, coordinate, or equation.
- Checks: all table points satisfy the rule; graph metadata matches the answer.

## Implementation Roadmap

1. Complete canonical worksheet schema and fixtures.
2. Create `src/generators/rng.ts`, `types.ts`, `answers.ts`, `constraints.ts`, and `registry.ts`.
3. Implement first generator families from the existing queue: fractions, percents, probability, linear equations, and area/perimeter.
4. Add seeded snapshots and property-style tests in `tests/generators`.
5. Add generated fixture worksheets in `tests/fixtures/generated`.
6. Add an adapter from generator output to the current static app item shape.
7. Gradually migrate current `generatorKind` logic out of `app.js` into the registry.
