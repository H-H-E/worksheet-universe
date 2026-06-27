import type { WorksheetFormat } from "@/types/worksheet";

import {
  formatFamilies,
  strands,
  worksheetTypes,
  type ExactGradeId,
  type Strand,
  type WorksheetType
} from "../catalog";
import type { CommandCenterIntent, CommandPanel, DifficultyTarget, PageSize } from "./types";

const fallbackType = worksheetTypes.find((type) => type.id === "fraction-models-and-manipulatives") || worksheetTypes[0];

export function defaultCommandCenterIntent(types: readonly WorksheetType[] = worksheetTypes): CommandCenterIntent {
  const type = types.find((item) => item.id === fallbackType.id) || types[0];
  const format = type.formats.includes("visual-model") ? "visual-model" : type.formats[0];

  return {
    prompt: "Make a Grade 5 fractions worksheet with visual models, 8 questions, medium difficulty, with answers.",
    skillQuery: "",
    exactGrade: type.grades.includes("5") ? "5" : type.grades[0],
    strand: type.strand,
    typeId: type.id,
    format,
    itemCount: 8,
    seed: 42,
    difficulty: "core",
    pageSize: "letter",
    activePanel: "trust"
  };
}

export function intentFromSearchParams(searchParams: URLSearchParams, types: readonly WorksheetType[] = worksheetTypes) {
  const fallback = defaultCommandCenterIntent(types);
  const typeId = safeTypeId(searchParams.get("type"), types) || fallback.typeId;
  const activeType = types.find((type) => type.id === typeId) || types[0];
  const format = safeFormat(searchParams.get("format"), activeType) || fallback.format;

  return normalizeIntent({
    prompt: searchParams.get("p") || fallback.prompt,
    skillQuery: searchParams.get("skill") || fallback.skillQuery,
    exactGrade: safeGrade(searchParams.get("grade"), activeType) || fallback.exactGrade,
    strand: safeStrand(searchParams.get("strand")) || fallback.strand,
    typeId,
    format,
    itemCount: clamp(Number(searchParams.get("count")) || fallback.itemCount, 3, 12),
    seed: Math.max(1, Number(searchParams.get("seed")) || fallback.seed),
    difficulty: safeDifficulty(searchParams.get("difficulty")) || fallback.difficulty,
    pageSize: safePageSize(searchParams.get("page")) || fallback.pageSize,
    activePanel: safePanel(searchParams.get("panel")) || fallback.activePanel
  }, types);
}

export function intentToSearchParams(intent: CommandCenterIntent, fallback = defaultCommandCenterIntent()) {
  const params = new URLSearchParams();
  setIfChanged(params, "p", intent.prompt, fallback.prompt);
  setIfChanged(params, "skill", intent.skillQuery, fallback.skillQuery);
  setIfChanged(params, "grade", intent.exactGrade, fallback.exactGrade);
  setIfChanged(params, "strand", intent.strand, fallback.strand);
  setIfChanged(params, "type", intent.typeId, fallback.typeId);
  setIfChanged(params, "format", intent.format, fallback.format);
  setIfChanged(params, "count", String(intent.itemCount), String(fallback.itemCount));
  setIfChanged(params, "seed", String(intent.seed), String(fallback.seed));
  setIfChanged(params, "difficulty", intent.difficulty, fallback.difficulty);
  setIfChanged(params, "page", intent.pageSize, fallback.pageSize);
  setIfChanged(params, "panel", intent.activePanel, fallback.activePanel);
  return params;
}

export function normalizeIntent(intent: CommandCenterIntent, types: readonly WorksheetType[] = worksheetTypes): CommandCenterIntent {
  const fallback = defaultCommandCenterIntent(types);
  let activeType = types.find((type) => type.id === intent.typeId) || types.find((type) => type.id === fallback.typeId) || types[0];
  if (intent.exactGrade && !activeType.grades.includes(intent.exactGrade)) {
    activeType = types.find((type) => type.grades.includes(intent.exactGrade as ExactGradeId) && (!intent.strand || type.strand === intent.strand))
      || types.find((type) => type.grades.includes(intent.exactGrade as ExactGradeId))
      || activeType;
  }
  if (intent.strand && activeType.strand !== intent.strand) {
    activeType = types.find((type) => type.strand === intent.strand && (!intent.exactGrade || type.grades.includes(intent.exactGrade as ExactGradeId)))
      || types.find((type) => type.strand === intent.strand)
      || activeType;
  }
  if (intent.format && !activeType.formats.includes(intent.format)) {
    activeType = types.find((type) => type.formats.includes(intent.format) && (!intent.exactGrade || type.grades.includes(intent.exactGrade as ExactGradeId)) && (!intent.strand || type.strand === intent.strand))
      || activeType;
  }
  const format = activeType.formats.includes(intent.format) ? intent.format : activeType.formats[0];

  return {
    ...intent,
    prompt: intent.prompt.trimStart(),
    skillQuery: intent.skillQuery.trimStart(),
    exactGrade: intent.exactGrade && activeType.grades.includes(intent.exactGrade) ? intent.exactGrade : activeType.grades[0] || fallback.exactGrade,
    strand: intent.strand && activeType.strand === intent.strand ? intent.strand : activeType.strand,
    typeId: activeType.id,
    format,
    itemCount: clamp(intent.itemCount, 3, 12),
    seed: Math.max(1, Math.round(intent.seed)),
    difficulty: safeDifficulty(intent.difficulty) || fallback.difficulty,
    pageSize: safePageSize(intent.pageSize) || fallback.pageSize,
    activePanel: safePanel(intent.activePanel) || fallback.activePanel
  };
}

export function nextSeed(seed: number) {
  return seed >= 99999 ? 1 : seed + 1;
}

function safeTypeId(value: string | null, types: readonly WorksheetType[]) {
  return types.find((type) => type.id === value)?.id;
}

function safeFormat(value: string | null, type: WorksheetType): WorksheetFormat | undefined {
  const validFormat = formatFamilies.find((format) => format.id === value)?.id;
  return validFormat && type.formats.includes(validFormat) ? validFormat : undefined;
}

function safeGrade(value: string | null, type: WorksheetType): ExactGradeId | undefined {
  return type.grades.find((grade) => grade === value);
}

function safeStrand(value: string | null): Strand | undefined {
  return strands.find((strand) => strand === value);
}

function safeDifficulty(value: string | null): DifficultyTarget | undefined {
  if (value === "readiness" || value === "core" || value === "challenge") return value;
  return undefined;
}

function safePageSize(value: string | null): PageSize | undefined {
  if (value === "letter" || value === "a4") return value;
  return undefined;
}

function safePanel(value: string | null): CommandPanel | undefined {
  if (value === "trust" || value === "answers" || value === "export" || value === "json") return value;
  return undefined;
}

function setIfChanged(params: URLSearchParams, key: string, value: string, fallback: string) {
  if (value !== fallback) params.set(key, value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
