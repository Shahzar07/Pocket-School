'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  Landmark,
  Languages,
  Library,
  PenLine,
  Presentation,
  Repeat,
  School,
  Shield,
  Sparkles,
  Star,
  Timer,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AI_TEACHERS, CEFR_LEVELS, TEACHER_CATEGORIES } from '@/lib/ai-teachers';
import { ADDONS, TIERS, tierDefinition } from '@/lib/entitlements';
import { LANGUAGES } from '@/lib/languages';
import { PROGRAMMES } from '@/lib/programmes';
import { discountLabel, formatMoney, quoteAddon, quotePlan } from '@/lib/pricing';
import { FORMAT_LABELS } from '@/lib/sparks';
import { usePricing } from '@/hooks/use-pricing';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isAdmin } from '@/lib/roles';
import { useHomeMotion } from '@/hooks/use-home-motion';
import s from '@/app/home.module.css';

const DEMO = 'mailto:institutions@poketschool.ai?subject=Book%20a%20Poket%20School%20demo';

const FORMAT_ORDER = [
  'flashcards',
  'mindmap',
  'infographic',
  'notes',
  'quiz',
  'slides',
  'problems',
  'glossary',
  'text',
  'videoScript',
  'audioScript',
] as const;

/** AI Studio labels. The shared format map uses different names for a few of these. */
function studioFormatLabel(id: (typeof FORMAT_ORDER)[number]): string {
  if (id === 'text') return 'Full Lesson';
  if (id === 'notes') return 'Study Notes';
  if (id === 'problems') return 'Practice Problems';
  if (id === 'videoScript') return 'Video';
  if (id === 'audioScript') return 'Audio';
  return FORMAT_LABELS[id] ?? id;
}

const AUDIENCES = ['students', 'parents', 'teachers', 'schools'] as const;
type Audience = (typeof AUDIENCES)[number];

const FEATURES: { id: string; icon: LucideIcon; href?: string }[] = [
  { id: 'studio', icon: Sparkles, href: '/ai-studio' },
  { id: 'goals', icon: Timer },
  { id: 'bloom', icon: Brain },
  { id: 'behaviour', icon: Star },
  { id: 'attendance', icon: ClipboardCheck },
  { id: 'reports', icon: FileBarChart },
  { id: 'integrity', icon: Shield },
  { id: 'calendar', icon: Calendar },
  { id: 'tutors', icon: Users },
  { id: 'exams', icon: PenLine },
  { id: 'snap', icon: Camera },
  { id: 'store', icon: Library },
  { id: 'modes', icon: Repeat },
  { id: 'course', icon: Presentation },
  { id: 'languages', icon: Languages },
  { id: 'payments', icon: Landmark },
  { id: 'academy', icon: School, href: '#schools' },
  { id: 'reads', icon: BookOpen, href: '/reads' },
  { id: 'sparks', icon: Zap },
];

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

