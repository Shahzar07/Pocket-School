'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { motion, type Variants } from 'motion/react';
import { toast } from 'sonner';
import { ADDONS, TIERS, planProgrammes } from '@/lib/entitlements';
import { LANGUAGES } from '@/lib/languages';
import { SIGNUP_GRANT } from '@/lib/sparks';
import { discountLabel, formatMoney, planById, quoteAddon, quotePlan, type BillingInterval } from '@/lib/pricing';
import { usePricing } from '@/hooks/use-pricing';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { MemberCardFace } from '@/components/cards/member-card-face';
import { MEMBER_CARD_TITLE, type PublicCard } from '@/lib/cards/model';
import {
  ArrowRight,
  Check,
  Video,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Building2,
  ShieldCheck,
  GraduationCap,
  Users,
  KeyRound,
  LayoutDashboard,
  BookOpen,
} from 'lucide-react';

/* ─── Animation helpers ─────────────────────────────────────── */

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO, delay: i * 0.08 },
  }),
};

const SAMPLE_CARD: PublicCard = {
  title: MEMBER_CARD_TITLE,
  firstName: 'Amina',
  levelName: 'IGCSE',
  schoolName: null,
  showPhoto: false,
  avatarUrl: '',
  badges: ['Algebra'],
  streakDays: 4,
  referralCode: 'AMINA2K7',
  joinPath: '/signup?ref=AMINA2K7',
  indexable: false,
  visible: true,
};

/* ─── Data ──────────────────────────────────────────────────── */

type Billing = BillingInterval;

interface PlanCopy {
  id: string;
  name: string;
  tagline: string;
  tier: number;
  popular?: boolean;
  cta: string;
  features: string[];
}

const PREVIEW_EXTRAS = [
  'ET AI tutor — 20 messages a day',
  'ET AI generator — 3 items a day',
  'Buy any marketplace course outright',
];

const PRIMARY_EXTRAS = [
  'Unlimited ET AI study materials',
  'Progress tracking and streaks',
];

const IGCSE_EXTRAS = [
  'ET AI tutor, unlimited',
  "Bloom's progress tracking",
];

/** Marketing copy for the sold plans. Amounts come from the pricing document. */
const PLANS: PlanCopy[] = [
  {
    id: 'preview',
    name: 'Free Preview',
    tier: 0,
    tagline: 'Browse everything, and take the first lesson of any course. No card, no countdown.',
    cta: 'Start free',
    features: PREVIEW_EXTRAS,
  },
  {
    id: 'primary_secondary',
    name: 'Primary & Lower Secondary',
    tier: 1,
    tagline: 'Primary and Lower Secondary. Every core subject, built to the curriculum.',
    cta: 'Choose this plan',
    features: PRIMARY_EXTRAS,
  },
  {
    id: 'igcse_alevel',
    name: 'IGCSE & A-Level',
    tier: 2,
    tagline: 'IGCSE to A-Level, with everything below included.',
    popular: true,
    cta: 'Choose this plan',
    features: IGCSE_EXTRAS,
  },
  {
    id: 'professional',
    name: 'Professional & Degrees',
    tier: 3,
    tagline: 'MBBS Medicine, LLB Law (University of London and other universities), Engineering and Nursing.',
    cta: 'Choose this plan',
    features: [],
  },
];

