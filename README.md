# Worksheet Universe

Worksheet Universe is now a math-only teacher worksheet library for generated HTML worksheets.

The current milestone gives teachers a clean static front end for choosing an exact grade,
searching math skills, selecting worksheet formats, generating sample worksheet instances,
auditing each answer key with deterministic solvers, and printing the same HTML as paper
worksheets.

## Run locally

Open `index.html` in a browser. No install or build step is required.

## Deploy on Vercel

This is a plain static site. Import the repository into Vercel with the "Other" framework preset
and leave the build command empty. The repo includes `vercel.json` for clean URLs, static security
headers, and revalidation-safe cache headers for the un-hashed `index.html`, `app.js`, and
`styles.css` files.

Do not commit `.vercel/project.json`, Vercel tokens, or environment files. Local Vercel runtime
folders and harness runtime output are excluded from deployments through `.vercelignore`.

## Agent harness

This repo includes an overnight Codex worker harness under `.agent/`.
The harness is for future worksheet-compiler work, not for launching unrelated product features.

Useful commands:

```bash
node scripts/agent-doctor.mjs
node scripts/agent-validate.mjs
node scripts/agent-selftest.mjs
node scripts/agent-summary.mjs
node scripts/agent-runner.mjs --list
node scripts/agent-runner.mjs --next --dry-run
```

Read `.agent/README.md` before launching long-running workers.

## Verify generators

Run:

```bash
node scripts/verify-generators.js
```

The verifier generates one worksheet for every math worksheet type, re-solves every answer key,
then enters each answer through the self-checking path. It fails if any generated answer key or
self-check result is invalid.

## What is here

- `index.html` - single page teacher worksheet library
- `styles.css` - app styling, digital worksheet states, and print layout
- `app.js` - math taxonomy, generator functions, answer solvers, self-checking UI logic
- `scripts/verify-generators.js` - generator and self-check verification
- `research/source-scan.md` - original notes from Math-Drills, K5 Learning, Twinkl, and adjacent sources

## Current focus

- Math-only worksheet types searchable by exact grade, grade band, topic strand, and format
- HTML format families for printable and digital worksheets
- Deterministic answer-key auditing before rendering
- Student self-checking inputs with feedback and score state
- Step-by-step solution metadata and generated step notes where supported
