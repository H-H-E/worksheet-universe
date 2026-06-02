# Testing

Worksheet Universe now uses package-based checks for the Next.js frontend and the JSON-first worksheet compiler path.

## Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:generators
npm run build
```

- `npm run lint`: runs ESLint with the Next.js config.
- `npm run typecheck`: runs TypeScript without emitting files.
- `npm run test`: runs Node's test runner through `tsx` for frontend/core workflow tests.
- `npm run test:generators`: generates every worksheet type, validates canonical worksheet JSON, audits generated answers, and self-checks answer keys.
- `npm run build`: compiles the Next.js app for deployment.
- `npm run start`: serves the exported `out/` directory after a successful build.

Fixture validation remains available as:

```bash
node tests/fixtures/validate-fixtures.mjs
```

The old static `index.html`/`styles.css`/`app.js` harness has been retired. Preview, print, checking, and answer-key audit now compile from canonical worksheet JSON.
