"use client";

import { CheckCircle2, ClipboardCheck, Copy, FileJson, Printer, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Worksheet } from "@/types/worksheet";
import type { AuditResult } from "../generator";
import type { ChecksByQuestion, CommandPanel, ExportOption } from "./types";

const exportOptions: ExportOption[] = [
  {
    id: "print-student",
    label: "Print student copy",
    description: "Print worksheet only",
    status: "ready"
  },
  {
    id: "print-key",
    label: "Answer key",
    description: "Print answers only",
    status: "ready"
  },
  {
    id: "print-all",
    label: "All pages",
    description: "Print worksheet and key",
    status: "ready"
  },
  {
    id: "copy-json",
    label: "Worksheet JSON",
    description: "Copy source contract",
    status: "ready"
  },
  {
    id: "make-another",
    label: "Make another",
    description: "Same settings, new seed",
    status: "ready"
  }
];

export function TrustPanel({
  idPrefix,
  worksheet,
  audit,
  checks,
  activePanel,
  copyStatus,
  setActivePanel,
  checkAll,
  printStudent,
  printAnswerKey,
  printAll,
  copyJson,
  makeAnother
}: {
  idPrefix: string;
  worksheet: Worksheet;
  audit: AuditResult;
  checks: ChecksByQuestion;
  activePanel: CommandPanel;
  copyStatus: string;
  setActivePanel: (panel: CommandPanel) => void;
  checkAll: () => void;
  printStudent: () => void;
  printAnswerKey: () => void;
  printAll: () => void;
  copyJson: () => void;
  makeAnother: () => void;
}) {
  const controlPressClass = "min-h-[40px] min-w-[40px] active:scale-[0.985] active:translate-y-px transition-transform";

  const duplicateCount = countDuplicatePrompts(worksheet);
  const checked = Object.values(checks);
  const correct = checked.filter((check) => check.status === "correct").length;
  const incorrect = checked.filter((check) => check.status === "incorrect").length;
  const open = Math.max(0, worksheet.answerKey.length - correct - incorrect);
  const difficultySpread = countDifficulties(worksheet);
  const trustStatus = audit.ok ? "Verified" : "Review needed";
  const trustMessage = audit.ok
    ? "All generated answers were verified."
    : `${audit.failed.length} generated answer mismatch${audit.failed.length === 1 ? "" : "es"} require review.`;

  return (
    <section
      id={`${idPrefix}-trust-panel`}
      className="trust-panel"
      aria-labelledby={`${idPrefix}-trust-title`}
      aria-describedby={`${idPrefix}-trust-message`}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Review</p>
          <h2 id={`${idPrefix}-trust-title`}>Trust status</h2>
        </div>
        <Badge variant={audit.ok ? "success" : "warning"} aria-label={`Trust status: ${trustStatus}`} aria-live="polite">{trustStatus}</Badge>
      </div>
      <p id={`${idPrefix}-trust-message`} className="status-line" aria-live="polite" aria-atomic="true">
        {trustMessage}
      </p>

      <div className="export-actions primary-actions" aria-label="Primary worksheet actions">
        {exportOptions.map((option) => (
          <ExportButton
            key={option.id}
            option={option}
            panelIdPrefix={idPrefix}
            onClick={() => {
              if (option.id === "print-student") printStudent();
              if (option.id === "print-key") printAnswerKey();
              if (option.id === "print-all") printAll();
              if (option.id === "copy-json") copyJson();
              if (option.id === "make-another") makeAnother();
            }}
          />
        ))}
      </div>
      <p className="status-line" role="status" aria-live="polite" aria-atomic="true">{copyStatus}</p>

      <Tabs value={activePanel} onValueChange={(value) => setActivePanel(value as CommandPanel)} aria-label="Trust panel sections">
        <TabsList className="panel-tabs">
          <TabsTrigger value="trust" className={controlPressClass} aria-label="Trust checks">Checks</TabsTrigger>
          <TabsTrigger value="answers" className={controlPressClass} aria-label="Answer list and worked solutions">Answers</TabsTrigger>
          <TabsTrigger value="export" className={controlPressClass} aria-label="Export options and actions">Export</TabsTrigger>
          <TabsTrigger value="json" className={controlPressClass} aria-label="Worksheet JSON view and copy action">JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="trust">
          <div className="metric-grid">
            <Metric label="Answers verified" value={`${audit.checked - audit.failed.length}/${audit.checked}`} tone={audit.ok ? "good" : "warn"} />
            <Metric label="Correct checks" value={String(correct)} tone="good" />
            <Metric label="Needs retry" value={String(incorrect)} tone="warn" />
            <Metric label="Unanswered" value={String(open)} tone="quiet" />
          </div>
          <div className="quality-list">
            <QualityItem label="Answer accuracy" value={audit.ok ? "All generated answers verified" : `${audit.failed.length} answer mismatch`} ok={audit.ok} />
            <QualityItem label="Duplicates" value={duplicateCount === 0 ? "None found" : `${duplicateCount} repeated prompt`} ok={duplicateCount === 0} />
            <QualityItem label="Standards" value={`${worksheet.metadata.standards.length} alignment reference${worksheet.metadata.standards.length === 1 ? "" : "s"}`} ok={worksheet.metadata.standards.length > 0} />
            <QualityItem label="Difficulty spread" value={difficultySpread} ok />
          </div>
          <Button
            type="button"
            className={controlPressClass}
            onClick={checkAll}
            aria-label="Check all entered answers against the worksheet key"
            title="Check all entered answers"
          >
            <ClipboardCheck aria-hidden="true" />
            Check all entered answers
          </Button>
        </TabsContent>

        <TabsContent value="answers">
          <ScrollArea className="answer-table-scroll">
            <Table>
              <TableCaption className="sr-only">Answer key, question IDs, and worked solutions</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Item</TableHead>
                  <TableHead scope="col">Answer</TableHead>
                  <TableHead scope="col">Worked solution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {worksheet.answerKey.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.questionId}</TableCell>
                    <TableCell>{entry.answer.value}</TableCell>
                    <TableCell>{entry.workedSolution[0]?.text || "Verified by generator."}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="export">
          <div className="use-notes">
            <p>Student copy prints the worksheet page. Answer key prints the separate key page. Make another keeps the same settings and advances the seed.</p>
          </div>
        </TabsContent>

        <TabsContent value="json">
          <div className="json-panel">
            <Button
              type="button"
              variant="outline"
              className="min-h-[40px] min-w-[40px] active:scale-[0.985] active:translate-y-px transition-transform"
              onClick={copyJson}
              aria-label="Copy worksheet JSON to clipboard"
              title="Copy worksheet JSON to clipboard"
            >
              <FileJson aria-hidden="true" />
              Copy worksheet JSON
            </Button>
            <pre tabIndex={0} aria-label="Worksheet JSON preview">{JSON.stringify({
              id: worksheet.id,
              schemaVersion: worksheet.schemaVersion,
              format: worksheet.metadata.format,
              questionCount: worksheet.answerKey.length,
              generator: worksheet.metadata.generator
            }, null, 2)}</pre>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "quiet" }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function QualityItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="quality-item">
      <CheckCircle2
        className={ok ? "text-emerald-600" : "text-amber-600"}
        aria-hidden="true"
      />
      <div>
        <p>{label}</p>
        <span>{value}</span>
        <span className="sr-only">Status: {ok ? "passed" : "needs attention"}</span>
      </div>
    </div>
  );
}

