# HTML, TeX, and LaTeX Rendering Strategy

Worksheet Universe should not choose between HTML and LaTeX as competing sources of truth. The source is validated worksheet JSON. Renderers compile that JSON into different output targets.

Recommended split:

```text
validated worksheet JSON
  -> HTML/CSS renderer with TeX math islands
  -> browser print/PDF via print CSS
  -> LaTeX renderer for .tex export
  -> optional external PDF compiler later
```

This gives the web app layout control, accessible editing, and print preview while preserving high-quality math notation and a future `.tex` export.

## Why Not Full LaTeX In HTML?

There is no native whole-page "LaTeX for HTML" syntax that provides layout, forms, interactions, print controls, and accessibility in the browser. The practical approach is:

- HTML for document structure, controls, semantic sections, and editable preview.
- CSS for screen layout, print layout, page breaks, large print, and black-and-white modes.
- TeX syntax for math fragments, rendered by KaTeX or MathJax.
- LaTeX as an export target generated from the same worksheet JSON.

The app should never store arbitrary raw TeX as the only representation of a question. Store structured math data and a TeX display string when helpful.

## Content Blocks

Question prompts should become structured blocks:

```json
[
  { "kind": "text", "value": "Solve " },
  { "kind": "math", "tex": "\\frac{1}{2} + \\frac{1}{4}", "alt": "one half plus one fourth" },
  { "kind": "text", "value": "." }
]
```

Common block types:

- `text`: escaped plain text.
- `math`: TeX string plus optional structured operands and accessible alt text.
- `table`: rows, columns, captions, and header metadata.
- `visual`: data for diagrams, number lines, fraction bars, graph placeholders, or future SVG/TikZ.
- `answerBox`: expected response type, width, height, and label.
- `choices`: multiple-choice options with stable ids.
- `workspace`: ruled area, grid area, or blank space.
- `solutionStep`: teacher-facing worked-solution step.

## HTML Renderer

The HTML renderer converts blocks into semantic markup:

```html
<p>
  <span>Solve </span>
  <span class="math" data-tex="\\frac{1}{2} + \\frac{1}{4}">...</span>
  <span>.</span>
</p>
```

Math rendering options:

- KaTeX: fast, small, good for most K-12 notation.
- MathJax: broader TeX/MathML coverage, heavier runtime.
- MathML: semantic native output where browser support and authoring quality are enough.

V1 should prefer KaTeX for speed if a dependency is acceptable later. Until then, the current static app can keep text math for generated prompts and reserve the block format for the next renderer layer.

HTML renderer invariants:

- Escape all user/teacher text.
- Do not use raw HTML from generated content.
- Keep answer keys out of student mode unless explicitly requested.
- Render math from structured display fields, not from arbitrary prompt strings.
- Preserve `aria-label` or readable fallback for math and visuals.

## Print CSS Renderer

Print behavior should remain CSS over the same HTML content:

- `@media print` hides controls and digital-only feedback.
- Name/date fields stay visible on student pages.
- Questions use `break-inside: avoid`.
- Format families can choose one-column, two-column, compact, large-print, or one-question-per-page layouts.
- Letter and A4 should be represented as options in the print model.

Browser print-to-PDF remains the practical v1 PDF path.

## LaTeX Export

LaTeX is a separate renderer:

```js
exportLatex(worksheetJson, options) -> string
```

The renderer should produce `.tex`, not compile PDF in the static app. Later, a CLI/server worker can compile with `xelatex`, `lualatex`, or `tectonic`.

Options:

```ts
type LatexExportOptions = {
  pageSize: "letter" | "a4";
  fontSize: "10pt" | "11pt" | "12pt" | "14pt";
  layout: "one-column" | "two-column" | "one-question-per-page";
  includeAnswerKey: boolean;
  includeWorkedSolutions: boolean;
  largePrint: boolean;
  blackAndWhite: boolean;
  showLearningGoals: boolean;
};
```

Macro surface:

