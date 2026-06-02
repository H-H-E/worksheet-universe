"use client";

import { useMemo, useState } from "react";
import type { ContentBlock, Worksheet, WorksheetFormat, WorksheetQuestion } from "@/types/worksheet";
import {
  BookOpen,
  CheckCircle2,
  FileJson,
  ListFilter,
  Printer,
  RefreshCcw,
  Search,
  SlidersHorizontal
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  answerForQuestion,
  auditWorksheet,
  checkAnswer,
  exactGrades,
  filterWorksheetTypes,
  formatFamilies,
  formatGrades,
  formatTitle,
  generateWorksheet,
  gradeBands,
  strands,
  worksheetTypes,
  type AnswerStatus,
  type ExactGradeId,
  type GradeBandId,
  type Strand,
  type WorksheetType
} from ".";

type ChecksByQuestion = Record<string, ReturnType<typeof checkAnswer>>;

const defaultType = worksheetTypes[0];

export function TeacherConsole() {
  const [query, setQuery] = useState("");
  const [exactGrade, setExactGrade] = useState<ExactGradeId | "">("");
  const [gradeBand, setGradeBand] = useState<GradeBandId | "">("");
  const [strand, setStrand] = useState<Strand | "">("");
  const [format, setFormat] = useState<WorksheetFormat | "">("");
  const [activeTypeId, setActiveTypeId] = useState(defaultType.id);
  const [activeFormat, setActiveFormat] = useState<WorksheetFormat>(defaultType.formats[0]);
  const [itemCount, setItemCount] = useState(6);
  const [seed, setSeed] = useState(42);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<ChecksByQuestion>({});
  const [copyStatus, setCopyStatus] = useState("");

  const filters = useMemo(() => ({ query, exactGrade, gradeBand, strand, format }), [query, exactGrade, gradeBand, strand, format]);
  const filteredTypes = useMemo(() => filterWorksheetTypes(worksheetTypes, filters), [filters]);
  const activeType = worksheetTypes.find((type) => type.id === activeTypeId) || filteredTypes[0] || defaultType;
  const resolvedFormat = activeType.formats.includes(activeFormat) ? activeFormat : activeType.formats[0];
  const worksheet = useMemo(
    () => generateWorksheet(activeType, { itemCount, seed, format: resolvedFormat }),
    [activeType, itemCount, seed, resolvedFormat]
  );
  const audit = useMemo(() => auditWorksheet(worksheet), [worksheet]);
  const summary = summarizeChecks(worksheet, checks);

  function resetAnswerState() {
    setAnswers({});
    setChecks({});
  }

  function selectType(type: WorksheetType) {
    setActiveTypeId(type.id);
    setActiveFormat(type.formats.includes(resolvedFormat) ? resolvedFormat : type.formats[0]);
    resetAnswerState();
  }

  function selectActiveFormat(nextFormat: WorksheetFormat) {
    setActiveFormat(nextFormat);
    resetAnswerState();
  }

  function updateItemCount(nextCount: number) {
    setItemCount(nextCount);
    resetAnswerState();
  }

  function updateSeed(nextSeed: number) {
    setSeed(nextSeed);
    resetAnswerState();
  }

  function resetFilters() {
    setQuery("");
    setExactGrade("");
    setGradeBand("");
    setStrand("");
    setFormat("");
  }

  function checkQuestion(question: WorksheetQuestion) {
    const answer = answerForQuestion(worksheet, question);
    if (!answer) return;
    setChecks((current) => ({
      ...current,
      [question.id]: checkAnswer(answers[question.id] || "", answer)
    }));
  }

  function checkAll() {
    const next: ChecksByQuestion = {};
    for (const section of worksheet.sections) {
      for (const question of section.questions) {
        const answer = answerForQuestion(worksheet, question);
        if (answer) next[question.id] = checkAnswer(answers[question.id] || "", answer);
      }
    }
    setChecks(next);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(worksheet, null, 2));
      setCopyStatus("Worksheet JSON copied.");
    } catch {
      setCopyStatus("Clipboard unavailable.");
    }
  }

  return (
    <>
      <header className="console-topbar no-print">
        <div className="mx-auto flex min-h-16 w-[min(1760px,calc(100%-24px))] items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">
              WU
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Worksheet Universe</h1>
              <p className="font-mono text-xs text-muted-foreground">{worksheetTypes.length} generators / JSON source</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant={audit.ok ? "success" : "warning"}>{audit.ok ? "Audit passed" : "Audit needs review"}</Badge>
            <Badge variant="outline">{filteredTypes.length} visible</Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => window.print()} aria-label="Print worksheet">
                  <Printer />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print worksheet</TooltipContent>
            </Tooltip>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button className="md:hidden" variant="outline" size="icon" aria-label="Open filters">
                <ListFilter />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <FilterRail
                query={query}
                setQuery={setQuery}
                exactGrade={exactGrade}
                setExactGrade={setExactGrade}
                gradeBand={gradeBand}
                setGradeBand={setGradeBand}
                strand={strand}
                setStrand={setStrand}
                format={format}
                setFormat={setFormat}
                itemCount={itemCount}
                setItemCount={updateItemCount}
                seed={seed}
                setSeed={updateSeed}
                resetFilters={resetFilters}
                filteredTypes={filteredTypes}
                selectType={selectType}
              />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="teacher-console">
        <aside className="console-sidebar console-column no-print">
          <div className="sticky-pane">
            <FilterRail
              query={query}
              setQuery={setQuery}
              exactGrade={exactGrade}
              setExactGrade={setExactGrade}
              gradeBand={gradeBand}
              setGradeBand={setGradeBand}
              strand={strand}
              setStrand={setStrand}
              format={format}
              setFormat={setFormat}
              itemCount={itemCount}
              setItemCount={updateItemCount}
              seed={seed}
              setSeed={updateSeed}
              resetFilters={resetFilters}
              filteredTypes={filteredTypes}
              selectType={selectType}
            />
          </div>
        </aside>

        <section className="console-column">
          <Card className="no-print mb-4">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">Teacher console</p>
                <CardTitle className="mt-1 text-2xl">{activeType.title}</CardTitle>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{activeType.summary}</p>
              </div>
              <div className="grid min-w-44 gap-2 text-right text-sm">
                <span className="font-mono text-muted-foreground">Seed {seed}</span>
                <span>{formatGrades(activeType.grades)}</span>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <Metric label="Audit" value={`${audit.checked - audit.failed.length}/${audit.checked}`} tone={audit.ok ? "good" : "warn"} />
              <Metric label="Correct" value={String(summary.correct)} tone="good" />
              <Metric label="Retry" value={String(summary.incorrect)} tone="warn" />
              <Metric label="Open" value={String(summary.unanswered)} tone="quiet" />
            </CardContent>
          </Card>

          <div className="print-surface">
            <WorksheetPreview
              worksheet={worksheet}
              answers={answers}
              checks={checks}
              setAnswers={setAnswers}
              checkQuestion={checkQuestion}
            />
          </div>
        </section>

        <aside className="console-inspector console-column no-print">
          <div className="sticky-pane">
            <Inspector
              activeType={activeType}
              activeFormat={resolvedFormat}
              setActiveFormat={selectActiveFormat}
              worksheet={worksheet}
              audit={audit}
              checkAll={checkAll}
              copyJson={copyJson}
              copyStatus={copyStatus}
            />
          </div>
        </aside>
      </main>
    </>
  );
}