function ExportButton({ option, panelIdPrefix, onClick }: { option: ExportOption; panelIdPrefix: string; onClick: () => void }) {
  const Icon = option.id.startsWith("print") ? Printer : option.id === "copy-json" ? Copy : RefreshCcw;
  const label = `${option.label}: ${option.description}`;
  return (
    <Button
      type="button"
      variant={option.id === "print-student" ? "default" : "outline"}
      className={`export-button min-h-[40px] min-w-[40px] active:scale-[0.985] active:translate-y-px transition-transform${option.id === "print-student" ? " primary-export-button" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-describedby={`${panelIdPrefix}-${option.id}-status`}
      title={label}
    >
      <Icon aria-hidden="true" />
      <span>{option.label}</span>
      <small>{option.description}</small>
      <span className="sr-only" id={`${panelIdPrefix}-${option.id}-status`}>{label}</span>
    </Button>
  );
}

function countDuplicatePrompts(worksheet: Worksheet) {
  const prompts = worksheet.sections.flatMap((section) => section.questions.map((question) => question.prompt));
  return prompts.length - new Set(prompts).size;
}

function countDifficulties(worksheet: Worksheet) {
  const counts = worksheet.sections
    .flatMap((section) => section.questions)
    .reduce<Record<string, number>>((result, question) => {
      const band = question.metadata?.difficulty?.band || "core";
      result[band] = (result[band] || 0) + 1;
      return result;
    }, {});

  return Object.entries(counts)
    .map(([band, count]) => `${count} ${band}`)
    .join(", ");
}
