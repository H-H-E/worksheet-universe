import type { WorksheetFormat } from "@/types/worksheet";

import { exactGrades, formatFamilies, type ExactGradeId, type Strand, type WorksheetType } from "../catalog";
import type { DifficultyTarget, ParsedPrompt } from "./types";

const formatHints: Record<WorksheetFormat, string[]> = {
  "fluency-grid": ["fluency", "drill", "facts", "grid", "practice"],
  "worked-practice": ["worked", "show work", "step", "steps", "practice"],
  "visual-model": ["visual", "model", "diagram", "bar", "fraction bar", "picture"],
  "quick-check": ["quick", "exit ticket", "check", "quiz", "bell ringer"],
  "real-world": ["word problem", "word problems", "real world", "story", "scenario"],
  "graph-data": ["graph", "data", "table", "coordinate", "statistics"]
};

const strandHints: Record<Strand, string[]> = {
  "Number Sense": ["number sense", "counting", "place value", "rounding", "compare numbers"],
  "Operations and Fluency": ["addition", "subtraction", "multiplication", "division", "operations", "fluency", "facts"],
  "Fractions, Decimals, and Percents": ["fraction", "fractions", "decimal", "decimals", "percent", "percents"],
  "Ratios and Proportional Reasoning": ["ratio", "ratios", "proportion", "proportional", "rate"],
  "Algebra and Functions": ["algebra", "equation", "equations", "function", "functions", "variable"],
  "Geometry and Spatial Reasoning": ["geometry", "shape", "shapes", "angle", "angles", "area", "perimeter"],
  Measurement: ["measurement", "measure", "length", "time", "unit", "units"],
  "Data, Statistics, and Probability": ["data", "statistics", "probability", "graph", "graphs", "mean", "median"],
  "Financial and Consumer Math": ["money", "finance", "financial", "budget", "consumer", "shopping"],
  "Word Problems and Mathematical Reasoning": ["word problem", "word problems", "reasoning", "explain", "real world"],
  "Math Puzzles, Logic, and Enrichment": ["puzzle", "logic", "challenge", "enrichment", "pattern"]
};

const difficultyHints: Record<DifficultyTarget, string[]> = {
  readiness: ["easy", "intro", "readiness", "beginner", "low text", "iep"],
  core: ["medium", "core", "standard", "normal", "practice"],
  challenge: ["hard", "challenge", "extension", "advanced", "diagnostic"]
};

export function parseWorksheetPrompt(prompt: string, types: readonly WorksheetType[]): ParsedPrompt {
  const normalized = normalize(prompt);
  const matchedTerms: string[] = [];

  const exactGrade = findGrade(normalized, matchedTerms);
  const itemCount = findItemCount(normalized, matchedTerms);
  const format = findByHints(formatHints, normalized, matchedTerms)
    || findFormatByCatalog(normalized, matchedTerms);
  const difficulty = findByHints(difficultyHints, normalized, matchedTerms);
  const strand = findByHints(strandHints, normalized, matchedTerms);
  const worksheetTypeId = findWorksheetType(normalized, types, exactGrade, strand, format, matchedTerms);

  const remainingText = matchedTerms
    .reduce((text, term) => text.replaceAll(term.toLowerCase(), " "), normalized)
    .replace(/\s+/g, " ")
    .trim();

  const confidence = [
    exactGrade,
    itemCount,
    format,
    difficulty,
    strand,
    worksheetTypeId
  ].filter(Boolean).length / 6;

  return {
    exactGrade,
    strand,
    worksheetTypeId,
    format,
    itemCount,
    difficulty,
    matchedTerms: [...new Set(matchedTerms)],
    remainingText,
    confidence: Number(confidence.toFixed(2))
  };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[.,;:!?()[\]{}"]/g, " ").replace(/\s+/g, " ").trim();
}

function findGrade(value: string, matchedTerms: string[]): ExactGradeId | undefined {
  if (/\b(pre k|pre-k|prek|pre kindergarten)\b/.test(value)) {
    matchedTerms.push("pre k");
    return "0";
  }

  if (/\b(kindergarten|grade k|kinder)\b/.test(value)) {
    matchedTerms.push("kindergarten");
    return "K";
  }

  const gradeMatch = value.match(/\b(?:grade|gr|year)\s*(\d{1,2}|k)\b/);
  if (!gradeMatch) return undefined;

  const rawGrade = gradeMatch[1].toUpperCase();
  const exactGrade = exactGrades.find((grade) => grade.id === rawGrade)?.id;
  if (exactGrade) matchedTerms.push(gradeMatch[0]);
  return exactGrade;
}

function findItemCount(value: string, matchedTerms: string[]) {
  const countMatch = value.match(/\b(\d{1,2})\s*(?:questions|problems|items|prompts)\b/);
  if (!countMatch) return undefined;
  matchedTerms.push(countMatch[0]);
  return clamp(Number(countMatch[1]), 3, 12);
}

function findFormatByCatalog(value: string, matchedTerms: string[]): WorksheetFormat | undefined {
  const match = formatFamilies.find((format) => value.includes(format.title.toLowerCase()));
  if (match) matchedTerms.push(match.title.toLowerCase());
  return match?.id;
}

function findByHints<T extends string>(hints: Record<T, string[]>, value: string, matchedTerms: string[]): T | undefined {
  let best: { id: T; term: string } | undefined;
  for (const [id, terms] of Object.entries(hints) as Array<[T, string[]]>) {
    const matched = terms.find((term) => hasTerm(value, term));
    if (matched && matched.length > (best?.term.length || 0)) {
      best = { id, term: matched };
    }
  }
  if (best) matchedTerms.push(best.term);
  return best?.id;
}

function findWorksheetType(
  value: string,
  types: readonly WorksheetType[],
  exactGrade: ExactGradeId | undefined,
  strand: Strand | undefined,
  format: WorksheetFormat | undefined,
  matchedTerms: string[]
) {
  let best: { type: WorksheetType; score: number; term?: string } | undefined;

  for (const type of types) {
    let score = 0;
    let term: string | undefined;
    const title = type.title.toLowerCase();
    if (value.includes(title)) {
      score += 20;
      term = title;
    }

    for (const token of title.split(/\s+/).filter((item) => item.length > 3)) {
      if (hasTerm(value, token)) score += 2;
    }

    if (exactGrade && type.grades.includes(exactGrade)) score += 2;
    if (strand && type.strand === strand) score += 4;
    if (format && type.formats.includes(format)) score += 2;
    if (type.summary.toLowerCase().split(/\s+/).some((token) => token.length > 5 && hasTerm(value, token))) score += 1;

    if (score > (best?.score || 0)) best = { type, score, term };
  }

  if (!best || best.score < 5) return undefined;
  if (best.term) matchedTerms.push(best.term);
  return best.type.id;
}

function hasTerm(value: string, term: string) {
  return value.includes(term.toLowerCase());
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
