"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ContentBlock, Worksheet, WorksheetQuestion } from "@/types/worksheet";
import { CheckCircle2, LockKeyhole, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { answerForQuestion, checkAnswer, formatTitle, type AnswerStatus } from "../generator";
import type { ChecksByQuestion, PageSize } from "./types";

export function WorksheetPreview({
  worksheet,
  pageSize,
  answers,
  checks,
  lockedQuestionIds,
  setAnswers,
  setChecks,
  toggleQuestionLock,
  requestNewVersion
}: {
  worksheet: Worksheet;
  pageSize: PageSize;
  answers: Record<string, string>;
  checks: ChecksByQuestion;
  lockedQuestionIds: string[];
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  setChecks: Dispatch<SetStateAction<ChecksByQuestion>>;
  toggleQuestionLock: (questionId: string) => void;
  requestNewVersion: () => void;
}) {
  function checkQuestion(question: WorksheetQuestion) {
    const answer = answerForQuestion(worksheet, question);
    if (!answer) return;
    setChecks((current) => ({
      ...current,
      [question.id]: checkAnswer(answers[question.id] || "", answer)
    }));
  }

  return (
    <div className="preview-stack">
      <article className={cn("worksheet-page student-copy", pageSize === "a4" ? "page-a4" : "page-letter")} aria-label="Worksheet preview">
        <header className="worksheet-header">
          <div>
            <p className="worksheet-kicker">Student copy</p>
            <h2>{worksheet.title}</h2>
            <p>{worksheet.topic} / {worksheet.gradeBand} / {formatTitle(worksheet.metadata.format)}</p>
          </div>
          <div className="student-fields" aria-label="Student details">
            <span>Name</span>
            <span>Date</span>
          </div>
        </header>

        <p className="worksheet-directions">{worksheet.instructions}</p>

        {worksheet.sections.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-title`}>
            <h3 id={`${section.id}-title`} className="section-title">{section.title}</h3>
            <ol className={cn("worksheet-grid", `format-${worksheet.metadata.format}`)}>
              {section.questions.map((question) => (
                <li key={question.id} className={cn("worksheet-item", statusRing(checks[question.id]?.status))}>
                  <div className="question-title-row">
                    <p className="question-prompt">{question.prompt}</p>
                    <div className="question-actions no-print">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={lockedQuestionIds.includes(question.id) ? "secondary" : "ghost"}
                            size="icon"
                            aria-label={lockedQuestionIds.includes(question.id) ? `Unlock ${question.id}` : `Lock ${question.id}`}
                            onClick={() => toggleQuestionLock(question.id)}
                          >
                            <LockKeyhole aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{lockedQuestionIds.includes(question.id) ? "Unlock question" : "Lock question"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Make another version of ${question.id}`} onClick={requestNewVersion}>
                            <RefreshCcw aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Make another version</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="question-content">
                    {question.content.map((block, index) => renderBlock(block, `${question.id}-${index}`))}
                  </div>
                  <div className="answer-checker no-print">
                    <div className="answer-input">
                      <Label htmlFor={`answer-${question.id}`}>Answer {question.id.replace("q", "")}</Label>
                      <Input
                        id={`answer-${question.id}`}
                        name={`answer-${question.id}`}
                        autoComplete="off"
                        value={answers[question.id] || ""}
                        onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                        aria-describedby={`feedback-${question.id}`}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => checkQuestion(question)}>
                      <CheckCircle2 aria-hidden="true" />
                      Check
                    </Button>
                    <p id={`feedback-${question.id}`} className={cn("feedback", feedbackTone(checks[question.id]?.status))} aria-live="polite">
                      {checks[question.id]?.notes || "Ready to check."}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </article>

      <AnswerKeyPrintPage worksheet={worksheet} pageSize={pageSize} />
    </div>
  );
}

function AnswerKeyPrintPage({ worksheet, pageSize }: { worksheet: Worksheet; pageSize: PageSize }) {
  return (
    <article className={cn("worksheet-page answer-key-page", pageSize === "a4" ? "page-a4" : "page-letter")} aria-label="Printable answer key">
      <header className="worksheet-header">
        <div>
          <p className="worksheet-kicker">Answer key</p>
          <h2>{worksheet.title}</h2>
          <p>{worksheet.topic} / {worksheet.gradeBand}</p>
        </div>
      </header>
      <ol className="answer-key-print-list">
        {worksheet.answerKey.map((entry) => (
          <li key={entry.id}>
            <span>{entry.questionId.replace("q", "")}</span>
            <strong>{entry.answer.value}</strong>
          </li>
        ))}
      </ol>
    </article>
  );
}

function renderBlock(block: ContentBlock, key: string) {
  if (block.kind === "text") return null;
  if (block.kind === "math") return <p key={key} className="math-line" aria-label={block.alt}>{block.tex}</p>;
  if (block.kind === "table") {
    return (
      <table key={key} className="worksheet-data-table">
        {block.caption ? <caption>{block.caption}</caption> : null}
        <thead>
          <tr>{block.headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    );
  }
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
  if (block.kind === "visual") {
    return <div key={key} className="visual-placeholder" aria-label={block.alt}>{block.visualType}</div>;
  }
  if (block.kind === "workspace") {
    return <div key={key} className={cn("workspace-box", block.style === "ruled" && "workspace-ruled", block.style === "grid" && "workspace-grid", block.style === "largePrint" && "workspace-large")} />;
  }
  if (block.kind === "answerBox") {
    return <div key={key} className="print-answer-line" aria-label={block.label || "Answer box"} />;
  }
  if (block.kind === "choices") {
    return (
      <ul key={key} className="choice-list">
        {block.choices.map((choice) => <li key={choice.id}>{choice.label}. {choice.content}</li>)}
      </ul>
    );
  }
  return null;
}

function statusRing(status?: AnswerStatus) {
  if (status === "correct") return "is-correct";
  if (status === "incorrect") return "is-incorrect";
  return "";
}

function feedbackTone(status?: AnswerStatus) {
  if (status === "correct") return "text-emerald-700";
  if (status === "incorrect") return "text-amber-700";
  return "text-muted-foreground";
}
