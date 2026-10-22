'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Building2, Compass, GraduationCap, IdCard, Landmark, Languages,
  Library, Scale, School, Shield, Sparkles, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { LANGUAGES } from '@/lib/languages';
import { HOME } from '@/lib/marketing/home';
import { FeaturedShowcase } from '@/components/courses/featured-showcase';
import { DuoIcon } from '@/components/landing/duo-icon';
import { TeachSection } from '@/components/landing/teach-section';

const serif = { fontFamily: 'var(--font-dm-serif), Georgia, serif' } as const;

type Problem = { problem: string; answer: string };
type Feature = { href: string; title: string; body: string };
type Level = { href: string; title: string; price: string; body: string };
type Plan = { name: string; amount: string; period: string; body: string; href: string; cta: string };

function asList<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) && value.length > 0 ? value as T[] : fallback;
}

const BOARD_ICONS: Record<string, LucideIcon> = {
  'Cambridge International (CAIE)': GraduationCap,
  'Pearson Edexcel': BookOpen,
  'Oxford AQA': Library,
  'University of London · LLB': Scale,
  'CEFR A1–C2 · Languages': Languages,
  'IB Diploma': Landmark,
  'AP (College Board)': School,
  'SPM / STPM (Malaysia)': BookOpen,
  'UEC': Library,
  'UK QAA (degree level)': Landmark,
  'MQA (Malaysian Qualifications Agency)': Scale,
  'A-Level / IAL': GraduationCap,
};

const FEATURE_ICONS: Record<string, LucideIcon> = {
  '/ai-teachers': GraduationCap,
  '/studio': Sparkles,
  '/reads': BookOpen,
  '/safeline': Shield,
  '/id': IdCard,
  '/demo': Users,
};

const LEVEL_ICONS: Record<string, LucideIcon> = {
  '/primary': School,
  '/igcse': BookOpen,
  '/alevel': GraduationCap,
  '/llb': Scale,
  '/mbbs': Compass,
  '/independent': Landmark,
};

