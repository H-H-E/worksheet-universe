# Worksheet Universe Agent Instructions

This repo is building an open-source worksheet compiler. The product architecture is:

teacher input -> worksheet JSON -> editable preview -> exports -> tests

JSON is the source of truth. UI, rendering, print, Markdown, and later export formats should compile from validated worksheet JSON rather than inventing parallel content systems.

## Required Agent Workflow

- Read your assigned `.agent/queue/*.json` task before editing.
- Only modify paths listed in `allowed_paths` unless the task is impossible without another path. If you touch another path, explain why in `.agent/reports/<task-id>.md`.
- Prefer small tested changes.
- Run all checks listed by the task.
- Write `.agent/reports/<task-id>.md` before finishing.
- Write or allow the runner to write `.agent/reports/<task-id>.result.json`.
- End with one of these statuses: `passed`, `failed`, `partial`, or `blocked`.

## Scope Rules

- Do not build accounts, payments, auth, databases, LMS integrations, Google Classroom, OCR, complex PDF parsing, or unrelated features unless the task explicitly asks.
- Do not delete working functionality.
- Do not rewrite the architecture unless explicitly assigned.
- Do not treat AI output as sacred content. Future worksheet output must remain editable before export.
- Keep changes boring, readable, and easy to review.
- Expect the runner to flag changes outside `allowed_paths` or inside `forbidden_paths`.

## Repository Search

- If CodeGraph tools are available, prefer them for structural questions such as where a symbol is defined, what calls it, or what a change affects.
- Use native file reads or `rg` for literal text, task JSON, docs, and exact file contents.
- For flow questions, prefer a single CodeGraph trace over manual grep chains when the index is available.
- If CodeGraph reports that the project is not initialized, ask before running an index initialization command.
- Do not use CodeGraph as a substitute for tests; it is for orientation and impact analysis.

## Product Rules

- Worksheet JSON is the contract between generation, editing, rendering, answer keys, and exports.
- Tests are the truth. If code and expectations disagree, fix the code or update the task with a clear report.
- HTML export and print CSS are first-class v1 targets.
- PDF, DOCX, LMS, and account features are later layers unless a future task explicitly assigns them.
