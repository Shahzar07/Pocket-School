'use client';

import { useTranslation } from 'react-i18next';
import {
  AudioLines, BookOpen, Calculator, ChartColumn, Eye, GalleryHorizontal,
  Images, Languages, Leaf, Lightbulb, Lock, LockOpen, MessageCircleQuestion,
  Music, Network, Pencil, PersonStanding, Scale, Search, Sparkles, UserRound, Users,
} from 'lucide-react';
import { DuoIcon } from '@/components/landing/duo-icon';

const INTELLIGENCES = [
  { key: 'home.v3.miLogical', icon: Calculator },
  { key: 'home.v3.miLinguistic', icon: Languages },
  { key: 'home.v3.miVisual', icon: Eye },
  { key: 'home.v3.miBodily', icon: PersonStanding },
  { key: 'home.v3.miMusical', icon: Music },
  { key: 'home.v3.miInterpersonal', icon: Users },
  { key: 'home.v3.miIntrapersonal', icon: UserRound },
  { key: 'home.v3.miNaturalist', icon: Leaf },
] as const;

const BLOOM = [
  { key: 'home.v3.bloomCreate', icon: Sparkles },
  { key: 'home.v3.bloomEvaluate', icon: Scale },
  { key: 'home.v3.bloomAnalyse', icon: Search },
  { key: 'home.v3.bloomApply', icon: Pencil },
  { key: 'home.v3.bloomUnderstand', icon: Lightbulb },
  { key: 'home.v3.bloomRemember', icon: BookOpen },
] as const;

const VISUALS = [
  { key: 'home.v3.visualMind', icon: Network },
  { key: 'home.v3.visualComic', icon: GalleryHorizontal },
  { key: 'home.v3.visualInfo', icon: ChartColumn },
  { key: 'home.v3.visualGallery', icon: Images },
  { key: 'home.v3.visualChant', icon: AudioLines },
] as const;

export function TeachSection() {
  const { t } = useTranslation();
  return (
    <section id="how-we-teach" data-landing-teach className="bg-white px-6 py-16 dark:bg-[#0B1417] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-[13px] font-normal leading-5 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.teachEyebrow')}</p>
        <h2 className="mt-3 max-w-2xl text-[32px] font-medium leading-[1.15] text-[#203337] dark:text-[#E7F4F2]">{t('home.v3.teachTitle')}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{t('home.v3.teachLede')}</p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-[rgba(32,51,55,0.08)] bg-[#F4F6F6] p-6 dark:border-[rgba(231,244,242,0.08)] dark:bg-[#122226]">
            <div className="flex items-center gap-3">
              <DuoIcon icon={Users} />
              <h3 className="text-xl font-medium text-[#203337] dark:text-[#E7F4F2]">{t('home.v3.miTitle')}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#203337]/85 dark:text-[#E7F4F2]/85">{t('home.v3.miBody')}</p>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {INTELLIGENCES.map((item) => (
                <li key={item.key} className="flex flex-col items-start gap-2 rounded-lg bg-white p-2 text-xs font-normal text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2]">
                  <DuoIcon icon={item.icon} />
                  {t(item.key)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-4 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.miCite')}</p>
          </article>
          <article className="rounded-2xl border border-[rgba(32,51,55,0.08)] bg-[#F4F6F6] p-6 dark:border-[rgba(231,244,242,0.08)] dark:bg-[#122226]">
            <div className="flex items-center gap-3">
              <DuoIcon icon={Sparkles} />
              <h3 className="text-xl font-medium text-[#203337] dark:text-[#E7F4F2]">{t('home.v3.bloomTitle')}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#203337]/85 dark:text-[#E7F4F2]/85">{t('home.v3.bloomBody')}</p>
            <ol className="mx-auto mt-4 flex max-w-sm flex-col items-center gap-1.5" aria-label={t('home.v3.bloomTitle')}>
              {BLOOM.map((item, index) => (
                <li
                  key={item.key}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-normal text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2]"
                  style={{ width: `${58 + index * 7}%` }}
                >
                  <item.icon aria-hidden size={16} strokeWidth={1.5} className="shrink-0 text-[#5F7074] dark:text-[#93A7AB]" />
                  {t(item.key)}
                </li>
              ))}
            </ol>
          </article>
          <article className="rounded-2xl border border-[rgba(32,51,55,0.08)] bg-[#F4F6F6] p-6 dark:border-[rgba(231,244,242,0.08)] dark:bg-[#122226]">
            <div className="flex items-center gap-3">
              <DuoIcon icon={Lock} />
              <h3 className="text-xl font-medium text-[#203337] dark:text-[#E7F4F2]">{t('home.v3.testsTitle')}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#203337]/85 dark:text-[#E7F4F2]/85">{t('home.v3.testsBody')}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-[#203337] dark:text-[#E7F4F2]">
              <span className="inline-flex items-center gap-2 rounded-lg border border-[rgba(32,51,55,0.1)] bg-white px-3 py-2 dark:border-[rgba(231,244,242,0.12)] dark:bg-[#0B1417]">
                <Lock aria-hidden size={16} strokeWidth={1.5} className="text-[#5F7074] dark:text-[#93A7AB]" /> {t('home.v3.testsLocked')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-[#3FE0D0] px-3 py-2 text-[#203337]">
                <LockOpen aria-hidden size={16} strokeWidth={1.5} /> {t('home.v3.testsOpen')}
              </span>
            </div>
          </article>
          <article className="rounded-2xl border border-[rgba(32,51,55,0.08)] bg-[#F4F6F6] p-6 dark:border-[rgba(231,244,242,0.08)] dark:bg-[#122226]">
            <div className="flex items-center gap-3">
              <DuoIcon icon={Images} />
              <h3 className="text-xl font-medium text-[#203337] dark:text-[#E7F4F2]">{t('home.v3.visualsTitle')}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#203337]/85 dark:text-[#E7F4F2]/85">{t('home.v3.visualsBody')}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {VISUALS.map((item) => (
                <li key={item.key} className="inline-flex items-center gap-2 rounded-lg border border-[rgba(32,51,55,0.1)] bg-white px-3 py-2 text-xs font-normal text-[#203337] dark:border-[rgba(231,244,242,0.12)] dark:bg-[#0B1417] dark:text-[#E7F4F2]">
                  <item.icon aria-hidden size={16} strokeWidth={1.5} className="text-[#5F7074] dark:text-[#93A7AB]" />
                  {t(item.key)}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-[rgba(32,51,55,0.08)] bg-[#F4F6F6] p-6 lg:col-span-2 dark:border-[rgba(231,244,242,0.08)] dark:bg-[#122226]">
            <div className="flex items-center gap-3">
              <DuoIcon icon={MessageCircleQuestion} />
              <h3 className="text-xl font-medium text-[#203337] dark:text-[#E7F4F2]">{t('home.v3.hintsTitle')}</h3>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#203337]/85 dark:text-[#E7F4F2]/85">{t('home.v3.hintsBody')}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
