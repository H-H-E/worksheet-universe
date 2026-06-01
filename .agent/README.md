# Overnight Agent Harness

## What The Harness Is

This harness runs short-lived Codex workers against small JSON task files. It is for building the Worksheet Universe compiler gradually and safely:

teacher input -> worksheet JSON -> editable preview -> exports -> tests

The harness does not build the worksheet compiler by itself. It defines task contracts, logs, state, reports, and runner scripts for future agents.
JSON is the source of truth for task contracts, worker results, and future worksheet compiler work.

## Why Short-Lived Tasks

Long-running agents drift. This repo uses one task file per task so each worker has a narrow goal, allowed paths, acceptance criteria, commands, retry limits, and a final report.

## JSON Contracts

Task files live in `.agent/queue/` and must match `.agent/task-schema.json`.

Worker final reports should match `.agent/result-schema.json`. Markdown reports are written to `.agent/reports/<task-id>.md` for humans.

Run manifests live at `.agent/logs/<task-id>/run.json` and must match `.agent/run-schema.json`.

Lifecycle logs live at `.agent/logs/<task-id>/events.jsonl`. Each JSONL event must match `.agent/event-schema.json` with an ISO-compatible `at` timestamp and non-empty `type`.

Runner state lives at `.agent/state.json` and must match `.agent/state-schema.json`.

## Commands

Run the doctor:

```bash
npm run agent:doctor
```

Direct form, for repos without `package.json`:

```bash
node scripts/agent-doctor.mjs
node scripts/agent-doctor.mjs --json
node scripts/agent-doctor.mjs --strict --json
```

The doctor reports Node version, package manager, package parse errors, framework, TypeScript presence, available scripts, Codex CLI availability, git status, GitHub Actions, queue readiness, next task/prompt hashes, safe next-run commands, harness folders, state/lock summary, cleanup candidates, validation coverage including path-overlap checks, operator warnings, and whether the harness files are committed for default worktree mode. With `--strict`, harness validation warnings are fatal, while doctor-only operator warnings remain informational.

Validate harness files:

```bash
npm run agent:validate
node scripts/agent-validate.mjs
node scripts/agent-validate.mjs --json
node scripts/agent-validate.mjs --strict
node scripts/agent-selftest.mjs
```

Normal validation treats recovery warnings as non-fatal. Use `--strict` when you want warnings to fail before an unattended run.
`agent-selftest` also runs `node --check` over the harness scripts so syntax mistakes fail in CI before a long worker run starts.

List tasks:

```bash
npm run agent:list
node scripts/agent-runner.mjs --list
node scripts/agent-runner.mjs --list --ready
node scripts/agent-runner.mjs --list --json
node scripts/agent-runner.mjs --graph
node scripts/agent-runner.mjs --graph --json
node scripts/agent-runner.mjs --show 001-inspect-repo
node scripts/agent-runner.mjs --logs 001-inspect-repo
node scripts/agent-runner.mjs --scope-check 001-inspect-repo
```

Task listings and graph JSON include compact task/prompt hashes, readiness, status, command-gate warning counts, JSON warning details, and `blocked_by` dependencies so missing scripts, future-created command files, task identity, prompt identity, and sequencing blockers are visible during queue scans.

Show runner state:

```bash
node scripts/agent-runner.mjs --status
node scripts/agent-runner.mjs --status --json
```

Status output includes the current task, ready tasks, next command, strict dry-run command, current-checkout fallback command, next task/prompt hash prefixes, queue counts, and lock owner details, including a best-effort process-alive check, when a real run is active.

Generate a queue/report summary:

```bash
node scripts/agent-summary.mjs
node scripts/agent-summary.mjs --json
node scripts/agent-summary.mjs --strict --json
node scripts/agent-summary.mjs --write
```