const INSTITUTION_FEATURES = [
  { icon: <ShieldCheck className="w-4 h-4" />, label: 'White-label branding', desc: 'Your logo, your colours, your domain.' },
  { icon: <KeyRound className="w-4 h-4" />, label: 'SSO & directory sync', desc: 'SAML and Google Workspace sign-in.' },
  { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Admin console', desc: 'Cohort analytics, usage and oversight.' },
  { icon: <Users className="w-4 h-4" />, label: 'Bulk seats', desc: 'Volume licensing from 25 learners up.' },
  { icon: <BookOpen className="w-4 h-4" />, label: 'Custom curriculum', desc: 'We ingest your schemes of work.' },
  { icon: <LayoutDashboard className="w-4 h-4" />, label: 'ET AI Timetabler', desc: 'Whole-school week, cover, and option blocks. Price TBC by Harry.' },
];

const SPARK_USES = [
  { title: 'Long-form generation', desc: 'Full podcast episodes, video storyboards and multi-chapter study guides.' },
  { title: 'Rich media', desc: 'Narrated audio, generated scene imagery and interactive infographics.' },
  { title: 'Deep exam work', desc: 'Full mock paper generation with rubric-based marking and gap analysis.' },
];

const FAQ_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/* ─── Page ──────────────────────────────────────────────────── */

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const { config, currency, ready, localMoney } = usePricing();

  const checkout = async (kind: 'plan' | 'addon', id: string) => {
    setCheckingOut(`${kind}:${id}`);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, interval: billing, currency }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'Checkout is unavailable.');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Checkout is unavailable.');
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <div
      className="pricing-page min-h-screen bg-background text-foreground overflow-x-hidden"
      data-pricing-ready={ready ? '1' : '0'}
      data-display-currency={currency}
    >
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative pt-24 lg:pt-32 pb-14 bg-gradient-to-b from-[#E9F7FA] via-[#F4FBFA] to-background overflow-hidden dark:from-[#0B1417] dark:via-[#122226] dark:to-[#0B1417]">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[var(--ps-cyan-soft)] blur-3xl" aria-hidden />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <p className="text-xs font-bold tracking-[0.25em] text-primary mb-5">PLANS &amp; PRICING</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-7xl tracking-tight text-foreground leading-[0.98] mb-6">
              Learn free.
              <br />
              <span className="ps-ink-gradient">
                Upgrade when it earns it.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              One price, everything included — ET AI for tutoring and study materials, and every
              format in between. No per-subject fees, no surprise add-ons.
            </p>
          </motion.div>

          {/* Billing toggle */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="mt-10 flex flex-col items-center gap-3"
          >
            <CurrencySwitcher />
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex items-center p-1 rounded-full bg-card border border-slate-200 shadow-sm"
            >
              {(['monthly', 'annual'] as const).map((b) => {
                const active = billing === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBilling(b)}
                    aria-pressed={active}
                    className={`relative text-xs sm:text-sm font-bold px-5 sm:px-6 py-2.5 rounded-full transition-colors ${
                      active ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="billing-pill"
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="absolute inset-0 rounded-full bg-[#203337]"
                      />
                    )}
                    <span className="relative">{b === 'monthly' ? 'Monthly' : 'Annual'}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--ps-cyan-text)]" />
              Pay annually and save {discountLabel(config)}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8" aria-label="Sample member card">
        <MemberCardFace card={SAMPLE_CARD} sample />
      </section>

      {/* ── Plans ──────────────────────────────────────────────── */}
      <section className="bg-card pb-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
            {PLANS.map((plan, i) => {
              const monthlyQuote = quotePlan(config, plan.id, 'monthly', currency);
              const annualQuote = quotePlan(config, plan.id, 'annual', currency);
              const monthlyUsd = quotePlan(config, plan.id, 'monthly', 'USD')?.amount ?? null;
              const annualUsd = quotePlan(config, plan.id, 'annual', 'USD')?.amount ?? null;
              return (
              <PlanCard
                key={plan.id}
                plan={plan}
                billing={billing}
                index={i}
                currency={monthlyQuote?.currency ?? annualQuote?.currency ?? currency}
                monthly={monthlyQuote?.amount ?? null}
                annual={annualQuote?.amount ?? null}
                conversion={localMoney((billing === 'monthly' ? monthlyUsd : annualUsd) ?? 0)}
                sparks={planById(config, plan.id)?.sparks ?? 0}
                rollover={TIERS.find(tier => tier.id === plan.id)?.sparksRollover ?? 0}
                checkingOut={checkingOut === `plan:${plan.id}`}
                onCheckout={() => checkout('plan', plan.id)}
              />
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Prices shown in {currency}, inclusive of applicable taxes. Cancel anytime.
            Regional pricing is available for Nigeria, Pakistan, Bangladesh and Ghana — contact us.
          </p>
        </div>
      </section>

      {/* ── Add-ons ────────────────────────────────────────────── */}
      <section id="addons" className="bg-card pb-20 lg:pb-24 scroll-mt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83]">Add-ons</p>
            <h2 className="font-heading text-3xl sm:text-4xl text-slate-900 tracking-tight mt-2">
              Bought on top of a plan
            </h2>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Independent of your subscription — cancel either without touching the other.
            </p>
          </div>

          {ADDONS.map(a => {
            const quoted = a.priceNote ? null : quoteAddon(config, a.id, currency);
            const addonQuoteAmount = quoted ? formatMoney(quoted.amount, quoted.currency) : formatMoney(0, currency);
            return (
            <div
              key={a.id}
              className="rounded-2xl border-2 border-slate-200 bg-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.4)]"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary grid place-items-center shrink-0">
                <Video className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-slate-900">{a.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{a.blurb}</p>
                {a.requiresLabel ? <p className="text-xs text-muted-foreground mt-2">{a.requiresLabel}</p> : (
                <p className="text-xs text-muted-foreground mt-2">
                  Requires the {TIERS.find(t => t.tier === a.requiresTier)?.name} plan or above.
                </p>
                )}
              </div>
              <div className="text-center sm:text-right shrink-0">
                <p className="text-2xl font-extrabold text-slate-900">
                  {a.priceNote ? a.priceNote : <>{addonQuoteAmount}<span className="text-sm font-medium text-muted-foreground">/mo</span></>}
                </p>
                <button
                  type="button"
                  onClick={() => checkout('addon', a.id)}
                  disabled={Boolean(a.priceNote) || checkingOut === `addon:${a.id}`}
                  className="mt-3 inline-flex items-center justify-center h-10 px-5 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  {checkingOut === `addon:${a.id}` ? 'Starting checkout…' : (a.priceNote ? a.priceNote : 'Subscribe')}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* ── Sparks explainer ───────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-muted border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-start">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
            >
              <p className="text-xs font-bold tracking-[0.2em] text-primary mb-4">THE SPARKS SYSTEM</p>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-foreground leading-[1.05] mb-5">
                What exactly is a{' '}
                <span className="ps-ink-gradient">
                  Spark
                </span>
                ?
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                Sparks are credits for the heavyweight AI work — the generations that take real compute
                rather than a quick answer. Chatting with ET AI and making standard notes, flashcards or
                quizzes with ET AI never touches them on a paid plan.
              </p>
              <p className="text-base text-muted-foreground leading-relaxed mb-8">
                Every plan includes a monthly allowance that refreshes on your billing date. Run dry
                before exams? Top-up packs are available from your dashboard at any time.
              </p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {PLANS.map(plan => {
                  const sparks = planById(config, plan.id)?.sparks ?? 0;
                  return {
                    plan: plan.name,
                    amount: sparks.toLocaleString('en'),
                    note: sparks > 0 ? 'per month' : 'top-ups only',
                  };
                }).map((s) => (
                  <div
                    key={s.plan}
                    className="rounded-2xl bg-card border border-slate-200 p-4 text-center shadow-sm"
                  >
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400 mb-1.5">
                      {s.plan}
                    </p>
                    <p className="font-heading text-3xl text-foreground leading-none flex items-center justify-center gap-1.5">
                      <Zap className="w-4 h-4 text-[var(--ps-cyan-text)] fill-[var(--ps-cyan-text)]" />
                      {s.amount}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{s.note}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              custom={1}
              className="space-y-4"
            >
              <p className="text-sm font-bold text-foreground mb-1">Sparks are spent on</p>
              {SPARK_USES.map((u) => (
                <div
                  key={u.title}
                  className="flex gap-4 rounded-2xl bg-card border border-slate-200 p-5 hover:border-primary/40 hover:shadow-[0_20px_50px_-20px_rgba(30,106,131,0.25)] transition-all"
                >
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--ps-cyan-soft)] flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[var(--ps-cyan-text)] fill-[var(--ps-cyan-text)]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-foreground mb-1">{u.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{u.desc}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-dashed border-primary/30 bg-muted p-5">
                <p className="text-sm text-foreground leading-relaxed">
                  <span className="font-bold">Never expire mid-cycle.</span> Unused monthly Sparks reset
                  each billing period, but purchased top-up Sparks roll over for as long as your account
                  is active.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Institutions ───────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-[#203337] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(30,106,131,0.25),transparent)]"
          aria-hidden
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16 items-center">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
            >
              <p className="text-xs font-bold tracking-[0.25em] text-[#6FBBCE] mb-5">FOR INSTITUTIONS</p>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white leading-[1.05] mb-5">
                Schools, colleges and
                <br />
                <span className="bg-gradient-to-r from-[#6FBBCE] via-[#A9D7E4] to-[#3FE0D0] bg-clip-text text-transparent">
                  training providers.
                </span>
              </h2>
              <p className="text-base text-white/70 leading-relaxed mb-8 max-w-md">
                Custom pricing built around your cohort size, curriculum and deployment. Pilot with one
                level, scale across the whole institution.
              </p>
              <a
                href="mailto:institutions@poketschool.ai?subject=Institutional%20Pricing%20Enquiry"
                className="inline-flex items-center gap-2 rounded-full h-12 px-7 text-sm font-bold bg-primary hover:bg-[#1E6A83] text-primary-foreground shadow-xl shadow-primary/40 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Talk to us
                <ArrowRight className="w-4 h-4" />
              </a>
              <p className="mt-4 text-xs text-white/50">
                institutions@poketschool.ai · typical reply within one working day
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              custom={1}
              className="grid sm:grid-cols-2 gap-3"
            >
              {INSTITUTION_FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/20 text-[#6FBBCE] flex items-center justify-center mb-3">
                    {f.icon}
                  </div>
                  <p className="text-sm font-extrabold text-white mb-1">{f.label}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{f.desc}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-dashed border-white/15 bg-transparent p-5 flex items-center">
                <p className="text-xs text-white/60 leading-relaxed">
                  Need something not on this list? Tell us what your programme needs and we will scope it.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <PricingFaq />

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <section className="pb-20 lg:pb-28 bg-card">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="c5-animated-gradient rounded-3xl py-16 sm:py-20 px-8 sm:px-10 text-white flex flex-col justify-center items-center text-center"
            style={{ boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)' }}
          >
            <h2
              className="font-heading font-normal leading-[1.05] mb-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}
            >
              Start on Free.
              <br />
              <em>Decide later.</em>
            </h2>
            <p className="text-[0.95rem] sm:text-base mb-8 font-normal text-white/90 max-w-md leading-relaxed">
              No card needed. Meet ET AI, make something with it, and see whether it changes how you study.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-neutral-900 text-white font-semibold text-[0.95rem] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.4)]"
              style={{ padding: '14px 32px', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}
            >
              Create your free account <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <p className="mt-10 text-center text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Poket School is an independent learning platform. Not affiliated with or endorsed by any
            examination board.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ─── Plan card ─────────────────────────────────────────────── */

function PlanCard({
  plan, billing, index, currency, monthly, annual, conversion, sparks, rollover, checkingOut, onCheckout,
}: {
  plan: PlanCopy;
  billing: Billing;
  index: number;
  currency: string;
  monthly: number | null;
  annual: number | null;
  conversion: string | null;
  sparks: number;
  rollover: number;
  checkingOut: boolean;
  onCheckout: () => void;
}) {
  const isFree = monthly === 0 && annual === 0;
  const price = billing === 'monthly' ? monthly : annual;
  const priceUnset = price == null;
  const shown = priceUnset ? 'Not set' : formatMoney(price, currency);
  const suffix = isFree ? 'forever' : priceUnset ? '' : billing === 'monthly' ? '/month' : '/year';
  const annualLabel = annual == null ? 'Not set' : formatMoney(annual, currency);
  const saving = monthly != null && annual != null ? monthly * 12 - annual : 0;
  const sparksLine = sparks > 0
    ? `${sparks.toLocaleString('en')} Sparks a month${rollover > 0 ? ` · ${rollover.toLocaleString('en')} roll over` : ''}`
    : `${SIGNUP_GRANT.toLocaleString('en')} welcome Sparks`;
  const included = [...planProgrammes(plan.id), ...plan.features];
  const features = sparks > 0 ? [...included, `${sparks.toLocaleString('en')} Sparks a month`] : included;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      custom={index}
      className={`relative flex flex-col rounded-2xl border transition-all h-full ${
        plan.popular
          ? 'border-primary bg-card shadow-[0_30px_70px_-30px_rgba(30,106,131,0.55)] lg:-mt-4 lg:mb-4'
          : 'border-slate-200 bg-card hover:border-primary/40 hover:shadow-[0_20px_50px_-20px_rgba(30,106,131,0.25)]'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#1E6A83] bg-[#3FE0D0] text-[#203337] text-[10px] font-bold tracking-[0.15em]">
            <Sparkles className="w-3 h-3 text-foreground" />
            MOST POPULAR
          </span>
        </div>
      )}

      <div className={`p-7 sm:p-8 ${plan.popular ? 'pt-9 sm:pt-10' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className={`w-4 h-4 ${plan.popular ? 'text-primary' : 'text-slate-400'}`} />
          <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-foreground">{plan.name}</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed min-h-[3.25rem]">{plan.tagline}</p>

        <div className="mt-6 flex items-end gap-2">
          <span
            data-plan-price={plan.id}
            className="font-heading text-4xl sm:text-5xl leading-none text-foreground tracking-tight tabular-nums"
          >
            {shown}
          </span>
          <span className="text-sm font-semibold text-muted-foreground pb-2">{suffix}</span>
        </div>
        {conversion && (
          <p data-local-conversion={plan.id} className="mt-1 text-xs text-muted-foreground">
            ≈ {conversion}
          </p>
        )}

        <div className="mt-2 h-5">
          {!isFree && !priceUnset && billing === 'annual' && saving > 0 && (
            <p className="text-xs font-bold text-success">
              Save {formatMoney(saving, currency)}
            </p>
          )}
          {!isFree && !priceUnset && billing === 'monthly' && annual != null && (
            <p className="text-xs text-muted-foreground">
              or {annualLabel}/year
            </p>
          )}
          {isFree && <p className="text-xs text-muted-foreground">No card required</p>}
          {priceUnset && <p className="text-xs text-muted-foreground">A super admin has not set this price</p>}
        </div>

        {isFree ? (
          <Link
            href="/signup"
            className="mt-6 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full text-sm font-bold transition-all bg-[#203337] hover:bg-[#1E6A83] text-white"
          >
            {plan.cta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onCheckout}
            disabled={checkingOut || priceUnset}
            className={`mt-6 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full text-sm font-bold transition-all disabled:opacity-60 ${
              plan.popular
                ? 'bg-primary hover:bg-[#1E6A83] text-primary-foreground shadow-lg shadow-primary/30'
                : 'bg-[#203337] hover:bg-[#1E6A83] text-white'
            }`}
          >
            {priceUnset ? 'Price not set' : checkingOut ? 'Starting checkout…' : plan.cta}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-7 sm:px-8 pb-8 pt-1 flex-1 flex flex-col">
        <div className="border-t border-slate-100 pt-6">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400 mb-4">
            What&rsquo;s included
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${
                    plan.popular ? 'bg-primary' : 'bg-[#E9F7FA]'
                  }`}
                >
                  <Check className={`w-2.5 h-2.5 ${plan.popular ? 'text-primary-foreground' : 'text-primary'}`} strokeWidth={3.5} />
                </span>
                <span className="text-sm text-slate-700 leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-6">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-md border border-[var(--ps-cyan-border)]/30 bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)]">
            <Zap className="w-3 h-3 fill-current" />
            {sparksLine}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── FAQ ───────────────────────────────────────────────────── */

function PricingFaq() {
  const { t } = useTranslation();
  const [active, setActive] = useState<number | null>(0);
  const count = LANGUAGES.length;

  return (
    <section id="pricing-faq" className="py-20 lg:py-24 bg-card">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-4">{t('landing.faq.pricingEyebrow')}</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-foreground leading-[1.05]">
            {t('landing.faq.pricingTitle')}
          </h2>
        </motion.div>

        <div className="flex flex-col gap-3">
          {FAQ_IDS.map((id, i) => {
            const open = active === i;
            const question = t(`landing.faq.q${id}`);
            return (
              <div
                key={id}
                className="bg-card border rounded-xl transition-all duration-200 hover:border-[#eaeaea]"
                style={{
                  borderColor: open ? '#eaeaea' : '#f0f0f0',
                  boxShadow: open ? '0 4px 12px rgba(0,0,0,0.04)' : '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActive(open ? null : i)}
                  aria-expanded={open}
                  className="w-full text-left flex justify-between items-center gap-3 font-semibold text-[0.95rem] text-foreground px-5 py-[18px] cursor-pointer"
                >
                  <span className="flex-1">{question}</span>
                  {open ? (
                    <ChevronUp className="w-5 h-5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 shrink-0 text-slate-400" />
                  )}
                </button>
                {open && (
                  <div className="px-5 pb-5 -mt-1 text-[0.9rem] text-muted-foreground leading-[1.65]">
                    {t(`landing.faq.a${id}`, { count })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
