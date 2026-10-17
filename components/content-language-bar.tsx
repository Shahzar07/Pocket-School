'use client';

import { useTranslation } from 'react-i18next';

export function ContentLanguageBar({
  status,
  showOriginal,
  notice,
  onToggle,
}: {
  status: 'source' | 'loading' | 'ready' | 'unavailable';
  showOriginal: boolean;
  notice?: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  if (status === 'source') return null;
  if (status === 'loading') {
    return <p role="status" className="mt-2 text-xs text-muted-foreground">Translating into your language…</p>;
  }
  if (status === 'unavailable') {
    return (
      <p role="status" className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        {notice || t('lesson.unavailable')}
      </p>
    );
  }
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-primary">
      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold">{t('lesson.autoTranslated')}</span>
      <button type="button" className="underline min-h-11 px-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-pressed={showOriginal} onClick={onToggle}>
        {showOriginal ? t('lesson.showTranslation') : t('lesson.showOriginal')}
      </button>
      {notice ? <span className="text-muted-foreground">{notice}</span> : null}
    </p>
  );
}
