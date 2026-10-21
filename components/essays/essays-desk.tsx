'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PenLine, Upload } from 'lucide-react';
import { HandwritingCapture } from '@/components/handwriting-capture';
import { toast } from 'sonner';
import { EssayDelivery } from '@/components/essays/essay-delivery';
import { EssayGrades } from '@/components/essays/essay-grades';
import { QuestionGenerator } from '@/components/essays/question-generator';
import { importFile } from '@/components/editor/import-file';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { LevelMenu } from '@/components/level-menu';
import { essayLevelLabel, type EssayLevel } from '@/lib/essays/coaching';
import { resolveLevel } from '@/lib/levels';
import { ESSAY_FLAG_MESSAGE, ESSAY_FLAG_STATUS } from '@/lib/essays/config';
import { essayPdfLines, markEssay, placeNotes, type EssayMark } from '@/lib/essays/mark';
import { guardPlan, planForPolicy, type EssayPlan } from '@/lib/essays/plan';
import type { GeneratedEssayQuestion } from '@/lib/essays/questions';
import {
  readEssays,
  readPolicy,
  statusText,
  writeEssays,
  type AssistEntry,
  type EssayEvidence,
  type EssayStatus,
  type StoredEssay,
} from '@/lib/essays/store';
import { gradeIfClear, planningAllowed, reviewSubmission } from '@/lib/essays/submit';
import { applyCapture, captureToSignals, emptyCapture, type CaptureState } from '@/lib/insights/integrity-capture';
import { saveIntegrityCase } from '@/lib/insights/client';

type DeskMode = 'question' | 'plan' | 'write' | 'history';

async function postEssay(kind: 'plan' | 'mark', payload: Record<string, unknown>): Promise<{ plan?: EssayPlan; mark?: EssayMark } | null> {
  try {
    const res = await fetch('/api/essays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...payload }),
    });
    if (!res.ok) return null;
    return await res.json() as { plan?: EssayPlan; mark?: EssayMark };
  } catch {
    return null;
  }
}

