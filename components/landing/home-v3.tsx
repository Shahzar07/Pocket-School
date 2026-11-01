'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { LANGUAGES } from '@/lib/languages';
import { HOME } from '@/lib/marketing/home';
import { FeaturedShowcase } from '@/components/courses/featured-showcase';
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

const primary = 'inline-flex h-12 items-center justify-center rounded-lg bg-[#3FE0D0] px-5 text-sm font-medium text-[#203337] transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]';
const secondary = 'inline-flex h-12 items-center justify-center rounded-lg border border-[rgba(32,51,55,0.1)] bg-white px-5 text-sm font-medium text-[#203337] transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-[rgba(231,244,242,0.12)] dark:bg-[#17282D] dark:text-[#E7F4F2]';
const onInk = 'inline-flex h-12 items-center justify-center rounded-lg border border-[rgba(231,244,242,0.24)] px-5 text-sm font-medium text-[#E7F4F2]';
const card = 'rounded-2xl border border-[rgba(32,51,55,0.08)] bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)] dark:border-[rgba(231,244,242,0.08)] dark:bg-[#122226] dark:shadow-none';
const title = 'text-[32px] font-medium leading-[1.15] text-[#203337] dark:text-[#E7F4F2]';

export function HomeV3() {
  const root = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();
  usePremiumMotion(root);
  const language = i18n.resolvedLanguage || i18n.language || '';
  const clusterScript = /^(ta|te|kn|ml|si|my|km|am)/.test(language);
  const tamil = language.startsWith('ta');
  const display = tamil
    ? { fontFamily: 'var(--font-tamil), var(--font-sans), sans-serif' }
    : undefined;
  const teachers = String(AI_TEACHERS.length);
  const languages = String(LANGUAGES.length);
  const problems = asList<Problem>(t('home.v3.problems', { returnObjects: true }), HOME.problems);
  const features = asList<Feature>(t('home.v3.features', { returnObjects: true }), HOME.features);
  const levels = asList<Level>(t('home.v3.levels', { returnObjects: true }), HOME.levels);
  const instPoints = asList<string>(t('home.v3.instPoints', { returnObjects: true }), HOME.instPoints);
  const plans = asList<Plan>(t('home.v3.plans', { returnObjects: true }), HOME.plans);
  const lesson = features[0];
  const steps = Array.isArray(lesson?.points) ? lesson.points : [];

  return (
    <div
      ref={root}
      className="overflow-x-clip bg-[#F4F6F6] text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2]"
      style={{ fontFamily: tamil ? 'var(--font-tamil), var(--font-sans), sans-serif' : 'var(--font-sans), sans-serif' }}
      data-landing="v3"
    >
      <section data-hero className="px-6 pb-16 pt-28 sm:px-8 sm:pt-40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div data-enter>
            <SectionLabel>{t('home.v3.eyebrow')}</SectionLabel>
            <h1
              className="mt-4 max-w-xl text-[36px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-[56px] sm:leading-[1.05] sm:tracking-[-0.03em]"
              style={clusterScript ? { ...display, overflowWrap: 'anywhere' } : display}
            >
              <span className="block">{t('home.v3.title')}{' & '}</span>
              <span className="mt-2 inline decoration-[#3FE0D0] decoration-4 underline-offset-[6px] underline">{t('home.v3.titleEm')}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base font-normal leading-7 text-[#203337] dark:text-[#E7F4F2]">{t('home.v3.lede')}</p>
            <p className="mt-3 max-w-xl text-sm leading-5 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.cred')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className={primary} href="/signup">{t('home.v3.start')}</Link>
              <Link className={secondary} href="/institutions/register">{t('home.v3.schools')}</Link>
            </div>
          </div>
          <div data-enter data-hero-mock className="rounded-2xl border border-[rgba(32,51,55,0.08)] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-[rgba(231,244,242,0.08)] dark:bg-[#122226] dark:shadow-none">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-lg font-medium leading-6 underline decoration-[#3FE0D0] decoration-4 underline-offset-[6px]">{lesson?.title}</p>
              <p className="text-xs tabular-nums text-[#5F7074] dark:text-[#93A7AB]">{teachers}</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{lesson?.body}</p>
            <ul className="mt-4 space-y-2">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className={index === 0
                    ? 'rounded-lg bg-[#F4F6F6] p-3 text-sm leading-6 text-[#203337] dark:bg-[#17282D] dark:text-[#E7F4F2]'
                    : 'rounded-lg px-3 py-2 text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]'}
                >
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <dl data-hero-stats="1" className="mx-auto mt-16 grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 border-t border-[rgba(32,51,55,0.08)] pt-8 dark:border-[rgba(231,244,242,0.08)] sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-2xl font-medium tabular-nums leading-8" style={display}>{t('home.v3.levelsLabel')}</dt>
            <dd className="mt-1 text-xs leading-4 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.formatsLabel')}</dd>
          </div>
          <div className="min-w-0 sm:border-s sm:border-[rgba(32,51,55,0.08)] sm:ps-6 sm:dark:border-[rgba(231,244,242,0.08)]">
            <dt className="text-[32px] font-medium tabular-nums leading-8" style={display}>{teachers}</dt>
            <dd className="mt-1 text-xs leading-4 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.teachersLabel')}</dd>
          </div>
          <div className="min-w-0 sm:border-s sm:border-[rgba(32,51,55,0.08)] sm:ps-6 sm:dark:border-[rgba(231,244,242,0.08)]">
            <dt className="text-[32px] font-medium tabular-nums leading-8" style={display}>{languages}</dt>
            <dd className="mt-1 text-xs leading-4 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.languagesLabel')}</dd>
          </div>
          <div className="min-w-0 sm:border-s sm:border-[rgba(32,51,55,0.08)] sm:ps-6 sm:dark:border-[rgba(231,244,242,0.08)]">
            <dt className="text-xl font-medium leading-7" style={display}>{t('home.v3.annual')}</dt>
            <dd className="mt-1 text-xs leading-4 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.priceTag')}</dd>
          </div>
        </dl>
      </section>

      <div data-landing-aligned className="border-y border-[rgba(32,51,55,0.08)] bg-white px-6 py-6 dark:border-[rgba(231,244,242,0.08)] dark:bg-[#0B1417] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 text-[13px] text-[#5F7074] dark:text-[#93A7AB]">
            <IconCap className="text-[#5F7074] dark:text-[#93A7AB]" />
            {t('home.v3.aligned')}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {HOME.boards.map((board) => (
              <li key={board} className="text-[13px] leading-5 text-[#203337] dark:text-[#E7F4F2]">{board}</li>
            ))}
          </ul>
        </div>
      </div>

      <div data-landing-universities className="bg-[#F4F6F6] px-6 py-8 dark:bg-[#0B1417] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 text-[13px] text-[#5F7074] dark:text-[#93A7AB]">
            <IconBuilding className="text-[#5F7074] dark:text-[#93A7AB]" />
            {t('home.v3.universities')}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {HOME.universities.map((name) => (
              <li key={name} className="text-[13px] font-medium leading-5">{name}</li>
            ))}
          </ul>
          <p className="mt-3 max-w-3xl text-xs leading-4 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.universitiesNote')}</p>
        </div>
      </div>

      <TeachSection />

      <section id="courses" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:px-8">
        <FeaturedShowcase variant="row" />
      </section>

      <section id="features" data-reveal className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:px-8">
        <SectionLabel>{t('home.v3.solveTag')}</SectionLabel>
        <h2 className={`mt-3 max-w-2xl ${title}`} style={display}>{t('home.v3.solveTitle')}</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.solveBody')}</p>
        <ul className="mt-8 grid gap-4 lg:grid-cols-2">
          {problems.map((item) => (
            <li key={item.problem} className={card}>
              <p className="font-medium">{item.problem}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{item.answer}</p>
            </li>
          ))}
        </ul>
        <div className="mt-16 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => {
            const Icon = FEATURE_ICONS[item.href] ?? IconSpark;
            const points = Array.isArray(item.points) ? item.points : [];
            return (
              <Link key={item.href} href={item.href} className={`${card} flex h-full flex-col transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#F4F6F6] dark:hover:bg-[#17282D]`}>
                <div className="flex items-center gap-2">
                  <Icon className="text-[#5F7074] dark:text-[#93A7AB]" />
                  <h3 className="text-lg font-medium leading-6" style={display}>{item.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{item.body}</p>
                {points.length > 0 ? (
                  <ul className="mt-4 flex-1 space-y-2">
                    {points.map((point) => (
                      <li key={point} className="flex gap-2 text-sm leading-6">
                        <Check className="mt-0.5 shrink-0 text-[#1E6A83] dark:text-[#3FE0D0]" size={16} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#1E6A83] dark:text-[#E7F4F2]">
                  {t('home.v3.learnMore')} <IconArrow />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bg-white px-6 py-16 dark:bg-[#0B1417] sm:px-8">
        <div data-reveal className="mx-auto max-w-6xl">
          <SectionLabel>{t('home.v3.levelsTag')}</SectionLabel>
          <h2 className={`mt-3 ${title}`} style={display}>{t('home.v3.levelsTitle')}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {levels.map((item) => {
              const Icon = LEVEL_ICONS[item.href] ?? IconCap;
              return (
                <li key={item.href}>
                  <Link href={item.href} className={`${card} flex h-full flex-col`}>
                    <Icon className="text-[#5F7074] dark:text-[#93A7AB]" />
                    <p className="mt-4 text-xs leading-4 text-[#5F7074] dark:text-[#93A7AB]">{item.price}</p>
                    <h3 className="mt-1 text-xl font-medium leading-7" style={display}>{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{item.body}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
        <h2 className={title} style={display}>{t('home.v3.rochfords')}</h2>
        <p className="mt-4 text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.rochfordsBody')}</p>
        <Link className="mt-4 inline-flex text-sm font-medium text-[#1E6A83] dark:text-[#E7F4F2]" href="/rochfords">{t('home.v3.rochfords')}</Link>
      </section>

      <section id="institutions" className="scroll-mt-24 bg-[#F4F6F6] px-6 py-16 dark:bg-[#0B1417] sm:px-8">
        <div data-reveal className="mx-auto max-w-6xl">
          <SectionLabel>{t('home.v3.instTag')}</SectionLabel>
          <h2 className={`mt-3 max-w-xl ${title}`} style={display}>{t('home.v3.instTitle')}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.instBody')}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {instPoints.map((point) => (
              <li key={point} className={`${card} text-sm leading-6`}>{point}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link className={primary} href="/institutions">{t('home.v3.instTag')}</Link>
            <a className={secondary} href="mailto:institutions@poketschool.ai">{t('home.v3.contact')}</a>
            <Link className="inline-flex h-12 items-center px-2 text-sm font-medium text-[#1E6A83] dark:text-[#E7F4F2]" href="/demo">{t('home.v3.demo')}</Link>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:px-8">
        <div data-reveal>
          <SectionLabel>{t('home.v3.priceTag')}</SectionLabel>
          <h2 className={`mt-3 ${title}`} style={display}>{t('home.v3.priceTitle')}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{t('home.v3.priceBody')}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const featured = index === 2;
              return (
                <li key={plan.name} className={`flex flex-col ${card}`}>
                  <h3 className="text-lg font-medium leading-6" style={display}>{plan.name}</h3>
                  <p className={`mt-4 text-[32px] font-medium tabular-nums leading-8 ${featured ? 'text-[#1E6A83] dark:text-[#E7F4F2]' : ''}`}>{plan.amount}</p>
                  <p className="text-xs leading-4 text-[#5F7074] dark:text-[#93A7AB]">{plan.period}</p>
                  <p className="mt-4 flex-1 text-sm leading-6 text-[#5F7074] dark:text-[#93A7AB]">{plan.body}</p>
                  <Link className={`mt-6 ${featured ? primary : secondary}`} href={plan.href}>{plan.cta}</Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="px-6 pb-20 sm:px-8">
        <div className="mx-auto max-w-6xl rounded-2xl bg-[#203337] px-6 py-16 text-center">
          <h2 className="text-[32px] font-medium leading-[1.15] text-[#E7F4F2]" style={display}>{t('home.v3.close')}</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link className={primary} href="/signup">{t('home.v3.start')}</Link>
            <Link className={onInk} href="/institutions/register">{t('home.v3.schools')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
