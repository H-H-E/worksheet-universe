import type {
  AnswerNormalization,
  ContentBlock,
  Worksheet,
  WorksheetAnswerKeyItem,
  WorksheetFormat,
  WorksheetQuestion,
  WorksheetQuestionType,
  WorksheetStandardRef
} from "@/types/worksheet";

import type { GradeBandId, Strand, WorksheetType } from "./catalog";
import { buildItem, createRng, hashString, solveItem, type GeneratedItem } from "./item-factory";

export interface WorksheetSettings {
  itemCount: number;
  seed: number;
  format: WorksheetFormat;
}

export interface AuditResult {
  ok: boolean;
  checked: number;
  failed: Array<{
    id: string;
    expected: string;
    solved: string;
  }>;
}

export type AnswerStatus = "unanswered" | "correct" | "incorrect";

export interface CheckAnswerResult {
  status: AnswerStatus;
  expectedAnswer: string;
  normalizedInput: string;
  notes: string;
}

interface GeneratedCanonical {
  generatedKind?: string;
  generatedFormat?: string;
  data?: Record<string, unknown>;
  feedback?: string;
  visual?: unknown;
  solved?: string | number;
}

export function generateWorksheet(type: WorksheetType, settings: WorksheetSettings): Worksheet {
  const itemCount = clamp(settings.itemCount, 3, 12);
  const rng = createRng(settings.seed + Math.abs(hashString(type.id)));
  const generatedItems = Array.from({ length: itemCount }, (_, index) => buildItem(type, index, rng));
  const generatorLineage = {
    id: type.id,
    version: "1.0.0",
    seed: String(settings.seed),
    variant: settings.format
  };

  const questions: WorksheetQuestion[] = generatedItems.map((item) => {
    const answerRef = item.id;
    return {
      id: item.id,
      type: questionTypeForItem(item),
      prompt: item.prompt,
      content: contentForItem(item, settings.format),
      answerRef,
      metadata: {
        difficulty: difficultyForType(type),
        skills: [slug(type.strand), type.generatorKind, settings.format],
        generator: {
          ...generatorLineage,
          seed: `${settings.seed}:${item.number}`
        }
      }
    };
  });

  const answerKey: WorksheetAnswerKeyItem[] = generatedItems.map((item) => ({
    id: `a${item.number}`,
    questionId: item.id,
    answer: {
      kind: normalizationForItem(item),
      value: item.answerKey.value,
      canonical: {
        generatedKind: item.kind,
        generatedFormat: item.format,
        data: item.data,
        feedback: item.feedback,
        visual: item.visual,
        solved: solveItem({ kind: item.kind, data: item.data })
      }
    },
    normalization: normalizationForItem(item),
    alternates: item.answerKey.alternates,
    tolerance: item.answerKey.tolerance,
    workedSolution: item.steps.map((step) => ({ text: step }))
  }));

  return {
    schemaVersion: "1.0.0",
    id: `${type.id}-${settings.seed}`,
    title: type.title,
    subject: "math",
    gradeBand: formatGrades(type.grades),
    topic: type.strand,
    learningGoals: [
      `Practice ${type.title}.`,
      type.solution.method
    ],
    instructions: formatDirections(settings.format),
    sections: [
      {
        id: "practice",
        title: formatTitle(settings.format),
        instructions: formatDirections(settings.format),
        questions
      }
    ],
    answerKey,
    metadata: {
      createdAt: "2026-06-02T00:00:00Z",
      generator: generatorLineage,
      format: settings.format,
      standards: standardsForType(type),
      versioning: {
        schemaVersion: "1.0.0",
        contentVersion: "1.0.0",
        migration: {
          strategy: "none",
          notes: []
        }
      }
    }
  };
}

export function auditWorksheet(worksheet: Worksheet): AuditResult {
  const failed: AuditResult["failed"] = [];

  for (const entry of worksheet.answerKey) {
    const canonical = entry.answer.canonical as GeneratedCanonical | undefined;
    const solved = canonical?.generatedKind && canonical.data
      ? String(solveItem({ kind: canonical.generatedKind, data: canonical.data }))
      : entry.answer.value;

    if (!equivalentAnswer(solved, entry.answer.value, entry)) {
      failed.push({
        id: entry.questionId,
        expected: entry.answer.value,
        solved
      });
    }
  }

  return {
    ok: failed.length === 0,
    checked: worksheet.answerKey.length,
    failed
  };
}

export function checkAnswer(input: string, answerKeyItem: WorksheetAnswerKeyItem): CheckAnswerResult {
  const normalizedInput = normalizeByKind(input, answerKeyItem.normalization);
  if (!input.trim()) {
    return {
      status: "unanswered",
      expectedAnswer: answerKeyItem.answer.value,
      normalizedInput,
      notes: "Enter an answer before checking."
    };
  }

  const candidates = [answerKeyItem.answer.value, ...(answerKeyItem.alternates || [])];
  const correct = candidates.some((candidate) => equivalentAnswer(input, candidate, answerKeyItem));

  return {
    status: correct ? "correct" : "incorrect",
    expectedAnswer: answerKeyItem.answer.value,
    normalizedInput,
    notes: correct ? "Correct." : feedbackForAnswer(answerKeyItem)
  };
}

export function answerForQuestion(worksheet: Worksheet, question: WorksheetQuestion) {
  return worksheet.answerKey.find((entry) => entry.questionId === question.answerRef);
}

export function formatGrades(grades: readonly string[]) {
  return grades.map((grade) => grade === "0" ? "Pre-K" : grade).join(", ");
}

