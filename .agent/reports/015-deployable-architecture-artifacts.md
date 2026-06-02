# 015-deployable-architecture-artifacts: Capture deployable architecture artifacts

Status: passed

## Summary

Captured the taxonomy, mixed HTML/TeX rendering, LaTeX export, and deterministic-generator architecture as durable repo artifacts. The docs preserve the subagent research outputs as implementation guidance while keeping worksheet JSON as the source of truth for generation, editing, rendering, answer keys, and exports.

The required harness checks passed. A static HTTP startup smoke also returned `200 OK` for the served app. A real browser smoke was attempted with Playwright, but Chromium could not start in this host because `libatk-1.0.so.0` is missing from the container.

## Files Changed

- `.agent/queue/015-deployable-architecture-artifacts.json`
- `.agent/reports/015-deployable-architecture-artifacts.md`
- `.agent/reports/015-deployable-architecture-artifacts.result.json`
- `docs/architecture/README.md`
- `docs/architecture/taxonomy-registry.md`
- `docs/architecture/html-tex-rendering.md`
- `docs/architecture/deterministic-generators.md`

## Traceability

- task_contract_file: `.agent/queue/015-deployable-architecture-artifacts.json`
- execution: manual local implementation in the current checkout
- review_subagent: `019e89bf-1442-7382-96e2-64231a8ccc2f`

Codex prompts:

- Not run through `agent-runner.mjs`; user requested direct iteration plus subagent support toward deployability.
- Subagent reviewed task 015 acceptance against `docs/architecture/` and reported `status: passed`.

## Codex Runs

- Local parent session created the docs artifacts and queue/report files.
- Explorer subagent reviewed acceptance coverage and found no missing items.

## Commands Run

- `node scripts/agent-validate.mjs`: passed, with warnings for ready tasks sharing report/docs paths and prior manual result reports not being reflected in `.agent/state.json`.
- `node scripts/verify-generators.js`: passed, 139 worksheet types and 834 generated items checked.
- `git diff --check`: passed.
- `node --check app.js`: passed.
- `curl -I http://127.0.0.1:4173/`: passed, returned `HTTP/1.0 200 OK` for the served static app.
- `playwright_cli.sh open --browser chromium http://127.0.0.1:4173/`: failed before page load because Chromium could not load `libatk-1.0.so.0`.

## Acceptance Checklist

- Taxonomy artifact documents grade, topic, skill, subskill, standards, difficulty, prerequisite, and coverage fields: passed.
- Renderer artifact documents HTML/CSS layout with TeX math islands plus LaTeX export from the same worksheet JSON: passed.
- Generator artifact documents deterministic coherent question generation from seed, constraints, variables, answers, worked solutions, and verification: passed.
- Artifacts include concrete next implementation paths tied to likely repo directories: passed.
- Generator verification still passes: passed.

## Remaining Work

- Add the canonical worksheet JSON schema and fixtures.
- Move current generator prototypes out of `app.js` into typed registry/generator modules once the repo has a package/build harness.
- Install missing browser host libraries before claiming a full Playwright browser smoke in this container.

## Logs

- No `.agent/logs/015-deployable-architecture-artifacts` bundle exists because this was not launched through `agent-runner.mjs`.
- Playwright browser launch failed with `error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file`.

## Branch / Worktree

- branch: `main`
- task branch field: `agent/015-deployable-architecture-artifacts`
- worktree: current checkout
