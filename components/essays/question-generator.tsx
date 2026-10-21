'use client';

import { useEffect, useRef, useState } from 'react';
import { essayLevelLabel, type EssayLevel } from '@/lib/essays/coaching';
import { BoardMenu } from '@/components/essays/board-menu';
import {
  ESSAY_SUBJECTS,
  ESSAY_TYPES,
  generateEssayQuestion,
  questionGuidance,
  readRecentQuestions,
  topicsFromText,
  writeRecentQuestions,
  type EssayType,
  type GeneratedEssayQuestion,
} from '@/lib/essays/questions';

export function QuestionGenerator({
  level,
  onUse,
}: {
  level: EssayLevel;
  onUse: (question: GeneratedEssayQuestion) => void;
}) {
  const [subject, setSubject] = useState<string>(ESSAY_SUBJECTS[2] ?? 'History');
  const [customSubject, setCustomSubject] = useState('');
  const [topics, setTopics] = useState('trade, cities');
  const [type, setType] = useState<EssayType>('argumentative');
  const [board, setBoard] = useState('cambridge');
  const [current, setCurrent] = useState<GeneratedEssayQuestion | null>(null);
  const recentRef = useRef<string[]>([]);
  const nonceRef = useRef(0);

  function chosenSubject() {
    return subject === 'other' ? customSubject.trim() || 'the subject' : subject;
  }

  function draw(nonce: number) {
    const next = generateEssayQuestion({
      subject: chosenSubject(),
      level,
      topics: topicsFromText(topics),
      type,
      board,
      recent: recentRef.current,
      nonce,
    });
    const remembered = [next.question, ...recentRef.current.filter(item => item !== next.question)].slice(0, 12);
    recentRef.current = remembered;
    writeRecentQuestions(remembered);
    setCurrent(next);
  }

  useEffect(() => {
    recentRef.current = readRecentQuestions();
    draw(0);
    // The first question uses the starting subject, topics, and level.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const guide = questionGuidance(level, board);
    setCurrent(current => current ? { ...current, ...guide, level } : current);
  }, [level, board]);

  function shuffle() {
    nonceRef.current += 1;
    draw(nonceRef.current);
  }

  return (
    <div className="space-y-4" data-testid="essay-generator">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Subject
          <select aria-label="Subject" value={subject} onChange={event => setSubject(event.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-border bg-background px-3 font-normal">
            {ESSAY_SUBJECTS.map(item => <option key={item} value={item}>{item}</option>)}
            <option value="other">Another subject</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Essay type
          <select aria-label="Essay type" value={type} onChange={event => setType(event.target.value as EssayType)} className="mt-1 block h-11 w-full rounded-xl border border-border bg-background px-3 font-normal">
            {ESSAY_TYPES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Topics
          <input aria-label="Topics" value={topics} onChange={event => setTopics(event.target.value)} placeholder="trade, cities" className="mt-1 block h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" />
        </label>
        <div className="text-sm font-semibold sm:col-span-2">
          Exam board style
          <BoardMenu level={level} value={board} onChange={setBoard} />
        </div>
        {subject === 'other' && (
          <label className="text-sm font-semibold sm:col-span-2">
            Subject name
            <input aria-label="Subject name" value={customSubject} onChange={event => setCustomSubject(event.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="shuffle-question" onClick={shuffle} className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Shuffle / new question
        </button>
        <button
          type="button"
          data-testid="use-question"
          disabled={!current}
          onClick={() => current && onUse(current)}
          className="h-10 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-50"
        >
          Use this question
        </button>
      </div>
      {current && (
        <article className="rounded-2xl border border-border bg-card p-4" data-testid="essay-question">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {current.subject} · {essayLevelLabel(current.level)} · {ESSAY_TYPES.find(item => item.id === current.type)?.label}
          </p>
          <p className="mt-2 text-lg font-semibold leading-snug">{current.question}</p>
          <p className="mt-3 text-sm text-muted-foreground" data-testid="question-guidance">{current.guidance}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">ET AI writes the question, not the essay. Shuffle skips questions already shown on this device.</p>
        </article>
      )}
    </div>
  );
}
