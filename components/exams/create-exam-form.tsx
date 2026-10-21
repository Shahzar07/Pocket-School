'use client';

import { useEffect, useState } from 'react';
import { AlignLeft, Copy, GripVertical, ListChecks, Plus, Scale, Trash2 } from 'lucide-react';
import { LevelMenu } from '@/components/level-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Course, ExamQuestion } from '@/lib/db';
import { EXAM_BUILDER_COPY as copy, QUESTION_TYPES, questionTypeLabel } from '@/lib/exams/builder-copy';
import { boardsForLevel } from '@/lib/essay/board-styles';
import { subjectsForLevel } from '@/lib/programmes';

export interface ExamDraft {
  title: string;
  description: string;
  timeLimit: string;
  passingScore: string;
  status: 'draft' | 'published';
  availableFrom: string;
  availableTo: string;
}

const field = 'mt-1 h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-sm text-[var(--studio-text)]';
const label = 'text-xs font-semibold text-[var(--studio-dim)]';
const quiet = 'inline-flex h-10 items-center justify-center rounded-full border border-[#1E6A83] bg-transparent px-4 text-sm font-semibold text-[var(--studio-accent-text)]';
const publish = 'inline-flex h-10 items-center justify-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]';

function TypeIcon({ type }: { type: ExamQuestion['type'] }) {
  const Icon = type === 'true_false' ? Scale : type === 'short_answer' ? AlignLeft : ListChecks;
  return <Icon className="h-4 w-4 shrink-0 text-[var(--studio-accent-text)]" aria-hidden />;
}