function FilterRail(props: {
  query: string;
  setQuery: (value: string) => void;
  exactGrade: ExactGradeId | "";
  setExactGrade: (value: ExactGradeId | "") => void;
  gradeBand: GradeBandId | "";
  setGradeBand: (value: GradeBandId | "") => void;
  strand: Strand | "";
  setStrand: (value: Strand | "") => void;
  format: WorksheetFormat | "";
  setFormat: (value: WorksheetFormat | "") => void;
  itemCount: number;
  setItemCount: (value: number) => void;
  seed: number;
  setSeed: (value: number) => void;
  resetFilters: () => void;
  filteredTypes: WorksheetType[];
  selectType: (type: WorksheetType) => void;
}) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            Find
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={props.resetFilters}>
            <RefreshCcw />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Command className="border">
          <CommandInput placeholder="Search skills..." value={props.query} onValueChange={props.setQuery} />
          <CommandList>
            <CommandEmpty>
              <div className="grid gap-2 px-3 py-2">
                <Skeleton className="h-3 w-full" />
                <span>No generators match.</span>
              </div>
            </CommandEmpty>
            <CommandGroup heading={`${props.filteredTypes.length} matches`}>
              {props.filteredTypes.slice(0, 7).map((type) => (
                <CommandItem key={type.id} value={type.title} onSelect={() => props.selectType(type)}>
                  <Search className="mr-2 h-3.5 w-3.5" />
                  <span className="line-clamp-1">{type.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <div className="grid gap-2">
          <Label>Exact grade</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {exactGrades.map((grade) => (
              <Button
                key={grade.id}
                type="button"
                variant={props.exactGrade === grade.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  props.setExactGrade(props.exactGrade === grade.id ? "" : grade.id);
                  props.setGradeBand("");
                }}
              >
                {grade.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Grade band</Label>
          <Select
            value={props.gradeBand || "all"}
            onValueChange={(value) => {
              props.setGradeBand(value === "all" ? "" : value as GradeBandId);
              props.setExactGrade("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All bands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bands</SelectItem>
              {gradeBands.map((band) => (
                <SelectItem key={band.id} value={band.id}>{band.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Topic strand</Label>
          <Select value={props.strand || "all"} onValueChange={(value) => props.setStrand(value === "all" ? "" : value as Strand)}>
            <SelectTrigger>
              <SelectValue placeholder="All strands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All strands</SelectItem>
              {strands.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Format</Label>
          <Select value={props.format || "all"} onValueChange={(value) => props.setFormat(value === "all" ? "" : value as WorksheetFormat)}>
            <SelectTrigger>
              <SelectValue placeholder="All formats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All formats</SelectItem>
              {formatFamilies.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-2">
            <Label htmlFor="item-count">Items</Label>
            <Input
              id="item-count"
              type="number"
              min={3}
              max={12}
              value={itemCountDisplay(props.itemCount)}
              onChange={(event) => props.setItemCount(clamp(Number(event.target.value) || 6, 3, 12))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seed">Seed</Label>
            <Input
              id="seed"
              type="number"
              min={1}
              value={props.seed}
              onChange={(event) => props.setSeed(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorksheetPreview({
  worksheet,
  answers,
  checks,
  setAnswers,
  checkQuestion
}: {
  worksheet: Worksheet;
  answers: Record<string, string>;
  checks: ChecksByQuestion;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  checkQuestion: (question: WorksheetQuestion) => void;
}) {
  return (
    <article className="worksheet-paper p-6">
      <header className="mb-5 flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">Student page</p>
          <h2 className="mt-1 text-2xl font-semibold">{worksheet.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{worksheet.topic} / {worksheet.gradeBand} / {formatTitle(worksheet.metadata.format)}</p>
        </div>
        <div className="grid min-w-36 grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span className="answer-box px-2 py-1">Name</span>
          <span className="answer-box px-2 py-1">Date</span>
        </div>
      </header>

      <p className="mb-4 text-sm">{worksheet.instructions}</p>

      {worksheet.sections.map((section) => (
        <section key={section.id}>
          <ol className={cn("worksheet-grid", `format-${worksheet.metadata.format}`)}>
            {section.questions.map((question) => (
              <li key={question.id} className={cn("worksheet-item rounded-md border p-3", statusRing(checks[question.id]?.status))}>
                <p className="mb-3 font-medium">{question.prompt}</p>
                <div className="grid gap-3">
                  {question.content.map((block, index) => renderBlock(block, `${question.id}-${index}`))}
                  <div className="answer-controls flex flex-wrap items-end gap-2">
                    <div className="grid min-w-40 flex-1 gap-1">
                      <Label htmlFor={`answer-${question.id}`}>Answer {question.id.replace("q", "")}</Label>
                      <Input
                        id={`answer-${question.id}`}
                        value={answers[question.id] || ""}
                        onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                        aria-label={`Answer for ${question.prompt}`}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => checkQuestion(question)}>
                      <CheckCircle2 />
                      Check
                    </Button>
                  </div>
                  <p className={cn("digital-feedback text-xs", feedbackTone(checks[question.id]?.status))}>
                    {checks[question.id]?.notes || "Enter an answer, then check it."}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </article>
  );
}

function Inspector({
  activeType,
  activeFormat,
  setActiveFormat,
  worksheet,
  audit,
  checkAll,
  copyJson,
  copyStatus
}: {
  activeType: WorksheetType;
  activeFormat: WorksheetFormat;
  setActiveFormat: (format: WorksheetFormat) => void;
  worksheet: Worksheet;
  audit: ReturnType<typeof auditWorksheet>;
  checkAll: () => void;
  copyJson: () => void;
  copyStatus: string;
}) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          Build
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label>Worksheet format</Label>
          <div className="grid gap-2">
            {activeType.formats.map((format) => (
              <Button
                key={format}
                variant={activeFormat === format ? "default" : "outline"}
                className="justify-start"
                onClick={() => setActiveFormat(format)}
              >
                {formatTitle(format)}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="rules">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="rules">
            <ScrollArea className="h-[310px] pr-3">
              <div className="grid gap-4 text-sm">
                <InfoList title="Controls" items={activeType.controls} />
                <InfoList title="Validation" items={activeType.validationRules} />
                <div>
                  <h3 className="mb-1 text-sm font-semibold">Solution path</h3>
                  <p className="text-muted-foreground">{activeType.solution.level}: {activeType.solution.method}</p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="audit">
            <div className="grid gap-3">
              <Badge variant={audit.ok ? "success" : "warning"}>{audit.ok ? "All generated answers verified" : `${audit.failed.length} failed`}</Badge>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Answer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worksheet.answerKey.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">{entry.questionId}</TableCell>
                      <TableCell>{entry.answer.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button onClick={checkAll}>
                <CheckCircle2 />
                Check all entered answers
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="json">
            <div className="grid gap-3">
              <Button onClick={copyJson}>
                <FileJson />
                Copy worksheet JSON
              </Button>
              <p className="min-h-5 text-xs text-muted-foreground">{copyStatus}</p>
              <pre className="max-h-[260px] overflow-auto rounded-md border bg-muted p-3 font-mono text-xs">
                {JSON.stringify({
                  id: worksheet.id,
                  schemaVersion: worksheet.schemaVersion,
                  format: worksheet.metadata.format,
                  questions: worksheet.sections[0]?.questions.length || 0
                }, null, 2)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        <Button variant="outline" onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </CardContent>
    </Card>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="grid gap-1 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="rounded-md border bg-background px-2 py-1">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "quiet" }) {
  return (
    <div className={cn("rounded-md border bg-background p-3", tone === "good" && "border-emerald-200", tone === "warn" && "border-amber-200")}>
      <p className="font-mono text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function renderBlock(block: ContentBlock, key: string) {
  if (block.kind === "text" || block.kind === "answerBox") return null;
  if (block.kind === "visual" && block.visualType === "dots") {
    const count = Number(block.data.count || 0);
    return (
      <div key={key} className="dot-model" aria-label={block.alt}>
        {Array.from({ length: count }, (_, index) => <span key={index} />)}
      </div>
    );
  }
  if (block.kind === "visual" && block.visualType === "fractionBar") {
    const numerator = Number(block.data.numerator || 0);
    const denominator = Number(block.data.denominator || 1);
    return (
      <div key={key} className="fraction-bar" aria-label={block.alt}>
        {Array.from({ length: denominator }, (_, index) => (
          <span key={index} className={index < numerator ? "filled" : ""} />
        ))}
      </div>
    );
  }
  if (block.kind === "workspace") {
    return <div key={key} className={cn("min-h-12 rounded-md border", block.style === "ruled" && "workspace-ruled", block.style === "grid" && "workspace-grid")} />;
  }
  return null;
}

function summarizeChecks(worksheet: Worksheet, checks: ChecksByQuestion) {
  const total = worksheet.answerKey.length;
  const correct = Object.values(checks).filter((check) => check.status === "correct").length;
  const incorrect = Object.values(checks).filter((check) => check.status === "incorrect").length;
  return {
    correct,
    incorrect,
    unanswered: Math.max(0, total - correct - incorrect)
  };
}

function statusRing(status?: AnswerStatus) {
  if (status === "correct") return "border-emerald-300 bg-emerald-50/45";
  if (status === "incorrect") return "border-amber-300 bg-amber-50/55";
  return "bg-white";
}

function feedbackTone(status?: AnswerStatus) {
  if (status === "correct") return "text-emerald-700";
  if (status === "incorrect") return "text-amber-700";
  return "text-muted-foreground";
}

function itemCountDisplay(value: number) {
  return Number.isFinite(value) ? value : 6;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
