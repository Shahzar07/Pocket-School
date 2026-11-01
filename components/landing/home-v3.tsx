'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { LANGUAGES } from '@/lib/languages';
import { HOME } from '@/lib/marketing/home';
import { FeaturedShowcase } from '@/components/courses/featured-showcase';
import { Ribbon } from '@/components/design/ribbon';
import { SectionLabel } from '@/components/design/section-label';
import {
  IconArrow, IconBook, IconBuilding, IconCap, IconCheck as Check, IconId, IconSchool, IconShield, IconSpark, IconUsers,
} from '@/components/design/icons';
import type { ReactElement, SVGProps } from 'react';
import { TeachSection } from '@/components/landing/teach-section';
import { usePremiumMotion } from '@/components/landing/use-premium-motion';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
type Problem = { problem: string; answer: string };
type Feature = { href: string; title: string; body: string; points?: string[] };
type Level = { href: string; title: string; price: string; body: string };
type Plan = { name: string; amount: string; period: string; body: string; href: string; cta: string };

function asList<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) && value.length > 0 ? value as T[] : fallback;
}

const FEATURE_ICONS: Record<string, (props: IconProps) => ReactElement> = {
  '/ai-teachers': IconCap,
  '/studio': IconSpark,
  '/reads': IconBook,
  '/safeline': IconShield,
  '/id': IconId,
  '/demo': IconUsers,
};

const LEVEL_ICONS: Record<string, (props: IconProps) => ReactElement> = {
  '/primary': IconSchool,
  '/igcse': IconBook,
  '/alevel': IconCap,
  '/llb': IconBuilding,
  '/mbbs': IconShield,
  '/independent': IconSpark,
};

const FAN = [
  'lg:-rotate-2',
  'lg:rotate-1 lg:-mt-4',
  'lg:-rotate-1 lg:-mt-4',
  'lg:rotate-2 lg:-mt-4',
  'lg:-rotate-2 lg:-mt-4',
  'lg:rotate-1 lg:-mt-4',
];

const cta = 'inline-flex min-h-11 items-center justify-center rounded-full bg-[#3FE0D0] px-5 text-sm font-bold text-[#203337]';
const inkBtn = 'inline-flex min-h-11 items-center justify-center rounded-full bg-[#203337] px-5 text-sm font-bold text-[#E7F4F2] dark:bg-[#E7F4F2] dark:text-[#203337]';
const ghost = 'inline-flex min-h-11 items-center justify-center rounded-full border border-[#1E6A83]/25 bg-white/70 px-5 text-sm font-semibold text-[#1E6A83] dark:border-[#E7F4F2]/30 dark:bg-transparent dark:text-[#E7F4F2]';
const card = 'rounded-[28px] border border-[#1E6A83]/12 bg-white shadow-[0_18px_50px_rgba(32,51,55,0.08)] dark:border-[#E7F4F2]/12 dark:bg-[#122226] dark:shadow-none';