export function EssaysDesk() {
  const pathname = usePathname() ?? '';
  const reviewHref = pathname.startsWith('/dashboard') ? '/dashboard/studio/essays/review' : '/studio/essays/review';
  const user = useAuthSTORE(state => state.user);
  const profile = useAuthSTORE(state => state.profile);
  const email = user?.email ?? profile?.email;
  const [mode, setMode] = useState<DeskMode>('question');
  const [level, setLevel] = useState<EssayLevel>('igcse');
  const [prompt, setPrompt] = useState('');
  const [idea, setIdea] = useState('');
  const [title, setTitle] = useState('Untitled essay');
  const [body, setBody] = useState('');
  const [mark, setMark] = useState<EssayMark | null>(null);
  const [plan, setPlan] = useState<EssayPlan | null>(null);
  const [question, setQuestion] = useState<GeneratedEssayQuestion | null>(null);
  const [status, setStatus] = useState<EssayStatus>('draft');
  const [message, setMessage] = useState('');
  const [evidence, setEvidence] = useState<EssayEvidence[]>([]);
  const [assist, setAssist] = useState<AssistEntry[]>([]);
  const [history, setHistory] = useState<StoredEssay[]>([]);
  const [planningEnabled, setPlanningEnabled] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const activeRef = useRef<string | null>(null);
  const captureRef = useRef<CaptureState>(emptyCapture(Date.now()));
  const caseRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setHistory(readEssays());
    setPlanningEnabled(readPolicy().planningEnabled);
  }, []);

  function remember(next: Partial<StoredEssay> & { body: string; title: string }) {
    const id = activeRef.current ?? crypto.randomUUID();
    activeRef.current = id;
    const saved: StoredEssay = {
      id,
      title: next.title,
      prompt,
      idea,
      level,
      body: next.body,
      mark: next.mark === undefined ? mark : next.mark,
      status: next.status ?? status,
      message: next.message ?? message,
      plan: next.plan === undefined ? plan : next.plan,
      question: next.question === undefined ? question : next.question,
      assist: next.assist ?? assist,
      evidence: next.evidence ?? evidence,
      caseId: next.caseId === undefined ? caseRef.current : next.caseId,
      updatedAt: Date.now(),
    };
    if (next.mark !== undefined) saved.mark = next.mark;
    setHistory(current => {
      const essays = [saved, ...current.filter(item => item.id !== id)];
      writeEssays(essays);
      return essays;
    });
  }

  function logAssist(entry: AssistEntry, extra?: Partial<StoredEssay>) {
    const next = [...assist, entry];
    setAssist(next);
    remember({ body, title, assist: next, ...extra });
  }

  function useQuestion(next: GeneratedEssayQuestion) {
    setQuestion(next);
    setPrompt(next.question);
    setLevel(next.level);
    if (title === 'Untitled essay') setTitle(next.subject);
    setMark(null);
    setStatus('draft');
    setMessage('');
    setMode('write');
    const entry: AssistEntry = {
      at: Date.now(),
      kind: 'question',
      note: `ET AI set the question for ${next.subject}. The essay itself is still the student's.`,
    };
    const nextAssist = [...assist, entry];
    setAssist(nextAssist);
    const id = activeRef.current ?? crypto.randomUUID();
    activeRef.current = id;
    const saved: StoredEssay = {
      id,
      title: title === 'Untitled essay' ? next.subject : title,
      prompt: next.question,
      idea,
      level: next.level,
      body,
      mark: null,
      status: 'draft',
      message: '',
      plan,
      question: next,
      assist: nextAssist,
      evidence,
      caseId: caseRef.current,
      updatedAt: Date.now(),
    };
    setHistory(current => {
      const essays = [saved, ...current.filter(item => item.id !== id)];
      writeEssays(essays);
      return essays;
    });
    toast.success('Question added to the editor.');
  }

  async function planWithAi() {
    const policy = readPolicy();
    setPlanningEnabled(policy.planningEnabled);
    const local = planForPolicy(policy, { idea, prompt, level });
    if (!local) {
      toast.message('Planning help is off for this assessment.');
      return;
    }
    setPlan(local);
    const entries: AssistEntry[] = [
      ...assist,
      { at: Date.now(), kind: 'plan', note: 'ET AI planned this essay: a brainstorm, an outline, and one thesis. No essay paragraphs were written.' },
      { at: Date.now() + 1, kind: 'exemplar', note: `ET AI showed a short exemplar on a different question: ${local.exemplarQuestion}` },
    ];
    setAssist(entries);
    remember({ body, title, plan: local, assist: entries, mark, status, message, evidence });
    setPlanning(true);
    const remote = await postEssay('plan', { idea, prompt, level, planningEnabled: policy.planningEnabled });
    setPlanning(false);
    if (remote?.plan && Array.isArray(remote.plan.brainstorm)) {
      const safe = guardPlan({
        brainstorm: remote.plan.brainstorm,
        outline: Array.isArray(remote.plan.outline) ? remote.plan.outline : [],
        thesis: remote.plan.thesis ?? '',
        exemplarQuestion: remote.plan.exemplarQuestion ?? '',
        exemplar: remote.plan.exemplar ?? '',
      }, local, prompt);
      setPlan(safe);
      remember({ body, title, plan: safe, assist: entries, mark, status, message, evidence });
    }
  }

  function resetCapture() {
    captureRef.current = emptyCapture(Date.now());
  }

  async function submit(options?: { handwritten?: boolean; text?: string; assist?: AssistEntry[] }) {
    const essayBody = (options?.text ?? body).trim();
    const handwritten = options?.handwritten === true;
    const baseAssist = options?.assist ?? assist;
    if (!essayBody) {
      toast.error('Write the essay before submitting.');
      return;
    }
    if (options?.text) setBody(options.text);
    setChecking(true);
    let modelScore = 0;
    if (!handwritten) {
      const integrity = new AbortController();
      const integrityTimer = setTimeout(() => integrity.abort(), 4000);
      try {
        const res = await fetch('/api/ai/integrity-check', {
          method: 'POST',
          signal: integrity.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: essayBody, assignmentTitle: title }),
        });
        if (res.ok) {
          const data = await res.json() as { aiScore?: number };
          if (typeof data.aiScore === 'number') modelScore = data.aiScore;
        }
      } catch {
        modelScore = 0;
      } finally {
        clearTimeout(integrityTimer);
      }
    }
    const signals = handwritten
      ? { pasteEvents: 0, largeInsertChars: 0, aiLikelihood: 0 }
      : {
        ...captureToSignals(captureRef.current, Date.now()),
        aiLikelihood: modelScore,
      };
    const review = reviewSubmission({ body: essayBody, signals, title, handwritten });
    if (review.flagged) {
      const localMark = markEssay({ body: essayBody, prompt, level, board: question?.board });
      const withheld = gradeIfClear(review, localMark);
      setMark(withheld);
      setStatus('flagged');
      setMessage(ESSAY_FLAG_MESSAGE);
      setEvidence(review.evidence);
      const entries: AssistEntry[] = [
        ...baseAssist,
        { at: Date.now(), kind: 'submit', note: 'Submitted for marking.' },
        { at: Date.now() + 1, kind: 'flag', note: ESSAY_FLAG_MESSAGE },
      ];
      setAssist(entries);
      let caseId = caseRef.current;
      if (user) {
        const studentName = profile?.name || user.displayName || 'A student';
        try {
          const saved = await authedFetch('/api/essays/flag', {
            method: 'POST',
            body: JSON.stringify({ title, studentName, evidence: review.evidence, score: review.score }),
          });
          if (typeof saved.caseId === 'string') caseId = saved.caseId;
          if (saved.saved !== true) {
            caseId = await saveIntegrityCase({
              studentId: user.uid,
              studentName,
              assignmentTitle: title,
              source: 'et-essays',
              decision: 'pending',
              automaticPenalty: false,
              level: 'concern',
              score: review.score,
              evidence: review.evidence,
              studentSummary: ESSAY_FLAG_MESSAGE,
            }).catch(() => caseId);
          }
        } catch {
          caseId = await saveIntegrityCase({
            studentId: user.uid,
            studentName,
            assignmentTitle: title,
            source: 'et-essays',
            decision: 'pending',
            automaticPenalty: false,
            level: 'concern',
            score: review.score,
            evidence: review.evidence,
            studentSummary: ESSAY_FLAG_MESSAGE,
          }).catch(() => caseId);
        }
      }
      caseRef.current = caseId;
      remember({
        body: essayBody,
        title,
        mark: null,
        status: 'flagged',
        message: ESSAY_FLAG_MESSAGE,
        evidence: review.evidence,
        assist: entries,
        caseId,
      });
      setChecking(false);
      return;
    }

    const local = markEssay({ body: essayBody, prompt, level, board: question?.board });
    setMark(local);
    setStatus('marked');
    setMessage(review.message);
    setEvidence(review.evidence);
    const entries: AssistEntry[] = [...baseAssist, { at: Date.now(), kind: 'submit', note: handwritten ? 'Handwritten work submitted for marking. Paste and AI-likelihood checks were skipped.' : 'Submitted for marking.' }];
    setAssist(entries);
    remember({ body: essayBody, title, mark: local, status: 'marked', message: review.message, evidence: review.evidence, assist: entries });
    const remote = await postEssay('mark', { body: essayBody, prompt, level });
    setChecking(false);
    if (remote?.mark) {
      setMark(remote.mark);
      remember({ body: essayBody, title, mark: remote.mark, status: 'marked', message: review.message, evidence: review.evidence, assist: entries });
    }
  }

  async function onHandwriting(text: string) {
    resetCapture();
    setMode('write');
    setMark(null);
    setStatus('draft');
    setMessage('');
    const entries: AssistEntry[] = [
      ...assist,
      { at: Date.now(), kind: 'handwriting', note: 'A handwritten photo was read. Paste and AI-likelihood checks were not applied.' },
    ];
    setAssist(entries);
    await submit({ handwritten: true, text, assist: entries });
  }

  function rewrite() {
    resetCapture();
    setStatus('draft');
    setMessage('');
    setMark(null);
    setEvidence([]);
    const entries: AssistEntry[] = [...assist, { at: Date.now(), kind: 'resubmit', note: 'The student started a rewrite. The earlier flag stays in this log.' }];
    setAssist(entries);
    remember({ body, title, mark: null, status: 'draft', message: '', evidence: [], assist: entries });
    setMode('write');
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    try {
      const result = await importFile(file);
      const text = result.blocks.map(block => [block.title, block.body].filter(Boolean).join('\n')).join('\n\n').trim();
      if (!text) {
        toast.error('ET AI needs the essay as text.');
        return;
      }
      captureRef.current = applyCapture(captureRef.current, { type: 'paste' });
      captureRef.current = applyCapture(captureRef.current, { type: 'input', length: text.length });
      setBody(text);
      setTitle(result.sourceName || file.name);
      setMark(null);
      setStatus('draft');
      setMode('write');
      toast.success('Essay loaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That file could not be read.');
    }
  }

  function openSaved(item: StoredEssay) {
    activeRef.current = item.id;
    caseRef.current = item.caseId;
    setTitle(item.title);
    setPrompt(item.prompt);
    setIdea(item.idea);
    setLevel(resolveLevel(item.level) ?? 'igcse');
    setBody(item.body);
    setMark(item.status === 'flagged' ? null : item.mark);
    setPlan(item.plan);
    setQuestion(item.question);
    setStatus(item.status);
    setMessage(item.message);
    setEvidence(item.evidence);
    setAssist(item.assist);
    resetCapture();
    setMode(item.status === 'flagged' ? 'write' : item.mark ? 'write' : item.plan ? 'plan' : 'write');
  }

  const showMark = mark && status !== 'flagged';
  const placed = placeNotes(body, showMark ? mark.inline : []);
  const planningOn = planningAllowed({ planningEnabled });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm font-semibold">
          Level
          <LevelMenu ariaLabel="Level" value={level} onChange={next => setLevel((resolveLevel(next) ?? 'igcse') as EssayLevel)} className="mt-1 min-w-[16rem]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-border p-1" role="tablist" aria-label="ET Essays">
            {([
              ['question', 'Question'],
              ['plan', 'Plan'],
              ['write', 'Write'],
              ['history', 'History'],
            ] as const).map(([item, label]) => (
              <button
                key={item}
                type="button"
                role="tab"
                data-testid={`${item}-tab`}
                aria-selected={mode === item}
                onClick={() => setMode(item)}
                className={`h-9 rounded-full px-4 text-sm font-semibold ${mode === item ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Link href={reviewHref} className="text-sm font-semibold text-primary hover:underline">Teacher review</Link>
        </div>
      </div>

      {mode === 'history' ? (
        <ul className="space-y-2">
          {history.length === 0 && <li className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No essays yet. A question, a plan, or a mark is kept on this device.</li>}
          {history.map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => openSaved(item)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left">
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="text-[13px] text-muted-foreground">{essayLevelLabel(item.level)} · {statusText(item)}</span>
                </span>
                <PenLine className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      ) : mode === 'question' ? (
        <QuestionGenerator level={level} onUse={useQuestion} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Question
              <textarea data-testid="essay-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Use a question from ET AI, or write your own." className="mt-1 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 font-normal" />
            </label>
            {question && (
              <p className="text-sm text-muted-foreground" data-testid="editor-guidance">{question.guidance}</p>
            )}
            {mode === 'plan' && (
              <label className="block text-sm font-semibold">
                Idea
                <textarea aria-label="Idea" value={idea} onChange={event => setIdea(event.target.value)} placeholder="A harbour that keeps a lost letter" className="mt-1 min-h-16 w-full rounded-xl border border-border bg-background px-3 py-2 font-normal" />
              </label>
            )}
            {mode === 'write' && (
              <label className="block text-sm font-semibold">
                Essay
                <textarea
                  aria-label="Essay"
                  data-testid="essay-body"
                  value={body}
                  onPaste={() => { captureRef.current = applyCapture(captureRef.current, { type: 'paste' }); }}
                  onBlur={() => { captureRef.current = applyCapture(captureRef.current, { type: 'blur' }); }}
                  onChange={event => {
                    const next = event.target.value;
                    captureRef.current = applyCapture(captureRef.current, { type: 'input', length: next.length });
                    setBody(next);
                    if (status === 'marked' || status === 'released') {
                      setMark(null);
                      setStatus('draft');
                    }
                  }}
                  placeholder="Write the essay here. ET AI will not write it for you."
                  className="mt-1 min-h-72 w-full rounded-xl border border-border bg-background px-3 py-2 font-normal leading-relaxed"
                />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {mode === 'plan' && (
                <button type="button" data-testid="plan-with-et" disabled={!planningOn || planning} onClick={() => void planWithAi()} className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {planning ? 'ET AI is planning…' : 'Plan with ET AI'}
                </button>
              )}
              {mode === 'write' && (
                <>
                  <button type="button" data-testid="submit-essay" disabled={checking} onClick={() => void submit()} className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {checking ? 'ET AI is checking…' : 'Submit for marking'}
                  </button>
                  <HandwritingCapture disabled={checking} onText={onHandwriting} />
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold">
                    <Upload className="h-4 w-4" /> Upload
                    <input aria-label="Upload an essay" type="file" accept=".txt,.md,.docx,.pdf,.html,.htm" className="sr-only" onChange={event => { void onUpload(event.target.files?.[0]); event.target.value = ''; }} />
                  </label>
                </>
              )}
            </div>
            {mode === 'plan' && !planningOn && (
              <p className="text-sm text-muted-foreground">Planning help is off for this assessment.</p>
            )}
            {mode === 'write' && (
              <p className="text-sm text-muted-foreground">Typed work is checked for paste and writing that appears AI-generated. A handwritten photo is read and marked straight away, without those checks.</p>
            )}
          </div>

          <div className="space-y-4">
            {status === 'flagged' && (
              <div className="rounded-2xl border border-border bg-card p-4" data-testid="essay-status">
                <p className="font-semibold">{ESSAY_FLAG_STATUS}</p>
                <p className="mt-2 text-sm leading-relaxed">{message || ESSAY_FLAG_MESSAGE}</p>
                <button type="button" onClick={rewrite} className="mt-3 h-10 rounded-full border border-border px-4 text-sm font-semibold">
                  Rewrite and submit
                </button>
              </div>
            )}
            {mode === 'plan' && plan && planningOn && (
              <div className="space-y-3" data-testid="essay-plan">
                <section>
                  <h2 className="text-sm font-semibold">Brainstorm</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.brainstorm.map(item => <li key={item}>{item}</li>)}</ul>
                </section>
                <section>
                  <h2 className="text-sm font-semibold">Outline</h2>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{plan.outline.map(item => <li key={item}>{item}</li>)}</ol>
                </section>
                <section>
                  <h2 className="text-sm font-semibold">Thesis</h2>
                  <p className="mt-2 text-sm">{plan.thesis}</p>
                </section>
                <section className="rounded-2xl border border-dashed border-border p-3">
                  <h2 className="text-sm font-semibold">A different question</h2>
                  <p className="mt-2 text-sm font-medium">{plan.exemplarQuestion}</p>
                  <p className="mt-2 text-sm leading-relaxed">{plan.exemplar}</p>
                  <p className="mt-2 text-[13px] text-muted-foreground">This is not your essay.</p>
                </section>
              </div>
            )}
            {showMark ? (
              <>
                <EssayGrades mark={mark} />
                {question && <p className="text-sm text-muted-foreground">{question.guidance}</p>}
                <p className="text-sm leading-relaxed">{mark.summary}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {mark.rubric.map(item => (
                    <li key={item.criterion} className="rounded-2xl border border-border bg-card p-3">
                      <p className="text-sm font-semibold">{item.label} · {item.score}/25</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">{item.note}</p>
                    </li>
                  ))}
                </ul>
                <section>
                  <h2 className="text-sm font-semibold">Inline suggestions</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {placed.map((part, index) => part.suggestion ? (
                      <mark key={index} className="bg-[var(--ps-cyan-soft)] text-foreground" title={part.suggestion}>{part.text}</mark>
                    ) : <span key={index}>{part.text}</span>)}
                  </p>
                </section>
                <section>
                  <h2 className="text-sm font-semibold">What to fix next</h2>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                    {mark.fixNext.map(item => <li key={item}>{item}</li>)}
                  </ol>
                </section>
                <EssayDelivery
                  title={title}
                  holderEmail={email ?? undefined}
                  lines={essayPdfLines({ title, level, body, mark, guidance: question?.guidance })}
                />
              </>
            ) : status !== 'flagged' && !(mode === 'plan' && plan && planningOn) && (
              <div className="rounded-2xl border border-dashed border-border p-5 text-sm leading-relaxed text-muted-foreground">
                ET AI can set a question, then help you plan. You write the essay. A mark shows a 9–1 grade, a letter from A* to U, and a percentage.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
