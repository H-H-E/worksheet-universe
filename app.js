const gradeBands = [
  { id: "pk-k", label: "Pre-K/K", grades: ["0", "K"], focus: "counting, symbols, shapes, and early math language" },
  { id: "1-2", label: "Grades 1-2", grades: ["1", "2"], focus: "place value, addition/subtraction, time, money, and simple data" },
  { id: "3-5", label: "Grades 3-5", grades: ["3", "4", "5"], focus: "multi-digit operations, fractions, decimals, geometry, and word problems" },
  { id: "6-8", label: "Grades 6-8", grades: ["6", "7", "8"], focus: "rational numbers, ratios, equations, functions, and statistics" },
  { id: "9-12", label: "Grades 9-12", grades: ["9", "10", "11", "12"], focus: "algebra, geometry, statistics, financial math, and advanced functions" }
];

const exactGrades = [
  { id: "0", label: "Pre-K" },
  { id: "K", label: "K" },
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "3", label: "3" },
  { id: "4", label: "4" },
  { id: "5", label: "5" },
  { id: "6", label: "6" },
  { id: "7", label: "7" },
  { id: "8", label: "8" },
  { id: "9", label: "9" },
  { id: "10", label: "10" },
  { id: "11", label: "11" },
  { id: "12", label: "12" }
];

const strands = [
  "Number Sense",
  "Operations and Fluency",
  "Fractions, Decimals, and Percents",
  "Ratios and Proportional Reasoning",
  "Algebra and Functions",
  "Geometry and Spatial Reasoning",
  "Measurement",
  "Data, Statistics, and Probability",
  "Financial and Consumer Math",
  "Word Problems and Mathematical Reasoning",
  "Math Puzzles, Logic, and Enrichment"
];

const formatFamilies = [
  {
    id: "fluency-grid",
    title: "Fluency Grid",
    summary: "Dense rows of short answer items with clear answer boxes and fast self-checking.",
    structure: "Header, directions, 2-column item grid, score strip, answer key page",
    bestFor: "facts, operations, integers, exponents"
  },
  {
    id: "worked-practice",
    title: "Worked Practice",
    summary: "One-column problems with workspace, optional hints, and step-by-step reveal.",
    structure: "Header, model item, item list, large work areas, steps drawer",
    bestFor: "multi-step arithmetic, fractions, algebra, word problems"
  },
  {
    id: "visual-model",
    title: "Visual Model",
    summary: "Manipulatives, bars, grids, number lines, or diagrams alongside answer fields.",
    structure: "Visual prompt, response box, vocabulary cue, teacher key",
    bestFor: "early number, place value, fractions, geometry"
  },
  {
    id: "graph-data",
    title: "Graph and Data",
    summary: "Tables, coordinate prompts, data displays, and interpretation questions.",
    structure: "Data source, graph/table area, analysis prompts, claim line",
    bestFor: "statistics, coordinate graphing, functions, probability"
  },
  {
    id: "real-world",
    title: "Real-World Task",
    summary: "Scenario-based page with quantities, constraints, and explanation space.",
    structure: "Scenario, facts table, questions, check fields, reflection prompt",
    bestFor: "money, ratios, measurement, word problems"
  },
  {
    id: "quick-check",
    title: "Quick Check",
    summary: "Short formative assessment with automatic score summary and retry support.",
    structure: "Small item set, confidence field, instant feedback, remediation notes",
    bestFor: "exit tickets, probes, review sheets"
  }
];

const agentTeam = [
  {
    role: "Curriculum Mapper",
    owns: "grade-band and topic routing",
    output: "Maps each math generator to grades, strands, prerequisites, and subskills."
  },
  {
    role: "Format Studio",
    owns: "worksheet layout and page structure",
    output: "Chooses an HTML page family, workspace density, visual supports, and print rules."
  },
  {
    role: "Answer Verifier",
    owns: "question and answer-key correctness",
    output: "Re-solves every generated item before it reaches the student page."
  },
  {
    role: "Solution Architect",
    owns: "step-by-step solution feasibility",
    output: "Classifies each type as full, visual, partial, or not applicable and defines step logic."
  },
  {
    role: "Digital Runtime",
    owns: "self-checking HTML behavior",
    output: "Renders inputs, feedback, scoring, answer reveals, and accessible digital states."
  }
];

function bandIdsForGrades(grades) {
  return gradeBands
    .filter((band) => band.grades.some((grade) => grades.includes(grade)))
    .map((band) => band.id);
}

function makeType(title, strand, grades, summary, config) {
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    title,
    strand,
    grades,
    gradeBands: bandIdsForGrades(grades),
    summary,
    controls: config.controls,
    formats: config.formats,
    generatorKind: config.generatorKind,
    validationRules: config.validationRules,
    solution: config.solution,
    params: config.params || {}
  };
}

