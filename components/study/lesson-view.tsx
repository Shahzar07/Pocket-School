'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Eye } from 'lucide-react';
import { MathMarkdown } from '@/components/math-markdown';
import { ContentLanguageBar } from '@/components/content-language-bar';
import { useContentTranslation } from '@/hooks/use-content-translation';
import type { LessonAsset } from '@/lib/study/types';

export function LessonView({ lesson, onComplete, done }: { lesson: LessonAsset; onComplete: () => void; done?: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const source = useMemo(() => ({
    markdown: lesson.markdown,
    checkpoints: JSON.stringify(lesson.checkpoints ?? []),
  }), [lesson]);
  const translation = useContentTranslation(
    `study-lesson:${lesson.markdown.slice(0, 80)}`,
    source,
    i18n.language,
    i18n.language !== 'en',
  );
  let checkpoints = lesson.checkpoints ?? [];
  try {
    const parsed = JSON.parse(translation.values.checkpoints || '[]') as { question?: string; answer?: string }[];
    if (Array.isArray(parsed) && parsed.length === checkpoints.length) {
      checkpoints = checkpoints.map((item, index) => ({
        ...item,
        question: parsed[index]?.question?.trim() || item.question,
        answer: parsed[index]?.answer?.trim() || item.answer,
      }));
    }
  } catch { /* keep the English checkpoints */ }
  return (
    <article className="max-w-3xl mx-auto" dir={translation.dir}>
      <ContentLanguageBar status={translation.status} showOriginal={translation.showOriginal} notice={translation.notice} onToggle={translation.toggle} />
      <div className="prose prose-slate max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-h2:text-[22px] prose-p:leading-relaxed prose-table:text-[14px] prose-th:bg-muted/60 prose-th:px-3 prose-td:px-3">
        <MathMarkdown>{translation.values.markdown || lesson.markdown}</MathMarkdown>
      </div>
      {lesson.checkpoints?.length > 0 && (
        <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary mb-3">Check yourself</p>
          <ol className="space-y-3">
            {checkpoints.map((c, i) => (
              <li key={i}>
                <div className="text-[15px] text-foreground [&_p]:my-0"><MathMarkdown>{`${i + 1}. ${c.question}`}</MathMarkdown></div>
                {open[i]
                  ? <div className="mt-1 text-[14px] text-success [&_p]:my-0"><MathMarkdown>{c.answer}</MathMarkdown></div>
                  : <button onClick={() => setOpen(o => ({ ...o, [i]: true }))} className="mt-1 text-[12px] font-semibold text-primary inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Show answer</button>}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <button onClick={onComplete} disabled={done}
          className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50">
          <CheckCircle2 className="w-4 h-4" /> {done ? 'Lesson complete' : 'I’ve learned this'}
        </button>
      </div>
    </article>
  );
}