The summary includes ready tasks, the next task, planned task/prompt hash prefixes, normal and strict next-run commands, the next scope-check command, command-gate parse/preflight plus warnings for the next task, live and archived run-manifest summaries, run-manifest command-gate warning counts, archived-run validation coverage, and unordered queue path overlaps for future scheduling decisions.
It also summarizes live lifecycle event logs, including event counts, invalid event counts, and the latest event type/timestamp.
It includes stale cleanup candidates and the exact cleanup dry-run command so recovery work is visible before a long run starts.
When the harness has not been committed yet, the summary includes current-checkout fallback commands using `--no-worktree --allow-dirty` for intentional local testing before the default worktree path is available.
It also lists any local run manifests found under `.agent/logs/`, including status, updated time, duration, and repair-attempt count.
If a result JSON or run manifest is malformed after an interrupted run, the summary reports that file as invalid instead of crashing; `agent-validate` remains the stricter pass/fail gate.
With `--strict`, summary exits nonzero when harness validation emits warnings.

Run the next dependency-ready task:

```bash
npm run agent:next
node scripts/agent-runner.mjs --next
node scripts/agent-runner.mjs --next --strict
```

Run a specific task:

```bash
node scripts/agent-runner.mjs --task 002-schema-and-fixtures
```

Real `--task` runs enforce dependencies by default. Use `--force` only when you intentionally need to rerun or debug a task out of order.
`--dry-run` and `--no-codex` can inspect a task even when its dependencies are not complete.
Use `--strict` with runner commands when validation warnings should stop the run before task selection or worker launch.
Runner modifier flags are context-checked: for example, `--ready` only works with `--list`, `--max-tasks` only works with `--all`, `--print-prompt` requires `--dry-run` or `--no-codex`, and `--json` task output is limited to dry-run/no-Codex previews because real runs write reports to disk.
Use either `--dry-run` or `--no-codex` for a task preview, not both.
Task ids passed to runner commands must use the queue filename format `NNN-lowercase-slug`.
Task branches are intentionally predictable: queue entries must use `agent/<task-id>` so worktree names, logs, reports, and commits stay traceable.

Dry-run without starting Codex:

```bash
node scripts/agent-runner.mjs --all --max-tasks 3 --dry-run
node scripts/agent-runner.mjs --all --max-tasks 3 --dry-run --json
```

Dry-run output includes a command-gate preflight showing whether commands parse without a shell, command executables, referenced Node script files, and declared `npm run <script>` gates are present in the current checkout. It also emits command-gate warnings for unparseable commands, missing executables, missing referenced files, missing package scripts, and malformed `package.json`.
Dry-run output also includes a worktree preflight. In default worktree mode it checks whether the harness files are committed to `HEAD`; with `--no-worktree` it explains whether the current checkout must be clean or whether `--allow-dirty` was provided.

Command gates time out after 30 minutes by default. Override when needed:

```bash
node scripts/agent-runner.mjs --next --command-timeout-minutes 10
```

Codex workers time out after 90 minutes by default:

```bash
node scripts/agent-runner.mjs --next --codex-timeout-minutes 60
```

Inspect the assembled worker prompt:

```bash
node scripts/agent-runner.mjs --task 001-inspect-repo --dry-run --print-prompt
```

Direct Codex example:

```bash
codex exec --sandbox workspace-write --json --output-schema .agent/result-schema.json -o .agent/reports/example.result.json "Read AGENTS.md and .agent/queue/001-inspect-repo.json, then complete the task."
```

For real task runs, replace `example` with the actual task id and write the matching Markdown report. The validator intentionally rejects orphan result files in `.agent/reports/`; use `.agent/tmp/` for scratch experiments.

## Overnight Playbook

1. Run `node scripts/agent-doctor.mjs`.
2. Run `node scripts/agent-validate.mjs`.
3. Inspect the plan with `node scripts/agent-runner.mjs --all --max-tasks 3 --dry-run`.
4. Inspect the first prompt with `node scripts/agent-runner.mjs --next --dry-run --print-prompt`.
5. Start small with `node scripts/agent-runner.mjs --next`.
6. If that passes, run a short batch with `node scripts/agent-runner.mjs --all --max-tasks 3`.
7. Check `node scripts/agent-runner.mjs --status` between batches.

Do not start a long batch while `.agent/tmp/runner.lock` exists unless you have confirmed the previous runner is stopped.

## Logs and Reports

