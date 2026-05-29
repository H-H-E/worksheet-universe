const grades = ["0", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const subjects = [
  "Math",
  "ELA",
  "Science",
  "Social Studies",
  "SEL",
  "World Language",
  "Special Education",
  "Classroom Tools"
];

const sources = ["Math-Drills", "K5 Learning", "Twinkl", "Adjacent Scan"];

const sourceIntel = [
  {
    name: "Math-Drills",
    url: "https://math-drills.com/",
    scope: "K-12 math",
    signal: "Deep parameterized worksheet variants",
    statA: "70k+",
    statALabel: "worksheets",
    statB: "2005",
    statBLabel: "launched",
    notes: "Best model for generator controls: digit count, item count, regrouping, orientation, large print, fillable sheets, answer keys, timed fluency, and granular subskills."
  },
  {
    name: "K5 Learning",
    url: "https://www.k5learning.com/free-math-worksheets",
    scope: "K-6 math, K-5 reading",
    signal: "Clear grade and topic pathways",
    statA: "K-6",
    statALabel: "math range",
    statB: "2nd",
    statBLabel: "answer page",
    notes: "Best model for plain navigation and developmental sequencing: grade pages, topic pages, printable PDFs, and parent-friendly language."
  },
  {
    name: "Twinkl",
    url: "https://www.twinkl.com/resources/usa-resources",
    scope: "Pre-K to grade 8 plus audiences",
    signal: "Broad subject, standards, and resource-type coverage",
    statA: "many",
    statALabel: "subjects",
    statB: "SPED",
    statBLabel: "audiences",
    notes: "Best model for breadth: ELA, math, science, social studies, SEL, PE, technology, standards, classroom management, ELL, homeschool, and special education."
  }
];

const opportunities = [
  {
    title: "Parameter depth everywhere",
    body: "Use Math-Drills style controls outside arithmetic: item count, difficulty, support level, answer key mode, print density, fillable fields, and exact subskill."
  },
  {
    title: "Grade 0-12 coverage",
    body: "K5 is clean but elementary-heavy. Add preschool, middle school, high school, AP-ready, remedial, adult education, and special education pathways."
  },
  {
    title: "One taxonomy, many formats",
    body: "Let the same vocabulary list, standard, passage, or topic become matching, cloze, quiz, word search, flashcards, CER, lab sheet, or project rubric."
  },
  {
    title: "Accessibility as a generator setting",
    body: "Make large print, dyslexia-friendly spacing, low-ink mode, left-handed layouts, visuals, sentence frames, and language supports first-class controls."
  },
  {
    title: "Teacher diagnostics",
    body: "Generate error-analysis items, misconception distractors, reteach groups, IEP probes, exit tickets, and progress-monitoring forms from the same skill."
  },
  {
    title: "Standards plus real life",
    body: "Blend standards tagging with usable contexts: money, maps, science data, civic scenarios, health choices, career tasks, and household math."
  },
  {
    title: "Print and digital parity",
    body: "Every worksheet should have printable PDF, screen-fillable mode, answer key, teacher notes, student self-check, and clean export."
  },
  {
    title: "Quality guardrails",
    body: "Add age appropriateness, reading level, cultural neutrality checks, answer validation, copyright-safe source handling, and no-surprise content review."
  }
];

const worksheetTypes = [
  makeType("Number Recognition and Tracing", "Math", ["0", "K"], ["K5 Learning", "Twinkl"], "Trace numerals, match quantities, color or circle target numbers.", ["number range", "trace style", "line size", "visual quantity model", "item count"], ["large print", "motor-skill spacing", "picture cues"]),
  makeType("Counting Sets and One-to-One Matching", "Math", ["0", "K", "1"], ["K5 Learning", "Twinkl"], "Count objects, match numerals to sets, and compare small quantities.", ["max count", "object theme", "answer format", "include ten frames", "item count"], ["visual supports", "cut-and-paste mode", "low-ink mode"]),
  makeType("Number Charts and Hundreds Charts", "Math", ["K", "1", "2", "3"], ["K5 Learning", "Math-Drills"], "Fill missing numbers, skip count, or highlight patterns on charts.", ["chart size", "missing-number density", "skip pattern", "start number", "color coding"], ["left-handed layout", "large cells", "pattern hints"]),
  makeType("Comparing and Ordering Numbers", "Math", ["K", "1", "2", "3", "4", "5", "6"], ["K5 Learning", "Math-Drills", "Twinkl"], "Use greater-than, less-than, number lines, and ordered lists.", ["number range", "digits", "decimals allowed", "negatives allowed", "item count"], ["number line scaffold", "symbol bank", "worked example"]),
  makeType("Place Value and Base-Ten Blocks", "Math", ["K", "1", "2", "3", "4", "5", "6"], ["K5 Learning", "Math-Drills", "Twinkl"], "Represent numbers with blocks, expanded form, word form, and digit value.", ["max place", "representation type", "block visuals", "standard/expanded/word mix", "item count"], ["manipulative visuals", "grid support", "read-aloud labels"]),
  makeType("Rounding and Estimation", "Math", ["2", "3", "4", "5", "6", "7"], ["K5 Learning", "Math-Drills"], "Round whole numbers or decimals and estimate sums, differences, products, or quotients.", ["place value", "number type", "operation", "context", "item count"], ["number line hints", "strategy prompt", "confidence rating"]),
  makeType("Addition Facts Fluency", "Math", ["K", "1", "2", "3"], ["Math-Drills", "K5 Learning"], "Practice single-digit facts, make-ten strategies, target facts, and timed frenzies.", ["fact range", "target fact", "timed/untimed", "orientation", "questions per page"], ["large print", "left-handed variant", "strategy cue"]),
  makeType("Multi-Digit Addition", "Math", ["2", "3", "4", "5", "6"], ["Math-Drills", "K5 Learning"], "Add 2- to 9-digit numbers with no, some, or all regrouping.", ["digit count", "regrouping level", "orientation", "thousands separator", "item count"], ["grid support", "place-value labels", "worked first problem"]),
  makeType("Subtraction Facts and Regrouping", "Math", ["1", "2", "3", "4", "5", "6"], ["Math-Drills", "K5 Learning"], "Practice subtraction facts, multi-digit subtraction, borrowing, and mixed review.", ["digit count", "regrouping level", "zeros in minuend", "orientation", "item count"], ["base-ten model", "step boxes", "error check column"]),
  makeType("Mixed Operations Practice", "Math", ["2", "3", "4", "5", "6", "7"], ["Math-Drills", "Twinkl"], "Mix addition, subtraction, multiplication, and division by skill or grade.", ["operation set", "number range", "regrouping", "mixed density", "item count"], ["operation symbols key", "color coding", "self-check answers"]),
  makeType("Fact Families", "Math", ["1", "2", "3", "4"], ["Math-Drills", "K5 Learning"], "Generate related addition/subtraction or multiplication/division equations.", ["family type", "number range", "missing position", "triangle model", "item count"], ["visual family triangle", "equation frames", "partial bank"]),
  makeType("Multiplication Tables and Facts", "Math", ["2", "3", "4", "5"], ["Math-Drills", "K5 Learning", "Twinkl"], "Practice tables, arrays, skip counting, target facts, and fluency checks.", ["times table range", "target factor", "array visuals", "timed/untimed", "item count"], ["array scaffold", "large print", "personal goal field"]),
  makeType("Long Multiplication", "Math", ["3", "4", "5", "6", "7"], ["Math-Drills", "K5 Learning"], "Multiply multi-digit numbers with variable factor lengths and separators.", ["factor digit counts", "separator style", "grid support", "large print", "item count"], ["expanded partial products", "place-value lanes", "worked example"]),
  makeType("Division Facts and Long Division", "Math", ["3", "4", "5", "6", "7"], ["Math-Drills", "K5 Learning"], "Practice division facts, quotients, remainders, and long-division layouts.", ["divisor range", "remainder mode", "digit count", "symbol style", "item count"], ["bracket/standard symbol", "multiplication check", "step boxes"]),
  makeType("Order of Operations", "Math", ["4", "5", "6", "7", "8"], ["K5 Learning", "Math-Drills"], "Generate 2- to 6-step expressions with or without exponents or fractions.", ["step count", "operations", "parentheses", "exponents", "include fractions"], ["PEMDAS reminder", "line-by-line workspace", "common error alerts"]),
  makeType("Fraction Models and Manipulatives", "Math", ["1", "2", "3", "4"], ["Math-Drills", "K5 Learning", "Twinkl"], "Use circles, strips, rectangles, groups, and number lines to model fractions.", ["model type", "denominator range", "shade/identify", "labels", "color mode"], ["color-blind-safe labels", "cut-out mode", "large manipulatives"]),
  makeType("Equivalent, Simplified, and Converted Fractions", "Math", ["3", "4", "5", "6"], ["Math-Drills", "K5 Learning"], "Simplify fractions, find equivalents, and convert between improper and mixed numbers.", ["fraction type", "denominator range", "simplification level", "blank position", "item count"], ["factor hints", "visual strip option", "step prompts"]),
  makeType("Fraction Operations", "Math", ["4", "5", "6", "7"], ["Math-Drills", "K5 Learning"], "Add, subtract, multiply, divide, and mix operations with proper, improper, and mixed fractions.", ["operation set", "denominator relation", "fraction types", "simplifying mode", "item count"], ["common denominator scaffold", "reciprocal reminder", "answer format"]),
  makeType("Decimals Operations", "Math", ["4", "5", "6", "7"], ["K5 Learning", "Math-Drills"], "Add, subtract, multiply, divide, compare, and round decimals.", ["decimal places", "operation", "place-value scaffold", "money context", "item count"], ["decimal grid", "align-decimals cue", "estimation check"]),
  makeType("Fractions, Decimals, and Percents Conversion", "Math", ["5", "6", "7", "8"], ["K5 Learning", "Math-Drills"], "Convert between representations and solve mixed representation problems.", ["conversion direction", "friendly denominators", "percent range", "word problem context", "item count"], ["conversion chart", "calculator allowed", "visual bar model"]),
  makeType("Ratios, Rates, and Proportions", "Math", ["5", "6", "7", "8", "9"], ["K5 Learning", "Math-Drills", "Twinkl"], "Generate ratio tables, unit rates, proportions, scaling, and real-world rate tasks.", ["ratio type", "unit rate context", "table size", "unknown position", "item count"], ["double number line", "table scaffold", "sentence frames"]),
  makeType("Percents", "Math", ["5", "6", "7", "8", "9"], ["K5 Learning", "Math-Drills", "Twinkl"], "Find percent of a number, percent change, discounts, tax, tips, and interest.", ["percent type", "number range", "money context", "multi-step mode", "item count"], ["formula bank", "proportion method", "bar model"]),
  makeType("Integers and Rational Numbers", "Math", ["6", "7", "8", "9"], ["K5 Learning", "Math-Drills"], "Compare, order, add, subtract, multiply, and divide positive and negative numbers.", ["operation", "integer range", "number line", "mixed rational mode", "item count"], ["number line scaffold", "sign rules card", "error analysis"]),
  makeType("Factors, Multiples, GCF, and LCM", "Math", ["4", "5", "6"], ["K5 Learning", "Math-Drills"], "Practice prime/composite numbers, factorization, GCF, and LCM.", ["skill focus", "number range", "factor tree", "multiple list", "item count"], ["factor tree template", "prime chart", "strategy prompt"]),
  makeType("Exponents and Scientific Notation", "Math", ["5", "6", "7", "8", "9"], ["K5 Learning", "Math-Drills"], "Practice powers, exponent rules, powers of ten, and scientific notation.", ["base type", "exponent range", "notation direction", "rules included", "item count"], ["expanded form prompt", "place-value slider", "rule reference"]),
  makeType("Algebra Expressions and Equations", "Math", ["6", "7", "8", "9", "10"], ["K5 Learning", "Math-Drills", "Twinkl"], "Generate variables, expressions, one-step/two-step equations, and inequalities.", ["equation type", "solution range", "integer mode", "word problem mode", "item count"], ["balance model", "solve-step boxes", "check-your-answer line"]),
  makeType("Functions and Input-Output Tables", "Math", ["4", "5", "6", "7", "8", "9"], ["Math-Drills", "K5 Learning"], "Complete function tables, write rules, graph inputs, and interpret patterns.", ["rule type", "table length", "missing cells", "graphing mode", "item count"], ["rule hint", "coordinate grid", "pattern sentence"]),
  makeType("Coordinate Graphing and Graph Paper", "Math", ["4", "5", "6", "7", "8", "9"], ["Math-Drills", "K5 Learning"], "Plot points, create pictures, read coordinates, and generate custom graph paper.", ["quadrants", "grid scale", "picture mode", "coordinate list", "paper type"], ["large grid", "axis labels", "coordinate checklist"]),
  makeType("Geometry Shapes and Properties", "Math", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], ["K5 Learning", "Math-Drills", "Twinkl"], "Identify, classify, draw, measure, and reason about 2D and 3D figures.", ["shape set", "property focus", "drawing mode", "angle mode", "item count"], ["shape bank", "tracing support", "vocabulary labels"]),
  makeType("Area, Perimeter, Surface Area, and Volume", "Math", ["3", "4", "5", "6", "7", "8", "9", "10"], ["K5 Learning", "Math-Drills", "Twinkl"], "Solve measurement geometry problems with figures, formulas, and units.", ["measure type", "figure type", "unit type", "formula bank", "item count"], ["grid figures", "formula reminders", "unit conversion cue"]),
  makeType("Measurement and Unit Conversions", "Math", ["1", "2", "3", "4", "5", "6", "7", "8"], ["K5 Learning", "Math-Drills", "Twinkl"], "Measure length, mass, volume, temperature, and convert customary or metric units.", ["measurement type", "unit system", "conversion steps", "tool visuals", "item count"], ["ruler visuals", "conversion table", "real-object context"]),
  makeType("Time, Elapsed Time, and Calendars", "Math", ["K", "1", "2", "3", "4", "5"], ["K5 Learning", "Math-Drills", "Twinkl"], "Read clocks, solve elapsed time, use calendars, and compare time intervals.", ["clock type", "minute increments", "elapsed time direction", "calendar mode", "item count"], ["analog/digital pair", "timeline scaffold", "daily routine context"]),
  makeType("Money, Budgeting, and Consumer Math", "Math", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["K5 Learning", "Math-Drills", "Adjacent Scan"], "Count coins, make change, compare prices, budget, calculate tax, interest, and discounts.", ["currency", "skill focus", "real-world scenario", "multi-step mode", "item count"], ["coin visuals", "budget table", "calculator policy"]),
  makeType("Statistics, Data, and Graphing", "Math", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["K5 Learning", "Math-Drills", "Twinkl"], "Read graphs, make plots, find mean/median/mode/range, and interpret data.", ["graph type", "dataset size", "statistics focus", "interpretation prompts", "item count"], ["data table scaffold", "graph template", "claim from data"]),
  makeType("Probability", "Math", ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Math-Drills", "Twinkl"], "Generate chance experiments, probability spinners, compound events, and expected value.", ["event type", "sample space size", "spinner/dice/cards", "theoretical/experimental", "item count"], ["visual sample space", "vocabulary support", "simulation option"]),
  makeType("Math Word Problems", "Math", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["K5 Learning", "Math-Drills", "Twinkl"], "Create scenario-based one-step, multi-step, and mixed-skill word problems.", ["skill focus", "reading level", "step count", "context", "answer explanation"], ["key information organizer", "draw-a-model space", "language supports"]),
  makeType("Math Puzzles and Logic Sheets", "Math", ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Math-Drills", "Adjacent Scan"], "Generate sudoku, kakuro, magic squares, number searches, mazes, and logic grids.", ["puzzle type", "difficulty", "grid size", "math operation", "answer key"], ["hint mode", "large grid", "extension challenge"]),

  makeType("Alphabet, Letter Formation, and Name Practice", "ELA", ["0", "K", "1"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Trace letters and names, identify upper/lowercase, and practice handwriting strokes.", ["letter set", "line style", "name input", "case mode", "picture cues"], ["fine-motor spacing", "dotted/solid lines", "left-handed layout"]),
  makeType("Phonemic Awareness and Phonics", "ELA", ["0", "K", "1", "2"], ["K5 Learning", "Twinkl"], "Practice sounds, rhymes, syllables, blending, segmenting, CVC words, blends, and digraphs.", ["phonics pattern", "word list", "picture support", "decodable-only mode", "item count"], ["sound boxes", "mouth picture cue", "word bank"]),
  makeType("Sight Words and High-Frequency Words", "ELA", ["K", "1", "2", "3"], ["K5 Learning", "Twinkl"], "Read, trace, write, color, find, and use sight words in sentences.", ["word list", "activity mix", "repetition count", "sentence mode", "font size"], ["rainbow write option", "word bank", "decodable note"]),
  makeType("Spelling and Word Study", "ELA", ["1", "2", "3", "4", "5", "6", "7", "8"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Generate spelling lists, word sorts, missing letters, syllables, and pattern practice.", ["pattern", "word count", "sort categories", "dictation mode", "assessment mode"], ["category headers", "audio script", "challenge words"]),
  makeType("Vocabulary Definitions and Context", "ELA", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Match words to definitions, use words in context, analyze prefixes, suffixes, roots, and word relationships.", ["word source", "difficulty", "question format", "distractor type", "item count"], ["student-friendly definitions", "morphology hints", "ELL translation field"]),
  makeType("Grammar Parts of Speech", "ELA", ["1", "2", "3", "4", "5", "6", "7", "8", "9"], ["K5 Learning", "Twinkl"], "Practice nouns, verbs, adjectives, adverbs, pronouns, prepositions, conjunctions, and interjections.", ["part of speech", "sentence complexity", "identify/write/sort", "mixed review", "item count"], ["color coding", "sentence frames", "reference box"]),
  makeType("Sentence Building and Mechanics", "ELA", ["1", "2", "3", "4", "5", "6", "7", "8"], ["K5 Learning", "Twinkl"], "Generate capitalization, punctuation, sentence fragments, run-ons, subject/predicate, and combining tasks.", ["skill focus", "sentence length", "editing marks", "rewrite space", "item count"], ["editing checklist", "model sentence", "space for rewrite"]),
  makeType("Reading Comprehension Passages", "ELA", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Generate passages with literal, inferential, vocabulary, and evidence-based questions.", ["genre", "reading level", "word count", "question types", "answer key"], ["read-aloud note", "line numbers", "vocabulary preview"]),
  makeType("Comprehension Skill Sheets", "ELA", ["1", "2", "3", "4", "5", "6", "7", "8"], ["K5 Learning", "Twinkl"], "Practice main idea, details, sequencing, cause/effect, compare/contrast, fact/opinion, and inference.", ["skill focus", "text length", "organizer type", "question depth", "item count"], ["graphic organizer", "sentence stems", "highlight evidence"]),
  makeType("Story Elements and Literary Analysis", "ELA", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["K5 Learning", "Twinkl"], "Analyze character, setting, plot, conflict, theme, point of view, figurative language, and poetry.", ["literary focus", "text genre", "response format", "evidence requirement", "difficulty"], ["story map", "quote boxes", "tiered prompts"]),
  makeType("Writing Prompts and Paragraph Scaffolds", "ELA", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Generate narrative, opinion, informative, creative, and reflective writing sheets.", ["writing mode", "topic", "length target", "planning organizer", "rubric level"], ["sentence starters", "word bank", "revision checklist"]),
  makeType("Essay, CER, and Argument Organizer", "ELA", ["4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Build thesis, claim, evidence, reasoning, counterclaim, and conclusion scaffolds.", ["essay type", "source count", "paragraph count", "evidence boxes", "rubric style"], ["CER sentence frames", "quote integration", "teacher conference notes"]),
  makeType("Research and Source Note Catcher", "ELA", ["4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Guide students through source evaluation, paraphrase notes, citations, and synthesis.", ["source type", "citation style", "note format", "reliability criteria", "output"], ["plagiarism-safe paraphrase prompts", "source rating scale", "color-coded claims"]),
  makeType("Book Reports and Reading Response", "ELA", ["2", "3", "4", "5", "6", "7", "8", "9"], ["Twinkl", "K5 Learning", "Adjacent Scan"], "Generate response sheets for plot, character, recommendation, theme, and personal connection.", ["book type", "response depth", "creative option", "rubric", "page count"], ["choice board", "sentence stems", "drawing space"]),
  makeType("Word Search, Crossword, and Word Scramble", "ELA", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Adjacent Scan", "Twinkl"], "Turn any word list into printable vocabulary puzzles.", ["puzzle type", "word list", "grid size", "clue mode", "answer key"], ["picture clues", "hidden message", "large grid"]),

  makeType("Scientific Method and Lab Planning", "Science", ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Create question, hypothesis, variables, procedure, materials, and safety planning sheets.", ["lab type", "grade band", "variable support", "safety checklist", "response depth"], ["sentence frames", "diagram space", "teacher approval box"]),
  makeType("Observation, Classification, and Sorting", "Science", ["0", "K", "1", "2", "3", "4", "5"], ["K5 Learning", "Twinkl"], "Sort objects, animals, plants, rocks, matter, or weather observations by traits.", ["topic", "sort categories", "picture/text mode", "cut-and-paste", "item count"], ["visual cards", "category examples", "hands-on option"]),
  makeType("Life Science Concepts", "Science", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Generate worksheets for cells, body systems, plants, animals, life cycles, ecosystems, and food webs.", ["concept", "diagram type", "vocabulary load", "question mix", "answer key"], ["label bank", "tiered reading", "diagram alt text"]),
  makeType("Earth and Space Science", "Science", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Cover weather, climate, rocks, landforms, water cycle, planets, moon phases, and seasons.", ["topic", "diagram/graph mode", "reading level", "data included", "item count"], ["visual model", "map connection", "daily observation log"]),
  makeType("Physical Science", "Science", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Practice matter, forces, motion, energy, electricity, waves, chemistry, and physics.", ["topic", "math integration", "diagram type", "experiment tie-in", "item count"], ["formula bank", "concept cartoon", "phenomenon prompt"]),
  makeType("Science Data Tables and Graphs", "Science", ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Generate experimental data, graphing tasks, interpretation questions, and conclusion prompts.", ["dataset size", "graph type", "analysis depth", "error bars", "claim prompt"], ["table scaffold", "graph grid", "CER organizer"]),
  makeType("Engineering Design Challenge Sheet", "Science", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Guide ask, imagine, plan, create, test, improve, and reflect cycles.", ["challenge context", "materials constraints", "test criteria", "team roles", "reflection level"], ["sketch boxes", "iteration log", "role cards"]),

  makeType("Map Skills and Geography", "Social Studies", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9"], ["Twinkl", "Adjacent Scan"], "Practice directions, coordinates, scale, landforms, regions, countries, and physical/cultural geography.", ["map type", "region", "skill focus", "question mix", "item count"], ["map key scaffold", "color-blind-safe map", "glossary"]),
  makeType("Timelines and Chronology", "Social Studies", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Create event sequencing, cause/effect timelines, era comparisons, and historical change sheets.", ["time span", "event count", "blank positions", "analysis prompts", "source cards"], ["large timeline", "image placeholders", "date clue bank"]),
  makeType("Primary Source Analysis", "Social Studies", ["4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Guide sourcing, context, close reading, corroboration, and evidence gathering.", ["source type", "question depth", "background level", "citation boxes", "response format"], ["vocabulary preview", "chunked source", "claim/evidence frames"]),
  makeType("Civics, Government, and Citizenship", "Social Studies", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Generate rules, rights, branches, elections, lawmaking, civic responsibility, and action worksheets.", ["topic", "scenario type", "role-play option", "reading level", "response depth"], ["civic vocabulary", "scenario cards", "discussion prompts"]),
  makeType("Economics and Financial Decision Making", "Social Studies", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Cover needs/wants, goods/services, supply/demand, markets, budgeting, taxes, credit, and investing.", ["concept", "simulation mode", "math level", "scenario", "item count"], ["decision table", "vocabulary bank", "real-life extension"]),
  makeType("History Cause, Effect, and Perspective", "Social Studies", ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Analyze events, people, movements, conflicts, and multiple perspectives.", ["era/topic", "analysis lens", "source set", "organizer", "difficulty"], ["perspective chart", "evidence boxes", "misconception check"]),
  makeType("Biography and Famous Figure Profile", "Social Studies", ["1", "2", "3", "4", "5", "6", "7", "8"], ["Twinkl", "Adjacent Scan"], "Create profile sheets for leaders, inventors, scientists, artists, activists, and community helpers.", ["figure/topic", "research depth", "timeline included", "character trait focus", "output style"], ["sentence frames", "portrait box", "source checklist"]),

  makeType("SEL Emotion Identification", "SEL", ["0", "K", "1", "2", "3", "4", "5"], ["K5 Learning", "Twinkl", "Adjacent Scan"], "Practice feeling words, facial expressions, body signals, and coping choices.", ["emotion set", "scenario type", "draw/write mode", "strategy bank", "item count"], ["visual choices", "nonverbal response", "calm corner version"]),
  makeType("SEL Reflection and Decision Making", "SEL", ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Generate self-awareness, goal-setting, conflict resolution, empathy, and responsible decision sheets.", ["CASEL competency", "scenario age", "reflection depth", "discussion mode", "teacher notes"], ["sentence stems", "private reflection option", "counselor version"]),
  makeType("World Language Vocabulary and Grammar", "World Language", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Create vocabulary matching, conjugation, gender/number agreement, translation, dialogue, and culture tasks.", ["language", "CEFR/grade level", "skill focus", "word list", "answer key"], ["L1 support", "picture cues", "oral practice cards"]),
  makeType("ESL Reading, Speaking, and Cloze", "World Language", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Adjacent Scan", "Twinkl"], "Generate leveled passages, vocabulary exercises, cloze grammar, discussion questions, and speaking cards.", ["CEFR level", "topic", "skill mix", "word count", "speaking format"], ["word bank", "pronunciation notes", "pair-work version"]),
  makeType("Special Education Visual Supports", "Special Education", ["0", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Create visual schedules, first-then boards, task analysis, social stories, and matching cards.", ["support type", "symbol style", "routine", "steps", "student independence level"], ["high contrast", "AAC-friendly labels", "lamination layout"]),
  makeType("IEP Data Probes and Progress Monitoring", "Special Education", ["0", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Adjacent Scan", "Math-Drills"], "Generate repeated skill probes, fluency timings, mastery checks, and teacher recording forms.", ["goal area", "probe length", "trial count", "scoring method", "date range"], ["large print", "error code legend", "graph progress"]),
  makeType("Cut, Paste, Sort, and Foldable Activities", "Classroom Tools", ["0", "K", "1", "2", "3", "4", "5", "6"], ["Twinkl", "Adjacent Scan"], "Turn concepts into hands-on sorting, sequencing, matching, flaps, foldables, and mini-books.", ["activity type", "card count", "category count", "cut line style", "answer key"], ["thick cut lines", "picture mode", "fine-motor options"]),
  makeType("Task Cards, Flashcards, and Bingo", "Classroom Tools", ["0", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan", "K5 Learning"], "Generate repeatable card-based review for terms, facts, concepts, and scenarios.", ["card type", "set size", "front/back mode", "image support", "print layout"], ["large cards", "QR/audio field", "self-check corner"]),
  makeType("Exit Tickets and Quick Checks", "Classroom Tools", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Generate 3-5 minute formative checks, confidence ratings, and next-step prompts.", ["skill", "question count", "difficulty mix", "self-rating", "teacher sort code"], ["small slips", "ELL supports", "misconception tags"]),
  makeType("Rubrics, Checklists, and Reflection Sheets", "Classroom Tools", ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], ["Twinkl", "Adjacent Scan"], "Create student-facing criteria, peer review forms, project checklists, and reflection templates.", ["assignment type", "criteria count", "scale", "student language", "teacher notes"], ["visual levels", "sentence starters", "print/digital modes"])
];

let activeGrade = "";
let activeSubject = "";
let activeSource = "";
let activeType = worksheetTypes[0];

const subjectColors = {
  "Math": "#007b83",
  "ELA": "#b64068",
  "Science": "#597f2f",
  "Social Studies": "#3d67ad",
  "SEL": "#b36a00",
  "World Language": "#7b4aa8",
  "Special Education": "#8b4f35",
  "Classroom Tools": "#36454f"
};

function makeType(title, subject, gradeRange, sourceNames, summary, controls, hooks) {
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    title,
    subject,
    grades: gradeRange,
    sources: sourceNames,
    summary,
    controls,
    hooks
  };
}

function renderFilters() {
  const gradeFilters = document.getElementById("gradeFilters");
  const subjectFilters = document.getElementById("subjectFilters");
  const sourceFilters = document.getElementById("sourceFilters");

  gradeFilters.innerHTML = grades.map((grade) => {
    const label = grade === "0" ? "Pre" : grade;
    return `<button class="grade-button ${activeGrade === grade ? "active" : ""}" data-grade="${grade}" type="button">${label}</button>`;
  }).join("");

  subjectFilters.innerHTML = subjects.map((subject) => {
    return `<button class="filter-button ${activeSubject === subject ? "active" : ""}" data-subject="${subject}" type="button">${subject}</button>`;
  }).join("");

  sourceFilters.innerHTML = sources.map((source) => {
    return `<button class="filter-button ${activeSource === source ? "active" : ""}" data-source="${source}" type="button">${source}</button>`;
  }).join("");
}

function renderSources() {
  const sourceCards = document.getElementById("sourceCards");
  sourceCards.innerHTML = sourceIntel.map((source) => `
    <article class="source-card">
      <div>
        <p class="eyebrow">${source.scope}</p>
        <h3>${source.name}</h3>
      </div>
      <div class="stat-row">
        <div class="stat"><strong>${source.statA}</strong><small>${source.statALabel}</small></div>
        <div class="stat"><strong>${source.statB}</strong><small>${source.statBLabel}</small></div>
      </div>
      <p><strong>${source.signal}.</strong> ${source.notes}</p>
      <a href="${source.url}">Open source</a>
    </article>
  `).join("");
}

function renderOpportunities() {
  const board = document.getElementById("opportunityBoard");
  board.innerHTML = opportunities.map((item) => `
    <article class="opportunity-card">
      <h3>${item.title}</h3>
      <p>${item.body}</p>
    </article>
  `).join("");
}

function getFilteredTypes() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  return worksheetTypes.filter((type) => {
    const haystack = [
      type.title,
      type.subject,
      type.summary,
      type.controls.join(" "),
      type.hooks.join(" "),
      type.sources.join(" ")
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query))
      && (!activeGrade || type.grades.includes(activeGrade))
      && (!activeSubject || type.subject === activeSubject)
      && (!activeSource || type.sources.includes(activeSource));
  });
}

function renderTypes() {
  const typeGrid = document.getElementById("typeGrid");
  const filtered = getFilteredTypes();
  document.getElementById("visibleCount").textContent = filtered.length;

  if (filtered.length === 0) {
    typeGrid.innerHTML = `<div class="empty-state">No worksheet types match those filters yet.</div>`;
    return;
  }

  typeGrid.innerHTML = filtered.map((type) => {
    const gradeLabel = type.grades[0] === "0"
      ? `Pre-${type.grades[type.grades.length - 1]}`
      : `${type.grades[0]}-${type.grades[type.grades.length - 1]}`;
    const chips = [
      type.subject,
      `Grades ${gradeLabel}`,
      ...type.sources.slice(0, 2)
    ];
    return `
      <button class="type-card ${activeType.id === type.id ? "selected" : ""}" data-type="${type.id}" type="button">
        <div class="type-kicker">
          <span>${type.subject}</span>
          <span class="subject-dot" style="background:${subjectColors[type.subject] || "#007b83"}"></span>
        </div>
        <h3>${type.title}</h3>
        <p>${type.summary}</p>
        <div class="chip-row">
          ${chips.map((chip) => `<span class="chip">${chip}</span>`).join("")}
        </div>
      </button>
    `;
  }).join("");
}

function renderBlueprint(type) {
  activeType = type;
  document.getElementById("blueprintTitle").textContent = type.title;
  document.getElementById("blueprintSummary").textContent = type.summary;

  document.getElementById("blueprintMeta").innerHTML = `
    <div class="meta-box"><small>Subject</small>${type.subject}</div>
    <div class="meta-box"><small>Grades</small>${formatGrades(type.grades)}</div>
    <div class="meta-box"><small>Signals</small>${type.sources.join(", ")}</div>
    <div class="meta-box"><small>Controls</small>${type.controls.length}</div>
  `;

  document.getElementById("controlList").innerHTML = type.controls
    .map((control) => `<li>${control}</li>`)
    .join("");

  document.getElementById("hookList").innerHTML = type.hooks
    .map((hook) => `<li>${hook}</li>`)
    .join("");

  document.getElementById("copyStatus").textContent = "";
  renderTypes();
}

function formatGrades(typeGrades) {
  return typeGrades.map((grade) => grade === "0" ? "Pre-K" : grade).join(", ");
}

function resetFilters() {
  activeGrade = "";
  activeSubject = "";
  activeSource = "";
  document.getElementById("searchInput").value = "";
  renderFilters();
  renderTypes();
}

function getPromptText() {
  return [
    `Generate a ${activeType.title} worksheet.`,
    `Subject: ${activeType.subject}.`,
    `Grade range: ${formatGrades(activeType.grades)}.`,
    `Purpose: ${activeType.summary}`,
    `Expose these controls: ${activeType.controls.join(", ")}.`,
    `Include these differentiation hooks: ${activeType.hooks.join(", ")}.`,
    "Return a student page, answer key, teacher notes, and print-friendly layout."
  ].join("\n");
}

function bindEvents() {
  document.getElementById("gradeFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-grade]");
    if (!button) return;
    activeGrade = activeGrade === button.dataset.grade ? "" : button.dataset.grade;
    renderFilters();
    renderTypes();
  });

  document.getElementById("subjectFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-subject]");
    if (!button) return;
    activeSubject = activeSubject === button.dataset.subject ? "" : button.dataset.subject;
    renderFilters();
    renderTypes();
  });

  document.getElementById("sourceFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-source]");
    if (!button) return;
    activeSource = activeSource === button.dataset.source ? "" : button.dataset.source;
    renderFilters();
    renderTypes();
  });

  document.getElementById("typeGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    const type = worksheetTypes.find((item) => item.id === button.dataset.type);
    if (type) renderBlueprint(type);
  });

  document.getElementById("searchInput").addEventListener("input", renderTypes);
  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  document.getElementById("clearGrade").addEventListener("click", () => {
    activeGrade = "";
    renderFilters();
    renderTypes();
  });
  document.getElementById("clearSubject").addEventListener("click", () => {
    activeSubject = "";
    renderFilters();
    renderTypes();
  });
  document.getElementById("clearSource").addEventListener("click", () => {
    activeSource = "";
    renderFilters();
    renderTypes();
  });

  document.getElementById("printBlueprint").addEventListener("click", () => window.print());
  document.getElementById("copyBlueprint").addEventListener("click", async () => {
    const status = document.getElementById("copyStatus");
    try {
      await navigator.clipboard.writeText(getPromptText());
      status.textContent = "Prompt copied.";
    } catch (error) {
      status.textContent = getPromptText();
    }
  });
}

renderFilters();
renderSources();
renderOpportunities();
renderBlueprint(activeType);
bindEvents();