const FAQ = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'] as const;

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
            <p className="mt-4 text-sm font-semibold text-white">{t('landing.hero.stat')}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90">{t('landing.hero.credibility')}</p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">{t('landing.hero.ideal')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link className={s.primary} href={startHref}>
                {t('landing.hero.start')} <ArrowRight size={16} aria-hidden className="ps-dir-icon" />
              </Link>
              <Link className={s.secondary} href="#schools">
                {t('landing.hero.schools')}
              </Link>
              <a className={s.quiet} href={DEMO}>
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
            {(['caie', 'edexcel', 'oxford', 'uol', 'cefr'] as const).map((id) => (
              <li key={id}>
                <span className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold">
                  {t(`landing.exam.${id}`)}
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

      <section className="bg-card py-16 md:py-24" id="features">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold text-primary">{t('landing.features.eyebrow')}</p>
          <h2 className="mt-2 max-w-xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">
            {t('landing.features.title')}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t('landing.features.lede')}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ id, icon: Icon, href }, index) => {
              const title = t(`landing.features.${id}.title`, { count: languageCount });
              const body = t(`landing.features.${id}.body`, { count: languageCount });
              const inner = (
                <>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                    <Icon size={20} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </>
              );
              return (
                <li key={id} data-home-reveal="card" data-home-delay={(index % 3) * 40}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex h-full flex-col rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <article className="flex h-full flex-col rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]">
                      {inner}
                    </article>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-muted-foreground">{t('landing.formatsLabel')}</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {FORMAT_ORDER.map((id) => (
                <li key={id}>
                  <span className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold">
                    {studioFormatLabel(id)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
          <p className="text-sm font-semibold text-primary">{t('landing.degrees.eyebrow')}</p>
          <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.degrees.title')}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t('landing.degrees.lede')}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {(['llb', 'mbbs', 'engineering', 'nursing'] as const).map((id) => (
              <li key={id} className="rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]">
                <h3 className="text-xl font-semibold">{t(`landing.degrees.${id}Title`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`landing.degrees.${id}Body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="supplement">
        <p className="text-sm font-semibold text-primary">{t('landing.supplement.eyebrow')}</p>
        <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.supplement.title')}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t('landing.supplement.body')}</p>
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(['caie', 'edexcel', 'oxford', 'uol'] as const).map((id) => (
            <li key={id} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{t(`landing.supplement.${id}Title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.supplement.${id}Body`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm font-semibold">{t('landing.supplement.learners')}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(['igcse', 'alevel', 'llb', 'mbbs', 'engineering', 'nursing', 'independent'] as const).map((id) => (
            <li key={id}>
              <span className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold">
                {t(`landing.supplement.${id}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24" id="intelligences">
        <p className="text-sm font-semibold text-primary">{t('landing.mi.eyebrow')}</p>
        <h2 className="mt-2 max-w-xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.mi.title')}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t('landing.mi.lede')}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['linguistic', 'logical', 'spatial', 'bodily', 'musical', 'interpersonal', 'intrapersonal', 'naturalist'] as const).map((id) => (
            <li key={id} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{t(`landing.mi.${id}Title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.mi.${id}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted/60 py-16 md:py-24" id="compare">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold text-primary">{t('landing.oldWay.eyebrow')}</p>
          <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.oldWay.title')}</h2>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[36rem] text-start text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-start font-semibold">{t('landing.oldWay.old')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('landing.oldWay.poket')}</th>
                </tr>
              </thead>
              <tbody>
                {(['1', '2', '3', '4', '5'] as const).map((id) => (
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
        <p className="text-sm font-semibold text-primary">{t('landing.reach.eyebrow')}</p>
        <h2 className="mt-2 text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.reach.title')}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{t('landing.reach.body')}</p>
      </section>

      <section className="bg-card py-16 md:py-24" id="rochford">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold text-primary">{t('landing.rochford.eyebrow')}</p>
          <h2 className="mt-2 max-w-xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">{t('landing.rochford.title')}</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{t('landing.rochford.body')}</p>
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
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[TIERS[0], TIERS[1], TIERS[2], TIERS[3]].map((tier) => {
            const monthlyQuote = quotePlan(config, tier.id, 'monthly', currency);
            const annualQuote = quotePlan(config, tier.id, 'annual', currency);
            const code = monthlyQuote?.currency ?? currency;
            const perMonth = annual ? (annualQuote?.amount ?? 0) / 12 : (monthlyQuote?.amount ?? 0);
            const sparks = config.plans.find((plan) => plan.id === tier.id)?.sparks ?? tier.sparks;
            return (
              <li key={tier.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <h3 className="text-xl font-semibold">{tier.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tier.blurb}</p>
                <p className="mt-5">
                  <span className="text-3xl font-semibold tracking-tight">{formatMoney(perMonth, code)}</span>
                  <span className="text-sm text-muted-foreground">{t('landing.pricing.perMonth')}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {annual && (annualQuote?.amount ?? 0) > 0
                    ? t('landing.pricing.billedYearly', { amount: formatMoney(annualQuote?.amount ?? 0, code) })
                    : (monthlyQuote?.amount ?? 0) > 0
                      ? t('landing.pricing.billedMonthly')
                      : t('landing.pricing.free')}
                </p>
                <ul className="mt-5 space-y-2 text-sm">
                  {tier.programmes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={16} aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                  {sparks > 0 ? (
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={16} aria-hidden />
                      <span>{t('landing.pricing.sparks', { count: sparks.toLocaleString('en') })}</span>
                    </li>
                  ) : null}
                </ul>
                <Link
                  href={tier.tier === 0 ? startHref : '/pricing'}
                  className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  {tier.tier === 0 ? t('landing.pricing.start') : t('landing.pricing.view')}
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

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20" id="schools">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-10">
          <p className="text-sm font-semibold text-primary">{t('landing.schools.eyebrow')}</p>
          <h2 className="mt-2 max-w-xl text-[clamp(32px,4vw,48px)] font-medium leading-tight">
            {t('landing.schools.title')}
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{t('landing.schools.body')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={DEMO}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              {t('landing.schools.demo')}
            </a>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold"
            >
              {t('landing.schools.pricing')}
            </Link>
          </div>
        </div>
      </section>

      <section className={`${s.band} px-4 py-16 md:py-24`}>
        <div className={s.clouds} aria-hidden />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-white/80">{t('landing.cta.eyebrow')}</p>
          <h2 className="mt-2 text-[clamp(36px,5vw,60px)] font-medium leading-tight text-white">{t('landing.cta.title')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/90">{t('landing.cta.body')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link className={s.primary} href={startHref}>
              {t('landing.cta.start')} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className={s.secondary} href="#schools">
              {t('landing.cta.schools')}
            </Link>
            <a className={s.quiet} href={DEMO}>
              {t('landing.cta.demo')}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