const worksheetTypes = [
  makeType("Number Recognition and Tracing", "Number Sense", ["0", "K"], "Generate numeral recognition, quantity matching, and trace-ready number prompts.", {
    generatorKind: "numberSense",
    formats: ["visual-model", "quick-check"],
    controls: ["number range", "visual quantity model", "trace line size", "item count"],
    validationRules: ["count model equals target numeral", "accepted answer is the numeral"],
    solution: { level: "visual", method: "show count marks and match them to the numeral" }
  }),
  makeType("Counting Sets and One-to-One Matching", "Number Sense", ["0", "K", "1"], "Count objects, match numerals to sets, and compare small quantities.", {
    generatorKind: "numberSense",
    formats: ["visual-model", "quick-check"],
    controls: ["max count", "object theme", "ten-frame support", "item count"],
    validationRules: ["object count is generated from the answer value"],
    solution: { level: "visual", method: "count each object once and mark the total" }
  }),
  makeType("Number Charts and Hundreds Charts", "Number Sense", ["K", "1", "2", "3"], "Fill missing numbers and continue skip-counting patterns.", {
    generatorKind: "numberPattern",
    formats: ["visual-model", "fluency-grid"],
    controls: ["start number", "skip pattern", "missing position", "chart size"],
    validationRules: ["missing value follows the generated arithmetic sequence"],
    solution: { level: "full", method: "add the skip amount until the blank position is reached" }
  }),
  makeType("Comparing and Ordering Numbers", "Number Sense", ["K", "1", "2", "3", "4", "5", "6"], "Use greater-than, less-than, equal signs, and ordered lists.", {
    generatorKind: "compare",
    formats: ["fluency-grid", "quick-check"],
    controls: ["number range", "digits", "decimals allowed", "negatives allowed", "item count"],
    validationRules: ["comparison sign is derived from numeric values"],
    solution: { level: "full", method: "compare place values from left to right" }
  }),
  makeType("Place Value and Base-Ten Blocks", "Number Sense", ["K", "1", "2", "3", "4", "5", "6"], "Represent numbers with digit values, expanded form, and base-ten models.", {
    generatorKind: "placeValue",
    formats: ["visual-model", "worked-practice"],
    controls: ["max place", "representation type", "block visuals", "item count"],
    validationRules: ["target digit value equals digit multiplied by place value"],
    solution: { level: "visual", method: "decompose the number by place-value columns" }
  }),
  makeType("Rounding and Estimation", "Number Sense", ["2", "3", "4", "5", "6", "7"], "Round whole numbers or decimals and estimate operation results.", {
    generatorKind: "rounding",
    formats: ["fluency-grid", "worked-practice"],
    controls: ["place value", "number type", "operation", "item count"],
    validationRules: ["rounded answer is recomputed from generated number and place"],
    solution: { level: "full", method: "inspect the digit to the right of the rounding place" }
  }),
  makeType("Addition Facts Fluency", "Operations and Fluency", ["K", "1", "2", "3"], "Practice single-digit facts, make-ten strategies, and timed fluency.", {
    generatorKind: "arithmetic",
    formats: ["fluency-grid", "quick-check"],
    controls: ["fact range", "target fact", "timed mode", "questions per page"],
    validationRules: ["sum is recomputed from addends"],
    solution: { level: "full", method: "combine addends or use make-ten decomposition" },
    params: { operation: "add", min: 1, max: 9 }
  }),
  makeType("Multi-Digit Addition", "Operations and Fluency", ["2", "3", "4", "5", "6"], "Add 2- to 5-digit numbers with optional regrouping.", {
    generatorKind: "arithmetic",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["digit count", "regrouping level", "orientation", "item count"],
    validationRules: ["sum is recomputed from generated addends"],
    solution: { level: "full", method: "add ones, tens, hundreds, and carry when needed" },
    params: { operation: "add", min: 100, max: 9999 }
  }),
  makeType("Subtraction Facts and Regrouping", "Operations and Fluency", ["1", "2", "3", "4", "5", "6"], "Practice subtraction facts, multi-digit subtraction, borrowing, and review.", {
    generatorKind: "arithmetic",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["digit count", "regrouping level", "zeros in minuend", "item count"],
    validationRules: ["difference is recomputed and kept nonnegative for elementary settings"],
    solution: { level: "full", method: "subtract by place value and regroup when a top digit is smaller" },
    params: { operation: "subtract", min: 20, max: 999 }
  }),
  makeType("Mixed Operations Practice", "Operations and Fluency", ["2", "3", "4", "5", "6", "7"], "Mix addition, subtraction, multiplication, and division by grade or skill.", {
    generatorKind: "mixedOperations",
    formats: ["fluency-grid", "quick-check"],
    controls: ["operation set", "number range", "mixed density", "item count"],
    validationRules: ["operation token controls the recomputed answer"],
    solution: { level: "full", method: "apply the operation shown in each item" }
  }),
  makeType("Fact Families", "Operations and Fluency", ["1", "2", "3", "4"], "Generate related addition/subtraction or multiplication/division equations.", {
    generatorKind: "factFamily",
    formats: ["visual-model", "worked-practice"],
    controls: ["family type", "number range", "missing position", "item count"],
    validationRules: ["missing value preserves the generated family relationship"],
    solution: { level: "full", method: "use inverse operations to complete the family" }
  }),
  makeType("Multiplication Tables and Facts", "Operations and Fluency", ["2", "3", "4", "5"], "Practice tables, arrays, skip counting, target facts, and fluency checks.", {
    generatorKind: "arithmetic",
    formats: ["fluency-grid", "visual-model"],
    controls: ["times table range", "target factor", "array visuals", "item count"],
    validationRules: ["product is recomputed from generated factors"],
    solution: { level: "full", method: "use repeated addition or known fact families" },
    params: { operation: "multiply", min: 2, max: 12 }
  }),
  makeType("Long Multiplication", "Operations and Fluency", ["3", "4", "5", "6", "7"], "Multiply multi-digit numbers with variable factor lengths.", {
    generatorKind: "arithmetic",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["factor digit counts", "grid support", "large print", "item count"],
    validationRules: ["product is recomputed from generated factors"],
    solution: { level: "full", method: "multiply by each place value and add partial products" },
    params: { operation: "multiply", min: 12, max: 999 }
  }),
  makeType("Division Facts and Long Division", "Operations and Fluency", ["3", "4", "5", "6", "7"], "Practice division facts, quotients, remainders, and long-division layouts.", {
    generatorKind: "division",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["divisor range", "remainder mode", "digit count", "item count"],
    validationRules: ["dividend is constructed from divisor and quotient"],
    solution: { level: "full", method: "divide, multiply, subtract, and bring down" }
  }),
  makeType("Order of Operations", "Operations and Fluency", ["4", "5", "6", "7", "8"], "Generate multi-step expressions with parentheses and multiplication.", {
    generatorKind: "orderOps",
    formats: ["worked-practice", "quick-check"],
    controls: ["step count", "operations", "parentheses", "item count"],
    validationRules: ["expression answer is computed without eval from stored operands"],
    solution: { level: "full", method: "simplify parentheses before multiplication and addition" }
  }),
  makeType("Fraction Models and Manipulatives", "Fractions, Decimals, and Percents", ["1", "2", "3", "4"], "Use bars, groups, and number lines to model fractions.", {
    generatorKind: "fractionModel",
    formats: ["visual-model", "quick-check"],
    controls: ["model type", "denominator range", "shade/identify", "color mode"],
    validationRules: ["fraction value equals shaded parts over total parts"],
    solution: { level: "visual", method: "count shaded parts and total equal parts" }
  }),
  makeType("Equivalent, Simplified, and Converted Fractions", "Fractions, Decimals, and Percents", ["3", "4", "5", "6"], "Simplify fractions, find equivalents, and convert improper and mixed numbers.", {
    generatorKind: "simplifyFraction",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["fraction type", "denominator range", "simplification level", "item count"],
    validationRules: ["simplified fraction is reduced by gcd"],
    solution: { level: "full", method: "divide numerator and denominator by their greatest common factor" }
  }),
  makeType("Fraction Operations", "Fractions, Decimals, and Percents", ["4", "5", "6", "7"], "Add, subtract, multiply, divide, and mix fractions.", {
    generatorKind: "fractionOps",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["operation set", "denominator relation", "simplifying mode", "item count"],
    validationRules: ["fraction result is recomputed and reduced"],
    solution: { level: "full", method: "use common denominators or fraction operation rules, then simplify" }
  }),
  makeType("Decimals Operations", "Fractions, Decimals, and Percents", ["4", "5", "6", "7"], "Add, subtract, multiply, divide, compare, and round decimals.", {
    generatorKind: "decimalOps",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["decimal places", "operation", "place-value scaffold", "item count"],
    validationRules: ["decimal result is computed as cents to avoid floating drift"],
    solution: { level: "full", method: "align decimals by place value before operating" }
  }),
  makeType("Fractions, Decimals, and Percents Conversion", "Fractions, Decimals, and Percents", ["5", "6", "7", "8"], "Convert between representations and solve mixed representation problems.", {
    generatorKind: "conversion",
    formats: ["worked-practice", "quick-check"],
    controls: ["conversion direction", "friendly denominators", "percent range", "item count"],
    validationRules: ["percent answer is generated from equivalent fraction"],
    solution: { level: "full", method: "scale the fraction to a denominator of 100" }
  }),
  makeType("Ratios, Rates, and Proportions", "Ratios and Proportional Reasoning", ["5", "6", "7", "8", "9"], "Generate ratio tables, unit rates, proportions, scaling, and real-world rate tasks.", {
    generatorKind: "ratio",
    formats: ["real-world", "worked-practice"],
    controls: ["ratio type", "unit rate context", "table size", "unknown position", "item count"],
    validationRules: ["unknown value is solved from generated unit rate"],
    solution: { level: "full", method: "find the unit rate, then scale to the requested quantity" }
  }),
  makeType("Percents", "Fractions, Decimals, and Percents", ["5", "6", "7", "8", "9"], "Find percent of a number, percent change, discounts, tax, tips, and interest.", {
    generatorKind: "percent",
    formats: ["real-world", "worked-practice"],
    controls: ["percent type", "number range", "money context", "multi-step mode", "item count"],
    validationRules: ["percent amount is recomputed as rate times base"],
    solution: { level: "full", method: "convert percent to decimal and multiply by the base" }
  }),
  makeType("Integers and Rational Numbers", "Operations and Fluency", ["6", "7", "8", "9"], "Compare, order, add, subtract, multiply, and divide positive and negative numbers.", {
    generatorKind: "integerOps",
    formats: ["fluency-grid", "worked-practice"],
    controls: ["operation", "integer range", "number line", "item count"],
    validationRules: ["signed result is recomputed from stored integers"],
    solution: { level: "full", method: "apply sign rules or model movement on a number line" }
  }),
  makeType("Factors, Multiples, GCF, and LCM", "Number Sense", ["4", "5", "6"], "Practice prime/composite numbers, factorization, GCF, and LCM.", {
    generatorKind: "gcf",
    formats: ["worked-practice", "quick-check"],
    controls: ["skill focus", "number range", "factor tree", "item count"],
    validationRules: ["GCF is recomputed through factor comparison"],
    solution: { level: "full", method: "list factors and choose the greatest shared factor" }
  }),
  makeType("Exponents and Scientific Notation", "Algebra and Functions", ["5", "6", "7", "8", "9"], "Practice powers, exponent rules, powers of ten, and scientific notation.", {
    generatorKind: "exponent",
    formats: ["fluency-grid", "worked-practice"],
    controls: ["base type", "exponent range", "notation direction", "item count"],
    validationRules: ["power is recomputed from base and exponent"],
    solution: { level: "full", method: "multiply the base by itself the exponent number of times" }
  }),
  makeType("Algebra Expressions and Equations", "Algebra and Functions", ["6", "7", "8", "9", "10"], "Generate variables, expressions, one-step/two-step equations, and inequalities.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "quick-check"],
    controls: ["equation type", "solution range", "integer mode", "word problem mode", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "undo addition/subtraction, then undo multiplication/division" }
  }),
  makeType("Functions and Input-Output Tables", "Algebra and Functions", ["4", "5", "6", "7", "8", "9"], "Complete function tables, write rules, graph inputs, and interpret patterns.", {
    generatorKind: "functionTable",
    formats: ["graph-data", "worked-practice"],
    controls: ["rule type", "table length", "missing cells", "graphing mode", "item count"],
    validationRules: ["output is recomputed from generated function rule"],
    solution: { level: "full", method: "substitute the input into the rule" }
  }),
  makeType("Coordinate Graphing and Graph Paper", "Algebra and Functions", ["4", "5", "6", "7", "8", "9"], "Plot points, read coordinates, translate points, and generate graph-paper prompts.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "visual-model"],
    controls: ["quadrants", "grid scale", "coordinate list", "paper type"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "visual", method: "move horizontally for x and vertically for y" }
  }),
  makeType("Geometry Shapes and Properties", "Geometry and Spatial Reasoning", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], "Identify, classify, draw, measure, and reason about 2D and 3D figures.", {
    generatorKind: "geometry",
    formats: ["visual-model", "quick-check"],
    controls: ["shape set", "property focus", "drawing mode", "angle mode", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "visual", method: "inspect sides, angles, or parallel/perpendicular features" }
  }),
  makeType("Area, Perimeter, Surface Area, and Volume", "Geometry and Spatial Reasoning", ["3", "4", "5", "6", "7", "8", "9", "10"], "Solve measurement geometry problems with figures, formulas, and units.", {
    generatorKind: "area",
    formats: ["visual-model", "worked-practice"],
    controls: ["measure type", "figure type", "unit type", "formula bank", "item count"],
    validationRules: ["area or perimeter is recomputed from generated dimensions"],
    solution: { level: "full", method: "select the formula, substitute dimensions, and compute" }
  }),
  makeType("Measurement and Unit Conversions", "Measurement", ["1", "2", "3", "4", "5", "6", "7", "8"], "Measure length, mass, volume, temperature, and convert customary or metric units.", {
    generatorKind: "measurement",
    formats: ["real-world", "worked-practice"],
    controls: ["measurement type", "unit system", "conversion steps", "item count"],
    validationRules: ["converted value is recomputed from generated conversion factor"],
    solution: { level: "full", method: "multiply or divide by the unit conversion factor" }
  }),
  makeType("Time, Elapsed Time, and Calendars", "Measurement", ["K", "1", "2", "3", "4", "5"], "Read clocks, solve elapsed time, use calendars, and compare intervals.", {
    generatorKind: "time",
    formats: ["real-world", "visual-model"],
    controls: ["clock type", "minute increments", "elapsed time direction", "item count"],
    validationRules: ["end time is recomputed from generated start and duration"],
    solution: { level: "visual", method: "add hours and minutes on a timeline" }
  }),
  makeType("Money, Budgeting, and Consumer Math", "Financial and Consumer Math", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "Count coins, make change, compare prices, budget, and calculate tax or discounts.", {
    generatorKind: "money",
    formats: ["real-world", "worked-practice"],
    controls: ["currency", "skill focus", "scenario", "multi-step mode", "item count"],
    validationRules: ["change or total is recomputed in cents"],
    solution: { level: "full", method: "subtract price from payment or apply the money formula" }
  }),
  makeType("Statistics, Data, and Graphing", "Data, Statistics, and Probability", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "Read graphs, make plots, find mean/median/mode/range, and interpret data.", {
    generatorKind: "mean",
    formats: ["graph-data", "worked-practice"],
    controls: ["graph type", "dataset size", "statistic focus", "item count"],
    validationRules: ["statistic is recomputed from generated dataset"],
    solution: { level: "full", method: "add the data values and divide by the count" }
  }),
  makeType("Probability", "Data, Statistics, and Probability", ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "Generate chance experiments, spinners, compound events, and expected value prompts.", {
    generatorKind: "probability",
    formats: ["graph-data", "quick-check"],
    controls: ["event type", "sample space size", "theoretical/experimental", "item count"],
    validationRules: ["probability fraction is favorable outcomes over total outcomes"],
    solution: { level: "full", method: "count favorable outcomes and divide by all possible outcomes" }
  }),
  makeType("Math Word Problems", "Word Problems and Mathematical Reasoning", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "Create scenario-based one-step, multi-step, and mixed-skill word problems.", {
    generatorKind: "wordProblem",
    formats: ["real-world", "worked-practice"],
    controls: ["skill focus", "reading level", "step count", "context", "answer explanation"],
    validationRules: ["scenario quantities are stored separately from text and re-solved"],
    solution: { level: "full", method: "identify known quantities, choose operation, compute, and label the answer" }
  }),
  makeType("Math Puzzles and Logic Sheets", "Math Puzzles, Logic, and Enrichment", ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "Generate number patterns, magic-square style prompts, and logic grids.", {
    generatorKind: "patternPuzzle",
    formats: ["quick-check", "visual-model"],
    controls: ["puzzle type", "difficulty", "grid size", "hint mode", "answer key"],
    validationRules: ["missing value follows the generated rule"],
    solution: { level: "partial", method: "state the discovered rule and apply it to the blank" }
  })
];