```latex
\WUHeader{Title}{Strand / Grade / Format}
\WUDirections{Directions text}
\begin{WUQuestions} ... \end{WUQuestions}
\WUAnswerBox[width]{height}
\begin{WUChoices} ... \WUChoice{Choice text} ... \end{WUChoices}
\begin{WUWorkedSolution} ... \end{WUWorkedSolution}
\WUDataTable{Caption}{tabular body}
\WUGraphPlaceholder{Label}{Width}{Height}
\WUAnswerKeyHeader{Title}
\WUKeyItem{number}{answer}{solution notes}
```

Starter template:

```latex
\documentclass[11pt]{article}
\usepackage[letterpaper,margin=0.65in]{geometry}
\usepackage{amsmath,amssymb,array,multicol,enumitem}

\newif\ifWUAnswers
\newif\ifWUSolutions
\WUAnswersfalse
\WUSolutionstrue

\newcommand{\WUHeader}[2]{%
  \noindent
  \begin{tabular*}{\textwidth}{@{\extracolsep{\fill}}ll}
    {\Large\bfseries #1} & Name:\ \rule{1.7in}{0.4pt} \\
    #2 & Date:\ \rule{1.7in}{0.4pt}
  \end{tabular*}
  \par\vspace{0.35in}
}

\newcommand{\WUDirections}[1]{%
  \noindent\textbf{Directions.} #1\par\vspace{0.15in}
}

\newenvironment{WUQuestions}{%
  \begin{enumerate}[leftmargin=*,label=\textbf{\arabic*.}]
}{%
  \end{enumerate}
}

\newcommand{\WUAnswerBox}[2][1.5in]{%
  \fbox{\rule{0pt}{#2}\hspace{#1}}
}

\newenvironment{WUChoices}{%
  \begin{enumerate}[label=$\bigcirc$ \Alph*.,leftmargin=2.5em]
}{%
  \end{enumerate}
}
\newcommand{\WUChoice}[1]{\item #1}

\newenvironment{WUWorkedSolution}{%
  \ifWUSolutions
  \par\vspace{0.1in}\noindent\textbf{Solution notes}\par
  \begin{enumerate}[leftmargin=*]
}{%
  \end{enumerate}
  \fi
}

\newcommand{\WUDataTable}[2]{%
  \par\noindent\textbf{#1}\par\vspace{0.05in}
  \begin{center}#2\end{center}
}

\newcommand{\WUGraphPlaceholder}[3]{%
  \par\noindent\textbf{#1}\par
  \fbox{\rule{0pt}{#3}\hspace{#2}}\par
}

\newcommand{\WUAnswerKeyHeader}[1]{%
  \clearpage
  \section*{Answer Key: #1}
}

\newcommand{\WUKeyItem}[3]{%
  \noindent\textbf{#1.} #2\par
  {\small #3}\par\vspace{0.08in}
}
```

## JSON To Target Mapping

| Block or question type | HTML output | LaTeX output |
|---|---|---|
| `text` | escaped text node | TeX-escaped text |
| `math` | KaTeX/MathJax/MathML island | raw trusted math TeX |
| `numeric`, `decimal`, `money`, `percent` | prompt + answer input/box | prompt + `\WUAnswerBox` |
| `fraction` | math island or fraction visual | `\frac{a}{b}` where parseable |
| `coordinate` | text/math coordinate | math `(x, y)` |
| `multipleChoice` | radio-like choices | `WUChoices` |
| `table` | semantic table | `WUDataTable` |
| `graph` or `visual` | SVG/CSS/placeholder | `WUGraphPlaceholder`, later TikZ |
| `steps` | details/teacher page | teacher key or `WUWorkedSolution` |

## Validation And Tests

Renderer tests should cover:

- Escaping of `# $ % & _ { } ~ ^ \` in text.
- Deterministic output for fixed JSON/options.
- Student mode does not leak answer-key values.
- Teacher key item count matches student questions.
- All six current format families render.
- Math blocks render in both HTML and LaTeX outputs.
- Table and graph placeholders survive both outputs.

## Implementation Path

1. Add canonical worksheet schema and fixtures.
2. Add `src/renderers/blocks` or `src/renderers/print-model` to normalize worksheet JSON into content blocks.
3. Add an HTML renderer that emits math islands without requiring a math library at first.
4. Add a LaTeX renderer with escaping and snapshot tests.
5. Add KaTeX or MathJax only when the app has a package/build step.
6. Add optional `.tex` download after JSON validation and answer-key audit pass.
