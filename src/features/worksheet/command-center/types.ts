import type { Worksheet, WorksheetFormat } from "@/types/worksheet";

import type { AuditResult, CheckAnswerResult, WorksheetSettings } from "../generator";
import type { ExactGradeId, Strand, WorksheetType } from "../catalog";

export type CommandPanel = "trust" | "answers" | "export" | "json";
export type DifficultyTarget = "readiness" | "core" | "challenge";
export type PageSize = "letter" | "a4";

export interface CommandCenterIntent {
  prompt: string;
  exactGrade: ExactGradeId | "";
  strand: Strand | "";
  typeId: string;
  format: WorksheetFormat;
  itemCount: number;
  seed: number;
  difficulty: DifficultyTarget;
  pageSize: PageSize;
  activePanel: CommandPanel;
}

export interface ParsedPrompt {
  exactGrade?: ExactGradeId;
  strand?: Strand;
  worksheetTypeId?: string;
  format?: WorksheetFormat;
  itemCount?: number;
  difficulty?: DifficultyTarget;
  matchedTerms: string[];
  remainingText: string;
  confidence: number;
}

export interface WorksheetPreset {
  id: string;
  title: string;
  summary: string;
  itemCount: number;
  format?: WorksheetFormat;
  difficulty: DifficultyTarget;
}

export interface GenerationState {
  worksheet: Worksheet;
  audit: AuditResult;
  activeType: WorksheetType;
  parsedPrompt: ParsedPrompt;
  settings: WorksheetSettings;
  pageSize: PageSize;
}

export interface ExportOption {
  id: "print-student" | "print-key" | "print-all" | "copy-json" | "make-another";
  label: string;
  description: string;
  status: "ready" | "planned";
}

export type ChecksByQuestion = Record<string, CheckAnswerResult>;