const expandedWorksheetTypes = [
  makeType("Ten-Frame Counting Readiness", "Number Sense", ["K"], "Count objects in ten-frames and match totals to numerals.", {
    generatorKind: "numberSense",
    formats: ["visual-model", "quick-check"],
    controls: ["max count", "ten-frame support", "item count"],
    validationRules: ["count model equals target numeral"],
    solution: { level: "visual", method: "count each filled space once" }
  }),
  makeType("Same More Fewer Sets", "Number Sense", ["K", "1"], "Compare two small sets using same, more, and fewer.", {
    generatorKind: "compare",
    formats: ["visual-model", "quick-check"],
    controls: ["max count", "object theme", "item count"],
    validationRules: ["comparison is derived from set counts"],
    solution: { level: "visual", method: "match objects one-to-one and compare leftovers" }
  }),
  makeType("Teen Numbers as Ten and Ones", "Number Sense", ["K", "1"], "Build teen numbers from one ten and extra ones.", {
    generatorKind: "placeValue",
    formats: ["visual-model", "worked-practice"],
    controls: ["number range", "base-ten visuals", "item count"],
    validationRules: ["teen number equals 10 plus ones"],
    solution: { level: "visual", method: "combine one ten with the remaining ones" }
  }),
  makeType("Counting Forward and Backward", "Number Sense", ["K", "1"], "Complete short forward and backward counting sequences.", {
    generatorKind: "numberPattern",
    formats: ["fluency-grid", "quick-check"],
    controls: ["start number", "direction", "missing position", "item count"],
    validationRules: ["missing value follows the counting sequence"],
    solution: { level: "full", method: "count by ones from the known number" }
  }),
  makeType("Number Line Positions to 20", "Number Sense", ["K", "1"], "Place and identify whole numbers on a 0-20 number line.", {
    generatorKind: "numberSense",
    formats: ["visual-model", "quick-check"],
    controls: ["number range", "blank position", "item count"],
    validationRules: ["answer matches generated number-line position"],
    solution: { level: "visual", method: "count tick marks from zero to the point" }
  }),
  makeType("Make Ten Addition Pairs", "Operations and Fluency", ["K", "1"], "Find pairs of numbers that make ten.", {
    generatorKind: "arithmetic",
    formats: ["visual-model", "quick-check"],
    controls: ["missing addend", "ten-frame support", "item count"],
    validationRules: ["sum equals 10"],
    solution: { level: "visual", method: "count how many more are needed to fill ten" },
    params: { operation: "add", min: 1, max: 9 }
  }),
  makeType("Add Within 20 Strategies", "Operations and Fluency", ["1", "2"], "Practice sums within 20 using counting on and make-ten strategies.", {
    generatorKind: "arithmetic",
    formats: ["fluency-grid", "worked-practice"],
    controls: ["sum range", "strategy scaffold", "item count"],
    validationRules: ["sum is recomputed from addends"],
    solution: { level: "full", method: "count on from the larger addend or make ten first" },
    params: { operation: "add", min: 1, max: 20 }
  }),
  makeType("Subtract Within 20 Strategies", "Operations and Fluency", ["1", "2"], "Practice differences within 20 using counting back and related facts.", {
    generatorKind: "arithmetic",
    formats: ["fluency-grid", "worked-practice"],
    controls: ["difference range", "strategy scaffold", "item count"],
    validationRules: ["difference is recomputed from generated numbers"],
    solution: { level: "full", method: "count back or use the related addition fact" },
    params: { operation: "subtract", min: 1, max: 20 }
  }),
  makeType("Missing Addends Within 20", "Operations and Fluency", ["1", "2"], "Solve equations with one missing addend.", {
    generatorKind: "factFamily",
    formats: ["worked-practice", "quick-check"],
    controls: ["sum range", "missing position", "item count"],
    validationRules: ["missing addend preserves the generated equation"],
    solution: { level: "full", method: "use subtraction or count up to the total" }
  }),
  makeType("Two-Digit Place Value Exchange", "Number Sense", ["1", "2"], "Rename two-digit numbers as tens and ones.", {
    generatorKind: "placeValue",
    formats: ["visual-model", "worked-practice"],
    controls: ["max number", "expanded form", "base-ten visuals", "item count"],
    validationRules: ["expanded value equals generated number"],
    solution: { level: "visual", method: "separate the number into tens and ones" }
  }),
  makeType("Skip Counting by 2s 5s and 10s", "Number Sense", ["1", "2", "3"], "Complete skip-counting patterns for common intervals.", {
    generatorKind: "numberPattern",
    formats: ["fluency-grid", "quick-check"],
    controls: ["skip amount", "start number", "missing position", "item count"],
    validationRules: ["missing value follows the skip-counting rule"],
    solution: { level: "full", method: "add the skip amount each time" }
  }),
  makeType("Compare Two-Digit Numbers", "Number Sense", ["1", "2"], "Compare two-digit numbers using place value.", {
    generatorKind: "compare",
    formats: ["fluency-grid", "quick-check"],
    controls: ["number range", "comparison sign", "item count"],
    validationRules: ["comparison sign is derived from numeric values"],
    solution: { level: "full", method: "compare tens first, then ones" }
  }),
  makeType("Three-Digit Expanded Form", "Number Sense", ["2", "3"], "Write three-digit numbers in expanded and standard form.", {
    generatorKind: "placeValue",
    formats: ["worked-practice", "quick-check"],
    controls: ["max place", "representation type", "item count"],
    validationRules: ["expanded form totals the target number"],
    solution: { level: "full", method: "add hundreds, tens, and ones values" }
  }),
  makeType("Add Two-Digit Numbers with Regrouping", "Operations and Fluency", ["2", "3"], "Add two-digit numbers with optional regrouping.", {
    generatorKind: "arithmetic",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["regrouping level", "orientation", "item count"],
    validationRules: ["sum is recomputed from generated addends"],
    solution: { level: "full", method: "add ones, regroup if needed, then add tens" },
    params: { operation: "add", min: 10, max: 99 }
  }),
  makeType("Subtract Two-Digit Numbers with Regrouping", "Operations and Fluency", ["2", "3"], "Subtract two-digit numbers with optional regrouping.", {
    generatorKind: "arithmetic",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["regrouping level", "orientation", "item count"],
    validationRules: ["difference is recomputed and kept nonnegative"],
    solution: { level: "full", method: "subtract ones, regroup if needed, then subtract tens" },
    params: { operation: "subtract", min: 10, max: 99 }
  }),
  makeType("Arrays and Equal Groups", "Operations and Fluency", ["2", "3"], "Represent multiplication with arrays and equal groups.", {
    generatorKind: "arithmetic",
    formats: ["visual-model", "worked-practice"],
    controls: ["factor range", "array visuals", "item count"],
    validationRules: ["product equals rows times columns"],
    solution: { level: "visual", method: "count equal groups or multiply rows by columns" },
    params: { operation: "multiply", min: 2, max: 10 }
  }),
  makeType("Division as Equal Sharing", "Operations and Fluency", ["3", "4"], "Divide objects into equal groups and find the quotient.", {
    generatorKind: "division",
    formats: ["visual-model", "worked-practice"],
    controls: ["divisor range", "remainder mode", "item count"],
    validationRules: ["dividend is constructed from divisor and quotient"],
    solution: { level: "visual", method: "share the total into equal groups" }
  }),
  makeType("Round Whole Numbers to Nearest Ten or Hundred", "Number Sense", ["3", "4"], "Round whole numbers to the nearest ten or hundred.", {
    generatorKind: "rounding",
    formats: ["fluency-grid", "worked-practice"],
    controls: ["place value", "number range", "item count"],
    validationRules: ["rounded answer is recomputed from number and place"],
    solution: { level: "full", method: "check the digit to the right of the rounding place" }
  }),
  makeType("Fraction Parts of a Whole", "Fractions, Decimals, and Percents", ["2", "3"], "Identify unit and non-unit fractions from shaded models.", {
    generatorKind: "fractionModel",
    formats: ["visual-model", "quick-check"],
    controls: ["model type", "denominator range", "item count"],
    validationRules: ["fraction equals shaded parts over total equal parts"],
    solution: { level: "visual", method: "count shaded parts and total equal parts" }
  }),
  makeType("Fractions on Number Lines", "Fractions, Decimals, and Percents", ["3", "4"], "Locate and name fractions on a number line.", {
    generatorKind: "fractionModel",
    formats: ["visual-model", "quick-check"],
    controls: ["denominator range", "missing point", "item count"],
    validationRules: ["fraction value matches generated number-line point"],
    solution: { level: "visual", method: "count equal jumps from zero" }
  }),
  makeType("Equivalent Fraction Models", "Fractions, Decimals, and Percents", ["3", "4", "5"], "Match equivalent fractions using bars and number lines.", {
    generatorKind: "simplifyFraction",
    formats: ["visual-model", "worked-practice"],
    controls: ["denominator range", "model type", "item count"],
    validationRules: ["equivalent fractions reduce to the same value"],
    solution: { level: "full", method: "multiply or divide numerator and denominator by the same number" }
  }),
  makeType("Add Like-Denominator Fractions", "Fractions, Decimals, and Percents", ["4", "5"], "Add fractions with the same denominator and simplify when needed.", {
    generatorKind: "fractionOps",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["denominator range", "simplifying mode", "item count"],
    validationRules: ["fraction sum is recomputed and reduced"],
    solution: { level: "full", method: "add numerators, keep the denominator, then simplify" }
  }),
  makeType("Decimal Place Value to Hundredths", "Fractions, Decimals, and Percents", ["4", "5"], "Read, write, and compare decimals to hundredths.", {
    generatorKind: "decimalOps",
    formats: ["worked-practice", "quick-check"],
    controls: ["decimal places", "comparison mode", "item count"],
    validationRules: ["decimal comparison is computed as whole-number place values"],
    solution: { level: "full", method: "compare tenths first, then hundredths" }
  }),
  makeType("Convert Fractions to Decimals with Tenths", "Fractions, Decimals, and Percents", ["4", "5"], "Convert tenths and hundredths between fraction and decimal form.", {
    generatorKind: "conversion",
    formats: ["worked-practice", "quick-check"],
    controls: ["conversion direction", "friendly denominators", "item count"],
    validationRules: ["decimal value is generated from the equivalent fraction"],
    solution: { level: "full", method: "use a denominator of 10 or 100" }
  }),
  makeType("Classify Two-Dimensional Shapes", "Geometry and Spatial Reasoning", ["K", "1", "2"], "Identify circles, triangles, rectangles, squares, and basic attributes.", {
    generatorKind: "geometry",
    formats: ["visual-model", "quick-check"],
    controls: ["shape set", "property focus", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "visual", method: "inspect sides, corners, and curves" }
  }),
  makeType("Quadrilaterals by Attributes", "Geometry and Spatial Reasoning", ["3", "4", "5"], "Classify quadrilaterals by sides, angles, and parallel lines.", {
    generatorKind: "geometry",
    formats: ["visual-model", "quick-check"],
    controls: ["property focus", "shape set", "item count"],
    validationRules: ["classification follows stored shape attributes"],
    solution: { level: "visual", method: "check sides, angles, and parallel pairs" }
  }),
  makeType("Measure Length with Rulers", "Measurement", ["1", "2", "3"], "Measure objects to the nearest whole unit.", {
    generatorKind: "measurement",
    formats: ["visual-model", "worked-practice"],
    controls: ["unit system", "ruler marks", "item count"],
    validationRules: ["measurement answer matches generated ruler length"],
    solution: { level: "visual", method: "start at zero and read the endpoint" }
  }),
  makeType("Elapsed Time on Timelines", "Measurement", ["2", "3", "4"], "Find elapsed time using start times, end times, and timelines.", {
    generatorKind: "time",
    formats: ["visual-model", "real-world"],
    controls: ["minute increments", "elapsed time direction", "item count"],
    validationRules: ["time interval is recomputed from start and end"],
    solution: { level: "visual", method: "jump by hours and minutes on a timeline" }
  }),
  makeType("Coin Values and Change", "Financial and Consumer Math", ["1", "2", "3"], "Count mixed coins and find simple change amounts.", {
    generatorKind: "money",
    formats: ["real-world", "quick-check"],
    controls: ["coin set", "total range", "item count"],
    validationRules: ["total or change is recomputed in cents"],
    solution: { level: "full", method: "add coin values or subtract cost from payment" }
  }),
  makeType("Read Picture and Bar Graphs", "Data, Statistics, and Probability", ["1", "2", "3"], "Answer questions from picture graphs and bar graphs.", {
    generatorKind: "mean",
    formats: ["graph-data", "quick-check"],
    controls: ["graph type", "dataset size", "question type", "item count"],
    validationRules: ["answer is recomputed from generated graph data"],
    solution: { level: "visual", method: "read the graph scale and compare category totals" }
  }),
  makeType("Multi-Step Grade 5 Word Problems", "Word Problems and Mathematical Reasoning", ["5"], "Solve multi-step word problems using whole numbers, fractions, or decimals.", {
    generatorKind: "wordProblem",
    formats: ["real-world", "worked-practice"],
    controls: ["skill focus", "step count", "reading level", "item count"],
    validationRules: ["scenario quantities are stored separately from text and re-solved"],
    solution: { level: "full", method: "identify each step, choose operations, compute, and label the answer" }
  }),
  makeType("Number Pattern Rule Challenges", "Math Puzzles, Logic, and Enrichment", ["3", "4", "5"], "Find missing values and describe rules in number patterns.", {
    generatorKind: "patternPuzzle",
    formats: ["quick-check", "worked-practice"],
    controls: ["rule type", "difficulty", "item count"],
    validationRules: ["missing value follows the generated rule"],
    solution: { level: "partial", method: "state the rule and apply it to the blank" }
  }),
  makeType("Scale Drawings and Map Distance", "Ratios and Proportional Reasoning", ["6", "7"], "Practice using scale factors to convert between drawing distances and real-world distances.", {
    generatorKind: "ratio",
    formats: ["worked-practice", "real-world"],
    controls: ["scale ratio", "distance units", "item count"],
    validationRules: ["missing distance is solved from the generated unit rate"],
    solution: { level: "full", method: "show the scale ratio, set up a proportion, and solve for the missing distance" }
  }),
  makeType("Unit Rate Shopping Comparisons", "Ratios and Proportional Reasoning", ["6", "7"], "Compare prices by finding unit rates in everyday shopping situations.", {
    generatorKind: "ratio",
    formats: ["real-world", "quick-check"],
    controls: ["package size", "price range", "item count"],
    validationRules: ["unit price is recomputed and rounded to cents"],
    solution: { level: "full", method: "divide price by quantity, compare unit prices, and identify the better value" }
  }),
  makeType("Equivalent Ratio Tables", "Ratios and Proportional Reasoning", ["6", "7"], "Complete tables of equivalent ratios and explain the multiplicative relationship.", {
    generatorKind: "ratio",
    formats: ["fluency-grid", "worked-practice"],
    controls: ["ratio size", "table length", "item count"],
    validationRules: ["table values preserve the generated ratio"],
    solution: { level: "full", method: "multiply or divide both quantities by the same factor" }
  }),
  makeType("Constant of Proportionality", "Ratios and Proportional Reasoning", ["7", "8"], "Identify the constant of proportionality from tables, equations, and word contexts.", {
    generatorKind: "ratio",
    formats: ["worked-practice", "graph-data"],
    controls: ["representation type", "unit rate context", "item count"],
    validationRules: ["constant equals output divided by input"],
    solution: { level: "full", method: "find y divided by x and use the constant to write or interpret y = kx" }
  }),
  makeType("Percent Change in Context", "Fractions, Decimals, and Percents", ["7", "8"], "Solve increase and decrease problems involving discounts, markups, and growth.", {
    generatorKind: "percent",
    formats: ["real-world", "worked-practice"],
    controls: ["increase/decrease mode", "percent range", "item count"],
    validationRules: ["change amount is recomputed from the original value and percent"],
    solution: { level: "full", method: "multiply the original amount by the percent change and add or subtract the result" }
  }),
  makeType("Percent Error", "Fractions, Decimals, and Percents", ["7", "8"], "Calculate percent error from estimated and actual values.", {
    generatorKind: "percent",
    formats: ["worked-practice", "real-world"],
    controls: ["measurement context", "error size", "item count"],
    validationRules: ["percent error is absolute error divided by actual value"],
    solution: { level: "full", method: "find the absolute error, divide by the actual value, and convert to a percent" }
  }),
  makeType("Rational Number Ordering", "Number Sense", ["6", "7"], "Order fractions, decimals, and integers on a number line.", {
    generatorKind: "compare",
    formats: ["quick-check", "visual-model"],
    controls: ["number form mix", "value range", "item count"],
    validationRules: ["comparison is derived from numeric values"],
    solution: { level: "full", method: "convert to a common form or compare positions on the number line" }
  }),
  makeType("Rational Number Operations Mix", "Operations and Fluency", ["7", "8"], "Practice mixed operations with positive and negative fractions and decimals.", {
    generatorKind: "mixedOperations",
    formats: ["worked-practice", "quick-check"],
    controls: ["operation set", "integer range", "item count"],
    validationRules: ["operation token controls the recomputed answer"],
    solution: { level: "full", method: "apply integer sign rules, then compute using fraction or decimal operation rules" }
  }),
  makeType("Integer Multiplication and Division", "Operations and Fluency", ["6", "7"], "Build fluency multiplying and dividing positive and negative integers.", {
    generatorKind: "integerOps",
    formats: ["fluency-grid", "quick-check"],
    controls: ["operation", "integer range", "item count"],
    validationRules: ["signed result is recomputed from stored integers"],
    solution: { level: "full", method: "use sign rules first, then multiply or divide absolute values" }
  }),
  makeType("Fraction Division in Word Problems", "Word Problems and Mathematical Reasoning", ["6", "7"], "Solve sharing, grouping, and rate problems involving division of fractions.", {
    generatorKind: "wordProblem",
    formats: ["real-world", "worked-practice"],
    controls: ["scenario type", "fraction range", "item count"],
    validationRules: ["scenario quantities are stored separately from text and re-solved"],
    solution: { level: "full", method: "model the situation, divide by multiplying by the reciprocal, and interpret the quotient" }
  }),
  makeType("Scientific Notation Basics", "Number Sense", ["8"], "Write large and small numbers in scientific notation and standard form.", {
    generatorKind: "exponent",
    formats: ["worked-practice", "quick-check"],
    controls: ["notation direction", "power of ten", "item count"],
    validationRules: ["power is recomputed from base and exponent"],
    solution: { level: "full", method: "move the decimal to make a number from 1 to less than 10 and track the power of ten" }
  }),
  makeType("Laws of Exponents", "Algebra and Functions", ["8"], "Simplify expressions using product, quotient, and power rules for exponents.", {
    generatorKind: "exponent",
    formats: ["worked-practice", "quick-check"],
    controls: ["rule focus", "base type", "item count"],
    validationRules: ["power is recomputed from base and exponent"],
    solution: { level: "full", method: "apply exponent rules to combine powers with the same base" }
  }),
  makeType("Evaluate Algebraic Expressions", "Algebra and Functions", ["6", "7"], "Substitute values into expressions and evaluate using order of operations.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "quick-check"],
    controls: ["expression type", "variable range", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "replace each variable with its value, then simplify using order of operations" }
  }),
  makeType("Distributive Property Practice", "Algebra and Functions", ["6", "7"], "Expand and simplify expressions using the distributive property.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "fluency-grid"],
    controls: ["coefficient range", "like terms", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "multiply the outside factor by each term inside the parentheses, then combine like terms" }
  }),
  makeType("Combine Like Terms", "Algebra and Functions", ["6", "7", "8"], "Simplify expressions by collecting terms with the same variable part.", {
    generatorKind: "algebra",
    formats: ["fluency-grid", "quick-check"],
    controls: ["term count", "coefficient range", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "group like terms and add or subtract their coefficients" }
  }),
  makeType("One-Step Equations", "Algebra and Functions", ["6", "7"], "Solve equations using inverse operations for all four operations.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "quick-check"],
    controls: ["operation", "solution range", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "undo the operation on the variable with the inverse operation on both sides" }
  }),
  makeType("Two-Step Equations", "Algebra and Functions", ["7", "8"], "Solve linear equations that require two inverse-operation steps.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "quick-check"],
    controls: ["coefficient range", "constant range", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "undo addition or subtraction first, then undo multiplication or division" }
  }),
  makeType("Inequalities on Number Lines", "Algebra and Functions", ["6", "7"], "Write, solve, and graph simple inequalities on number lines.", {
    generatorKind: "algebra",
    formats: ["visual-model", "quick-check"],
    controls: ["inequality sign", "integer bounds", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "visual", method: "solve like an equation, then use an open or closed point and shade the correct direction" }
  }),
  makeType("Slope from Tables and Graphs", "Algebra and Functions", ["8"], "Find slope from ordered pairs, tables, and coordinate graphs.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "worked-practice"],
    controls: ["coordinate range", "representation type", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "full", method: "compute change in y divided by change in x" }
  }),
  makeType("Linear Equations from Graphs", "Algebra and Functions", ["8"], "Use slope and intercepts to write equations for lines.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "worked-practice"],
    controls: ["slope type", "intercept range", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "full", method: "identify slope and y-intercept, then write the equation in y = mx + b form" }
  }),
  makeType("Systems by Inspection", "Algebra and Functions", ["8"], "Identify the solution to two linear relationships from tables or graphs.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "quick-check"],
    controls: ["intersection type", "coordinate range", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "visual", method: "find the point where both relationships have the same x and y values" }
  }),
  makeType("Angle Relationships", "Geometry and Spatial Reasoning", ["7", "8"], "Solve for missing angles using vertical, adjacent, complementary, and supplementary relationships.", {
    generatorKind: "geometry",
    formats: ["visual-model", "worked-practice"],
    controls: ["angle relationship", "measure range", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "full", method: "use the angle relationship equation, then solve for the missing measure" }
  }),
  makeType("Triangle Angle Sum", "Geometry and Spatial Reasoning", ["6", "7", "8"], "Find missing angle measures in triangles using the 180-degree angle sum.", {
    generatorKind: "geometry",
    formats: ["visual-model", "quick-check"],
    controls: ["angle range", "missing angle position", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "full", method: "add known angles and subtract the total from 180 degrees" }
  }),
  makeType("Area of Composite Figures", "Measurement", ["6", "7"], "Break composite shapes into rectangles, triangles, and parallelograms to find area.", {
    generatorKind: "area",
    formats: ["visual-model", "worked-practice"],
    controls: ["figure type", "unit type", "item count"],
    validationRules: ["area or perimeter is recomputed from generated dimensions"],
    solution: { level: "full", method: "decompose the figure, find each simple area, and add or subtract as needed" }
  }),
  makeType("Surface Area of Prisms", "Measurement", ["6", "7"], "Find surface area of rectangular and triangular prisms from nets or dimensions.", {
    generatorKind: "measurement",
    formats: ["visual-model", "worked-practice"],
    controls: ["prism type", "net support", "item count"],
    validationRules: ["converted value is recomputed from generated conversion factor"],
    solution: { level: "full", method: "find the area of each face and add all face areas" }
  }),
  makeType("Volume of Cylinders and Prisms", "Measurement", ["7", "8"], "Calculate volume of prisms and cylinders using base area and height.", {
    generatorKind: "measurement",
    formats: ["worked-practice", "real-world"],
    controls: ["solid type", "unit type", "item count"],
    validationRules: ["converted value is recomputed from generated conversion factor"],
    solution: { level: "full", method: "find the area of the base, then multiply by height" }
  }),
  makeType("Transformations on the Coordinate Plane", "Geometry and Spatial Reasoning", ["8"], "Apply translations, reflections, and rotations to coordinate points.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "visual-model"],
    controls: ["transformation type", "coordinate range", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "visual", method: "use the transformation rule to map each original coordinate to its image" }
  }),
  makeType("Similar Figures and Scale Factor", "Geometry and Spatial Reasoning", ["7", "8"], "Use scale factors to find missing side lengths in similar figures.", {
    generatorKind: "geometry",
    formats: ["visual-model", "worked-practice"],
    controls: ["scale factor", "figure type", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "full", method: "set up a ratio of corresponding sides and multiply by the scale factor" }
  }),
  makeType("Pythagorean Theorem Practice", "Geometry and Spatial Reasoning", ["8"], "Find missing side lengths in right triangles using the Pythagorean theorem.", {
    generatorKind: "geometry",
    formats: ["worked-practice", "visual-model"],
    controls: ["missing side", "triple support", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "full", method: "substitute into a squared plus b squared equals c squared and solve for the missing side" }
  }),
  makeType("Mean Absolute Deviation", "Data, Statistics, and Probability", ["6", "7"], "Measure variability in a data set by finding mean absolute deviation.", {
    generatorKind: "mean",
    formats: ["graph-data", "worked-practice"],
    controls: ["dataset size", "value range", "item count"],
    validationRules: ["statistic is recomputed from generated dataset"],
    solution: { level: "full", method: "find the mean, calculate each distance from the mean, then average those distances" }
  }),
  makeType("Box Plot Interpretation", "Data, Statistics, and Probability", ["6", "7"], "Read medians, quartiles, range, and spread from box plots.", {
    generatorKind: "mean",
    formats: ["graph-data", "quick-check"],
    controls: ["dataset size", "question type", "item count"],
    validationRules: ["statistic is recomputed from generated dataset"],
    solution: { level: "visual", method: "use the five-number summary to answer questions about center and variability" }
  }),
  makeType("Two-Way Tables", "Data, Statistics, and Probability", ["7", "8"], "Analyze categorical data using two-way frequency and relative frequency tables.", {
    generatorKind: "probability",
    formats: ["graph-data", "real-world"],
    controls: ["category count", "frequency mode", "item count"],
    validationRules: ["probability fraction is favorable outcomes over total outcomes"],
    solution: { level: "full", method: "use row, column, and table totals to compare counts or calculate relative frequencies" }
  }),
  makeType("Compound Probability", "Data, Statistics, and Probability", ["7", "8"], "Find probabilities for simple compound events using lists, tables, and tree diagrams.", {
    generatorKind: "probability",
    formats: ["worked-practice", "visual-model"],
    controls: ["event type", "sample space size", "item count"],
    validationRules: ["probability fraction is favorable outcomes over total outcomes"],
    solution: { level: "full", method: "count favorable outcomes over total outcomes or multiply probabilities for independent events" }
  }),
  makeType("Simple Interest", "Financial and Consumer Math", ["7", "8"], "Calculate simple interest, total balance, principal, rate, or time in consumer contexts.", {
    generatorKind: "money",
    formats: ["real-world", "worked-practice"],
    controls: ["principal range", "rate range", "item count"],
    validationRules: ["change or total is recomputed in cents"],
    solution: { level: "full", method: "use I = prt, then add interest to principal when total balance is requested" }
  }),
  makeType("Budget Percent Allocations", "Financial and Consumer Math", ["6", "7", "8"], "Use percentages to allocate income across budget categories.", {
    generatorKind: "percent",
    formats: ["real-world", "quick-check"],
    controls: ["budget size", "category mix", "item count"],
    validationRules: ["percent amount is recomputed as rate times base"],
    solution: { level: "full", method: "multiply the total budget by each category percent and check that allocations match the whole" }
  }),
  makeType("Logic Grid Number Clues", "Math Puzzles, Logic, and Enrichment", ["6", "7", "8"], "Use number properties and clues to eliminate possibilities and solve logic puzzles.", {
    generatorKind: "patternPuzzle",
    formats: ["quick-check", "worked-practice"],
    controls: ["clue count", "difficulty", "item count"],
    validationRules: ["missing value follows the generated rule"],
    solution: { level: "partial", method: "track each clue, eliminate impossible values, and confirm the remaining solution fits all clues" }
  }),
  makeType("Linear Function Tables", "Algebra and Functions", ["9"], "Practice evaluating linear rules and completing input-output tables.", {
    generatorKind: "functionTable",
    formats: ["worked-practice", "quick-check"],
    controls: ["rule type", "table length", "item count"],
    validationRules: ["output is recomputed from generated function rule"],
    solution: { level: "full", method: "substitute each input into the linear rule and compute the output" }
  }),
  makeType("High School Slope from Tables and Graphs", "Algebra and Functions", ["9", "10"], "Build fluency finding slope from ordered pairs, tables, and simple graph contexts.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "worked-practice"],
    controls: ["coordinate range", "representation type", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "full", method: "show rise over run as change in y divided by change in x" }
  }),
  makeType("Linear Models from Context", "Algebra and Functions", ["9", "10"], "Write and interpret linear equations from real-world situations.", {
    generatorKind: "wordProblem",
    formats: ["real-world", "worked-practice"],
    controls: ["context type", "rate range", "item count"],
    validationRules: ["scenario quantities are stored separately from text and re-solved"],
    solution: { level: "full", method: "identify the rate and starting value, then write and interpret the equation" }
  }),
  makeType("Systems by Substitution", "Algebra and Functions", ["9", "10"], "Solve systems of two linear equations using substitution with scaffolded steps.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "quick-check"],
    controls: ["coefficient range", "solution range", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "substitute one expression into the other equation, solve, then back-substitute" }
  }),
  makeType("Systems from Word Problems", "Word Problems and Mathematical Reasoning", ["9", "10"], "Model comparison, mixture, and ticket scenarios with systems of equations.", {
    generatorKind: "wordProblem",
    formats: ["real-world", "worked-practice"],
    controls: ["scenario type", "step count", "item count"],
    validationRules: ["scenario quantities are stored separately from text and re-solved"],
    solution: { level: "full", method: "define variables, write the system, solve, and interpret the ordered pair" }
  }),
  makeType("Quadratic Factoring Practice", "Algebra and Functions", ["9", "10"], "Factor quadratic expressions including trinomials and special products.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "quick-check"],
    controls: ["quadratic type", "coefficient range", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "find factor pairs that multiply to the constant term and add to the middle coefficient" }
  }),
  makeType("Quadratic Graph Features", "Algebra and Functions", ["9", "10", "11"], "Identify vertex, axis of symmetry, intercepts, and direction from quadratic equations.", {
    generatorKind: "algebra",
    formats: ["graph-data", "worked-practice"],
    controls: ["feature focus", "equation form", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "use the equation form to identify vertex, direction, and intercept features" }
  }),
  makeType("Exponential Growth and Decay Models", "Algebra and Functions", ["9", "10", "11"], "Create and evaluate exponential models for growth, decay, and percent-change contexts.", {
    generatorKind: "exponent",
    formats: ["real-world", "worked-practice"],
    controls: ["growth/decay mode", "time range", "item count"],
    validationRules: ["power is recomputed from base and exponent"],
    solution: { level: "full", method: "write the model with initial value, growth factor, and time, then evaluate" }
  }),
  makeType("Function Notation Practice", "Algebra and Functions", ["9", "10"], "Evaluate functions, interpret notation, and compare outputs across representations.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "quick-check"],
    controls: ["function rule", "input range", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "replace the input value inside the function rule and simplify" }
  }),
  makeType("Arithmetic and Geometric Sequences", "Algebra and Functions", ["9", "10", "11"], "Find terms, rules, and missing values in arithmetic and geometric sequences.", {
    generatorKind: "numberPattern",
    formats: ["worked-practice", "quick-check"],
    controls: ["sequence type", "missing position", "item count"],
    validationRules: ["missing value follows the generated arithmetic sequence"],
    solution: { level: "full", method: "identify the common difference or ratio, then apply the rule to the target term" }
  }),
  makeType("Polynomial Operations", "Algebra and Functions", ["10", "11"], "Add, subtract, and multiply polynomial expressions with clear organization.", {
    generatorKind: "algebra",
    formats: ["worked-practice", "quick-check"],
    controls: ["operation set", "term count", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "align like terms, distribute when multiplying, then combine like terms" }
  }),
  makeType("Radical Expression Simplifying", "Number Sense", ["10", "11"], "Simplify square roots and radical expressions using perfect-square factors.", {
    generatorKind: "exponent",
    formats: ["worked-practice", "quick-check"],
    controls: ["radicand range", "perfect-square factors", "item count"],
    validationRules: ["power is recomputed from base and exponent"],
    solution: { level: "full", method: "factor out perfect squares and rewrite the radical in simplified form" }
  }),
  makeType("Rational Exponents", "Number Sense", ["10", "11"], "Convert and simplify expressions with rational exponents and radicals.", {
    generatorKind: "exponent",
    formats: ["worked-practice", "quick-check"],
    controls: ["exponent form", "base range", "item count"],
    validationRules: ["power is recomputed from base and exponent"],
    solution: { level: "full", method: "rewrite rational exponents as roots and powers, then simplify" }
  }),
  makeType("Domain and Range from Graphs", "Algebra and Functions", ["9", "10", "11"], "Read domain, range, intercepts, and intervals from function graphs.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "quick-check"],
    controls: ["graph type", "interval notation", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "visual", method: "read x-values for domain and y-values for range from the graph" }
  }),
  makeType("Transformations of Functions", "Algebra and Functions", ["10", "11", "12"], "Practice shifts, reflections, and stretches of parent functions.", {
    generatorKind: "algebra",
    formats: ["graph-data", "worked-practice"],
    controls: ["parent function", "transformation type", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "visual", method: "describe how each constant changes the parent graph" }
  }),
  makeType("Right Triangle Trigonometry", "Geometry and Spatial Reasoning", ["10", "11"], "Use sine, cosine, and tangent to solve right-triangle side and angle problems.", {
    generatorKind: "geometry",
    formats: ["visual-model", "worked-practice"],
    controls: ["trig ratio", "missing side/angle", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "full", method: "choose the trig ratio that connects the known side, unknown side, and angle" }
  }),
  makeType("Pythagorean Theorem Applications", "Geometry and Spatial Reasoning", ["9", "10"], "Solve distance, diagonal, and missing-side problems using the Pythagorean theorem.", {
    generatorKind: "geometry",
    formats: ["visual-model", "real-world"],
    controls: ["context type", "missing side", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "full", method: "substitute into a squared plus b squared equals c squared and solve for the missing side" }
  }),
  makeType("Similarity and Scale Factor", "Geometry and Spatial Reasoning", ["9", "10"], "Find missing lengths in similar figures and interpret scale factors.", {
    generatorKind: "ratio",
    formats: ["visual-model", "worked-practice"],
    controls: ["scale factor", "figure type", "item count"],
    validationRules: ["unknown value is solved from generated unit rate"],
    solution: { level: "full", method: "set up corresponding side ratios and solve the proportion" }
  }),
  makeType("Triangle Congruence Reasoning", "Geometry and Spatial Reasoning", ["10"], "Identify valid triangle congruence criteria and justify conclusions.", {
    generatorKind: "geometry",
    formats: ["visual-model", "quick-check"],
    controls: ["congruence theorem", "diagram support", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "visual", method: "match the given sides and angles to a valid congruence criterion" }
  }),
  makeType("Circle Theorems Practice", "Geometry and Spatial Reasoning", ["10", "11"], "Apply angle, arc, chord, tangent, and secant relationships in circles.", {
    generatorKind: "geometry",
    formats: ["visual-model", "worked-practice"],
    controls: ["theorem focus", "measure range", "item count"],
    validationRules: ["shape property is selected from controlled geometry facts"],
    solution: { level: "full", method: "identify the circle relationship, write the equation, and solve" }
  }),
  makeType("Coordinate Geometry Proof Prep", "Geometry and Spatial Reasoning", ["10", "11"], "Use slope, midpoint, and distance to classify figures on the coordinate plane.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "worked-practice"],
    controls: ["proof target", "coordinate range", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "full", method: "calculate slopes, midpoints, or distances and use them as evidence" }
  }),
  makeType("Geometric Transformations on the Plane", "Geometry and Spatial Reasoning", ["9", "10"], "Practice translations, reflections, rotations, and dilations using coordinates.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "visual-model"],
    controls: ["transformation type", "coordinate range", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "visual", method: "apply the coordinate rule to each point to find its image" }
  }),
  makeType("Two-Way Tables and Conditional Probability", "Data, Statistics, and Probability", ["9", "10", "11"], "Interpret two-way tables and calculate conditional probabilities.", {
    generatorKind: "probability",
    formats: ["graph-data", "real-world"],
    controls: ["table size", "probability type", "item count"],
    validationRules: ["probability fraction is favorable outcomes over total outcomes"],
    solution: { level: "full", method: "use the condition to choose the denominator, then count favorable outcomes" }
  }),
  makeType("Normal Distribution Interpretations", "Data, Statistics, and Probability", ["11", "12"], "Use mean and standard deviation to interpret values in bell-shaped distributions.", {
    generatorKind: "mean",
    formats: ["graph-data", "worked-practice"],
    controls: ["mean range", "standard deviation", "item count"],
    validationRules: ["statistic is recomputed from generated dataset"],
    solution: { level: "full", method: "compare the value to the mean in standard-deviation units" }
  }),
  makeType("Scatter Plot Trend Analysis", "Data, Statistics, and Probability", ["9", "10", "11"], "Describe association, outliers, and reasonable predictions from scatter plots.", {
    generatorKind: "coordinate",
    formats: ["graph-data", "real-world"],
    controls: ["trend strength", "data context", "item count"],
    validationRules: ["new coordinate is recomputed from generated translation"],
    solution: { level: "visual", method: "inspect the direction, strength, and unusual points before predicting" }
  }),
  makeType("Measures of Center and Spread", "Data, Statistics, and Probability", ["9", "10"], "Compare mean, median, range, and interquartile range for data sets.", {
    generatorKind: "mean",
    formats: ["graph-data", "worked-practice"],
    controls: ["dataset size", "statistic focus", "item count"],
    validationRules: ["statistic is recomputed from generated dataset"],
    solution: { level: "full", method: "compute the requested statistic and compare what it says about the data" }
  }),
  makeType("Permutations and Combinations", "Data, Statistics, and Probability", ["11", "12"], "Choose and calculate arrangements and selections in counting problems.", {
    generatorKind: "probability",
    formats: ["worked-practice", "real-world"],
    controls: ["counting method", "set size", "item count"],
    validationRules: ["probability fraction is favorable outcomes over total outcomes"],
    solution: { level: "full", method: "decide whether order matters, then use the matching counting method" }
  }),
  makeType("Compound Interest Scenarios", "Financial and Consumer Math", ["9", "10", "11", "12"], "Model savings and loans with compound interest calculations.", {
    generatorKind: "percent",
    formats: ["real-world", "worked-practice"],
    controls: ["principal range", "rate range", "item count"],
    validationRules: ["percent amount is recomputed as rate times base"],
    solution: { level: "full", method: "use the interest formula with principal, rate, time, and compounding frequency" }
  }),
  makeType("Credit Card Payoff Reasoning", "Financial and Consumer Math", ["11", "12"], "Analyze payments, interest, balances, and payoff tradeoffs in credit scenarios.", {
    generatorKind: "money",
    formats: ["real-world", "worked-practice"],
    controls: ["balance range", "payment strategy", "item count"],
    validationRules: ["change or total is recomputed in cents"],
    solution: { level: "full", method: "apply interest, subtract payments, and compare the remaining balance" }
  }),
  makeType("Tax Tip Discount and Markup", "Financial and Consumer Math", ["9", "10", "11"], "Solve multi-step percent problems involving shopping, taxes, discounts, and markups.", {
    generatorKind: "percent",
    formats: ["real-world", "quick-check"],
    controls: ["percent type", "money context", "item count"],
    validationRules: ["percent amount is recomputed as rate times base"],
    solution: { level: "full", method: "compute each percent change in order and track the updated total" }
  }),
  makeType("SAT ACT Linear Equation Practice", "Algebra and Functions", ["10", "11", "12"], "Practice concise test-style questions involving linear equations, slope, and intercepts.", {
    generatorKind: "algebra",
    formats: ["quick-check", "worked-practice"],
    controls: ["question style", "difficulty", "item count"],
    validationRules: ["solution is substituted back into the generated equation"],
    solution: { level: "full", method: "choose the shortest algebraic path and check the answer in the equation" }
  }),
  makeType("SAT ACT Data Interpretation Practice", "Data, Statistics, and Probability", ["10", "11", "12"], "Answer test-style questions using tables, charts, rates, and percent comparisons.", {
    generatorKind: "wordProblem",
    formats: ["graph-data", "quick-check"],
    controls: ["data display", "question style", "item count"],
    validationRules: ["scenario quantities are stored separately from text and re-solved"],
    solution: { level: "full", method: "pull the needed values from the data display and compute the requested comparison" }
  }),
  makeType("Optimization Word Problems", "Word Problems and Mathematical Reasoning", ["11", "12"], "Use equations and constraints to reason about maximum, minimum, and best-value situations.", {
    generatorKind: "wordProblem",
    formats: ["real-world", "worked-practice"],
    controls: ["constraint type", "model type", "item count"],
    validationRules: ["scenario quantities are stored separately from text and re-solved"],
    solution: { level: "full", method: "write the model and constraints, test viable values, and choose the best result" }
  }),
  makeType("Logic Grid Number Challenges", "Math Puzzles, Logic, and Enrichment", ["9", "10", "11", "12"], "Use deductive reasoning with number clues, constraints, and elimination.", {
    generatorKind: "patternPuzzle",
    formats: ["quick-check", "worked-practice"],
    controls: ["clue count", "difficulty", "item count"],
    validationRules: ["missing value follows the generated rule"],
    solution: { level: "partial", method: "track each clue, eliminate impossible values, and confirm the remaining solution" }
  })
];