function MiniDesk({ title }: { title: string }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-[#1E6A83]/12 bg-[#F7FBFA] dark:border-[#E7F4F2]/15 dark:bg-[#0B1417]">
      <div className="flex gap-2 p-2.5">
        <div className="flex w-14 shrink-0 flex-col gap-1.5 rounded-xl bg-[#1E6A83]/10 p-1.5 dark:bg-[#E7F4F2]/10">
          <span className="h-1.5 rounded-full bg-[#1E6A83]/50 dark:bg-[#E7F4F2]/50" />
          <span className="h-1.5 w-4/5 rounded-full bg-[#1E6A83]/30 dark:bg-[#E7F4F2]/30" />
          <span className="h-1.5 w-3/5 rounded-full bg-[#3FE0D0]" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-[10px] font-semibold text-[#203337] dark:text-[#E7F4F2]">{title}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <span className="h-8 rounded-lg bg-white dark:bg-[#122226]" />
            <span className="h-8 rounded-lg bg-[#3FE0D0]/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeV3() {
  const root = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();
  usePremiumMotion(root);
  const language = i18n.resolvedLanguage || i18n.language || '';
  const clusterScript = /^(ta|te|kn|ml|si|my|km|am)/.test(language);
  const tamil = language.startsWith('ta');
  const display = tamil
    ? { fontFamily: 'var(--font-tamil), var(--font-sans), sans-serif' }
    : { fontFamily: 'var(--font-sans), sans-serif' };
  const teachers = String(AI_TEACHERS.length);
  const languages = String(LANGUAGES.length);
  const problems = asList<Problem>(t('home.v3.problems', { returnObjects: true }), HOME.problems);
  const features = asList<Feature>(t('home.v3.features', { returnObjects: true }), HOME.features);
  const levels = asList<Level>(t('home.v3.levels', { returnObjects: true }), HOME.levels);
  const instPoints = asList<string>(t('home.v3.instPoints', { returnObjects: true }), HOME.instPoints);
  const plans = asList<Plan>(t('home.v3.plans', { returnObjects: true }), HOME.plans);
  const preview = features.slice(0, 4);

  return (
    <div
      ref={root}
      className="overflow-x-clip bg-[#F7FBFA] text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2]"
      style={{ fontFamily: tamil ? 'var(--font-tamil), var(--font-sans), sans-serif' : 'var(--font-sans), sans-serif' }}
      data-landing="v3"
    >
      <section
        data-hero
        className="relative px-5 pb-10 pt-24 sm:px-8 sm:pt-28"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_88%_-8%,rgba(63,224,208,0.38),transparent_62%),linear-gradient(180deg,#F7FBFA_0%,#ffffff_78%)] dark:bg-[radial-gradient(820px_380px_at_88%_-10%,rgba(63,224,208,0.16),transparent_60%),linear-gradient(180deg,#0B1417,#0B1417)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SectionLabel>{t('home.v3.eyebrow')}</SectionLabel>
            <h1
              className="mt-5 max-w-3xl text-[clamp(2.55rem,6.2vw,4.75rem)] font-extrabold leading-[1.02] tracking-tight"
              style={clusterScript ? { ...display, overflowWrap: 'anywhere' } : display}
            >
              {t('home.v3.title')}
              {' '}
              <em className="not-italic [box-decoration-break:clone] bg-[linear-gradient(transparent_62%,rgba(63,224,208,0.8)_62%)] px-0.5 dark:bg-[linear-gradient(transparent_62%,rgba(63,224,208,0.45)_62%)]">{t('home.v3.titleEm')}</em>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#203337]/85 dark:text-[#E7F4F2]/85">{t('home.v3.lede')}</p>
            <p className="mt-3 max-w-xl text-sm font-medium text-[#1E6A83] dark:text-[#E7F4F2]">{t('home.v3.cred')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className={inkBtn} href="/signup">{t('home.v3.start')}</Link>
              <Link className={ghost} href="/institutions/register">{t('home.v3.schools')}</Link>
              <Link className={ghost} href="/demo">{t('home.v3.demo')}</Link>
            </div>
          </div>
          <div data-hero-mock className="relative mx-auto mb-8 w-full max-w-lg lg:max-w-none">
            <div className={`${card} relative p-3 sm:p-4`}>
              <div className="grid grid-cols-[52px_1fr] gap-3">
                <ul className="space-y-1.5 rounded-2xl bg-[#F7FBFA] p-1.5 dark:bg-[#0B1417]">
                  {preview.map((item) => {
                    const Icon = FEATURE_ICONS[item.href] ?? IconSpark;
                    return (
                      <li key={item.href} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#1E6A83] dark:bg-[#122226] dark:text-[#E7F4F2]" title={item.title}>
                        <Icon size={16} />
                      </li>
                    );
                  })}
                </ul>
                <div className="space-y-2">
                  <div className="rounded-2xl bg-[#3FE0D0] p-3 text-[#203337]">
                    <p className="text-[11px] font-bold">{preview[0]?.title}</p>
                    <p className="mt-1 line-clamp-3 text-[11px] leading-snug">{preview[0]?.body}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-[#E9F7FA] p-3 text-[11px] font-semibold text-[#203337] dark:bg-[#1E6A83] dark:text-white">
                      <p className="line-clamp-3">{preview[1]?.title}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-[11px] font-semibold text-[#203337] ring-1 ring-[#1E6A83]/15 dark:bg-[#0B1417] dark:text-[#E7F4F2] dark:ring-[#E7F4F2]/15">
                      <p className="line-clamp-3">{preview[2]?.title}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <dl data-hero-stats="1" className="relative mx-auto mt-14 grid max-w-6xl grid-cols-2 gap-y-6 border-t border-[#1E6A83]/15 pt-6 dark:border-[#E7F4F2]/15 sm:grid-cols-4">
          <div className="min-w-0 pe-4 sm:border-e sm:border-[#1E6A83]/15 sm:dark:border-[#E7F4F2]/15">
            <dt className="text-xl font-extrabold leading-tight sm:text-2xl" style={display}>{t('home.v3.levelsLabel')}</dt>
            <dd className="mt-1 text-xs leading-snug text-[#203337]/75 dark:text-[#E7F4F2]/75">{t('home.v3.formatsLabel')}</dd>
          </div>
          <div className="min-w-0 ps-4 sm:border-e sm:border-[#1E6A83]/15 sm:ps-6 sm:dark:border-[#E7F4F2]/15">
            <dt className="text-2xl font-extrabold leading-tight" style={display}>{teachers}</dt>
            <dd className="mt-1 text-xs leading-snug text-[#203337]/75 dark:text-[#E7F4F2]/75">{t('home.v3.teachersLabel')}</dd>
          </div>
          <div className="min-w-0 pe-4 sm:border-e sm:border-[#1E6A83]/15 sm:ps-6 sm:dark:border-[#E7F4F2]/15">
            <dt className="text-2xl font-extrabold leading-tight" style={display}>{languages}</dt>
            <dd className="mt-1 text-xs leading-snug text-[#203337]/75 dark:text-[#E7F4F2]/75">{t('home.v3.languagesLabel')}</dd>
          </div>
          <div className="min-w-0 ps-4 sm:ps-6">
            <dt className="text-lg font-extrabold leading-tight sm:text-xl" style={display}>{t('home.v3.annual')}</dt>
            <dd className="mt-1 text-xs leading-snug text-[#203337]/75 dark:text-[#E7F4F2]/75">{t('home.v3.priceTag')}</dd>
          </div>
        </dl>
      </section>

      <div data-landing-aligned className="border-y border-[#1E6A83]/10 bg-white px-5 py-5 dark:border-[#E7F4F2]/10 dark:bg-[#0B1417] sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[#1E6A83] dark:text-[#E7F4F2]">
            <IconCap size={16} />
            {t('home.v3.aligned')}
          </span>
          {HOME.boards.map((board) => (
            <span key={board} className="inline-flex items-center rounded-full border border-[#1E6A83]/15 bg-[#F7FBFA] px-3 py-1 text-xs text-[#203337] dark:border-[#E7F4F2]/15 dark:bg-[#122226] dark:text-[#E7F4F2]">
              {board}
            </span>
          ))}
        </div>
      </div>

      <div data-landing-universities className="bg-[#F7FBFA] px-5 py-6 dark:bg-[#0B1417] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold text-[#1E6A83] dark:text-[#E7F4F2]">
            <IconBuilding size={16} />
            {t('home.v3.universities')}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {HOME.universities.map((name) => (
              <li key={name} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#203337] ring-1 ring-[#1E6A83]/10 dark:bg-[#122226] dark:text-[#E7F4F2] dark:ring-[#E7F4F2]/15">{name}</li>
            ))}
          </ul>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-[#1E6A83] dark:text-[#E7F4F2]">{t('home.v3.universitiesNote')}</p>
        </div>
      </div>

      <TeachSection />

      <section id="courses" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-12 sm:px-8">
        <FeaturedShowcase variant="row" />
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-16 sm:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <SectionLabel>{t('home.v3.solveTag')}</SectionLabel>
            <h2 className="mt-4 max-w-xl text-[clamp(1.85rem,3.2vw,2.85rem)] font-extrabold leading-[1.08] tracking-tight" style={display}>{t('home.v3.solveTitle')}</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{t('home.v3.solveBody')}</p>
          </div>
          <ul className="mx-auto w-full max-w-xl">
            {problems.map((item, index) => (
              <li key={item.problem} className={`${card} p-5 ${FAN[index] ?? ''} ${index === 0 ? '' : '-mt-3'}`}>
                <p className="font-semibold">{item.problem}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#1E6A83] dark:text-[#E7F4F2]">{item.answer}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-16 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => {
            const Icon = FEATURE_ICONS[item.href] ?? IconSpark;
            const points = Array.isArray(item.points) ? item.points : [];
            return (
              <Link key={item.href} href={item.href} data-reveal className={`${card} flex h-full flex-col p-4 hover:border-[#1E6A83]/30 dark:hover:border-[#E7F4F2]/30`}>
                <MiniDesk title={item.title} />
                <div className="mt-4 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#3FE0D0]/25 text-[#1E6A83] dark:text-[#E7F4F2]">
                    <Icon size={18} />
                  </span>
                  <h3 className="text-xl font-extrabold tracking-tight" style={display}>{item.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{item.body}</p>
                {points.length > 0 ? (
                  <ul className="mt-3 flex-1 space-y-2">
                    {points.map((point) => (
                      <li key={point} className="flex gap-2 text-sm leading-relaxed">
                        <Check className="mt-0.5 shrink-0 text-[#1E6A83] dark:text-[#3FE0D0]" size={16} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1E6A83] dark:text-[#E7F4F2]">
                  {t('home.v3.learnMore')} <IconArrow size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bg-white px-5 py-16 dark:bg-[#0B1417] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionLabel>{t('home.v3.levelsTag')}</SectionLabel>
          <h2 className="mt-4 text-[clamp(1.85rem,3.2vw,2.85rem)] font-extrabold leading-[1.08] tracking-tight" style={display}>{t('home.v3.levelsTitle')}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {levels.map((item, index) => {
              const Icon = LEVEL_ICONS[item.href] ?? IconCap;
              return (
                <li key={item.href} data-reveal className={index === 0 ? 'sm:col-span-2 lg:col-span-1' : ''}>
                  <Link href={item.href} className={`${card} flex h-full flex-col p-5`}>
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E9F7FA] text-[#1E6A83] dark:bg-[#0B1417] dark:text-[#E7F4F2]">
                      <Icon size={20} />
                    </span>
                    <p className="mt-4 text-xs font-bold text-[#1E6A83] dark:text-[#E7F4F2]">{item.price}</p>
                    <h3 className="mt-1 text-2xl font-extrabold tracking-tight" style={display}>{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{item.body}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <h2 className="text-[clamp(1.85rem,3.2vw,2.6rem)] font-extrabold leading-tight tracking-tight" style={display}>{t('home.v3.rochfords')}</h2>
        <p className="mt-4 text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{t('home.v3.rochfordsBody')}</p>
        <Link className="mt-5 inline-flex text-sm font-semibold text-[#1E6A83] dark:text-[#E7F4F2]" href="/rochfords">{t('home.v3.rochfords')}</Link>
      </section>

      <section id="institutions" className="relative scroll-mt-28 overflow-hidden bg-[#203337] px-5 py-16 text-[#E7F4F2] sm:px-8">
        <Ribbon />
        <div className="relative mx-auto max-w-6xl">
          <SectionLabel>{t('home.v3.instTag')}</SectionLabel>
          <h2 className="mt-4 max-w-xl text-[clamp(1.85rem,3.2vw,2.85rem)] font-extrabold leading-[1.08] tracking-tight text-white" style={display}>{t('home.v3.instTitle')}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#E7F4F2]/85">{t('home.v3.instBody')}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {instPoints.map((point) => (
              <li key={point} data-reveal className="rounded-[28px] border border-white/15 bg-white/10 p-5 text-sm leading-relaxed backdrop-blur-sm">{point}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className={cta} href="/institutions">{t('home.v3.instTag')}</Link>
            <a className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-5 text-sm font-semibold text-white" href="mailto:institutions@poketschool.ai">{t('home.v3.contact')}</a>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-16 sm:px-8">
        <SectionLabel>{t('home.v3.priceTag')}</SectionLabel>
        <h2 className="mt-4 text-[clamp(1.85rem,3.2vw,2.85rem)] font-extrabold leading-[1.08] tracking-tight" style={display}>{t('home.v3.priceTitle')}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{t('home.v3.priceBody')}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const featured = index === 2;
            return (
              <li
                key={plan.name}
                data-reveal
                className={`flex flex-col p-5 ${card} ${featured ? 'ring-2 ring-[#3FE0D0] lg:-translate-y-2' : ''}`}
              >
                <h3 className="text-xl font-extrabold tracking-tight" style={display}>{plan.name}</h3>
                <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#1E6A83] dark:text-[#E7F4F2]">{plan.amount}</p>
                <p className="text-xs font-semibold text-[#1E6A83] dark:text-[#E7F4F2]">{plan.period}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{plan.body}</p>
                <Link className={`mt-5 ${featured ? cta : inkBtn}`} href={plan.href}>{plan.cta}</Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-5 pb-16 sm:px-8">
        <div className="mx-auto max-w-6xl rounded-[32px] bg-[#203337] px-6 py-14 text-center text-[#E7F4F2]">
          <h2 className="text-[clamp(1.85rem,3.2vw,2.7rem)] font-extrabold leading-tight tracking-tight text-white" style={display}>{t('home.v3.close')}</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link className={cta} href="/signup">{t('home.v3.start')}</Link>
            <Link className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-5 text-sm font-semibold text-white" href="/institutions/register">{t('home.v3.schools')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
