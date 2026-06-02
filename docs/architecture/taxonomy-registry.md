# Worksheet Type Taxonomy Registry

Worksheet Universe needs a registry that is richer than the current app-card catalog. The current `app.js` entries are useful seed data, but a deployable worksheet compiler needs explicit curriculum metadata so teachers can search by grade, topic, skill, subskill, difficulty, prerequisite, and standards alignment.

JSON remains the source of truth. UI cards, generated worksheets, exports, and coverage reports should consume this registry instead of re-parsing display text.

## Registry Fields

Each worksheet type should include:

- `id`: stable slug used by generators, routes, and imports.
- `title`: teacher-facing name.
- `status`: `active`, `draft`, `deprecated`, or `needs-generator`.
- `version`: registry entry version.
- `summary`: concise teacher-facing description.
- `grades`: exact grades such as `K`, `1`, `2`, through `12`.
- `gradeBands`: broader ranges such as `pk-k`, `1-2`, `3-5`, `6-8`, `9-12`.
- `ageRange`: approximate US-oriented age range; secondary to grade.
- `strand`: current product strand, such as `Algebra and Functions`.
- `domain`: standards-style domain, such as `operations-and-algebraic-thinking`.
- `skill`: stable broad skill, such as `place-value`.
- `subskills`: precise teachable targets, such as `expanded-form` or `digit-value`.
- `prerequisites`: prior skills, worksheet types, and readiness notes.
- `difficulty`: band, numeric level, and drivers.
- `standards`: tagged references with framework, code, and alignment strength.
- `generator`: deterministic generator family, variants, controls, formats, and params.
- `validation`: answer type, audit rules, checker behavior, and invariants.
- `solution`: solution level and method.
- `coverage`: tags for search, recommendations, and gap scoring.

Difficulty bands:

- `readiness`: preparatory recognition, matching, tracing, and vocabulary.
- `intro`: first exposure with heavy scaffolding.
- `core`: expected grade-level practice.
- `fluency`: speed, volume, and automaticity.
- `application`: word problems, modeling, interpretation, and transfer.
- `extension`: enrichment, test-prep, advanced, or optional challenge.

## Proposed JSON Shape

```json
{
  "registryVersion": "2026.06",
  "frameworks": [
    {
      "id": "CCSS-M",
      "label": "Common Core State Standards for Mathematics",
      "url": "https://corestandards.org/mathematics-standards/"
    },
    {
      "id": "SAT-MATH",
      "label": "SAT Suite Math Domains",
      "url": "https://satsuite.collegeboard.org/k12-educators/about/alignment/math"
    },
    {
      "id": "ACT-MATH",
      "label": "ACT Math Reporting Categories",
      "url": "https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/description-of-math-test.html"
    }
  ],
  "worksheetTypes": [
    {
      "id": "add-within-20-strategies",
      "title": "Add Within 20 Strategies",
      "status": "active",
      "version": "1.0.0",
      "grades": ["1", "2"],
      "gradeBands": ["1-2"],
      "ageRange": { "min": 6, "max": 8, "basis": "typical-us" },
      "strand": "Operations and Fluency",
      "domain": "operations-and-algebraic-thinking",
      "skill": "addition-subtraction-within-20",
      "subskills": ["counting-on", "make-ten", "related-facts"],
      "prerequisites": {
        "skillIds": ["counting-sequence", "number-composition-to-10"],
        "worksheetTypeIds": ["make-ten-addition-pairs"],
        "notes": ["Student can count forward from a number within 20."]
      },
      "difficulty": {
        "band": "core",
        "level": 2,
        "drivers": ["sum-range", "unknown-position", "visual-support"]
      },
      "standards": [
        { "framework": "CCSS-M", "code": "1.OA.C.6", "alignment": "primary" },
        { "framework": "CCSS-M", "code": "2.OA.B.2", "alignment": "secondary" }
      ],
      "generator": {
        "family": "arithmetic",
        "variants": ["addition-within-20", "make-ten"],
        "formats": ["fluency-grid", "worked-practice"],
        "controls": ["sum range", "strategy support", "item count"],
        "params": { "operation": "add", "min": 1, "max": 20 }
      },
      "validation": {
        "answerType": "integer",
        "rules": ["sum is recomputed from addends"],
        "invariants": ["0 <= addend <= 20", "sum <= 20"]
      },
      "solution": {
        "level": "full",
        "method": "show counting-on or make-ten strategy"
      },
      "coverage": ["k2-core", "fluency", "addition"]
    }
  ]
}
```