- Logs are stored under `.agent/logs/<task-id>/`.
- The exact task contract is copied to `.agent/logs/<task-id>/task.json`.
- Worker and repair prompts are stored as `.agent/logs/<task-id>/<worker>.prompt.md`.
- Codex JSONL output is stored at `.agent/logs/<task-id>/codex.jsonl`.
- Codex stderr is stored at `.agent/logs/<task-id>/codex.stderr.log`.
- Raw Codex structured results are copied into `.agent/logs/<task-id>/<worker>.result.json` before the runner writes its final command-gated report.
- Command logs are stored under `.agent/logs/<task-id>/commands/`.
- The latest run manifest is stored at `.agent/logs/<task-id>/run.json`.
- Lifecycle events are stored at `.agent/logs/<task-id>/events.jsonl`.
- Long-running Codex workers and command gates emit periodic `codex.heartbeat` and `command.heartbeat` lifecycle events with elapsed time so operators can tell a run is still alive.
- Prior live log bundles are archived under `.agent/logs/archive/<task-id>/` before a new real run resets `.agent/logs/<task-id>/`.
- Human reports are stored at `.agent/reports/<task-id>.md`.
- JSON result files are stored at `.agent/reports/<task-id>.result.json`.
- Intermediate repair worker JSON is written under `.agent/tmp/`, not `.agent/reports/`.

Logs are cleaned at the start of each real task run so stale output is not mixed with current command gates. If the existing task log directory contains real files, the runner moves that bundle into `.agent/logs/archive/<task-id>/...` before cleaning it.
Task command gates are parsed into executable arguments with `scripts/agent-command-utils.mjs` and spawned without a shell; the validator rejects chained, unparseable, shell-redirection, command-substitution, backtick, and leading environment-assignment commands before a worker run.
Command-gate preflight is centralized in `scripts/agent-preflight.mjs` so runner, summary, and doctor checks report missing executables, package scripts, malformed `package.json`, and missing Node scripts consistently.
The runner includes the same command-gate preflight in worker prompts and run manifests, so overnight logs preserve the command argv, missing-script/package warnings, and executable checks the worker saw before editing.
The validator checks those run-manifest preflight entries against the task command list by index, including basic field shapes, so a stale or hand-edited `run.json` cannot silently claim a different command gate was checked.
It also protects the matching `.agent/run-schema.json` command-gate contract so future schema edits keep the preflight fields explicit.
The validator also analyzes `allowed_paths` overlap. It warns only when currently ready tasks overlap, and summary output lists all unordered task pairs that would need path locking or dependency sequencing before future parallel execution.
Task validation also rejects branches that do not include the task id, empty scopes, missing `.git`/`node_modules`/`.env` forbidden paths, empty acceptance criteria, empty command strings, duplicate dependencies, and queued tasks that omit `node scripts/agent-validate.mjs` from their command gates.
The validator scans harness prompts, queue files, workflows, and harness scripts for common hardcoded token shapes, including OpenAI, GitHub, npm, Slack, Google API, and AWS access key patterns. It also rejects unsafe PR review workflow changes such as `pull_request_target` or writable repository/PR permissions.
Markdown reports include changed files, task/prompt traceability hashes, Codex worker exits, elapsed durations, command logs, skipped command gates, worker-reported acceptance criteria, and log locations. The run manifest records a `run_id`, start/finish timestamps, duration, baseline dirty files, final changed files, Codex worker attempts, repair attempts, and command results.
The Markdown report `Status:` line must be one of `passed`, `failed`, `partial`, or `blocked`, and it must agree with the matching `.result.json` status when both files exist.
JSON result reports must cover each task acceptance criterion exactly once; extra, empty, or duplicate criteria fail validation.
The validator also checks the nested `commands_run` and `acceptance_results` contracts in `.agent/result-schema.json` so final report shape does not drift from the runner and reviewer expectations.
It checks task-schema array contracts too, keeping queue fields such as `allowed_paths`, `forbidden_paths`, `acceptance`, `commands`, and `depends_on` as string arrays.
Dry-run previews, lifecycle events, Codex run summaries, and run manifests also record SHA-256 hashes of the task contract and assembled prompts. Those hashes tie back to the saved `task.json` and `*.prompt.md` files, so you can prove which queue contract and prompt a worker saw even if `.agent/queue/` changes later.
When a run manifest references those files, `agent-validate` recomputes the hashes and fails if the saved artifact content no longer matches the manifest. It also checks the manifest shape against `.agent/run-schema.json` and validates lifecycle events against `.agent/event-schema.json`. Archived run bundles are validated too; because a moved bundle keeps the historical paths in `run.json`, validation resolves those artifact hashes against the archive directory when the original live log path no longer exists.
Lifecycle event validation also checks common event fields, including `task_id`, `command`, elapsed/duration values, exit codes, booleans, and repo-relative artifact paths. Those fields are documented in `.agent/event-schema.json`, while the schema still allows event-specific details.
The runner attaches `task_id` to lifecycle events automatically based on the task log directory.
Run manifests and dry-runs include a compact environment snapshot with Node version, platform, package manager, `package.json` presence, and best-effort Codex/git executable paths.
Prompt assembly and task/prompt hashing live in `scripts/agent-trace-utils.mjs` so runner and summary output stay consistent. Prompt assembly reports malformed `package.json` in the prompt command summary instead of crashing before a worker can report the issue.
State, manifest, result, and Markdown report files are written through same-directory atomic renames to reduce the chance of corrupt half-written files after interruption. The validator rejects unexpected `.agent/state.json` keys so stale runner metadata does not become part of the contract by accident.
The state schema is tracked beside the other harness contracts so future runners and repair tools can validate state without copying shape assumptions from the current script.
State validation rejects unknown task ids, duplicate task ids inside a bucket, and task ids that appear in multiple terminal buckets.
If an interruption leaves old `.tmp` files behind from atomic writes, `agent-validate` reports non-fatal validation warnings and `agent-doctor` surfaces them in its operator warning list. Shared cleanup detection lives in `scripts/agent-cleanup-utils.mjs` so the runner, doctor, and summary agree on what is stale.
The validator and doctor also check runner-lock health. They warn when a lock is malformed, points at a process that no longer appears alive, or when a run manifest still says `running` after the lock is gone.
Because command and Codex workers emit heartbeat events, the validator also warns when a live `running` manifest has no lifecycle events or the latest event is stale.
The validator also cross-checks `.agent/state.json`, `.agent/reports/*.result.json`, and `.agent/logs/*/run.json`. It warns when state buckets disagree with result status, finished manifests are missing result reports, result and manifest status differ, or a running manifest disagrees with `current_task`.

