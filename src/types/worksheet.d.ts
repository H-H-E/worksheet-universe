export type WorksheetSubject = "math";

export type WorksheetQuestionType =
  | "numeric"
  | "integer"
  | "decimal"
  | "money"
  | "percent"
  | "fraction"
  | "coordinate"
  | "equation"
  | "multipleChoice"
  | "shortText"
  | "table"
  | "graph"
  | "visualModel";

export type WorksheetFormat =
  | "fluency-grid"
  | "worked-practice"
  | "visual-model"
  | "quick-check"
  | "real-world"
  | "graph-data";

export type AnswerNormalization =
  | "number"
  | "integer"
  | "decimal"
  | "money"
  | "percent"
  | "fraction"
  | "coordinate"
  | "equation"
  | "text"
  | "choice";

export type ContentBlock =
  | { kind: "text"; text: string }
  | { kind: "math"; tex: string; alt: string }
  | { kind: "visual"; visualType: "dots" | "fractionBar" | "numberLine" | "coordinatePlane" | "geometryFigure" | "graphPlaceholder"; data: Record<string, unknown>; alt: string }
  | { kind: "table"; caption?: string; headers: string[]; rows: string[][] }
  | { kind: "answerBox"; answerRef: string; label?: string; width?: string }
  | { kind: "choices"; choices: Array<{ id: string; label: string; content: string }> }
  | { kind: "workspace"; style: "blank" | "ruled" | "grid" | "largePrint"; height?: string };

export type DifficultyBand = "readiness" | "intro" | "core" | "fluency" | "application" | "extension";

export interface Difficulty {
  band: DifficultyBand;
  level: number;
}

export interface GeneratorLineage {
  id: string;
  version: string;
  seed: string;
  variant?: string;
}

export interface WorksheetQuestion {
  id: string;
  type: WorksheetQuestionType;
  prompt: string;
  content: ContentBlock[];
  answerRef: string;
  metadata?: {
    difficulty?: Difficulty;
    skills?: string[];
    generator?: GeneratorLineage;
  };
}

export interface WorksheetSection {
  id: string;
  title: string;
  instructions?: string;
  questions: WorksheetQuestion[];
}

export interface WorksheetAnswer {
  kind: AnswerNormalization;
  value: string;
  canonical?: Record<string, unknown>;
}

export interface WorksheetAnswerKeyItem {
  id: string;
  questionId: string;
  answer: WorksheetAnswer;
  normalization: AnswerNormalization;
  alternates?: string[];
  tolerance?: number;
  workedSolution: Array<{ text: string; math?: string }>;
}

export interface WorksheetStandardRef {
  framework: "CCSS-M" | "SAT-MATH" | "ACT-MATH" | "local";
  code: string;
  alignment: "primary" | "secondary" | "supporting";
}

export interface WorksheetVersioning {
  schemaVersion: "1.0.0";
  contentVersion: string;
  migration: {
    strategy: "none" | "forward-only" | "manual-review";
    notes: string[];
  };
}

export interface WorksheetMetadata {
  createdAt: string;
  generator: GeneratorLineage;
  format: WorksheetFormat;
  standards: WorksheetStandardRef[];
  versioning: WorksheetVersioning;
}

export interface Worksheet {
  schemaVersion: "1.0.0";
  id: string;
  title: string;
  subject: WorksheetSubject;
  gradeBand: string;
  topic: string;
  learningGoals: string[];
  instructions: string;
  sections: WorksheetSection[];
  answerKey: WorksheetAnswerKeyItem[];
  metadata: WorksheetMetadata;
}
