# 017-next-command-center-frontend: Fresh Next.js command center frontend

Status: passed

## Summary

Replaced the previous single-file teacher console with a fresh Next.js App Router command-center frontend. The new root experience has a teacher intent prompt, local deterministic prompt parsing, structured setup controls, URL-backed state, a PDF-style worksheet preview, answer checking, a trust panel, print/export actions, and a mobile step workflow.

Worksheet JSON remains the source of truth. The existing worksheet catalog, generator, item factory, schema, and answer-checking helpers were preserved; preview, answer key, checking, print, JSON copy, and make-another behavior all compile from generated canonical `Worksheet` JSON.

## Files Changed

- `.agent/queue/017-next-command-center-frontend.json`
- `.agent/reports/017-next-command-center-frontend.md`
- `.agent/reports/017-next-command-center-frontend.result.json`
- `README.md`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/tabs.tsx`
- `src/features/worksheet/index.ts`
- `src/features/worksheet/command-center/*`
- `tests/frontend/worksheet-console.test.ts`

Removed:

- `src/features/worksheet/TeacherConsole.tsx`

## Traceability

- task_contract_file: `.agent/queue/017-next-command-center-frontend.json`
- execution: manual local implementation in the current checkout
- guidelines_source: `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`

## Codex Runs

- Local session implemented the new command-center UI, prompt parser, URL state helpers, tests, docs, and task report/result artifacts.
- No subagents were spawned.

## Commands Run

- `node scripts/agent-validate.mjs`: passed, with existing warnings for older result/state mismatches and ready-task path overlaps.
- `node tests/fixtures/validate-fixtures.mjs`: passed, 3 valid fixtures and 1 invalid fixture checked.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed.
- `npm run test`: passed.
- `npm run test:generators`: passed, 139 worksheet types and 834 generated items checked.
- `npm run build`: passed with `next build --webpack`; route `/` prerendered as static content.
- `git diff --check`: passed.
- `npm run dev -- -H 127.0.0.1 -p 3000`: failed in sandbox with `listen EPERM`.
- `npm run dev -- --webpack -H 127.0.0.1 -p 3000`: started after escalation; emitted a host file-watch limit warning.
- `curl -I http://127.0.0.1:3000/`: passed after the dev server warmed up, returning `HTTP/1.1 200 OK`.
- `npm run start`: started the built static preview server after escalation.
- `curl -I http://127.0.0.1:4173/`: passed after escalation, returning `HTTP/1.1 200 OK`.

## Acceptance Checklist

- The root app is a fresh Next.js App Router command-center experience with prompt entry, structured setup, worksheet preview, trust panel, export actions, and mobile workflow: passed.
- The current console UI implementation is removed or replaced without changing the public Worksheet JSON schema: passed.
- A local parseWorksheetPrompt helper maps grade, topic/type, item count, format, and difficulty hints to existing deterministic worksheet generators without fabricating content: passed.
- Stateful UI choices are reflected in URL query parameters and restored on load: passed.
- Preview, answer key, answer checking, print, JSON copy, and make-another behavior compile from canonical Worksheet JSON: passed.
- Changed UI follows the latest Vercel Web Interface Guidelines for labels, focus, semantic actions/navigation, live feedback, content handling, motion, and print/mobile layout: passed.
- Frontend tests cover prompt parsing, filter mapping, deterministic generation, format switching, answer audit/checking, URL state helpers, and make-another seed behavior: passed.
- Required validation, lint, typecheck, test, generator verification, and build commands pass: passed.

## Remaining Work

- Install or expose a local browser automation runtime if Playwright screenshot verification is required; no `chromium`, `chromium-browser`, `google-chrome`, or `playwright` binary was available.
- Resolve the host file-watch limit if hot-reload stability is needed; the webpack dev server served HTTP 200 but reported `ENOSPC` watcher warnings.

## Logs

- No `.agent/logs/017-next-command-center-frontend` bundle exists because this was not launched through `agent-runner.mjs`.
- Local preview URL: `http://127.0.0.1:4173/`.

## Branch / Worktree

- branch: current checkout
- task branch field: `agent/017-next-command-center-frontend`
- worktree: `/home/codexdev/work/codex-mega-git/worksheet-universe`
