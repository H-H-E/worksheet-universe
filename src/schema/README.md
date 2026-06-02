# Worksheet Schema

`worksheet.schema.json` is the v1 canonical worksheet contract. Generated worksheets, editable previews, print HTML, answer keys, and future exports should compile from this JSON shape rather than from parallel prompt strings.

## Versioning

- `schemaVersion` identifies the validator contract. The initial version is `1.0.0`.
- `metadata.versioning.contentVersion` tracks content changes that do not alter the schema contract.
- Backward-compatible field additions may use a new minor schema version once the repo has migration tooling.
- Breaking schema changes require a new major version and fixtures for both the old and new shape.

## Migration Expectations

- Store migration notes in `metadata.versioning.migration.notes` for generated or imported worksheets.
- Prefer forward-only migrations that preserve `id`, `answerRef`, and `answerKey.questionId` links.
- Any future migration script should validate before and after migration.
- Renderers must reject worksheets with unknown major schema versions until a migration path exists.

## Current Scope

This schema intentionally avoids dependencies. `tests/fixtures/validate-fixtures.mjs` implements the subset of JSON Schema keywords used by the v1 fixtures and adds semantic checks for question and answer-key cross references.
