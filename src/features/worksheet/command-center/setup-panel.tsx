"use client";

import { Filter, RefreshCcw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  exactGrades,
  formatFamilies,
  strands,
  type Strand,
  type WorksheetType
} from "../catalog";
import { formatTitle } from "../generator";
import type { CommandCenterIntent, DifficultyTarget, PageSize, ParsedPrompt, WorksheetPreset } from "./types";

const presets: WorksheetPreset[] = [
  {
    id: "bell-ringer",
    title: "Bell Ringer",
    summary: "5 minutes",
    itemCount: 5,
    format: "quick-check",
    difficulty: "readiness"
  },
  {
    id: "homework",
    title: "Homework Practice",
    summary: "steady practice",
    itemCount: 10,
    format: "worked-practice",
    difficulty: "core"
  },
  {
    id: "diagnostic",
    title: "Diagnostic",
    summary: "increasing demand",
    itemCount: 12,
    format: "worked-practice",
    difficulty: "challenge"
  }
];

export function PromptBar({
  idPrefix,
  intent,
  parsedPrompt,
  updateIntent,
  applyPrompt
}: {
  idPrefix: string;
  intent: CommandCenterIntent;
  parsedPrompt: ParsedPrompt;
  updateIntent: (patch: Partial<CommandCenterIntent>, resetWorksheet?: boolean) => void;
  applyPrompt: () => void;
}) {
  const promptId = `${idPrefix}-teacher-prompt`;

  return (
    <form
      className="prompt-bar"
      onSubmit={(event) => {
        event.preventDefault();
        applyPrompt();
      }}
    >
      <Label htmlFor={promptId}>Teacher intent</Label>
      <div className="prompt-row">
        <textarea
          id={promptId}
          name="teacher-prompt"
          rows={2}
          value={intent.prompt}
          onChange={(event) => updateIntent({ prompt: event.target.value })}
          className="prompt-input"
          placeholder="Make a Grade 5 fractions worksheet..."
          autoComplete="off"
          spellCheck
        />
        <Button type="submit" size="lg" className="min-h-[40px] min-w-[40px] active:scale-[0.985] active:translate-y-px transition-transform">
          <Sparkles aria-hidden="true" />
          Generate
        </Button>
      </div>
      <div className="prompt-chips" aria-label="Parsed prompt">
        {parsedPrompt.exactGrade ? <Badge variant="secondary">Grade {parsedPrompt.exactGrade}</Badge> : null}
        {parsedPrompt.strand ? <Badge variant="secondary">{parsedPrompt.strand}</Badge> : null}
        {parsedPrompt.format ? <Badge variant="secondary">{formatTitle(parsedPrompt.format)}</Badge> : null}
        {parsedPrompt.itemCount ? <Badge variant="secondary">{parsedPrompt.itemCount} questions</Badge> : null}
        {parsedPrompt.difficulty ? <Badge variant="secondary">{difficultyLabel(parsedPrompt.difficulty)}</Badge> : null}
      </div>
    </form>
  );
}

