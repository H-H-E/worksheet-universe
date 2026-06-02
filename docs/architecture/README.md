# Architecture Artifacts

These artifacts preserve the current deployment-oriented design direction for Worksheet Universe.

- [Worksheet Type Taxonomy Registry](taxonomy-registry.md): standards-aligned grade/topic/skill/subskill metadata and coverage scoring.
- [HTML, TeX, and LaTeX Rendering Strategy](html-tex-rendering.md): HTML/CSS layout, TeX math islands, browser print, and `.tex` export from the same worksheet JSON.
- [Deterministic Question Generator Architecture](deterministic-generators.md): coherent-by-construction math generators with seeded variables, derived answers, worked solutions, and verification.

The shared rule across all three: worksheet JSON is the source of truth. UI cards, editable preview, print HTML, LaTeX export, answer checking, and tests should compile from validated worksheet JSON rather than parallel content systems.