## Representative Coverage Examples

| Worksheet type | Grades | Strand > skill > subskill | Prerequisites | Difficulty | Standards tags |
|---|---:|---|---|---|---|
| `number-recognition-and-tracing` | K | Number Sense > counting/cardinality > numeral recognition | oral counting, one-to-one matching | readiness | `CCSS-M:K.CC.A.3`, `K.CC.B.4` |
| `add-within-20-strategies` | 1-2 | Operations > add/subtract > make ten, counting on | number pairs to 10 | core | `1.OA.C.6`, `2.OA.B.2` |
| `three-digit-expanded-form` | 2-3 | Number Sense > place value > expanded form | tens/ones, base-ten blocks | core | `2.NBT.A.1`, `2.NBT.A.3` |
| `multiplication-tables-and-facts` | 3 | Operations > multiplication > fact fluency | arrays, skip counting | fluency | `3.OA.C.7` |
| `equivalent-fraction-models` | 3-5 | Fractions > equivalence > visual models | equal parts, unit fractions | intro/core | `3.NF.A.3`, `4.NF.A.1` |
| `decimal-place-value-to-hundredths` | 4-5 | Decimals > place value > tenths/hundredths | fractions with denominators 10/100 | core | `4.NF.C.6`, `4.NF.C.7`, `5.NBT.A.3` |
| `unit-rate-shopping-comparisons` | 6-7 | Ratios > unit rates > price per unit | division, ratio language | application | `6.RP.A.2`, `6.RP.A.3b`, `7.RP.A.1` |
| `two-step-equations` | 7-8 | Algebra > equations > inverse operations | integer/rational operations, one-step equations | core | `7.EE.B.4`, `8.EE.C.7` |
| `pythagorean-theorem-practice` | 8 | Geometry > right triangles > missing side/distance | squares, square roots, coordinate plane | core/application | `8.G.B.6`, `8.G.B.7`, `8.G.B.8` |
| `quadratic-factoring-practice` | 9-10 | Algebra > quadratics > factoring trinomials | distributive property, polynomial terms | core | `HSA-SSE.A.2`, `HSA-REI.B.4` |
| `right-triangle-trigonometry` | 10-11 | Geometry > trigonometry > sine/cosine/tangent | similarity, Pythagorean theorem | core/application | `HSG-SRT.C.6`, `HSG-SRT.C.8` |
| `normal-distribution-interpretations` | 11-12 | Statistics > distributions > mean/stdev/normal model | center/spread, z-score intuition | extension | `HSS-ID.A.2`, `HSS-ID.A.4` |

## Coverage Scoring

Create a target matrix with rows like:

```text
gradeBand + domain + skill + subskill + difficultyBand + requiredStandards + targetTypeCount
```

Score current and future worksheet types against each cell:

- `0.00`: no matching worksheet type.
- `0.25`: broad type exists but no precise subskill.
- `0.50`: targeted type exists but lacks standards, prerequisites, or difficulty.
- `0.75`: targeted type has standards and difficulty but weak generator or validation specificity.
- `1.00`: targeted type has grade, skill, subskill, prerequisites, difficulty, standards, generator, validation, and solution metadata.

Suggested formulas:

```text
metadataScore = completedRequiredFields / requiredFields
cellScore = min(sum(matchingTypeWeights), targetTypeCount) / targetTypeCount
gapPriority = targetWeight * (1 - cellScore)
```

The gap report should also flag overbroad worksheet types that span too many grades or standards. Those entries are difficult to recommend precisely and usually need to be split into narrower generator variants.

## Implementation Path

1. Add `src/catalog/worksheet-types.json` as the future source registry.
2. Add `src/catalog/schema` or `src/schema` validation once the canonical worksheet schema exists.
3. Add a script that extracts the current 139 `makeType(...)` entries from `app.js`.
4. Add a mapper from current title/strand metadata to `domain`, `skill`, `subskills`, `standards`, `prerequisites`, and `difficulty`.
5. Generate `docs/reports/coverage-matrix.md` from the registry.
6. Update the UI to consume the registry rather than hardcoded display text.

## References

- Common Core Mathematics Standards: https://corestandards.org/mathematics-standards/
- Common Core Mathematics Standards PDF: https://corestandards.org/wp-content/uploads/2023/09/Math_Standards1.pdf
- SAT Suite Math domains: https://satsuite.collegeboard.org/k12-educators/about/alignment/math
- ACT math test description: https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/description-of-math-test.html
