# Worksheet Source Scan

Date: 2026-05-29

Goal: collect public category and feature signals from worksheet sites so Worksheet Universe
can build an original generator taxonomy. This is not a content-copying project. We only use
public navigation patterns, topic coverage, and generator mechanics as market research.

## Named sources from the user

### Math-Drills

Source: https://math-drills.com/

Observed signals:

- The homepage says Math-Drills has over 70,000 free math worksheets.
- It covers number sense, arithmetic, pre-algebra, geometry, measurement, money concepts,
  and related math areas.
- The homepage highlights two interactive features: math flash cards and a dots math game.
- The footer/category navigation exposes: addition, subtraction, multiplication facts,
  long multiplication, division, mixed operations, algebra, base-ten blocks, decimals,
  fact families, fractions, geometry, graph paper, integers, measurement, money, number lines,
  number sense, order of operations, patterning, percentages, place value, powers of ten,
  statistics, time, word problems, seasonal worksheets, flash cards, and games.

High-value mechanics to improve on:

- Granular controls: digit count, item count, number range, regrouping level, orientation,
  large-print mode, fillable/savable mode, and answer keys.
- Accessibility-like variants: large print, left-handed variants, grid support, and clear
  uncluttered formats.
- Localization-like variants: comma, space, and period thousands separators.
- Fluency variants: timed facts, target facts, individual fact focus, and multiple questions
  per page.
- Manipulative variants: base-ten blocks, fraction circles, fraction strips, number lines,
  graph paper, and printable supports.

### K5 Learning

Source: https://www.k5learning.com/free-math-worksheets

Observed signals:

- K5 offers free math worksheets by grade from kindergarten through grade 6.
- The math landing page organizes topics into numbers, fractions and decimals, measurement,
  four operations, geometry, exponents, proportions, percents, integers, algebra, and word
  problems.
- K5 states that math worksheets are printable and include answers on the second page.
- Grade 1 topics include number charts/counting, number patterns, comparing numbers,
  base-ten blocks, place value, addition, subtraction, fractions, measurement, counting
  money, telling time, geometry, data/graphing, and word problems.
- Grade 6 topics include place value/scientific notation, four operations, fractions,
  decimals, percents, measurement, geometry, factoring, exponents, proportions, and integers.

High-value mechanics to improve on:

- K5 has a very clean grade pathway. We should preserve that simplicity.
- Improve breadth beyond K-6 math by extending to grades 0-12 and more subjects.
- Improve control depth by letting teachers tune the worksheet instead of choosing only a
  fixed printable.
- Add teacher-facing metadata: standards, misconceptions, accommodations, answer explanations,
  and extension tasks.

### Twinkl

Source: https://www.twinkl.com/resources/usa-resources

Observed signals:

- Twinkl's USA resources page spans early childhood, prekindergarten, kindergarten, grades
  1-8, homeschool, special education, ELL, world languages, standards, and other audiences.
- Repeated math categories include assessment, addition/subtraction, counting/cardinality,
  fractions/decimals/percentages, geometry, math games, measurement/data, multiplication/
  division, operations/algebraic thinking, place value, problem of the day, visual aids,
  and word problems.
- Repeated ELA categories include assessment, language, reading, speaking/listening,
  study skills, visual aids, writing, phonics, sight words, and spelling.
- Science categories include earth and space science, life science, physical science,
  scientific practices, and assessment.
- Social studies categories include civics/government, countries, culture/diversity,
  economics/finance, geography/environment, history, states/capitals, and assessment.
- Additional areas include art, health education, holidays/events, music, PE, SEL, STEAM,
  technology, classroom management, family communication, labels, routines, awards,
  record keeping, and test prep.

High-value mechanics to improve on:

- Twinkl has strong breadth and audience segmentation. We should model that breadth.
- Improve by making resources dynamically generated from teacher inputs, standards, or
  uploaded word lists/passages.
- Add reusable transformations: one topic can become worksheet, task cards, bingo, exit
  ticket, slide warmup, rubric, or quiz.
- Add transparent generation controls and print/digital parity.

## Adjacent sources scanned for broader taxonomy

- Math-Aids: https://www.math-aids.com/
- WorksheetWorks: https://www.worksheetworks.com/
- DadsWorksheets: https://www.dadsworksheets.com/worksheets.html
- Easy Teacher Worksheets: https://www.easyteacherworksheets.com/
- Super Teacher Worksheets: https://www.superteacherworksheets.com/
- K12 Reader: https://www.k12reader.com/reading-worksheets-by-main-subject/
- EnglishLinx: https://englishlinx.com/
- Scholastic Teachables: https://teachables.scholastic.com/
- Canva worksheet maker: https://www.canva.com/create/worksheets/
- Tools for Educators: https://www.toolsforeducators.com/
- WordMint: https://wordmint.com/
- Discovery Education Puzzlemaker reference: https://otan.us/Resources/TeachingWithTechnology/ResourceDetails/536
- NGSS standards search: https://www.nextgenscience.org/standards
- C3 Framework reference: https://www.socialstudies.org/sites/default/files/c3/c3-framework-for-social-studies-rev0617.pdf
- National Core Arts Standards: https://nationalartsstandards.org/

## Product taxonomy layers

The generator should not store a flat list only. It should combine these layers:

1. Grade band: pre-K, K, 1-2, 3-5, 6-8, 9-12, adult/remedial.
2. Subject domain: math, ELA, science, social studies, SEL, world language, special education,
   arts, health, PE, technology, financial literacy, classroom tools.
3. Worksheet format: drill, matching, cloze, short answer, multiple choice, graphic organizer,
   lab sheet, CER, map, timeline, puzzle, task card, flashcard, bingo, exit ticket, rubric,
   reflection, project planner.
4. Generator controls: item count, difficulty, reading level, standards, supports, layout,
   answer key, teacher notes, accommodations, language, theme, and print density.
5. Validation: answer correctness, age appropriateness, copyright safety, content safety,
   bias/culture check, and accessibility check.

## Early improvement backlog

1. Build Math-Drills-level controls for all subjects, not only arithmetic.
2. Add K5-style grade navigation for every subject from grade 0-12.
3. Add Twinkl-style audience filters: ELL, special education, homeschool, intervention,
   gifted, teacher, parent, counselor.
4. Generate multiple output types from one input: worksheet, quiz, task cards, flashcards,
   puzzle, exit ticket, lesson warmup, and answer key.
5. Include accessibility toggles: large print, dyslexia-friendly spacing, low ink, plain
   language, visual supports, left-handed layout, uncluttered layout.
6. Include teacher diagnostics: misconception tags, reteach grouping, progress-monitoring,
   IEP probes, and standards reports.
7. Support math-specific parameter depth: digit count, number range, regrouping, separator,
   orientation, grid support, manipulatives, timed fluency, and strategy hints.
8. Support ELA-specific parameter depth: passage length, reading level, vocabulary tier,
   decodability, question depth, evidence requirement, genre, and writing scaffold.
9. Support science/social studies inquiry sheets: source analysis, data interpretation,
   CER, lab planning, map skills, timelines, and civic action.
10. Keep all generated content original, source-safe, and teacher-editable.

