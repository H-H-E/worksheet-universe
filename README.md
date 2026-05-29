# Worksheet Universe

Worksheet Universe is a source-backed planning prototype for a K-12 worksheet generator.

The first milestone is not to copy worksheets from other sites. It is to study public category
structures, extract generator ideas, and build an original taxonomy that can drive our own
worksheet engine.

## Run locally

Open `index.html` in a browser. No install or build step is required.

## What is here

- `index.html` - single page worksheet atlas prototype
- `styles.css` - app styling and print layout
- `app.js` - source scan data, worksheet type taxonomy, and filtering logic
- `research/source-scan.md` - notes from Math-Drills, K5 Learning, Twinkl, and adjacent worksheet sources

## Current focus

- Math-Drills: deep parameter ideas such as item count, digit count, regrouping, large print,
  fillable/savable sheets, left-handed variants, separators, timed fluency, and manipulatives.
- K5 Learning: clean elementary grade paths and topic sequencing.
- Twinkl: broad subject/audience coverage, standards filters, and resource-type variety.

## Product direction

Build a generator that combines:

- grade band
- subject domain
- worksheet format
- parameter controls
- accessibility/accommodation settings
- answer key and teacher notes
- printable and digital modes