export function CreateExamForm({
  draft,
  onDraft,
  questions,
  onQuestions,
  courses,
  courseId,
  onCourse,
  saving,
  onSave,
}: {
  draft: ExamDraft;
  onDraft: (next: ExamDraft) => void;
  questions: ExamQuestion[];
  onQuestions: (next: ExamQuestion[]) => void;
  courses: Course[];
  courseId: string;
  onCourse: (id: string) => void;
  saving: boolean;
  onSave: (status: 'draft' | 'published', extra: { level: string; subject: string; boardStyle: string }) => void;
}) {
  const [level, setLevel] = useState('igcse');
  const [subject, setSubject] = useState('');
  const [boardStyle, setBoardStyle] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const subjects = subjectsForLevel(level);
  const boards = boardsForLevel(level);
  const marks = questions.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  const countLabel = questions.length === 1 ? copy.question : copy.questions;

  useEffect(() => {
    if (!boards.some((item) => item.id === boardStyle)) setBoardStyle(boards[0]?.id ?? '');
  }, [boards, boardStyle]);

  function patchQuestion(index: number, patch: Partial<ExamQuestion>) {
    onQuestions(questions.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function changeType(index: number, type: ExamQuestion['type']) {
    patchQuestion(index, {
      type,
      answer: '',
      options: type === 'multiple_choice' ? ['', '', '', ''] : undefined,
    });
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    onQuestions(questions.map((item, i) => {
      if (i !== qIndex) return item;
      const options = [...(item.options ?? [])];
      options[oIndex] = value;
      return { ...item, options };
    }));
  }

  function duplicateQuestion(index: number) {
    const source = questions[index];
    if (!source) return;
    const copyQuestion: ExamQuestion = {
      ...source,
      id: crypto.randomUUID(),
      options: source.options ? [...source.options] : undefined,
    };
    const next = [...questions];
    next.splice(index + 1, 0, copyQuestion);
    onQuestions(next);
  }

  function removeQuestion(index: number) {
    if (!window.confirm(copy.deleteQuestion)) return;
    onQuestions(questions.filter((_, i) => i !== index));
  }

  function moveQuestion(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= questions.length || to >= questions.length) return;
    const next = [...questions];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    onQuestions(next);
  }

  function changeLevel(next: string) {
    setLevel(next);
    const nextSubjects = subjectsForLevel(next);
    if (subject && !nextSubjects.includes(subject)) setSubject('');
  }

  const extra = { level, subject, boardStyle };
  const settings = (
    <div className="space-y-3">
      <div>
        <p className={label}>{copy.level}</p>
        <div className="mt-1">
          <LevelMenu value={level} onChange={changeLevel} ariaLabel={copy.level} className="w-full" />
        </div>
      </div>
      <label className="block">
        <span className={label}>{copy.subject}</span>
        <select className={field} value={subject} aria-label={copy.subject} onChange={(event) => setSubject(event.target.value)}>
          <option value="">{copy.chooseSubject}</option>
          {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="block">
        <span className={label}>{copy.board}</span>
        <select className={field} value={boardStyle} aria-label={copy.board} onChange={(event) => setBoardStyle(event.target.value)}>
          {boards.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className={label}>{copy.timeLimit}</span>
        <Input type="number" value={draft.timeLimit} onChange={(event) => onDraft({ ...draft, timeLimit: event.target.value })} placeholder={copy.noLimit} className={field} />
      </label>
      <label className="block">
        <span className={label}>{copy.passingScore}</span>
        <Input type="number" value={draft.passingScore} onChange={(event) => onDraft({ ...draft, passingScore: event.target.value })} className={field} />
      </label>
      <label className="block">
        <span className={label}>{copy.availableFrom}</span>
        <Input type="datetime-local" value={draft.availableFrom} onChange={(event) => onDraft({ ...draft, availableFrom: event.target.value })} className={field} />
      </label>
      <label className="block">
        <span className={label}>{copy.availableTo}</span>
        <Input type="datetime-local" value={draft.availableTo} onChange={(event) => onDraft({ ...draft, availableTo: event.target.value })} className={field} />
      </label>
      <div>
        <p className={label}>{copy.status}</p>
        <Select value={draft.status} onValueChange={(value) => onDraft({ ...draft, status: value as ExamDraft['status'] })}>
          <SelectTrigger className="mt-1 h-11 w-full"><SelectValue>{draft.status === 'published' ? copy.published : copy.draft}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{copy.draft}</SelectItem>
            <SelectItem value="published">{copy.published}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="block">
        <span className={label}>{copy.allocate}</span>
        <select className={field} value={courseId} aria-label={copy.allocate} onChange={(event) => onCourse(event.target.value)}>
          {courses.length === 0 ? <option value="">{copy.noCourse}</option> : null}
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <div data-exam-builder="create" className="w-full">
      <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--studio-border)] bg-[var(--studio-bg)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="text-sm font-semibold text-[var(--studio-text)]">
          {questions.length} {countLabel} · {copy.total} {marks} {copy.marks}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={quiet} disabled={saving} onClick={() => onSave('draft', extra)}>{copy.saveDraft}</button>
          <button type="button" className={quiet} aria-pressed={preview} onClick={() => setPreview((open) => !open)}>{preview ? copy.closePreview : copy.preview}</button>
          <button type="button" className={publish} disabled={saving} onClick={() => onSave('published', extra)}>{copy.publish}</button>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--studio-accent-text)]">{copy.newAssessment}</p>
            <h2 className="mt-1 font-heading text-3xl tracking-tight text-[var(--studio-text)]">{copy.createExam}</h2>
          </div>
          {preview ? (
            <section aria-label={copy.preview} className="space-y-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5">
              <h3 className="font-heading text-2xl text-[var(--studio-text)]">{draft.title.trim() || copy.untitled}</h3>
              {draft.description ? <p className="text-sm text-[var(--studio-dim)]">{draft.description}</p> : null}
              <ol className="space-y-4">
                {questions.map((item, index) => (
                  <li key={item.id}>
                    <p className="text-sm font-semibold text-[var(--studio-text)]">{index + 1}. {item.question || copy.questionText}</p>
                    <p className="mt-1 text-xs text-[var(--studio-dim)]">{questionTypeLabel(item.type)} · {item.points} pts</p>
                    {item.type === 'multiple_choice' ? (
                      <ul className="mt-2 space-y-1 text-sm text-[var(--studio-text)]">
                        {(item.options ?? []).map((option, optionIndex) => <li key={optionIndex}>{String.fromCharCode(65 + optionIndex)}. {option}</li>)}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <label className="block">
            <span className={label}>{copy.title}</span>
            <Input value={draft.title} onChange={(event) => onDraft({ ...draft, title: event.target.value })} placeholder={copy.examTitle} className={field} />
          </label>
          <label className="block">
            <span className={label}>{copy.description}</span>
            <Textarea value={draft.description} onChange={(event) => onDraft({ ...draft, description: event.target.value })} rows={4} className="mt-1 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-2 text-sm text-[var(--studio-text)]" />
          </label>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--studio-accent-text)]">{copy.questionsTitle}</p>
                <h3 className="font-heading text-xl text-[var(--studio-text)]">{questions.length} {questions.length === 1 ? copy.questionTitle : copy.questionsTitle}</h3>
              </div>
              <button
                type="button"
                className={quiet}
                onClick={() => onQuestions([...questions, { id: crypto.randomUUID(), type: 'multiple_choice', question: '', options: ['', '', '', ''], answer: '', points: 1 }])}
              >
                <Plus className="me-1 h-4 w-4" aria-hidden /> {copy.addQuestion}
              </button>
            </div>
            {questions.map((item, index) => (
              <article
                key={item.id}
                className="scroll-mt-24 space-y-3 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 sm:p-5"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) moveQuestion(dragIndex, index);
                  setDragIndex(null);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      draggable
                      aria-label={`${copy.reorder} ${index + 1}`}
                      className="grid h-9 w-9 shrink-0 cursor-grab place-items-center rounded-lg text-[var(--studio-accent-text)]"
                      onDragStart={() => setDragIndex(index)}
                      onDragEnd={() => setDragIndex(null)}
                    >
                      <GripVertical className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="text-sm font-semibold text-[var(--studio-text)]">Q{index + 1}</span>
                    <TypeIcon type={item.type} />
                    <Select value={item.type} onValueChange={(value) => changeType(index, value as ExamQuestion['type'])}>
                      <SelectTrigger className="h-9 min-w-40" aria-label={questionTypeLabel(item.type)}>
                        <SelectValue>{questionTypeLabel(item.type)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} value={item.points} onChange={(event) => patchQuestion(index, { points: Number(event.target.value) })} className="h-9 w-16 text-sm" />
                    <span className="text-xs text-[var(--studio-dim)]">{copy.points}</span>
                    <button type="button" className={quiet} onClick={() => duplicateQuestion(index)}>{copy.duplicate}</button>
                    <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[var(--studio-accent-text)]" aria-label={copy.deleteQuestion} onClick={() => removeQuestion(index)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <Textarea value={item.question} onChange={(event) => patchQuestion(index, { question: event.target.value })} placeholder={copy.questionText} rows={4} className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] px-3 py-2 text-sm text-[var(--studio-text)]" />
                {item.type === 'multiple_choice' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(item.options ?? []).map((option, optionIndex) => (
                      <Input key={optionIndex} value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} className="bg-[var(--studio-bg)] text-sm" />
                    ))}
                  </div>
                ) : null}
                {item.type === 'true_false' ? (
                  <Select value={item.answer} onValueChange={(value) => patchQuestion(index, { answer: value ?? '' })}>
                    <SelectTrigger className="w-40"><SelectValue placeholder={copy.answer}>{item.answer || copy.answer}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="True">{copy.trueLabel}</SelectItem>
                      <SelectItem value="False">{copy.falseLabel}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--studio-dim)]">{copy.correctAnswer}</span>
                  {item.type === 'multiple_choice' ? (
                    <Select value={item.answer} onValueChange={(value) => patchQuestion(index, { answer: value ?? '' })}>
                      <SelectTrigger className="h-9 w-48 text-sm"><SelectValue placeholder={copy.select}>{item.answer || copy.select}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {(item.options ?? []).map((option, optionIndex) => {
                          if (!option) return null;
                          return <SelectItem key={optionIndex} value={option}>{option}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {item.type === 'short_answer' ? (
                    <Input value={item.answer} onChange={(event) => patchQuestion(index, { answer: event.target.value })} placeholder={copy.modelAnswer} className="h-9 flex-1 bg-[var(--studio-bg)] text-sm" />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="order-first lg:sticky lg:top-20 lg:order-none lg:col-start-2 lg:row-start-1" data-exam-settings>
          <button
            type="button"
            className={`${quiet} mb-3 w-full lg:hidden`}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            {copy.settings}
          </button>
          <div data-exam-settings-panel className={`${settingsOpen ? 'block' : 'hidden'} rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 lg:block`}>
            {settings}
          </div>
        </aside>
      </div>
    </div>
  );
}