Show the current log bundle and latest lifecycle events:

```bash
node scripts/agent-runner.mjs --logs 001-inspect-repo
node scripts/agent-runner.mjs --logs 001-inspect-repo --json
```

The log summary also lists existing Markdown and JSON report files for the task, plus the latest archived run bundles.
When `run.json` exists, the log summary includes latest status, update timestamp, duration, cwd/worktree, task and prompt hash prefixes, command-gate warning count, and the run summary; JSON output includes the parsed manifest.

## Worktrees

By default the runner creates one git worktree per task:

```text
../<repo-name>-<task-id>
```

Use `--no-worktree` only when you intentionally want the worker to run in the current checkout.

Real `--no-worktree` runs refuse to start in a dirty checkout unless you pass `--allow-dirty`.
If a task worktree directory already exists, the runner verifies it is on the expected task branch before reusing it.

Worktree runs require the harness files to be committed so the new worktree contains `.agent/`, every queued task file, `AGENTS.md`, the runner scripts, workflows, prompts, and command-gate helper scripts such as `agent-validate` and `agent-doctor`. The runner checks this before creating a worktree. If those files are still untracked, commit the harness first or run intentionally with `--no-worktree --allow-dirty`.
The required worktree file list is centralized in `scripts/agent-harness-files.mjs` and shared by the runner, doctor, and validator to avoid drift between preflight checks.

## Recovery

If a task fails:

1. Read `.agent/reports/<task-id>.md`.
2. Run `node scripts/agent-runner.mjs --logs <task-id>`.
3. Inspect `.agent/logs/<task-id>/commands/`.
4. Fix the task file if the scope was wrong, or rerun the task after correcting the blocker.
5. Do not mark the task passed until its acceptance criteria and commands pass.

The runner retries repair prompts up to `max_attempts`, then records the final status in `.agent/state.json`.

If a previous run was interrupted and `.agent/state.json` still has `current_task`, inspect the logs first. After confirming no worker is still running, clear stale state with:

```bash
node scripts/agent-runner.mjs --reset-running --dry-run --json
node scripts/agent-runner.mjs --reset-running
```

