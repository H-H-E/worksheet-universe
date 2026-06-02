# 002-schema-and-fixtures: Create canonical worksheet schema and fixtures

Status: passed

## Summary

Added the first canonical worksheet JSON contract without introducing a package/build stack. The schema covers worksheet metadata, sections, compiler question types, structured content blocks, answer keys, generator lineage, standards references, and versioning/migration metadata.

Also added documented TypeScript definitions and a dependency-free fixture validator. The validator checks the JSON Schema subset used by the fixtures and adds semantic checks that question ids and answer-key references line up.

Path exception: `.agent/reports` is not listed in this task's `allowed_paths`, but the repository workflow requires writing `.agent/reports/002-schema-and-fixtures.md` and `.agent/reports/002-schema-and-fixtures.result.json`.

## Files Changed

- `.agent/reports/002-schema-and-fixtures.md`
- `.agent/reports/002-schema-and-fixtures.result.json`
- `src/schema/README.md`
- `src/schema/worksheet.schema.json`
- `src/types/worksheet.d.ts`
- `tests/fixtures/validate-fixtures.mjs`
- `tests/fixtures/valid/addition-fluency.json`
- `tests/fixtures/valid/fraction-model.json`
- `tests/fixtures/valid/linear-equation.json`
- `tests/fixtures/invalid/malformed-question.json`

## Traceability

- task_contract_file: `.agent/queue/002-schema-and-fixtures.json`
- execution: manual local implementation in the current checkout

Codex prompts:

- Not run through `agent-runner.mjs`; user requested direct iteration plus subagent support toward deployability.

## Codex Runs

- Local parent session implemented the schema, fixture validator, fixtures, and report files.

## Commands Run

- `node scripts/agent-validate.mjs`: passed, with warnings for ready task path overlaps and prior manual result reports not being reflected in `.agent/state.json`.
- `node tests/fixtures/validate-fixtures.mjs`: passed, 3 valid fixtures accepted and 1 malformed fixture rejected.
- `node scripts/verify-generators.js`: passed, 139 worksheet types and 834 generated items checked.
- `git diff --check src/schema src/types tests/fixtures`: passed.

## Acceptance Checklist

- At least 3 fixture worksheets validate successfully: passed.
- At least 1 malformed fixture test fails validation: passed.
- Schema includes worksheet, section, question, answer key, and metadata: passed.
- Worksheet schema includes id, title, subject, gradeBand, topic, learningGoals, instructions, sections, answerKey, and metadata: passed.
- Question schema includes the required worksheet compiler question type enum: passed.
- Schema documents versioning and migration expectations: passed.

## Remaining Work

- Bridge the current static generator output into this canonical worksheet JSON shape.
- Add renderer/export tests against the canonical fixtures.

## Logs

- No `.agent/logs/002-schema-and-fixtures` bundle exists because this was not launched through `agent-runner.mjs`.

## Branch / Worktree

- branch: `main`
- task branch field: `agent/002-schema-and-fixtures`
- worktree: current checkout
- unrelated unstaged changes left untouched: `app.js`, `index.html`, `styles.css`, `.gitignore`