worksheetTypes.push(...expandedWorksheetTypes);

let activeBand = "";
let activeGrade = "";
let activeStrand = "";
let activeFormat = "";
let activeType = worksheetTypes[0];
let activeWorksheetFormat = worksheetTypes[0].formats[0];
let currentWorksheet = null;

function createRng(seed) {
  let state = Math.max(1, Math.floor(seed) % 2147483647);
  return function next() {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function hashString(value) {
  return value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function int(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(rng, values) {
  return values[int(rng, 0, values.length - 1)];
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function simplifyFraction(numerator, denominator) {
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: Math.abs(denominator / divisor)
  };
}

function formatFraction(fraction) {
  if (fraction.denominator === 1) return String(fraction.numerator);
  return `${fraction.numerator}/${fraction.denominator}`;
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

function formatTime(totalMinutes) {
  const minutesInDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(minutesInDay / 60);
  const minute = minutesInDay % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function buildItem(type, index, rng) {
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
      const operation = type.params.operation;
      let a = int(rng, type.params.min, type.params.max);
      let b = int(rng, type.params.min, type.params.max);
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

function arithmeticSteps(a, b, operation) {
  if (operation === "add") return [`Add ${a} and ${b}.`, `The sum is ${a + b}.`];
  if (operation === "subtract") return [`Subtract ${b} from ${a}.`, `The difference is ${a - b}.`];
  return [`Multiply ${a} by ${b}.`, `The product is ${a * b}.`];
}

function finalizeItem(item) {
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
    studentInput: "",
    validation: { status: "unanswered", attempts: 0 },
    answerKey: {
      value: String(answer),
      alternates: item.alternates || [],
      tolerance: item.format === "decimal" || item.format === "money" ? 0.01 : 0,
      normalize: normalizer,
      orderInsensitive: Boolean(item.orderInsensitive)
    }
  };
}

function solveItem(item) {
  const data = item.data;
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
      return data.quotient;
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
      return Number((data.values.reduce((total, value) => total + value, 0) / data.values.length).toFixed(2));
    case "probability":
      return formatFraction(simplifyFraction(data.favorable, data.total));
    case "wordProblem":
      return data.boxes * data.perBox;
    default:
      return "";
  }
}

function generateWorksheet(type) {
  const itemCount = clamp(Number(document.getElementById("itemCount").value) || 6, 3, 12);
  const seed = Number(document.getElementById("seedInput").value) || 42;
  const rng = createRng(seed + Math.abs(hashString(type.id)));
  const items = Array.from({ length: itemCount }, (_, index) => buildItem(type, index, rng));
  const worksheet = {
    id: `${type.id}-${seed}`,
    title: type.title,
    strand: type.strand,
    grades: type.grades,
    format: activeWorksheetFormat,
    settings: {
      itemCount,
      seed,
      showSteps: type.solution.level !== "not-applicable",
      revealPolicy: "after-check"
    },
    items,
    summary: summarizeItems(items)
  };
  worksheet.audit = auditWorksheet(worksheet);
  return worksheet;
}

function auditWorksheet(worksheet) {
  const results = worksheet.items.map((item) => {
    const solved = String(solveItem(item));
    return {
      id: item.id,
      expected: item.answerKey.value,
      solved,
      ok: equivalentAnswer(solved, item.answerKey.value, item.answerKey)
    };
  });
  return {
    ok: results.every((result) => result.ok),
    checked: results.length,
    failed: results.filter((result) => !result.ok)
  };
}

function equivalentAnswer(left, right, answerKey) {
  if (answerKey.normalize === "fraction") return sameFraction(left, right);
  if (answerKey.normalize === "coordinate") return normalizeCoordinate(left) === normalizeCoordinate(right);
  if (answerKey.normalize === "number") {
    const a = Number(String(left).replace(/[$,%]/g, ""));
    const b = Number(String(right).replace(/[$,%]/g, ""));
    if (Number.isNaN(a) || Number.isNaN(b)) return normalizeText(left) === normalizeText(right);
    return Math.abs(a - b) <= (answerKey.tolerance || 0);
  }
  return normalizeText(left) === normalizeText(right);
}

function sameFraction(left, right) {
  const a = parseFraction(left);
  const b = parseFraction(right);
  if (!a || !b) return normalizeText(left) === normalizeText(right);
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

function parseFraction(value) {
  const raw = String(value).trim();
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return { numerator: Number(raw), denominator: 1 };
  }
  const match = raw.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!match || Number(match[2]) === 0) return null;
  return { numerator: Number(match[1]), denominator: Number(match[2]) };
}

function normalizeCoordinate(value) {
  return String(value).replace(/[()\s]/g, "").toLowerCase();
}

function normalizeText(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function isCorrect(input, answerKey) {
  const candidates = [answerKey.value, ...answerKey.alternates];
  return candidates.some((candidate) => equivalentAnswer(input, candidate, answerKey));
}

function summarizeItems(items) {
  const correct = items.filter((item) => item.validation.status === "correct").length;
  const incorrect = items.filter((item) => item.validation.status === "incorrect").length;
  const unanswered = items.length - correct - incorrect;
  return {
    correct,
    incorrect,
    unanswered,
    score: items.length ? Math.round(correct / items.length * 100) : 0
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderFilters() {
  document.getElementById("exactGradeFilters").innerHTML = exactGrades.map((grade) => `
    <button class="grade-button ${activeGrade === grade.id ? "active" : ""}" data-grade="${grade.id}" type="button">${grade.label}</button>
  `).join("");

  document.getElementById("gradeBandFilters").innerHTML = gradeBands.map((band) => `
    <button class="filter-button ${activeBand === band.id ? "active" : ""}" data-band="${band.id}" type="button">${band.label}</button>
  `).join("");

  document.getElementById("strandFilters").innerHTML = strands.map((strand) => `
    <button class="filter-button ${activeStrand === strand ? "active" : ""}" data-strand="${strand}" type="button">${strand}</button>
  `).join("");

  document.getElementById("formatFilters").innerHTML = formatFamilies.map((format) => `
    <button class="filter-button ${activeFormat === format.id ? "active" : ""}" data-format="${format.id}" type="button">${format.title}</button>
  `).join("");
}

function renderCoverage() {
  document.getElementById("totalTypeCount").textContent = worksheetTypes.length;
  document.getElementById("totalFormatCount").textContent = formatFamilies.length;
}

function renderAgents() {
  document.getElementById("agentGrid").innerHTML = agentTeam.map((agent) => `
    <article class="agent-card">
      <span>${agent.owns}</span>
      <h3>${agent.role}</h3>
      <p>${agent.output}</p>
    </article>
  `).join("");
}

function renderGradeMap() {
  document.getElementById("gradeMapGrid").innerHTML = gradeBands.map((band) => {
    const types = worksheetTypes.filter((type) => type.gradeBands.includes(band.id));
    const grouped = strands
      .map((strand) => ({ strand, count: types.filter((type) => type.strand === strand).length }))
      .filter((item) => item.count > 0);
    return `
      <article class="grade-band-card">
        <h3>${band.label}</h3>
        <p>${band.focus}</p>
        <div class="mini-list">
          ${grouped.map((item) => `<span>${item.strand} <strong>${item.count}</strong></span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderFormats() {
  document.getElementById("formatGrid").innerHTML = formatFamilies.map((format) => `
    <article class="format-card">
      <h3>${format.title}</h3>
      <p>${format.summary}</p>
      <dl>
        <dt>Structure</dt>
        <dd>${format.structure}</dd>
        <dt>Best for</dt>
        <dd>${format.bestFor}</dd>
      </dl>
    </article>
  `).join("");
}

function getFilteredTypes() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  return worksheetTypes.filter((type) => {
    const haystack = [
      type.title,
      type.strand,
      type.summary,
      type.controls.join(" "),
      type.formats.join(" "),
      type.validationRules.join(" "),
      type.solution.method
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query))
      && (!activeGrade || type.grades.includes(activeGrade))
      && (!activeBand || type.gradeBands.includes(activeBand))
      && (!activeStrand || type.strand === activeStrand)
      && (!activeFormat || type.formats.includes(activeFormat));
  });
}

function renderTypes() {
  const typeGrid = document.getElementById("typeGrid");
  const filtered = getFilteredTypes();
  document.getElementById("visibleCount").textContent = filtered.length;

  if (!filtered.length) {
    typeGrid.innerHTML = `<div class="empty-state">No math generators match those filters.</div>`;
    return;
  }

  typeGrid.innerHTML = filtered.map((type) => `
    <button class="type-card ${activeType.id === type.id ? "selected" : ""}" data-type="${type.id}" type="button">
      <div class="type-kicker">
        <span>${type.strand}</span>
        <span>${type.solution.level}</span>
      </div>
      <h3>${type.title}</h3>
      <p>${type.summary}</p>
      <div class="chip-row">
        <span class="chip">${formatGrades(type.grades)}</span>
        ${type.formats.slice(0, 2).map((formatId) => `<span class="chip">${formatTitle(formatId)}</span>`).join("")}
      </div>
    </button>
  `).join("");
}

function renderBlueprint(type) {
  activeType = type;
  if (activeFormat && type.formats.includes(activeFormat)) activeWorksheetFormat = activeFormat;
  if (!type.formats.includes(activeWorksheetFormat)) activeWorksheetFormat = type.formats[0];
  document.getElementById("blueprintTitle").textContent = type.title;
  document.getElementById("blueprintSummary").textContent = type.summary;
  document.getElementById("statusType").textContent = type.title;

  document.getElementById("blueprintMeta").innerHTML = `
    <div class="meta-box"><small>Strand</small>${type.strand}</div>
    <div class="meta-box"><small>Grades</small>${formatGrades(type.grades)}</div>
    <div class="meta-box"><small>Format</small>${formatTitle(activeWorksheetFormat)}</div>
    <div class="meta-box"><small>Solutions</small>${type.solution.level}</div>
  `;

  document.getElementById("formatOptionList").innerHTML = type.formats.map((formatId) => {
    const format = formatFamilies.find((item) => item.id === formatId);
    return `
      <button class="format-choice ${activeWorksheetFormat === formatId ? "active" : ""}" data-worksheet-format="${formatId}" type="button">
        <strong>${formatTitle(formatId)}</strong>
        <span>${format ? format.bestFor : "worksheet practice"}</span>
      </button>
    `;
  }).join("");

  document.getElementById("controlList").innerHTML = type.controls.map((control) => `<li>${control}</li>`).join("");
  document.getElementById("validationList").innerHTML = type.validationRules.map((rule) => `<li>${rule}</li>`).join("");
  document.getElementById("solutionSummary").textContent = `${type.solution.level}: ${type.solution.method}`;
  document.getElementById("copyStatus").textContent = "";

  currentWorksheet = generateWorksheet(type);
  renderWorksheet(currentWorksheet);
  renderTypes();
}

function renderWorksheet(worksheet) {
  const stage = document.getElementById("worksheetStage");
  const auditClass = worksheet.audit.ok ? "pass" : "fail";
  document.getElementById("statusAudit").textContent = worksheet.audit.ok
    ? `${worksheet.audit.checked}/${worksheet.audit.checked} valid`
    : `${worksheet.audit.failed.length} failed`;

  stage.innerHTML = `
    <article class="worksheet-page format-${escapeHtml(worksheet.format)}" aria-label="${escapeHtml(worksheet.title)} worksheet">
      <header class="worksheet-header">
        <div>
          <p class="eyebrow">Student page</p>
          <h3>${escapeHtml(worksheet.title)}</h3>
          <p>${escapeHtml(worksheet.strand)} | ${escapeHtml(formatGrades(worksheet.grades))} | ${escapeHtml(formatTitle(worksheet.format))}</p>
        </div>
        <div class="student-fields">
          <span>Name</span>
          <span>Date</span>
        </div>
      </header>

      <p class="worksheet-directions">${escapeHtml(formatDirections(worksheet.format))}</p>

      <div class="worksheet-summary digital-controls">
        <span class="audit-badge ${auditClass}">Answer key audit: ${worksheet.audit.ok ? "passed" : "failed"}</span>
        <span>${worksheet.summary.correct} correct</span>
        <span>${worksheet.summary.incorrect} incorrect</span>
        <span>${worksheet.summary.unanswered} unanswered</span>
      </div>

      <ol class="worksheet-items">
        ${worksheet.items.map(renderWorksheetItem).join("")}
      </ol>
    </article>

    <article class="answer-key-page">
      <p class="eyebrow">Teacher page</p>
      <h3>Answer Key and Step Notes</h3>
      <ol>
        ${worksheet.items.map((item) => `
          <li>
            <strong>${escapeHtml(item.answerKey.value)}</strong>
            <span>${escapeHtml(item.steps.join(" "))}</span>
          </li>
        `).join("")}
      </ol>
    </article>
  `;
}

function renderWorksheetItem(item) {
  const status = item.validation.status;
  return `
    <li class="worksheet-item ${status}" data-item-id="${item.id}">
      <div class="item-body">
        <p class="item-prompt">${escapeHtml(item.prompt)}</p>
        ${renderVisual(item.visual)}
        <label class="answer-field">
          <span>Answer ${item.number}</span>
          <input value="${escapeHtml(item.studentInput)}" data-answer-input="${item.id}" aria-label="Answer for item ${item.number}" autocomplete="off">
        </label>
        <div class="item-actions digital-controls">
          <button class="mini-button" data-check-item="${item.id}" type="button">Check</button>
          <span class="status-badge">${statusLabel(status)}</span>
        </div>
        <p class="feedback" aria-live="polite">${feedbackText(item)}</p>
        ${item.steps.length ? `
          <details class="steps digital-controls">
            <summary>Steps</summary>
            <ol>${item.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
          </details>
        ` : ""}
      </div>
    </li>
  `;
}

function renderVisual(visual) {
  if (!visual) return "";
  if (visual.kind === "dots") {
    return `<div class="dot-model" aria-label="${visual.count} dots">${Array.from({ length: visual.count }, () => "<span></span>").join("")}</div>`;
  }
  if (visual.kind === "fractionBar") {
    return `
      <div class="fraction-bar" aria-label="${visual.numerator} of ${visual.denominator} parts shaded">
        ${Array.from({ length: visual.denominator }, (_, index) => `<span class="${index < visual.numerator ? "filled" : ""}"></span>`).join("")}
      </div>
    `;
  }
  return "";
}

function checkItem(item) {
  item.validation.attempts += 1;
  item.validation.status = item.studentInput.trim()
    ? isCorrect(item.studentInput, item.answerKey) ? "correct" : "incorrect"
    : "unanswered";
}

function checkAllAnswers() {
  currentWorksheet.items.forEach(checkItem);
  currentWorksheet.summary = summarizeItems(currentWorksheet.items);
  renderWorksheet(currentWorksheet);
}

function statusLabel(status) {
  if (status === "correct") return "Correct";
  if (status === "incorrect") return "Try again";
  return "Unanswered";
}

function feedbackText(item) {
  if (item.validation.status === "correct") return "Correct.";
  if (item.validation.status === "incorrect") return item.feedback;
  return "Enter an answer, then check it.";
}

function formatGrades(grades) {
  return grades.map((grade) => grade === "0" ? "Pre-K" : grade).join(", ");
}

function formatTitle(formatId) {
  const format = formatFamilies.find((item) => item.id === formatId);
  return format ? format.title : formatId;
}

function formatDirections(formatId) {
  const directions = {
    "fluency-grid": "Solve each item neatly. Use the answer boxes for quick fluency practice.",
    "worked-practice": "Show your work for each item. Use the step notes after checking your answer.",
    "visual-model": "Use the model, diagram, or representation before entering an answer.",
    "graph-data": "Read the table, graph, coordinates, or data display carefully before solving.",
    "real-world": "Track the quantities in the situation, then label each answer with units.",
    "quick-check": "Answer each item, check your work, and use feedback to retry."
  };
  return directions[formatId] || "Solve each item and check your work.";
}

function resetFilters() {
  activeBand = "";
  activeGrade = "";
  activeStrand = "";
  activeFormat = "";
  document.getElementById("searchInput").value = "";
  renderFilters();
  renderTypes();
}

function getSpecText() {
  return [
    `Generate a self-checking HTML math worksheet for ${activeType.title}.`,
    `Grades: ${formatGrades(activeType.grades)}.`,
    `Strand: ${activeType.strand}.`,
    `Format family: ${activeType.formats.map(formatTitle).join(", ")}.`,
    `Controls: ${activeType.controls.join(", ")}.`,
    `Validation: ${activeType.validationRules.join("; ")}.`,
    `Step solution plan: ${activeType.solution.level} - ${activeType.solution.method}.`,
    "Each item must include prompt, structured data, answerKey, audit solver, student input, feedback, and print-safe layout."
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bindEvents() {
  document.getElementById("exactGradeFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-grade]");
    if (!button) return;
    activeGrade = activeGrade === button.dataset.grade ? "" : button.dataset.grade;
    if (activeGrade) activeBand = "";
    renderFilters();
    renderTypes();
  });

  document.getElementById("gradeBandFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-band]");
    if (!button) return;
    activeBand = activeBand === button.dataset.band ? "" : button.dataset.band;
    if (activeBand) activeGrade = "";
    renderFilters();
    renderTypes();
  });

  document.getElementById("strandFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-strand]");
    if (!button) return;
    activeStrand = activeStrand === button.dataset.strand ? "" : button.dataset.strand;
    renderFilters();
    renderTypes();
  });

  document.getElementById("formatFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-format]");
    if (!button) return;
    activeFormat = activeFormat === button.dataset.format ? "" : button.dataset.format;
    renderFilters();
    renderTypes();
  });

  document.getElementById("typeGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    const type = worksheetTypes.find((item) => item.id === button.dataset.type);
    if (type) renderBlueprint(type);
  });

  document.getElementById("formatOptionList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-worksheet-format]");
    if (!button) return;
    activeWorksheetFormat = button.dataset.worksheetFormat;
    renderBlueprint(activeType);
  });

  document.getElementById("worksheetStage").addEventListener("input", (event) => {
    const input = event.target.closest("[data-answer-input]");
    if (!input || !currentWorksheet) return;
    const item = currentWorksheet.items.find((entry) => entry.id === input.dataset.answerInput);
    if (item) item.studentInput = input.value;
  });

  document.getElementById("worksheetStage").addEventListener("click", (event) => {
    const button = event.target.closest("[data-check-item]");
    if (!button || !currentWorksheet) return;
    const item = currentWorksheet.items.find((entry) => entry.id === button.dataset.checkItem);
    if (!item) return;
    checkItem(item);
    currentWorksheet.summary = summarizeItems(currentWorksheet.items);
    renderWorksheet(currentWorksheet);
  });

  document.getElementById("searchInput").addEventListener("input", renderTypes);
  document.getElementById("itemCount").addEventListener("change", () => renderBlueprint(activeType));
  document.getElementById("seedInput").addEventListener("change", () => renderBlueprint(activeType));
  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  document.getElementById("clearGrade").addEventListener("click", () => {
    activeGrade = "";
    renderFilters();
    renderTypes();
  });
  document.getElementById("clearBand").addEventListener("click", () => {
    activeBand = "";
    renderFilters();
    renderTypes();
  });
  document.getElementById("clearStrand").addEventListener("click", () => {
    activeStrand = "";
    renderFilters();
    renderTypes();
  });
  document.getElementById("clearFormat").addEventListener("click", () => {
    activeFormat = "";
    renderFilters();
    renderTypes();
  });

  document.getElementById("generateWorksheet").addEventListener("click", () => renderBlueprint(activeType));
  document.getElementById("checkAnswers").addEventListener("click", checkAllAnswers);
  document.getElementById("printWorksheet").addEventListener("click", () => window.print());
  document.getElementById("copyBlueprint").addEventListener("click", async () => {
    const status = document.getElementById("copyStatus");
    try {
      await navigator.clipboard.writeText(getSpecText());
      status.textContent = "Spec copied.";
    } catch (error) {
      status.textContent = getSpecText();
    }
  });
}

renderFilters();
renderCoverage();
renderAgents();
renderGradeMap();
renderFormats();
renderBlueprint(activeType);
bindEvents();
