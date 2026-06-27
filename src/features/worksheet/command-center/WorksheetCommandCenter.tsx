"use client";

import { useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpenCheck, FileText, Menu, Printer, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  answerForQuestion,
  auditWorksheet,
  checkAnswer,
  filterWorksheetTypes,
  generateWorksheet,
  worksheetTypes,
  type WorksheetType
} from "..";
import { PromptBar, SetupPanel } from "./setup-panel";
import { parseWorksheetPrompt } from "./prompt-parser";
import { TrustPanel } from "./trust-panel";
import type { ChecksByQuestion, CommandCenterIntent, CommandPanel, WorksheetPreset } from "./types";
import {
  defaultCommandCenterIntent,
  intentFromSearchParams,
  intentToSearchParams,
  nextSeed,
  normalizeIntent
} from "./url-state";
import { WorksheetPreview } from "./worksheet-preview";

type PrintMode = "student" | "answer-key" | "all";

export function WorksheetCommandCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [intent, setIntent] = useState(() => intentFromSearchParams(new URLSearchParams(searchParams.toString()), worksheetTypes));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<ChecksByQuestion>({});
  const [lockedQuestionIds, setLockedQuestionIds] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState("Ready.");
  const [mobileStep, setMobileStep] = useState("setup");

  const fallback = useMemo(() => defaultCommandCenterIntent(worksheetTypes), []);
  const parsedPrompt = useMemo(() => parseWorksheetPrompt(intent.prompt, worksheetTypes), [intent.prompt]);
  const visibleTypes = useMemo(() => {
    return filterWorksheetTypes(worksheetTypes, {
      query: intent.skillQuery,
      exactGrade: intent.exactGrade,
      strand: intent.strand,
      format: intent.format
    });
  }, [intent.exactGrade, intent.format, intent.skillQuery, intent.strand]);
  const activeType = resolveActiveType(intent, parsedPrompt.worksheetTypeId, visibleTypes);
  const activeFormat = activeType.formats.includes(intent.format) ? intent.format : activeType.formats[0];
  const worksheet = useMemo(
    () => generateWorksheet(activeType, { itemCount: intent.itemCount, seed: intent.seed, format: activeFormat }),
    [activeFormat, activeType, intent.itemCount, intent.seed]
  );
  const audit = useMemo(() => auditWorksheet(worksheet), [worksheet]);

  function updateIntent(patch: Partial<CommandCenterIntent>, resetWorksheet = false) {
    const nextIntent = normalizeIntent({ ...intent, ...patch }, worksheetTypes);
    setIntent(nextIntent);
    replaceUrl(nextIntent);
    if (resetWorksheet) resetAnswerState();
  }

  function replaceUrl(nextIntent: CommandCenterIntent) {
    const params = intentToSearchParams(nextIntent, fallback).toString();
    const nextUrl = params ? `${pathname}?${params}` : pathname;
    startTransition(() => {
      router.replace(nextUrl as Route, { scroll: false });
    });
  }

  function resetAnswerState() {
    setAnswers({});
    setChecks({});
    setLockedQuestionIds([]);
  }

  function applyPrompt() {
    const nextType = parsedPrompt.worksheetTypeId
      ? worksheetTypes.find((type) => type.id === parsedPrompt.worksheetTypeId)
      : undefined;
    const nextIntent = normalizeIntent({
      ...intent,
      exactGrade: parsedPrompt.exactGrade || intent.exactGrade,
      strand: parsedPrompt.strand || nextType?.strand || intent.strand,
      typeId: parsedPrompt.worksheetTypeId || intent.typeId,
      format: parsedPrompt.format || intent.format,
      itemCount: parsedPrompt.itemCount || intent.itemCount,
      difficulty: parsedPrompt.difficulty || intent.difficulty
    }, worksheetTypes);
    setIntent(nextIntent);
    replaceUrl(nextIntent);
    resetAnswerState();
    setCopyStatus("Worksheet regenerated from teacher intent.");
  }

  function applyPreset(preset: WorksheetPreset) {
    updateIntent({
      itemCount: preset.itemCount,
      format: preset.format && activeType.formats.includes(preset.format) ? preset.format : intent.format,
      difficulty: preset.difficulty
    }, true);
    setCopyStatus(`${preset.title} preset applied.`);
  }

  function resetToDefault() {
    setIntent(fallback);
    replaceUrl(fallback);
    resetAnswerState();
    setCopyStatus("Default command center loaded.");
  }

  function makeAnother() {
    updateIntent({ seed: nextSeed(intent.seed) }, true);
    setCopyStatus("New deterministic version generated.");
  }

  function toggleQuestionLock(questionId: string) {
    setLockedQuestionIds((current) => current.includes(questionId)
      ? current.filter((id) => id !== questionId)
      : [...current, questionId]);
  }

  function checkAll() {
    const nextChecks: ChecksByQuestion = {};
    for (const section of worksheet.sections) {
      for (const question of section.questions) {
        const answer = answerForQuestion(worksheet, question);
        if (answer) nextChecks[question.id] = checkAnswer(answers[question.id] || "", answer);
      }
    }
    setChecks(nextChecks);
    setCopyStatus("Entered answers checked against the key.");
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(worksheet, null, 2));
      setCopyStatus("Worksheet JSON copied.");
    } catch {
      setCopyStatus("Clipboard unavailable.");
    }
  }

  function printWithMode(mode: PrintMode) {
    document.documentElement.dataset.printMode = mode;
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.documentElement.dataset.printMode = "student";
      }, 250);
    }, 0);
  }

  function setActivePanel(panel: CommandPanel) {
    updateIntent({ activePanel: panel });
  }

  function setMobileWorkflowStep(step: string) {
    setMobileStep(step);
    if (step === "export") setActivePanel("export");
    if (step === "review" && intent.activePanel === "export") setActivePanel("trust");
  }

  return (
    <div className="command-center-shell relative isolate bg-muted/20">
      <a className="skip-link" href="#command-workspace">Skip to worksheet workspace</a>
      <p className="sr-only" aria-live="polite">{copyStatus}</p>
      <header className="command-topbar no-print">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">WU</div>
          <div>
            <h1>Worksheet Universe</h1>
            <p>Make, inspect, print</p>
          </div>
        </div>
        <div className="topbar-current no-print" aria-label="Current worksheet">
          <span>{activeType.title}</span>
          <small>{intent.itemCount} questions, {intent.pageSize.toUpperCase()}, seed {intent.seed}</small>
        </div>
        <div className="topbar-actions">
          <Badge variant={audit.ok ? "success" : "warning"}>{audit.ok ? "Audit passed" : "Audit review"}</Badge>
          <Button type="button" variant="outline" size="sm" onClick={makeAnother}>
            <RefreshCcw aria-hidden="true" />
            New version
          </Button>
          <Button type="button" size="sm" onClick={() => printWithMode("student")}>
            <Printer aria-hidden="true" />
            Print
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="mobile-menu-button lg:hidden" aria-label="Open command menu">
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(92vw,360px)] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Worksheet Universe</SheetTitle>
                <SheetDescription>{activeType.title}</SheetDescription>
              </SheetHeader>
              <div className="sheet-actions">
                <Button type="button" onClick={makeAnother}>
                  <RefreshCcw aria-hidden="true" />
                  New version
                </Button>
                <Button type="button" variant="outline" onClick={() => printWithMode("student")}>
                  <FileText aria-hidden="true" />
                  Print student copy
                </Button>
                <Button type="button" variant="outline" onClick={() => printWithMode("answer-key")}>
                  <BookOpenCheck aria-hidden="true" />
                  Print answer key
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main id="command-workspace" className="relative">
        <div className="command-mobile lg:hidden rounded-[1rem] border border-border/80 bg-background/95 p-1 shadow-[0_16px_36px_-30px_rgba(0,0,0,0.4)]">
          <PromptBar idPrefix="mobile" intent={intent} parsedPrompt={parsedPrompt} updateIntent={updateIntent} applyPrompt={applyPrompt} />
          <Tabs value={mobileStep} onValueChange={setMobileWorkflowStep}>
            <TabsList className="mobile-tabs">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="review">Review</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>
            <TabsContent value="setup">
              <SetupPanel
                idPrefix="mobile"
                intent={intent}
                activeType={activeType}
                visibleTypes={visibleTypes}
                updateIntent={updateIntent}
                applyPreset={applyPreset}
                resetToDefault={resetToDefault}
              />
            </TabsContent>
            <TabsContent value="preview">
              <div className="rounded-[0.85rem] border border-border/70 bg-card/60 p-2 shadow-[0_10px_24px_-24px_rgba(0,0,0,0.35)]">
                <WorksheetPreview
                  worksheet={worksheet}
                  pageSize={intent.pageSize}
                  answers={answers}
                  checks={checks}
                  lockedQuestionIds={lockedQuestionIds}
                  setAnswers={setAnswers}
                  setChecks={setChecks}
                  toggleQuestionLock={toggleQuestionLock}
                  requestNewVersion={makeAnother}
                />
              </div>
            </TabsContent>
            <TabsContent value="review">
              <TrustPanel
                idPrefix="mobile"
                worksheet={worksheet}
                audit={audit}
                checks={checks}
                activePanel={intent.activePanel}
                copyStatus={copyStatus}
                setActivePanel={setActivePanel}
                checkAll={checkAll}
                printStudent={() => printWithMode("student")}
                printAnswerKey={() => printWithMode("answer-key")}
                printAll={() => printWithMode("all")}
                copyJson={copyJson}
                makeAnother={makeAnother}
              />
            </TabsContent>
            <TabsContent value="export">
              <TrustPanel
                idPrefix="mobile-export"
                worksheet={worksheet}
                audit={audit}
                checks={checks}
                activePanel={intent.activePanel}
                copyStatus={copyStatus}
                setActivePanel={setActivePanel}
                checkAll={checkAll}
                printStudent={() => printWithMode("student")}
                printAnswerKey={() => printWithMode("answer-key")}
                printAll={() => printWithMode("all")}
                copyJson={copyJson}
                makeAnother={makeAnother}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="command-desktop-frame hidden lg:block rounded-[1.8rem] border border-border/65 bg-muted/35 p-2 shadow-[0_24px_58px_-40px_rgba(0,0,0,0.38)]">
          <div className="command-desktop hidden lg:grid">
            <section className="command-control-deck no-print rounded-[1.25rem] border border-border/55 bg-card/90 shadow-[0_10px_28px_-24px_rgba(0,0,0,0.3)]">
              <PromptBar idPrefix="desktop" intent={intent} parsedPrompt={parsedPrompt} updateIntent={updateIntent} applyPrompt={applyPrompt} />
              <div className="workflow-panel">
                <div className="workflow-heading">
                  <p className="eyebrow">Workflow</p>
                  <strong>{audit.ok ? "Ready to print" : "Review before export"}</strong>
                </div>
                <ol className="workflow-rail" aria-label="Workflow status">
                  <WorkflowStep label="Teacher intent" value={intent.prompt.trim() ? "Parsed" : "Ready"} />
                  <WorkflowStep label="Setup" value={intent.exactGrade ? `Grade ${intent.exactGrade}` : "Any grade"} />
                  <WorkflowStep label="Preview" value={`${worksheet.answerKey.length} items`} />
                  <WorkflowStep label="Review" value={audit.ok ? "Verified" : "Needs review"} />
                  <WorkflowStep label="Export" value="Student print" />
                </ol>
                <div className="flow-summary" aria-label="Current draft summary">
                  <SummaryItem label="Skill" value={activeType.title} />
                  <SummaryItem label="Format" value={activeFormat.replaceAll("-", " ")} />
                  <SummaryItem label="Grade" value={intent.exactGrade || "Any"} />
                  <SummaryItem label="Status" value={audit.ok ? "Verified" : "Needs review"} />
                </div>
              </div>
            </section>

            <aside className="command-sidebar no-print rounded-[1.15rem] border border-border/55 bg-card/95 shadow-[0_12px_30px_-30px_rgba(0,0,0,0.3)]">
              <SetupPanel
                idPrefix="desktop"
                intent={intent}
                activeType={activeType}
                visibleTypes={visibleTypes}
                updateIntent={updateIntent}
                applyPreset={applyPreset}
                resetToDefault={resetToDefault}
              />
            </aside>

            <section className="command-preview-column rounded-[1.2rem] border border-border/60 bg-background/95 shadow-[0_14px_36px_-30px_rgba(0,0,0,0.34)]" aria-label="Live worksheet preview">
              <div className="preview-heading no-print">
                <div>
                  <p className="eyebrow">Preview</p>
                  <h2>Student worksheet</h2>
                </div>
                <Badge variant="outline">{worksheet.title}</Badge>
              </div>
              <WorksheetPreview
                worksheet={worksheet}
                pageSize={intent.pageSize}
                answers={answers}
                checks={checks}
                lockedQuestionIds={lockedQuestionIds}
                setAnswers={setAnswers}
                setChecks={setChecks}
                toggleQuestionLock={toggleQuestionLock}
                requestNewVersion={makeAnother}
              />
            </section>

            <aside className="command-inspector no-print rounded-[1.2rem] border border-border/55 bg-card/95 shadow-[0_12px_30px_-30px_rgba(0,0,0,0.3)]">
              <TrustPanel
                idPrefix="desktop"
                worksheet={worksheet}
                audit={audit}
                checks={checks}
                activePanel={intent.activePanel}
                copyStatus={isPending ? "Updating URL..." : copyStatus}
                setActivePanel={setActivePanel}
                checkAll={checkAll}
                printStudent={() => printWithMode("student")}
                printAnswerKey={() => printWithMode("answer-key")}
                printAll={() => printWithMode("all")}
                copyJson={copyJson}
                makeAnother={makeAnother}
              />
            </aside>
            </div>
        </div>
      </main>

      <div className="mobile-action-bar no-print lg:hidden">
        <Button type="button" variant="outline" onClick={makeAnother}>
          <RefreshCcw aria-hidden="true" />
          New
        </Button>
        <Button type="button" onClick={() => printWithMode("student")}>
          <Printer aria-hidden="true" />
          Print
        </Button>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkflowStep({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  );
}

function resolveActiveType(intent: CommandCenterIntent, parsedTypeId: string | undefined, visibleTypes: WorksheetType[]) {
  return worksheetTypes.find((type) => type.id === intent.typeId)
    || (parsedTypeId ? worksheetTypes.find((type) => type.id === parsedTypeId) : undefined)
    || visibleTypes[0]
    || worksheetTypes[0];
}
