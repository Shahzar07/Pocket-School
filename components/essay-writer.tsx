'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { authedFetch } from '@/lib/api-client';
import { ContentLanguageBar } from '@/components/content-language-bar';
import { essayCopy } from '@/lib/essay/copy';
import { useContentTranslation } from '@/hooks/use-content-translation';
import { LevelMenu } from '@/components/level-menu';
import { gradeFromMark } from '@/lib/essay/scale';
import {
  type DegreeStyle,
  type EssayLevelId,
  ESTIMATE_LABEL,
  REFERENCING_STYLES,
  countWords,
  defaultWordTarget,
  mapEssayScale,
  referencingApplies,
  scaleBlurb,
  scaleFamily,
  toEssayLevelId,
  writingTypesFor,
} from '@/lib/essay/scale-config';

interface Criterion {
  id: string;
  label: string;
  scoreCaption: string;
  scoreLabel: string;
  strength: string;
  fix: string;
  quote: string;
}

interface Result {
  levelId: string;
  headline: string;
  detail: string;
  percentage: number | null;
  showsPercentage: boolean;
  estimateLabel: string;
  criteria: Criterion[];
  nextSteps: string[];
  improvedParagraph: string;
  feedback: string;
  bandId: string;
  scaleId: string;
  letter: string;
  mark: number;
  level: number | string;
}

const control = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground';

function readResult(data: Record<string, unknown>): Result | null {
  if (typeof data.headline !== 'string' || typeof data.detail !== 'string') {
    if (typeof data.mark !== 'number' && typeof data.mark !== 'string') return null;
    const grade = gradeFromMark(Number(data.mark));
    return {
      levelId: 'igcse',
      headline: `Level ${grade.level} · ${grade.letter}`,
      detail: scaleBlurb('igcse'),
      percentage: grade.mark,
      showsPercentage: true,
      estimateLabel: ESTIMATE_LABEL,
      criteria: [],
      nextSteps: [],
      improvedParagraph: '',
      feedback: typeof data.feedback === 'string' ? data.feedback : '',
      bandId: String(grade.level),
      scaleId: 'igcse',
      letter: grade.letter,
      mark: grade.mark,
      level: grade.level,
    };
  }
  const criteria = Array.isArray(data.criteria)
    ? data.criteria.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      if (typeof row.label !== 'string' || typeof row.quote !== 'string') return [];
      return [{
        id: String(row.id ?? row.label),
        label: row.label,
        scoreCaption: typeof row.scoreCaption === 'string' ? row.scoreCaption : 'Score',
        scoreLabel: String(row.scoreLabel ?? row.score ?? ''),
        strength: typeof row.strength === 'string' ? row.strength : '',
        fix: typeof row.fix === 'string' ? row.fix : '',
        quote: row.quote,
      }];
    })
    : [];
  const percentage = typeof data.percentage === 'number' ? data.percentage : null;
  return {
    levelId: typeof data.levelId === 'string' ? data.levelId : 'igcse',
    headline: data.headline,
    detail: data.detail,
    percentage,
    showsPercentage: data.showsPercentage === true && percentage != null,
    estimateLabel: typeof data.estimateLabel === 'string' ? data.estimateLabel : ESTIMATE_LABEL,
    criteria,
    nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps.filter((step): step is string => typeof step === 'string') : [],
    improvedParagraph: typeof data.improvedParagraph === 'string' ? data.improvedParagraph : '',
    feedback: typeof data.feedback === 'string' ? data.feedback : '',
    bandId: typeof data.bandId === 'string' ? data.bandId : '',
    scaleId: typeof data.scaleId === 'string' ? data.scaleId : '',
    letter: typeof data.letter === 'string' ? data.letter : '',
    mark: typeof data.mark === 'number' ? data.mark : 0,
    level: typeof data.level === 'number' || typeof data.level === 'string' ? data.level : data.headline,
  };
}

