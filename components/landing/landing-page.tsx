'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { AI_TEACHERS, CEFR_LEVELS, TEACHER_CATEGORIES } from '@/lib/ai-teachers';
import { ADDONS, tierDefinition } from '@/lib/entitlements';
import { LANGUAGES } from '@/lib/languages';
import { PROGRAMMES } from '@/lib/programmes';
import { discountLabel, formatMoney, quoteAddon, quotePlan } from '@/lib/pricing';
import { usePricing } from '@/hooks/use-pricing';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isAdmin } from '@/lib/roles';
import { useHomeMotion } from '@/hooks/use-home-motion';
import { DemoLeadForm } from '@/components/demo-lead-form';
import s from '@/app/home.module.css';

const DEMO = 'mailto:institutions@poketschool.ai';

const EXAM_CHIPS = ['caie', 'edexcel', 'oxford', 'uol', 'cefr', 'more'] as const;
const HERO_STATS = ['countries', 'levels', 'teachers', 'formats', 'intelligences'] as const;
const DEGREES = ['llb', 'mbbs', 'engineering', 'nursing'] as const;
const DEGREE_PILLS = {
  llb: ['contract', 'tort', 'criminal', 'public', 'land', 'equity', 'more'],
  mbbs: ['anatomy', 'physiology', 'pharmacology', 'biochemistry', 'pathology', 'clinical'],
  engineering: ['maths', 'mechanics', 'materials', 'circuits', 'structures', 'design'],
  nursing: ['anatomy', 'physiology', 'pharmacology', 'care', 'clinical', 'community'],
} as const;
const LEARNER_PILLS = ['private', 'home', 'international', 'llbLearners', 'mbbs', 'languages', 'professional'] as const;
const BOARDS = [
  { id: 'caie', pills: ['a', 'b', 'c', 'd'] },
  { id: 'edexcel', pills: ['a', 'b', 'c'] },
  { id: 'oxford', pills: ['a', 'b'] },
  { id: 'uol', pills: ['a', 'b'] },
] as const;
const DOES = [
  { id: 'teachers', meta: true },
  { id: 'studio', meta: true },
  { id: 'exam', meta: true },
  { id: 'maths', meta: true },
  { id: 'bloom', meta: false },
  { id: 'certificates', meta: false },
] as const;
const INTELLIGENCES = ['linguistic', 'logical', 'spatial', 'auditory', 'kinesthetic', 'interpersonal', 'intrapersonal', 'naturalist'] as const;
const COMPARE = ['1', '2', '3', '4', '5'] as const;
const COUNTRIES = ['malaysia', 'nigeria', 'uk', 'singapore', 'china', 'more'] as const;
const SCHOOL_CARDS = ['brand', 'curriculum', 'data', 'admin'] as const;
const PLAN_CARDS = [
  { id: 'preview', name: 'previewName', features: ['preview1', 'preview2', 'preview3', 'preview4', 'preview5'], popular: false },
  { id: 'igcse_alevel', name: 'igcseName', features: ['igcse1', 'igcse2', 'igcse3', 'igcse4', 'igcse5', 'igcse6', 'igcse7', 'igcse8', 'igcse9', 'igcse10', 'igcse11', 'igcse12', 'igcse13'], popular: true },
  { id: 'professional', name: 'professionalName', features: ['professional1', 'professional2', 'professional3', 'professional4', 'professional5', 'professional6', 'professional7', 'professional8', 'professional9'], popular: false },
] as const;
const NEW_FEATURES = ['essay', 'live', 'reads', 'badges', 'transcripts', 'parents', 'languages', 'studio'] as const;

const SHOTS = [
  { id: 'analytics', src: '/landing/analytics.webp' },
  { id: 'behaviour', src: '/landing/behaviour.webp' },
  { id: 'integrity', src: '/landing/integrity.webp' },
  { id: 'tutors', src: '/landing/tutors.webp' },
  { id: 'exams', src: '/landing/exams.webp' },
  { id: 'snap', src: '/landing/snap.webp' },
  { id: 'store', src: '/landing/store.webp' },
  { id: 'modes', src: '/landing/modes.webp' },
  { id: 'reads', src: '/landing/reads.webp' },
  { id: 'payments', src: '/landing/payments.webp' },
] as const;

const FAQ = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'] as const;
const AUDIENCES = ['students', 'parents', 'teachers', 'schools'] as const;
type Audience = (typeof AUDIENCES)[number];

