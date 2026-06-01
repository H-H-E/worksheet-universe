# Codex PR Review Prompt

Review this pull request for the Worksheet Universe compiler project.

Check for:

- completion of the assigned `.agent/queue/*.json` task
- tests or validation commands that actually cover the change
- scope creep beyond the task
- unsafe secrets or credential handling
- unrelated edits
- preservation of the architecture: teacher input -> worksheet JSON -> editable preview -> exports -> tests
- JSON remaining the source of truth
- avoidance of accounts, payments, auth, databases, LMS integrations, Google Classroom, OCR, and complex PDF parsing unless explicitly assigned

Return a concise pass/fail review with concrete issues and the smallest needed fix.