export function formatTitle(format: WorksheetFormat) {
  const titles: Record<WorksheetFormat, string> = {
    "fluency-grid": "Fluency Grid",
    "worked-practice": "Worked Practice",
    "visual-model": "Visual Model",
    "quick-check": "Quick Check",
    "real-world": "Real-World Task",
    "graph-data": "Graph and Data"
  };
  return titles[format];
}

export function formatDirections(format: WorksheetFormat) {
  const directions: Record<WorksheetFormat, string> = {
    "fluency-grid": "Solve each item neatly. Use the answer boxes for quick fluency practice.",
    "worked-practice": "Show your work for each item. Use the step notes after checking your answer.",
    "visual-model": "Use the model, diagram, or representation before entering an answer.",
    "graph-data": "Read the table, graph, coordinates, or data display carefully before solving.",
    "real-world": "Track the quantities in the situation, then label each answer with units.",
    "quick-check": "Answer each item, check your work, and use feedback to retry."
  };
  return directions[format];
}

function contentForItem(item: GeneratedItem, format: WorksheetFormat): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  if (item.visual?.kind === "dots") {
    blocks.push({
      kind: "visual",
      visualType: "dots",
      data: { count: item.visual.count },
      alt: `${item.visual.count} dots.`
    });
  } else if (item.visual?.kind === "fractionBar") {
    blocks.push({
      kind: "visual",
      visualType: "fractionBar",
      data: { numerator: item.visual.numerator, denominator: item.visual.denominator },
      alt: `${item.visual.numerator} of ${item.visual.denominator} equal parts shaded.`
    });
  } else {
    blocks.push({ kind: "text", text: item.prompt });
  }

  blocks.push({
    kind: "workspace",
    style: workspaceStyleForFormat(format),
    height: format === "quick-check" || format === "fluency-grid" ? "0.35in" : "0.8in"
  });

  blocks.push({
    kind: "answerBox",
    answerRef: item.id,
    label: "answer",
    width: item.format === "coordinate" ? "9rem" : "6rem"
  });

  return blocks;
}

function questionTypeForItem(item: GeneratedItem): WorksheetQuestionType {
  if (item.kind === "algebra") return "equation";
  if (item.format === "numeric") return "numeric";
  if (item.format === "text") return "shortText";
  return item.format;
}

function normalizationForItem(item: GeneratedItem): AnswerNormalization {
  if (item.format === "numeric") return "number";
  if (item.format === "text") return "text";
  return item.format;
}

function workspaceStyleForFormat(format: WorksheetFormat): "blank" | "ruled" | "grid" | "largePrint" {
  if (format === "graph-data") return "grid";
  if (format === "visual-model") return "largePrint";
  if (format === "worked-practice" || format === "real-world") return "ruled";
  return "blank";
}

function difficultyForType(type: WorksheetType) {
  const gradeNumbers = type.grades.map((grade) => grade === "K" ? 0 : Number(grade)).filter(Number.isFinite);
  const highest = Math.max(...gradeNumbers, 1);
  return {
    band: highest <= 2 ? "intro" : highest <= 5 ? "core" : highest <= 8 ? "application" : "extension",
    level: Math.min(5, Math.max(1, Math.ceil(highest / 3)))
  } as const;
}

function standardsForType(type: WorksheetType): WorksheetStandardRef[] {
  return type.grades.slice(0, 3).map((grade, index) => ({
    framework: "local",
    code: `${grade}.${slug(type.strand)}.${slug(type.title)}`.slice(0, 64),
    alignment: index === 0 ? "primary" : "supporting"
  }));
}

function equivalentAnswer(left: string | number, right: string | number, answerKey: WorksheetAnswerKeyItem) {
  if (answerKey.normalization === "fraction") return sameFraction(left, right);
  if (answerKey.normalization === "coordinate") return normalizeCoordinate(left) === normalizeCoordinate(right);
  if (["number", "integer", "decimal", "money", "percent"].includes(answerKey.normalization)) {
    const a = Number(String(left).replace(/[$,%]/g, ""));
    const b = Number(String(right).replace(/[$,%]/g, ""));
    if (Number.isNaN(a) || Number.isNaN(b)) return normalizeText(left) === normalizeText(right);
    return Math.abs(a - b) <= (answerKey.tolerance || 0);
  }
  return normalizeText(left) === normalizeText(right);
}

function sameFraction(left: string | number, right: string | number) {
  const a = parseFraction(left);
  const b = parseFraction(right);
  if (!a || !b) return normalizeText(left) === normalizeText(right);
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

function parseFraction(value: string | number) {
  const raw = String(value).trim();
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return { numerator: Number(raw), denominator: 1 };
  }
  const match = raw.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!match || Number(match[2]) === 0) return null;
  return { numerator: Number(match[1]), denominator: Number(match[2]) };
}

function normalizeByKind(value: string, kind: AnswerNormalization) {
  if (kind === "coordinate") return normalizeCoordinate(value);
  if (kind === "fraction") {
    const fraction = parseFraction(value);
    return fraction ? `${fraction.numerator}/${fraction.denominator}` : normalizeText(value);
  }
  if (["number", "integer", "decimal", "money", "percent"].includes(kind)) {
    return String(value).replace(/[$,%]/g, "").trim();
  }
  return normalizeText(value);
}

function normalizeCoordinate(value: string | number) {
  return String(value).replace(/[()\s]/g, "").toLowerCase();
}

function normalizeText(value: string | number) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function feedbackForAnswer(answerKeyItem: WorksheetAnswerKeyItem) {
  const canonical = answerKeyItem.answer.canonical as GeneratedCanonical | undefined;
  return canonical?.feedback || "Check the operation, units, and answer format.";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function gradeBandForStrand(strand: Strand, gradeBand: GradeBandId) {
  return `${gradeBand}:${slug(strand)}`;
}