function landingMoney(amount: number, currency: string): string {
  if (Number.isInteger(amount)) {
    const code = (currency || 'USD').trim().toUpperCase();
    try {
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return formatMoney(amount, currency);
    }
  }
  return formatMoney(amount, currency);
}

function Shot({
  src,
  alt,
  priority = false,
  caption,
  onDark = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  caption?: string;
  onDark?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/30 bg-card shadow-[var(--shadow-card)]">
      <div className="relative aspect-[16/10] bg-muted">
        <Image
          src={src}
          alt={alt}
          fill
          sizes={priority ? '(min-width: 1024px) 48vw, 100vw' : '(min-width: 1024px) 46vw, 100vw'}
          className="object-cover object-top"
          priority={priority}
        />
      </div>
      {caption ? (
        <figcaption className={`px-3 py-2 text-xs leading-relaxed ${onDark ? 'bg-[#123844] text-white' : 'text-muted-foreground'}`}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Pills({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <span className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLElement>(null);
  useHomeMotion(rootRef);
  const [annual, setAnnual] = useState(false);
  const [audience, setAudience] = useState<Audience>('students');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { config, currency } = usePricing();
  const { user, profile } = useAuthSTORE();
  const languageCount = LANGUAGES.length;
  const dashboard =
    profile?.role === 'teacher'
      ? '/dashboard/teacher'
      : isAdmin(profile)
        ? '/dashboard/admin'
        : profile?.role === 'parent'
          ? '/dashboard/parent'
          : '/dashboard/student';
  const startHref = user ? dashboard : '/signup';
  const moveTab = (index: number) => {
    const next = AUDIENCES[(index + AUDIENCES.length) % AUDIENCES.length];
    setAudience(next);
    tabRefs.current[AUDIENCES.indexOf(next)]?.focus();
  };

  return (
    <main className={`${s.home} bg-background text-foreground`} ref={rootRef}>
      <section className={s.hero} data-home-hero>
        <div className={s.clouds} aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-white/90">{t('landing.hero.eyebrow')}</p>
            <h1 className="mt-3 max-w-xl text-[clamp(40px,6vw,68px)] font-medium leading-[1.05] text-white">
              {t('landing.hero.title')}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/90">{t('landing.hero.lede')}</p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90">{t('landing.hero.credibility')}</p>
            <ul className="mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
              {HERO_STATS.map((id) => (
                <li key={id} className="rounded-2xl border border-white/25 bg-white/10 px-3 py-3 text-sm font-semibold leading-snug text-white">
                  {t(`landing.hero.stats.${id}`)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link className={s.primary} href={startHref}>
                {t('landing.hero.start')} <ArrowRight size={16} aria-hidden className="ps-dir-icon" />
              </Link>
              <Link className={s.secondary} href="#schools">
                {t('landing.hero.schools')}
              </Link>
              <a className={s.quiet} href="#demo">
                {t('landing.hero.demo')}
              </a>
            </div>
          </div>
          <div data-home-reveal="card">
            <Shot src="/landing/goals.webp" alt={t('landing.shots.goalsAlt')} priority caption={t('landing.shots.caption')} onDark />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card" aria-label={t('landing.exam.label')}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-foreground">{t('landing.exam.label')}</p>
          <ul className="flex flex-wrap gap-2">
            {EXAM_CHIPS.map((id) => (
              <li key={id}>
                <span className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold">
                  {t(`landing.exam.${id}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border bg-background" aria-label={t('landing.newFeatures.label')}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-foreground">{t('landing.newFeatures.label')}</p>
          <ul className="flex flex-wrap gap-2">
            {NEW_FEATURES.map((id) => (
              <li key={id}>
                <span className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-xs font-semibold">
                  {t(`landing.newFeatures.${id}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <nav className="border-b border-border bg-card" aria-label={t('landing.pathwaysLabel')}>
        <ul className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {PROGRAMMES.map((programme) => (
            <li key={programme.value} className="shrink-0">
              <Link
                href="/courses"
                className="inline-flex h-9 items-center rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
              >
                {programme.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="audiences">
        <h2 className="text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.audiences.label')}</h2>
        <div
          className="mt-6 flex gap-2 overflow-x-auto"
          role="tablist"
          aria-label={t('landing.audiences.label')}
          onKeyDown={(event) => {
            const index = AUDIENCES.indexOf(audience);
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              moveTab(index + 1);
            }
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              moveTab(index - 1);
            }
            if (event.key === 'Home') {
              event.preventDefault();
              moveTab(0);
            }
            if (event.key === 'End') {
              event.preventDefault();
              moveTab(AUDIENCES.length - 1);
            }
          }}
        >
          {AUDIENCES.map((id, index) => {
            const selected = audience === id;
            return (
              <button
                key={id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`audience-${id}`}
                aria-selected={selected}
                aria-controls={`audience-panel-${id}`}
                tabIndex={selected ? 0 : -1}
                className={`h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                  selected
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-foreground'
                }`}
                onClick={() => setAudience(id)}
              >
                {t(`landing.audiences.${id}.tab`)}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={`audience-panel-${audience}`}
          aria-labelledby={`audience-${audience}`}
          className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8"
          data-home-reveal="card"
        >
          <h3 className="text-2xl font-medium md:text-3xl">{t(`landing.audiences.${audience}.title`)}</h3>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {t(`landing.audiences.${audience}.body`)}
          </p>
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {(['a', 'b', 'c'] as const).map((point) => (
              <li key={point} className="flex gap-2 text-sm leading-relaxed">
                <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden />
                <span>{t(`landing.audiences.${audience}.${point}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="teachers">
        <p className="text-sm font-semibold text-primary">{t('landing.teachers.eyebrow')}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.teachers.title')}</h2>
          <Link href="/ai-teachers" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {t('landing.teachers.open')} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t('landing.teachers.lede')}</p>
        <div className="mt-8 space-y-8">
          {TEACHER_CATEGORIES.map((category) => {
            const teachers = AI_TEACHERS.filter((teacher) => teacher.category === category);
            if (teachers.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground">{category}</h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {teachers.map((teacher) => (
                    <li key={teacher.id}>
                      <Link href="/ai-teachers" className="block h-full rounded-2xl border border-border bg-card p-4 hover:border-primary">
                        <p className="font-semibold">{teacher.name}</p>
                        <p className="mt-1 text-xs font-medium text-primary">{teacher.title}</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{teacher.tagline}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
                {category === 'Languages' ? (
                  <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-4">
                    <p className="text-sm leading-relaxed">{t('landing.cefr.banner')}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {CEFR_LEVELS.map((level) => (
                        <li key={level.code}>
                          <span className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground">
                            {level.code} {level.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-card py-16 md:py-24" id="degrees">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.degrees.title')}</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">{t('landing.degrees.lede')}</p>
          <p className="mt-4 text-sm font-semibold">{t('landing.degrees.lineup')}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {DEGREES.map((id) => (
              <li key={id} className="rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]">
                <h3 className="text-xl font-semibold">{t(`landing.degrees.${id}.title`)}</h3>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-primary">{t(`landing.degrees.${id}.level`)}</p>
                {id === 'llb' ? (
                  <p className="mt-2 text-sm font-medium">{t('landing.degrees.llb.note')}</p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`landing.degrees.${id}.body`)}</p>
                <Pills items={DEGREE_PILLS[id].map((pill) => t(`landing.degrees.${id}.${pill}`))} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="supplement">
        <p className="text-sm font-semibold text-primary">{t('landing.supplement.eyebrow')}</p>
        <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.supplement.title')}</h2>
        <p className="mt-3 max-w-2xl font-medium">{t('landing.supplement.sub')}</p>
        <p className="mt-3 max-w-3xl text-muted-foreground">{t('landing.supplement.body')}</p>
        <Pills items={LEARNER_PILLS.map((id) => t(`landing.supplement.${id}`))} />
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {BOARDS.map((board) => (
            <li key={board.id} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{t(`landing.supplement.${board.id}.title`)}</h3>
              <p className="mt-1 text-xs font-semibold text-primary">{t(`landing.supplement.${board.id}.region`)}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.supplement.${board.id}.body`)}</p>
              <Pills items={board.pills.map((pill) => t(`landing.supplement.${board.id}.${pill}`))} />
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card py-16 md:py-24" id="does">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="max-w-3xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.does.title')}</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">{t('landing.does.lede')}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOES.map((card) => (
              <li key={card.id} className="rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]">
                <h3 className="text-lg font-semibold">
                  {t(`landing.does.${card.id}Title`)}
                  {card.meta ? <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-primary">{t(`landing.does.${card.id}Meta`)}</span> : null}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`landing.does.${card.id}Body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="intelligences">
        <h2 className="max-w-3xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.mi.title')}</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">{t('landing.mi.lede')}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INTELLIGENCES.map((id) => (
            <li key={id} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{t(`landing.mi.${id}Title`)}</h3>
              <p className="mt-1 text-xs font-semibold text-primary">{t(`landing.mi.${id}Smart`)}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.mi.${id}Body`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-lg font-medium">{t('landing.mi.close')}</p>
      </section>

      <section className="bg-muted/60 py-16 md:py-24" id="compare">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.oldWay.title')}</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">{t('landing.oldWay.lede')}</p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[36rem] text-start text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-start">
                    <span className="block font-semibold">{t('landing.oldWay.old')}</span>
                    <span className="mt-1 block text-xs font-medium text-muted-foreground">{t('landing.oldWay.oldSub')}</span>
                  </th>
                  <th className="px-4 py-3 text-start">
                    <span className="block font-semibold">{t('landing.oldWay.poket')}</span>
                    <span className="mt-1 block text-xs font-medium text-muted-foreground">{t('landing.oldWay.poketSub')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((id) => (
                  <tr key={id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{t(`landing.oldWay.old${id}`)}</td>
                    <td className="px-4 py-3">{t(`landing.oldWay.new${id}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="parents">
        <h2 className="max-w-3xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.parents.title')}</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">{t('landing.parents.lede')}</p>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {(['feed', 'alert', 'sparks'] as const).map((id) => (
            <li key={id} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{t(`landing.parents.${id}Title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.parents.${id}Body`)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]" aria-label={t('landing.parents.example')}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('landing.parents.example')}</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <h3 className="text-xl font-semibold">{t('landing.parents.name')}</h3>
            <p className="text-sm font-semibold">{t('landing.parents.streak')} · {t('landing.parents.sparks')}</p>
          </div>
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm">
            <span className="font-semibold">{t('landing.parents.goalAlert')}</span>
            {' · '}
            {t('landing.parents.goalDetail')}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {(['biology', 'chemistry', 'mathematics'] as const).map((subject) => (
              <li key={subject} className="rounded-2xl border border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">{t(`landing.parents.${subject}`)}</p>
                <p className="mt-1 text-2xl font-semibold">{t(`landing.parents.${subject}Score`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-muted/60 py-16 md:py-24" id="screens">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold text-primary">{t('landing.shots.eyebrow')}</p>
          <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.shots.title')}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('landing.shots.caption')}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {SHOTS.map((shot) => (
              <li key={shot.id}>
                <Shot src={shot.src} alt={t(`landing.shots.${shot.id}Alt`)} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="reach">
        <h2 className="max-w-3xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.reach.title')}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{t('landing.reach.lede')}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTRIES.map((id) => (
            <li key={id} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{t(`landing.reach.${id}`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`landing.reach.${id}Levels`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card py-16 md:py-24" id="rochford">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="max-w-3xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.rochford.title')}</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{t('landing.rochford.body')}</p>
          <p className="mt-6 max-w-3xl rounded-2xl border border-border bg-background p-5 text-sm leading-relaxed">{t('landing.rochford.card')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20" id="schools">
        <h2 className="max-w-3xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.schools.title')}</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{t('landing.schools.body')}</p>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {SCHOOL_CARDS.map((id) => (
            <li key={id} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{t(`landing.schools.${id}Title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.schools.${id}Body`)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 md:p-8">
          <h3 className="text-2xl font-medium">{t('landing.schools.ctaTitle')}</h3>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t('landing.schools.ctaBody')}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a className="text-sm font-semibold text-primary" href={DEMO}>{t('landing.schools.email')}</a>
            <a
              href="#demo"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)] px-5 text-sm font-semibold text-[var(--ps-cyan-ink)]"
            >
              {t('landing.schools.demo')}
            </a>
          </div>
          <div id="demo" className="mt-8 max-w-3xl">
            <DemoLeadForm />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24" id="addons">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold text-primary">{t('landing.addons.eyebrow')}</p>
          <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.addons.title')}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t('landing.addons.lede')}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {ADDONS.map((addon) => {
              const quote = quoteAddon(config, addon.id, currency);
              const plan = tierDefinition(addon.requiresTier).name;
              return (
                <li key={addon.id} className="rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]">
                  <h3 className="text-2xl font-medium">{addon.name}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{t(`landing.addons.${addon.id}`)}</p>
                  <p className="mt-4 text-sm">{t('landing.addons.requires', { plan })}</p>
                  {quote && quote.amount > 0 ? (
                    <p className="mt-2 text-lg font-semibold">
                      {formatMoney(quote.amount, quote.currency)}
                      <span className="text-sm font-medium text-muted-foreground">{t('landing.pricing.perMonth')}</span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Link href="/pricing" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {t('landing.addons.view')} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="bg-muted/60 py-16 md:py-24" id="pricing">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-primary">{t('landing.pricing.eyebrow')}</p>
              <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.pricing.title')}</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">{t('landing.pricing.lede')}</p>
            </div>
            <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label={t('landing.pricing.period')}>
              <button
                type="button"
                aria-pressed={!annual}
                className={`h-10 rounded-full px-4 text-sm font-semibold ${annual ? 'text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
                onClick={() => setAnnual(false)}
              >
                {t('landing.pricing.monthly')}
              </button>
              <button
                type="button"
                aria-pressed={annual}
                className={`h-10 rounded-full px-4 text-sm font-semibold ${annual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setAnnual(true)}
              >
                {t('landing.pricing.yearly')}{' '}
                <span className="font-medium">({t('landing.pricing.off', { discount: discountLabel(config) })})</span>
              </button>
            </div>
          </div>
          <ul className="mt-8 grid gap-4 lg:grid-cols-3">
            {PLAN_CARDS.map((card) => {
              const monthlyQuote = quotePlan(config, card.id, 'monthly', currency);
              const annualQuote = quotePlan(config, card.id, 'annual', currency);
              const code = monthlyQuote?.currency ?? currency;
              const monthlyAmount = monthlyQuote?.amount ?? 0;
              const annualAmount = annualQuote?.amount ?? 0;
              const perMonth = annual && annualAmount > 0 ? annualAmount / 12 : monthlyAmount;
              return (
                <li
                  key={card.id}
                  className={`flex flex-col rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] ${card.popular ? 'border-primary' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">{t(`landing.pricing.${card.name}`)}</h3>
                    {card.popular ? (
                      <span className="rounded-full border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)] px-3 py-1 text-xs font-semibold text-[var(--ps-cyan-ink)]">
                        {t('landing.pricing.popular')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-5">
                    <span className="text-3xl font-semibold tracking-tight">{landingMoney(perMonth, code)}</span>
                    <span className="text-sm text-muted-foreground">{annual && annualAmount > 0 ? t('landing.pricing.perMo') : t('landing.pricing.perMonth')}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {annual && annualAmount > 0
                      ? t('landing.pricing.billedYearly', { amount: landingMoney(annualAmount, code) })
                      : monthlyAmount > 0
                        ? t('landing.pricing.billedMonthly')
                        : t('landing.pricing.free')}
                  </p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {card.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={16} aria-hidden />
                        <span>{t(`landing.pricing.${feature}`)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={card.id === 'preview' ? '/courses' : '/pricing'}
                    className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)] px-4 text-sm font-semibold text-[var(--ps-cyan-ink)]"
                  >
                    {card.id === 'preview' ? t('landing.pricing.explore') : t('landing.pricing.view')}
                    <ArrowRight size={14} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/pricing" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {t('landing.pricing.all')} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="bg-card py-16 md:py-24" id="faq">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-sm font-semibold text-primary">{t('landing.faq.eyebrow')}</p>
          <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.faq.title')}</h2>
          <div className="mt-6 divide-y divide-border border-y border-border">
            {FAQ.map((id) => (
              <details key={id} className="group py-1">
                <summary className="cursor-pointer list-none py-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {t(`landing.faq.${id}`)}
                    <span aria-hidden className="text-primary group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.faq.a${id.slice(1)}`, { count: languageCount })}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={`${s.band} px-4 py-16 md:py-24`}>
        <div className={s.clouds} aria-hidden />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="mt-2 text-[clamp(36px,5vw,60px)] font-medium leading-tight text-white">{t('landing.cta.title')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/90">{t('landing.cta.body')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link className={s.primary} href={startHref}>
              {t('landing.cta.start')} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className={s.secondary} href="/courses">
              {t('landing.cta.courses')}
            </Link>
            <a className={s.quiet} href="#demo">
              {t('landing.cta.demo')}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