`--reset-running` refuses to clear a lock whose recorded process still appears alive. Use `--reset-running --force` only after confirming the runner process is not actually doing useful work.
If there is no current task and no runner lock, `--reset-running` is a no-op and does not rewrite state.
Use `--dry-run --json` first to see whether the command would clear `current_task` or remove `.agent/tmp/runner.lock`.

If reports exist but state looks wrong, rebuild state buckets from JSON reports:

```bash
node scripts/agent-runner.mjs --reconcile-state --dry-run --json
node scripts/agent-runner.mjs --reconcile-state
```

`--reconcile-state --dry-run --json` shows the previous and next state buckets, reports considered, and status changes without writing `.agent/state.json`.

If interrupted atomic writes or inspection commands leave stale `.tmp` files or empty ignored log/tmp directories, preview cleanup before deleting anything:

```bash
node scripts/agent-runner.mjs --cleanup-stale --dry-run --json
node scripts/agent-runner.mjs --cleanup-stale
```

`--cleanup-stale` only targets stale `.tmp` files under `.agent/` and empty transient directories under `.agent/logs/` or `.agent/tmp/`; it refuses paths outside `.agent/`.

The runner uses `.agent/tmp/runner.lock` for real Codex runs and releases it on normal completion, `SIGINT`, or `SIGTERM`. If interrupted, it records a `runner.signal` event, marks the active task blocked in state, and updates `run.json`. Remove the lock file manually only after verifying no runner process is active.
If a second runner finds a lock whose recorded process is no longer alive, inspect the task logs and then use `--reset-running` to clear stale state.
If a run appears quiet, inspect `.agent/logs/<task-id>/events.jsonl` or `node scripts/agent-runner.mjs --logs <task-id>` before assuming it is stuck. Heartbeat events mean the child process is still being watched by the runner.

The runner also checks file scope after a worker runs. Changes under `.agent/reports` are always allowed for reports; other changes must stay inside the task's `allowed_paths` and outside `forbidden_paths`.
Use `node scripts/agent-runner.mjs --scope-check <task-id>` to check the current checkout against one task's scope before launching or repairing a worker.
If the local sandbox blocks `git status`, scope-check emits a structured blocked result instead of guessing.
The validator also checks reported `files_changed` entries against the task scope, so manually written or direct-Codex result files cannot claim out-of-scope edits as a pass.

The validator also rejects broad allowed paths such as `.`, paths outside the repo, allowed/forbidden path conflicts, dependency priority inversions, schema enum drift, missing `.env` forbids, broken required workflow content, hardcoded API-key patterns in harness prompts, queue files, scripts, and workflows, chained or unparseable task commands, impossible command gates whose required script or `package.json` cannot exist in the task scope, malformed task Markdown reports, unsafe log/tmp ignore files, and destructive unattended commands such as `rm -rf`, `git reset --hard`, `git clean`, `git push`, `sudo`, or `danger-full-access`.
It also checks that each `.agent/reports/*.result.json` has a matching human-readable `.agent/reports/*.md` report and that Markdown reports correspond to queued tasks or generated summaries.
Result reports must account for every command declared by the task. Commands that did not run are recorded as `skipped` instead of disappearing from the report.
Passed JSON reports must have no failed or skipped commands, no remaining work, and passed acceptance results.
If a worker result omits task acceptance criteria or marks them incomplete, the runner downgrades an otherwise passing command-gate run to `partial`.
If `.agent/logs/<task-id>/run.json` exists, the validator checks that it has a `run_id` and matches a known task, command list, command-result accounting, retry limit, timestamps, and timeout fields.
When present, the validator also checks run duration fields and Codex attempt telemetry so stale or malformed overnight logs fail early.
When reports and manifests exist together, the validator warns on state/report/manifest drift so `--reconcile-state` can be used intentionally rather than guessing from stale files.

## What Agents Must Not Build Yet

Do not build accounts, payments, auth, databases, LMS integrations, Google Classroom, OCR, complex PDF parsing, classroom management, or unrelated product features unless a future task explicitly asks.

The near-term product path is schema, fixtures, deterministic math generators, HTML rendering, print CSS, answer checking, editor UI, JSON import/export, Markdown export, and smoke tests.