export function SetupPanel({
  idPrefix,
  intent,
  activeType,
  visibleTypes,
  updateIntent,
  applyPreset,
  resetToDefault
}: {
  idPrefix: string;
  intent: CommandCenterIntent;
  activeType: WorksheetType;
  visibleTypes: WorksheetType[];
  updateIntent: (patch: Partial<CommandCenterIntent>, resetWorksheet?: boolean) => void;
  applyPreset: (preset: WorksheetPreset) => void;
  resetToDefault: () => void;
}) {
  return (
    <section className="setup-panel" aria-labelledby={`${idPrefix}-setup-title`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Setup</p>
          <h2 id={`${idPrefix}-setup-title`}>Build target</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[40px] min-w-[40px] active:scale-[0.985] active:translate-y-px transition-transform"
          onClick={resetToDefault}
        >
          <RefreshCcw aria-hidden="true" />
          Reset
        </Button>
      </div>

      <div className="preset-row" aria-label="Worksheet presets">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            className="preset-button min-h-[40px] min-w-[40px] active:scale-[0.985] active:translate-y-px transition-transform"
            onClick={() => applyPreset(preset)}
          >
            <span>{preset.title}</span>
            <small>{preset.summary}</small>
          </Button>
        ))}
      </div>

      <div className="field-group">
        <Label htmlFor={`${idPrefix}-skill-search`}>Skill search</Label>
        <Input
          id={`${idPrefix}-skill-search`}
          name="skill-search"
          value={intent.skillQuery}
          onChange={(event) => updateIntent({ skillQuery: event.target.value })}
          autoComplete="off"
          placeholder="fractions, equations, place value"
        />
      </div>

      <div className="field-group">
        <Label>Exact grade</Label>
        <div className="grade-grid">
          {exactGrades.map((grade) => (
            <Button
              key={grade.id}
              type="button"
              variant={intent.exactGrade === grade.id ? "default" : "outline"}
              size="sm"
              className="min-h-[40px] min-w-[40px] active:scale-[0.985] active:translate-y-px transition-transform"
              onClick={() => updateIntent({ exactGrade: grade.id }, true)}
            >
              {grade.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <Label htmlFor={`${idPrefix}-strand`}>Topic strand</Label>
        <Select value={intent.strand || "all"} onValueChange={(value) => updateIntent({ strand: value === "all" ? "" : value as Strand }, true)}>
          <SelectTrigger id={`${idPrefix}-strand`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All strands</SelectItem>
            {strands.map((strand) => (
              <SelectItem key={strand} value={strand}>{strand}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="field-group">
        <Label>Generator</Label>
        <div className="selected-generator">
          <span>Selected</span>
          <strong>{activeType.title}</strong>
          <small>{activeType.summary}</small>
        </div>
        <div className="generator-list" aria-label={`${visibleTypes.length} matching generators`}>
          {visibleTypes.slice(0, 6).map((type) => (
            <button
              key={type.id}
              type="button"
              className={cn("generator-option min-h-[40px] active:scale-[0.985] active:translate-y-px transition-transform", activeType.id === type.id && "is-active")}
              onClick={() => updateIntent({ typeId: type.id, strand: type.strand, format: type.formats.includes(intent.format) ? intent.format : type.formats[0] }, true)}
            >
              <span>{type.title}</span>
              <small>{type.strand}</small>
            </button>
          ))}
          {visibleTypes.length === 0 ? (
            <p className="empty-generator-state">No generators match these filters.</p>
          ) : null}
        </div>
        <p className="result-count"><Filter className="size-3.5" aria-hidden="true" /> Showing {Math.min(visibleTypes.length, 6)} of {visibleTypes.length}</p>
      </div>

      <details className="fine-tuning-panel">
        <summary>Fine-tune worksheet details</summary>
        <div className="fine-tuning-fields">
          <div className="two-column-fields">
            <div className="field-group">
              <Label htmlFor={`${idPrefix}-format`}>Format</Label>
              <Select value={intent.format} onValueChange={(value) => updateIntent({ format: value as CommandCenterIntent["format"] }, true)}>
                <SelectTrigger id={`${idPrefix}-format`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatFamilies.filter((format) => activeType.formats.includes(format.id)).map((format) => (
                    <SelectItem key={format.id} value={format.id}>{format.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="field-group">
              <Label htmlFor={`${idPrefix}-difficulty`}>Difficulty target</Label>
              <Select value={intent.difficulty} onValueChange={(value) => updateIntent({ difficulty: value as DifficultyTarget })}>
                <SelectTrigger id={`${idPrefix}-difficulty`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="readiness">Readiness</SelectItem>
                  <SelectItem value="core">Core</SelectItem>
                  <SelectItem value="challenge">Challenge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="three-column-fields">
            <div className="field-group">
              <Label htmlFor={`${idPrefix}-count`}>Questions</Label>
              <Input
                id={`${idPrefix}-count`}
                name="question-count"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                min={3}
                max={12}
                value={intent.itemCount}
                onChange={(event) => updateIntent({ itemCount: Number(event.target.value) || 3 }, true)}
              />
            </div>
            <div className="field-group">
              <Label htmlFor={`${idPrefix}-seed`}>Seed</Label>
              <Input
                id={`${idPrefix}-seed`}
                name="worksheet-seed"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                min={1}
                value={intent.seed}
                onChange={(event) => updateIntent({ seed: Number(event.target.value) || 1 }, true)}
              />
            </div>
            <div className="field-group">
              <Label htmlFor={`${idPrefix}-page-size`}>Page</Label>
              <Select value={intent.pageSize} onValueChange={(value) => updateIntent({ pageSize: value as PageSize })}>
                <SelectTrigger id={`${idPrefix}-page-size`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter</SelectItem>
                  <SelectItem value="a4">A4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

function difficultyLabel(value: DifficultyTarget) {
  const labels: Record<DifficultyTarget, string> = {
    readiness: "Readiness",
    core: "Core",
    challenge: "Challenge"
  };
  return labels[value];
}
