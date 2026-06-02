# Testing

Worksheet Universe currently uses dependency-free Node checks. There is no framework build step yet; the scripts below keep the static app and worksheet JSON contract deployable while later tasks add richer modules.

## Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

What they do:

- `npm run lint`: parses repo JSON files, checks JavaScript module syntax, and confirms local Vercel project metadata is not required.
- `npm run typecheck`: compares the worksheet question enum in `src/schema/worksheet.schema.json` with `src/types/worksheet.d.ts`.
- `npm run test`: runs harness validation, fixture validation, and generator verification.
- `npm run build`: performs a static deploy sanity check for `index.html`, `styles.css`, `app.js`, `vercel.json`, JavaScript syntax, and fixture validation.

## Static Deploy Note

The Vercel deployment target remains a plain static site. Import with the "Other" preset and leave the Vercel build command empty unless a later task introduces an actual output directory. The npm `build` script is a validation gate, not a bundler.
