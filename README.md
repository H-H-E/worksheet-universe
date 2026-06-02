# Worksheet Universe

Worksheet Universe is a JSON-first teacher worksheet console for generated K-12 math practice.

The app now runs as a Next.js App Router frontend with TypeScript, Tailwind CSS, and source-owned shadcn/ui components. Teachers can search worksheet generators, filter by exact grade/strand/format, generate deterministic worksheet JSON, preview printable student pages, check answers, audit answer keys, and copy canonical worksheet JSON.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

To preview the static export locally:

```bash
npm run build
npm run start
```

## Checks

```bash
node scripts/agent-validate.mjs
node tests/fixtures/validate-fixtures.mjs
npm run lint
npm run typecheck
npm run test
npm run test:generators
npm run build
```

`npm run test:generators` verifies every worksheet type by generating canonical `Worksheet` JSON, validating the answer audit, and self-checking each generated answer.

## Deploy on Vercel

Import the repository into Vercel as a Next.js project. Vercel detects the framework from `package.json`; no custom build command or secrets are required.

Do not commit `.vercel/project.json`, Vercel tokens, environment files, `node_modules`, or `.next`.

## What is here

- `src/app` - Next App Router entry, global theme, and page shell
- `src/components/ui` - source-owned shadcn/ui primitives
- `src/features/worksheet` - worksheet catalog, deterministic generation, filtering, audit, checking, and teacher console UI
- `src/schema` and `src/types` - canonical worksheet JSON contract
- `scripts/verify-generators.ts` - all-generator canonical JSON verification
- `tests/frontend` - workflow tests for filtering, generation, format switching, and answer checking

## Product rules

Worksheet JSON is the source of truth between generation, editing, rendering, answer keys, and exports. The frontend preview and print surface compile from canonical worksheet JSON rather than from a parallel content system.
