'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Languages, Loader2, Sparkles } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { bearerHeaders } from '@/lib/api-client';
import { awardSparks, type Lesson } from '@/lib/db';
import { readLessonBody } from '@/lib/lesson-body';
import { LANGUAGES, getLanguage } from '@/lib/languages';
import { LESSON_TRANSLATION_COST } from '@/lib/sparks';
import { formatAppNumber } from '@/lib/i18n/detect';
import { Button } from '@/components/ui/button';

/**
 * Editors add a localized title and body, or ask ET AI to translate the English
 * source. AI translation confirms the Sparks cost first and charges only
 * after a translation comes back.
 */
export function LessonLanguagePanel({
  draft,
  patch,
}: {
  draft: Lesson;
  patch: (patch: Partial<Lesson>) => void;
}) {
  const { t, i18n } = useTranslation();
  const { user, profile, fetchProfile } = useAuthSTORE();
  const targets = LANGUAGES.filter(l => l.code !== 'en');
  const [code, setCode] = useState(targets[0]?.code ?? 'ms');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loc = draft.localizations?.[code];
    setTitle(loc?.title ?? '');
    setBody(loc?.text ?? '');
    setConfirming(false);
    // Re-seed only when the lesson or target language changes, so typing
    // is not wiped when the editor autosaves other fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id, code]);

  const balance = profile?.sparksBalance ?? 0;
  const costLabel = formatAppNumber(LESSON_TRANSLATION_COST, i18n.language);
  const canAfford = balance >= LESSON_TRANSLATION_COST;
  const source = draft.localizations?.[code]?.source;
  const langLabel = getLanguage(code).label;

  const save = (nextTitle: string, nextBody: string, sourceKind: 'manual' | 'ai') => {
    const next = { ...(draft.localizations ?? {}) };
    if (!nextBody.trim()) {
      delete next[code];
      patch({ localizations: next });
      toast.success(t('cms.cleared'));
      return;
    }
    next[code] = {
      title: nextTitle.trim(),
      text: nextBody,
      source: sourceKind,
    };
    patch({ localizations: next });
    toast.success(t('cms.saved'));
  };

  const translate = async () => {
    const englishTitle = draft.title?.trim() ?? '';
    const englishBody = readLessonBody(draft).trim();
    if (!englishTitle && !englishBody) {
      toast.error(t('cms.empty'));
      return;
    }
    if (!user || !canAfford) return;
    setConfirming(false);
    setBusy(true);
    try {
      const res = await fetch('/api/ai/translate-lesson', {
        method: 'POST',
        headers: await bearerHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: englishTitle,
          text: englishBody,
          targetLanguage: code,
        }),
      });
      const data = await res.json() as { title?: string; text?: string; error?: string; unavailable?: boolean };
      if (data.unavailable) {
        toast.error(t('lesson.unavailable'));
        return;
      }
      if (!res.ok || !data.text) {
        throw new Error(data.error || t('cms.failed'));
      }
      await awardSparks(
        user.uid,
        -LESSON_TRANSLATION_COST,
        'ai_studio',
        `Lesson translation into ${getLanguage(code).englishName}`,
      );
      await fetchProfile(user.uid);
      setTitle(data.title ?? '');
      setBody(data.text);
      save(data.title ?? '', data.text, 'ai');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('cms.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Languages className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">{t('cms.heading')}</h2>
        {source && (
          <span className="ms-auto text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {source === 'ai' ? t('cms.sourceAi') : t('cms.sourceManual')}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{t('cms.hint')}</p>

      <label className="block text-xs font-medium text-muted-foreground">
        {t('cms.target')}
        <select
          value={code}
          onChange={e => setCode(e.target.value)}
          className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
        >
          {targets.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-medium text-muted-foreground">
        {t('cms.localizedTitle')}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
        />
      </label>

      <label className="block text-xs font-medium text-muted-foreground">
        {t('cms.localizedBody')}
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      {!canAfford && (
        <p className="text-xs text-[var(--ps-cyan-text)]">{t('cms.insufficient', { cost: costLabel })}</p>
      )}

      {confirming && (
        <div className="rounded-xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-3 py-3 space-y-2">
          <p className="text-sm text-[var(--ps-cyan-text)]">
            {t('cms.confirmBody', { language: langLabel, cost: costLabel })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="rounded-xl h-8" onClick={translate} disabled={busy}>
              {t('cms.confirm')}
            </Button>
            <Button type="button" size="sm" variant="outline" className="rounded-xl h-8" onClick={() => setConfirming(false)}>
              {t('cms.cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-xl h-8" onClick={() => save(title, body, 'manual')}>
          {body.trim() ? t('cms.save') : t('cms.clear')}
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-xl h-8 gap-1.5"
          disabled={busy || !canAfford}
          onClick={() => setConfirming(true)}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {busy ? t('cms.working') : t('cms.translate')}
        </Button>
      </div>
    </section>
  );
}
