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
    const filtered = filterWorksheetTypes(worksheetTypes, {
      exactGrade: intent.exactGrade,
      strand: intent.strand,
      format: intent.format
    });
    return filtered.length > 0 ? filtered : worksheetTypes;
  }, [intent.exactGrade, intent.format, intent.strand]);
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

  return (
    <div className="command-center-shell">
      <a className="skip-link" href="#command-workspace">Skip to worksheet workspace</a>
      <p className="sr-only" aria-live="polite">{copyStatus}</p>
      <header className="command-topbar no-print">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">WU</div>
          <div>
            <h1>Worksheet Universe</h1>
            <p>JSON-first worksheet command center</p>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Primary">
          <a href="#command-workspace">Generate</a>
          <a href="#command-workspace">Preview</a>
          <a href="#desktop-trust-panel">Review</a>
        </nav>
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
              <Button type="button" variant="outline" size="icon" className="lg:hidden" aria-label="Open command menu">
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

      <main id="command-workspace">
        <div className="command-mobile lg:hidden">
          <PromptBar idPrefix="mobile" intent={intent} parsedPrompt={parsedPrompt} updateIntent={updateIntent} applyPrompt={applyPrompt} />
          <Tabs value={mobileStep} onValueChange={setMobileStep}>
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
              <div>
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
                activePanel="export"
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

        <div className="command-desktop hidden lg:grid">
          <aside className="command-sidebar no-print">
            <PromptBar idPrefix="desktop" intent={intent} parsedPrompt={parsedPrompt} updateIntent={updateIntent} applyPrompt={applyPrompt} />
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

          <section className="command-preview-column" aria-label="Live worksheet preview">
            <div className="preview-heading no-print">
              <div>
                <p className="eyebrow">Live preview</p>
                <h2>{worksheet.title}</h2>
              </div>
              <Badge variant="outline">{intent.pageSize.toUpperCase()} / Seed {intent.seed}</Badge>
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

          <aside className="command-inspector no-print">
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

function resolveActiveType(intent: CommandCenterIntent, parsedTypeId: string | undefined, visibleTypes: WorksheetType[]) {
  return worksheetTypes.find((type) => type.id === intent.typeId)
    || (parsedTypeId ? worksheetTypes.find((type) => type.id === parsedTypeId) : undefined)
    || visibleTypes[0]
    || worksheetTypes[0];
}