export function EssayWriter({ purpose }: { purpose: string }) {
  const params = useSearchParams();
  const { i18n } = useTranslation();
  const initialLevel = toEssayLevelId(params.get('level'));
  const initialTypes = writingTypesFor(initialLevel);
  const initialType = initialTypes.some((type) => type.id === params.get('type'))
    ? params.get('type')!
    : initialTypes[0]!.id;
  const requestedWords = Number(params.get('words'));
  const wordsFromTask = Number.isFinite(requestedWords) && requestedWords > 0;
  const [level, setLevel] = useState<EssayLevelId>(initialLevel);
  const [writingType, setWritingType] = useState(initialType);
  const [subject, setSubject] = useState(params.get('subject') ?? '');
  const [board, setBoard] = useState(params.get('board') ?? '');
  const [wordTarget, setWordTarget] = useState(wordsFromTask ? Math.min(20_000, Math.round(requestedWords)) : defaultWordTarget(initialLevel));
  const [wordTouched, setWordTouched] = useState(wordsFromTask);
  const [referencing, setReferencing] = useState(
    REFERENCING_STYLES.some((style) => style.id === params.get('referencing')) ? params.get('referencing')! : '',
  );
  const [degreeStyle, setDegreeStyle] = useState<DegreeStyle>(params.get('degreeStyle') === 'cgpa' ? 'cgpa' : 'uk');
  const [rubric, setRubric] = useState(params.get('rubric') ?? '');
  const [prompt, setPrompt] = useState('');
  const [essay, setEssay] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const words = countWords(essay);
  const types = writingTypesFor(level);
  const feedback = useContentTranslation(
    `essay:${(result?.feedback ?? '').slice(0, 80)}`,
    { feedback: result?.feedback ?? '' },
    i18n.language,
    Boolean(result?.feedback) && i18n.language !== 'en',
  );

  const onLevel = (next: EssayLevelId) => {
    setLevel(next);
    setWritingType((current) => (writingTypesFor(next).some((type) => type.id === current) ? current : writingTypesFor(next)[0]!.id));
    if (!wordTouched) setWordTarget(defaultWordTarget(next));
    if (!referencingApplies(next)) setReferencing('');
    setResult(null);
  };

  const chooseDegree = (next: DegreeStyle) => {
    setDegreeStyle(next);
    setResult((current) => {
      if (!current || scaleFamily(current.levelId as EssayLevelId) !== 'degree' || current.percentage == null) return current;
      const scale = mapEssayScale('degree', current.percentage, { degreeStyle: next });
      return { ...current, ...scale };
    });
  };

  const grade = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await authedFetch('/api/essay/grade', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          essay,
          level,
          writingType,
          subject,
          board,
          wordTarget,
          referencing: referencingApplies(level) ? referencing : '',
          rubric,
          degreeStyle: scaleFamily(level) === 'degree' ? degreeStyle : 'uk',
        }),
      });
      const parsed = readResult(data);
      if (!parsed) throw new Error('ET AI could not grade this essay.');
      setResult(parsed);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'ET AI could not grade this essay.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">ET AI Essay Writer</p>
      <h1 className="font-heading text-4xl tracking-tight">Write, then let ET AI mark it</h1>
      <p className="text-sm text-muted-foreground">{purpose}</p>
      <div data-essay-setup="1" className="grid gap-3 sm:grid-cols-2">
        <div className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ps-cyan-text)]">{essayCopy.level}</span>
          <LevelMenu ariaLabel={essayCopy.level} value={level} onChange={(next) => onLevel(toEssayLevelId(next))} />
        </div>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ps-cyan-text)]">{essayCopy.writingType}</span>
          <select aria-label={essayCopy.writingType} data-essay-type={writingType} value={writingType} onChange={(event) => { setWritingType(event.target.value); setResult(null); }} className={control}>
            {types.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ps-cyan-text)]">{essayCopy.subject}</span>
          <input aria-label={essayCopy.subject} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={essayCopy.subjectPlaceholder} className={control} />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ps-cyan-text)]">{essayCopy.board}</span>
          <input aria-label={essayCopy.board} value={board} onChange={(event) => setBoard(event.target.value)} placeholder={essayCopy.boardPlaceholder} className={control} />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ps-cyan-text)]">{essayCopy.words}</span>
          <input aria-label={essayCopy.words} type="number" min={1} max={20000} value={wordTarget} onChange={(event) => { setWordTouched(true); setWordTarget(Math.max(1, Math.min(20_000, Number(event.target.value) || 1))); }} className={control} />
        </label>
        {referencingApplies(level) && (
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ps-cyan-text)]">{essayCopy.referencing}</span>
            <select aria-label={essayCopy.referencing} value={referencing} onChange={(event) => setReferencing(event.target.value)} className={control}>
              <option value="">{essayCopy.referencingPlaceholder}</option>
              {REFERENCING_STYLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        )}
        {scaleFamily(level) === 'degree' && (
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ps-cyan-text)]">{essayCopy.degreeStyle}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={degreeStyle === 'uk'} onClick={() => chooseDegree('uk')} className={`min-h-11 px-4 rounded-full text-sm font-semibold ${degreeStyle === 'uk' ? 'bg-[var(--ps-cyan)] text-[var(--ps-cyan-ink)]' : 'border border-border text-foreground'}`}>
                {essayCopy.uk}
              </button>
              <button type="button" aria-pressed={degreeStyle === 'cgpa'} onClick={() => chooseDegree('cgpa')} className={`min-h-11 px-4 rounded-full text-sm font-semibold ${degreeStyle === 'cgpa' ? 'bg-[var(--ps-cyan)] text-[var(--ps-cyan-ink)]' : 'border border-border text-foreground'}`}>
                {essayCopy.cgpa}
              </button>
            </div>
          </div>
        )}
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ps-cyan-text)]">{essayCopy.rubric}</span>
          <textarea aria-label={essayCopy.rubric} value={rubric} onChange={(event) => setRubric(event.target.value)} rows={3} placeholder={essayCopy.rubricPlaceholder} className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground" />
          <input aria-label={essayCopy.rubricFile} type="file" accept=".txt,.md,.csv,text/plain" className="text-sm text-muted-foreground" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => setRubric(text.slice(0, 4_000)));
          }} />
        </label>
      </div>
      <p data-essay-blurb className="text-sm text-muted-foreground">{scaleBlurb(level, degreeStyle)}</p>
      <input aria-label="Essay task" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What should the essay answer?" className={control} />
      <textarea aria-label="Essay" value={essay} onChange={(event) => setEssay(event.target.value)} rows={14} placeholder="Write the essay here." className="w-full rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground" />
      <p aria-live="polite" data-essay-words={words} className="text-xs text-right text-muted-foreground">{essayCopy.wordCounter(words, wordTarget)}</p>
      <button type="button" disabled={busy} onClick={() => void grade()} className="h-11 px-5 rounded-full bg-foreground text-background text-sm font-bold">
        {busy ? essayCopy.reading : essayCopy.mark}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div data-essay-result="1" data-essay-scale={result.scaleId} data-essay-band={result.bandId} className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <p data-essay-estimate className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ps-cyan-text)]">{result.estimateLabel}</p>
          <div className="flex flex-wrap items-end gap-4">
            <p data-essay-headline className="font-heading text-4xl tracking-tight text-foreground">{result.headline}</p>
            {result.showsPercentage && result.percentage != null && (
              <p data-essay-percent className="text-3xl font-semibold text-foreground">{result.percentage}%</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{result.detail}</p>
          <div dir={feedback.dir}>
            <ContentLanguageBar status={feedback.status} showOriginal={feedback.showOriginal} notice={feedback.notice} onToggle={feedback.toggle} />
            <p className="text-sm leading-relaxed">{feedback.values.feedback || result.feedback}</p>
          </div>
          <div className="space-y-3">
            {result.criteria.map((criterion) => (
              <article key={criterion.id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-foreground">{criterion.label}</h2>
                  <p className="text-sm font-semibold text-[var(--ps-cyan-text)]">{criterion.scoreCaption} {criterion.scoreLabel}</p>
                </div>
                <blockquote className="border-l-2 border-[var(--ps-cyan)] pl-3 text-sm text-foreground">{criterion.quote}</blockquote>
                <p className="text-sm text-foreground"><span className="font-semibold">{essayCopy.strength}. </span>{criterion.strength}</p>
                <p className="text-sm text-foreground"><span className="font-semibold">{essayCopy.fix}. </span>{criterion.fix}</p>
              </article>
            ))}
          </div>
          {result.nextSteps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground">{essayCopy.nextSteps}</h2>
              <ul className="list-disc pl-5 text-sm space-y-1 text-foreground">
                {result.nextSteps.map((step) => <li key={step}>{step}</li>)}
              </ul>
            </div>
          )}
          {result.improvedParagraph && (
            <div className="rounded-xl bg-[var(--ps-cyan-soft)] p-3 space-y-1">
              <h2 className="text-sm font-semibold text-foreground">{essayCopy.improved}</h2>
              <p className="text-xs text-muted-foreground">{essayCopy.improvedNote}</p>
              <p className="text-sm leading-relaxed text-foreground">{result.improvedParagraph}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
