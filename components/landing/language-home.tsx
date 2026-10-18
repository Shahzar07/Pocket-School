'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { applyAppLanguage } from '@/lib/i18n/apply';
import { updateUser } from '@/lib/db';
import { LANGUAGES, getLanguage, readLanguage } from '@/lib/languages';

const PLACE = ['language', 'teachers', 'records', 'id', 'safeline', 'studio'] as const;
const PROBLEMS = ['language', 'parent', 'home'] as const;

/** Language pillar, problems row, and the one-place grid. Counts come from LANGUAGES. */
export function LanguageHome() {
  const { t } = useTranslation();
  const { user, profile, setProfile } = useAuthSTORE();
  const [selected, setSelected] = useState('en');
  const count = LANGUAGES.length;
  const current = getLanguage(selected);

  useEffect(() => {
    const sync = () => setSelected(readLanguage());
    sync();
    window.addEventListener('pocket-school-lang-change', sync);
    return () => window.removeEventListener('pocket-school-lang-change', sync);
  }, []);

  const select = (code: string) => {
    setSelected(code);
    applyAppLanguage(code, { explicit: true });
    if (!user) return;
    updateUser(user.uid, { language: code })
      .then(() => {
        if (profile) setProfile({ ...profile, language: code });
      })
      .catch(() => {});
  };

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="language" aria-labelledby="language-heading">
        <p className="text-sm font-semibold text-primary">{t('landing.language.eyebrow')}</p>
        <h2 id="language-heading" className="mt-2 max-w-3xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">
          {t('landing.language.title')}
        </h2>
        <ul className="mt-6 grid max-w-3xl gap-3 text-base leading-relaxed">
          <li>{t('landing.language.count', { count })}</li>
          <li>{t('landing.language.rtl')}</li>
          <li>{t('landing.language.reviewed')}</li>
          <li>{t('landing.language.teachers')}</li>
          <li>{t('landing.language.switch')}</li>
          <li>{t('landing.language.parents')}</li>
        </ul>
        <p className="mt-6 text-sm font-semibold">{t('landing.language.switcherLabel')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('landing.language.current')}: <span lang={current.bcp47} dir={current.rtl ? 'rtl' : 'ltr'}>{current.label}</span>
          {' · '}
          {current.englishName}
        </p>
        <ul className="mt-4 flex max-w-5xl flex-wrap gap-2" aria-label={t('landing.language.switcherLabel')}>
          {LANGUAGES.map((language) => {
            const active = language.code === selected;
            return (
              <li key={language.code}>
                <button
                  type="button"
                  lang={language.bcp47}
                  dir={language.rtl ? 'rtl' : 'ltr'}
                  aria-pressed={active}
                  onClick={() => select(language.code)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground'
                  }`}
                >
                  {language.label}
                  <span className="ms-1 font-normal opacity-80" dir="ltr">{language.englishName}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{t('landing.language.soon')}</span>
          {t('landing.language.readAloud')}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('landing.language.readAloudNote')}</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16" aria-labelledby="problems-heading">
        <p className="text-sm font-semibold text-primary">{t('landing.problems.eyebrow')}</p>
        <h2 id="problems-heading" className="mt-2 max-w-3xl text-[clamp(28px,4vw,40px)] font-medium leading-tight">
          {t('landing.problems.title')}
        </h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {PROBLEMS.map((id) => (
            <li key={id} className="rounded-3xl border border-border bg-card p-5">
              <p className="text-sm font-semibold">{t(`landing.problems.${id}`)}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.problems.${id}Answer`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8" aria-labelledby="place-heading">
        <p className="text-sm font-semibold text-primary">{t('landing.place.eyebrow')}</p>
        <h2 id="place-heading" className="mt-2 max-w-3xl text-[clamp(28px,4vw,40px)] font-medium leading-tight">
          {t('landing.place.title')}
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLACE.map((id) => (
            <li key={id} className="rounded-3xl border border-border bg-card p-5">
              <p className="flex items-start gap-2 text-sm font-semibold">
                <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden />
                {t(`landing.place.${id}`)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.place.${id}Body`, { count })}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