export function HomeV3() {
  const { t } = useTranslation();
  const teachers = String(AI_TEACHERS.length);
  const languages = String(LANGUAGES.length);
  const problems = asList<Problem>(t('home.v3.problems', { returnObjects: true }), HOME.problems);
  const features = asList<Feature>(t('home.v3.features', { returnObjects: true }), HOME.features);
  const levels = asList<Level>(t('home.v3.levels', { returnObjects: true }), HOME.levels);
  const instPoints = asList<string>(t('home.v3.instPoints', { returnObjects: true }), HOME.instPoints);
  const plans = asList<Plan>(t('home.v3.plans', { returnObjects: true }), HOME.plans);
  return (
    <div className="bg-white text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2]" style={{ fontFamily: 'var(--font-dm-sans), var(--font-sans), sans-serif' }} data-landing="v3">
      <section className="bg-[linear-gradient(165deg,#0B1417_0%,#1E6A83_52%,#3FE0D0_130%)] px-6 pb-16 pt-24 text-white sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3FE0D0]">{t('home.v3.eyebrow')}</p>
          <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl" style={serif}>
            {t('home.v3.title')}<br />
            <em className="text-[#3FE0D0]">{t('home.v3.titleEm')}</em>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85">{t('home.v3.lede')}</p>
          <p className="mt-3 text-sm text-white/75">{t('home.v3.cred')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-[#203337]" href="/signup">{t('home.v3.start')}</Link>
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-semibold" href="/institutions/register">{t('home.v3.schools')}</Link>
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-semibold" href="/demo">{t('home.v3.demo')}</Link>
          </div>
          <dl data-hero-stats="1" className="not-prose mt-10 grid grid-cols-2 items-start gap-x-4 gap-y-5 sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-2xl font-bold leading-tight text-white">{t('home.v3.levelsLabel')}</dt>
              <dd className="mt-1 text-xs leading-snug text-white">{t('home.v3.formatsLabel')}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-2xl font-semibold leading-tight text-white [-webkit-text-stroke:0.45px_#fff]" style={serif}>{teachers}</dt>
              <dd className="mt-1 text-xs leading-snug text-white">{t('home.v3.teachersLabel')}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-2xl font-semibold leading-tight text-white [-webkit-text-stroke:0.45px_#fff]" style={serif}>{languages}</dt>
              <dd className="mt-1 text-xs leading-snug text-white">{t('home.v3.languagesLabel')}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-2xl font-semibold leading-tight text-white [-webkit-text-stroke:0.45px_#fff]" style={serif}>{t('home.v3.annual')}</dt>
              <dd className="mt-1 text-xs leading-snug text-white">{t('home.v3.priceTag')}</dd>
            </div>
          </dl>
        </div>
      </section>
      <div data-landing-aligned className="border-b border-[#1E6A83]/15 bg-[#F4FBFA] px-6 py-4 dark:border-[#3FE0D0]/20 dark:bg-[#122226]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1E6A83] dark:text-[#3FE0D0]">
            <GraduationCap aria-hidden size={16} />
            {t('home.v3.aligned')}
          </span>
          {HOME.boards.map((board) => {
            const Icon = BOARD_ICONS[board] ?? BookOpen;
            return (
              <span key={board} className="inline-flex items-center gap-1.5 rounded-full border border-[#1E6A83]/20 bg-white px-3 py-1 text-xs text-[#203337] dark:border-[#3FE0D0]/30 dark:bg-[#1A1918] dark:text-[#E7F4F2]">
                <Icon aria-hidden size={14} className="text-[#1E6A83] dark:text-[#3FE0D0]" />
                {board}
              </span>
            );
          })}
        </div>
      </div>
      <div data-landing-universities className="border-b border-[#1E6A83]/15 bg-white px-6 py-4 dark:border-[#3FE0D0]/20 dark:bg-[#0B1417]">
        <div className="mx-auto max-w-5xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1E6A83] dark:text-[#3FE0D0]">
            <Building2 aria-hidden size={16} />
            {t('home.v3.universities')}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {HOME.universities.map((name) => (
              <li key={name} className="rounded-full bg-[#F4FBFA] px-3 py-1 text-xs font-semibold text-[#203337] dark:bg-[#1A1918] dark:text-[#E7F4F2]">{name}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[#1E6A83] dark:text-[#3FE0D0]">{t('home.v3.universitiesNote')}</p>
        </div>
      </div>
      <TeachSection />
      <section id="courses" className="mx-auto max-w-5xl px-6 py-12">
        <FeaturedShowcase variant="row" />
      </section>
      <section id="features" className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83] dark:text-[#3FE0D0]">{t('home.v3.solveTag')}</p>
        <h2 className="mt-2 max-w-2xl text-3xl sm:text-4xl" style={serif}>{t('home.v3.solveTitle')}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{t('home.v3.solveBody')}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {problems.map((item) => (
            <li key={item.problem} className="rounded-2xl border border-[#1E6A83]/15 p-4 dark:border-[#3FE0D0]/25">
              <p className="font-semibold">{item.problem}</p>
              <p className="mt-1 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{item.answer}</p>
            </li>
          ))}
        </ul>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => {
            const Icon = FEATURE_ICONS[item.href] ?? Sparkles;
            return (
              <Link key={item.href} href={item.href} className="rounded-2xl bg-[#F4FBFA] p-5 hover:bg-[#3FE0D0]/25 dark:bg-[#122226] dark:hover:bg-[#1E6A83]/40">
                <DuoIcon icon={Icon} />
                <h3 className="mt-3 text-xl" style={serif}>{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{item.body}</p>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="bg-[#F4FBFA] px-6 py-16 dark:bg-[#122226]">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83] dark:text-[#3FE0D0]">{t('home.v3.levelsTag')}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl" style={serif}>{t('home.v3.levelsTitle')}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {levels.map((item) => {
              const Icon = LEVEL_ICONS[item.href] ?? GraduationCap;
              return (
                <li key={item.href}>
                  <Link href={item.href} className="block h-full rounded-2xl bg-white p-5 dark:bg-[#1A1918]">
                    <DuoIcon icon={Icon} />
                    <p className="mt-3 text-xs font-bold text-[#1E6A83] dark:text-[#3FE0D0]">{item.price}</p>
                    <h3 className="mt-1 text-2xl" style={serif}>{item.title}</h3>
                    <p className="mt-2 text-sm text-[#203337]/80 dark:text-[#E7F4F2]/80">{item.body}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-3xl sm:text-4xl" style={serif}>{t('home.v3.rochfords')}</h2>
        <p className="mt-4 text-sm leading-relaxed text-[#203337]/80 dark:text-[#E7F4F2]/80">{t('home.v3.rochfordsBody')}</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" href="/rochfords">{t('home.v3.rochfords')}</Link>
      </section>
      <section id="institutions" className="bg-[linear-gradient(165deg,#0B1417,#1E6A83)] px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3FE0D0]">{t('home.v3.instTag')}</p>
          <h2 className="mt-2 max-w-xl text-3xl sm:text-4xl" style={serif}>{t('home.v3.instTitle')}</h2>
          <p className="mt-3 max-w-2xl text-sm text-white/80">{t('home.v3.instBody')}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {instPoints.map((point) => (
              <li key={point} className="rounded-2xl bg-white/10 p-4 text-sm">{point}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-[#203337]" href="/institutions">{t('home.v3.instTag')}</Link>
            <a className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-semibold" href="mailto:institutions@poketschool.ai">{t('home.v3.contact')}</a>
          </div>
        </div>
      </section>
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83] dark:text-[#3FE0D0]">{t('home.v3.priceTag')}</p>
        <h2 className="mt-2 text-3xl sm:text-4xl" style={serif}>{t('home.v3.priceTitle')}</h2>
        <p className="mt-3 text-sm text-[#203337]/80 dark:text-[#E7F4F2]/80">{t('home.v3.priceBody')}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.name} className="flex flex-col rounded-2xl border border-[#1E6A83]/15 p-5 dark:border-[#3FE0D0]/25 dark:bg-[#1A1918]">
              <h3 className="text-xl" style={serif}>{plan.name}</h3>
              <p className="mt-2 text-3xl font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{plan.amount}</p>
              <p className="text-xs text-[#1E6A83] dark:text-[#3FE0D0]">{plan.period}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed">{plan.body}</p>
              <Link className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337]" href={plan.href}>{plan.cta}</Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="bg-[#0B1417] px-6 py-14 text-center text-white">
        <h2 className="text-3xl" style={serif}>{t('home.v3.close')}</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337]" href="/signup">{t('home.v3.start')}</Link>
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/30 px-4 text-sm font-semibold" href="/institutions/register">{t('home.v3.schools')}</Link>
        </div>
      </section>
    </div>
  );
}
