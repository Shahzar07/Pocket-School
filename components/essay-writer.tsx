'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authedFetch } from '@/lib/api-client';
import { ContentLanguageBar } from '@/components/content-language-bar';
import { useContentTranslation } from '@/hooks/use-content-translation';
import type { EssayGrade } from '@/lib/essay/scale';

interface Result extends EssayGrade {
  feedback: string;
}

export function EssayWriter({ purpose }: { purpose: string }) {
  const { i18n } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [essay, setEssay] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const feedback = useContentTranslation(
    `essay:${(result?.feedback ?? '').slice(0, 80)}`,
    { feedback: result?.feedback ?? '' },
    i18n.language,
    Boolean(result?.feedback) && i18n.language !== 'en',
  );

  const grade = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await authedFetch('/api/essay/grade', {
        method: 'POST',
        body: JSON.stringify({ prompt, essay }),
      });
      setResult({
        mark: Number(data.mark),
        level: data.level === 'U' ? 'U' : Number(data.level),
        letter: String(data.letter ?? ''),
        feedback: String(data.feedback ?? ''),
      });
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'ET AI could not grade this essay.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">ET AI Essay Writer</p>
      <h1 className="font-heading text-4xl tracking-tight">Write, then let ET AI mark it</h1>
      <p className="text-sm text-muted-foreground">{purpose}</p>
      <input aria-label="Essay task" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What should the essay answer?" className="h-11 w-full rounded-xl border border-border px-3 text-sm" />
      <textarea aria-label="Essay" value={essay} onChange={(event) => setEssay(event.target.value)} rows={14} placeholder="Write the essay here." className="w-full rounded-2xl border border-border p-4 text-sm leading-relaxed" />
      <button type="button" disabled={busy} onClick={() => void grade()} className="h-11 px-5 rounded-full bg-foreground text-background text-sm font-bold">
        {busy ? 'ET AI is reading…' : 'Grade on the 9–1 scale'}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="rounded-2xl border border-border p-4 space-y-2">
          <p className="text-3xl font-semibold">{result.mark}%</p>
          <p className="text-sm">Level {result.level} · {result.letter}</p>
          <div dir={feedback.dir}>
            <ContentLanguageBar status={feedback.status} showOriginal={feedback.showOriginal} notice={feedback.notice} onToggle={feedback.toggle} />
            <p className="text-sm leading-relaxed">{feedback.values.feedback || result.feedback}</p>
          </div>
        </div>
      )}
    </div>
  );
}
