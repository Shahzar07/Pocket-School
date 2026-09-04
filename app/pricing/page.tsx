'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'motion/react';
import { ADDONS, TIERS } from '@/lib/entitlements';
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

/* ─── Data ──────────────────────────────────────────────────── */

type Billing = 'monthly' | 'annual';

interface Plan {
  id: string;
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  /** International monthly rate in USD. */
  usdMonthly: number;
  /** Access tier from lib/entitlements.ts. */
  tier: number;
  popular?: boolean;
  cta: string;
  features: string[];
  sparks: string;
}

/**
 * The four plans from the Access Tiers brief (August 2026). Prices are the
 * Malaysian ringgit rates; `usd` carries the international rate shown on the
 * currency toggle. Tier numbers map to lib/entitlements.ts.
 */
const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Preview',
    tier: 0,
    tagline: 'Browse everything, and take the first lesson of any course. No card, no countdown.',
    monthly: 0,
    annual: 0,
    usdMonthly: 0,
    cta: 'Start free',
    sparks: '50 welcome Sparks',
    features: [
      'Full course catalogue',
      'First lesson of every course',
      'Ayla AI tutor — 20 messages a day',
      'Quill generator — 3 items a day',
      'Buy any marketplace course outright',
    ],
  },
  {
    id: 'primary_secondary',
    name: 'Primary & Lower Secondary',
    tier: 1,
    tagline: 'Years 1–9. Every core subject, built to the curriculum.',
    monthly: 49,
    annual: 441,
    usdMonthly: 19,
    cta: 'Choose this plan',
    sparks: '300 Sparks a month · 100 roll over',
    features: [
      'Primary Years 1–6, all subjects',
      'Lower Secondary Years 7–9',
      'Unlimited Quill study materials',
      'Progress tracking and streaks',
      '300 Sparks a month',
    ],
  },
  {
    id: 'igcse_alevel',
    name: 'IGCSE & A-Level',
    tier: 2,
    tagline: 'Years 10–13. The exam years, with everything below included.',
    monthly: 352,
    annual: 3168,
    usdMonthly: 79,
    popular: true,
    cta: 'Choose this plan',
    sparks: '800 Sparks a month · 300 roll over',
    features: [
      'IGCSE / GCSE — Cambridge & Edexcel',
      'A-Level and AS-Level',
      'Pre-University and Foundation',
      'Everything in Primary & Lower Secondary',
      'Ayla AI tutor, unlimited',
      "Bloom's progress tracking",
      'Parent dashboard',
      'Completion certificates',
      '800 Sparks a month',
    ],
  },
  {
    id: 'professional',
    name: 'Professional & Degrees',
    tier: 3,
    tagline: 'Micro degrees, professional certifications and the UoL External LLB.',
    monthly: 441,
    annual: 3969,
    usdMonthly: 99,
    cta: 'Choose this plan',
    sparks: '2,000 Sparks a month · 700 roll over',
    features: [
      'Micro Degrees and Diplomas',
      'Professional Certifications',
      'University of London External LLB — all 12 modules',
      'Amara, the law specialist AI teacher',
      'IRAC coaching and case law analysis',
      'Everything in IGCSE & A-Level',
      '2,000 Sparks a month',
    ],
  },
];

const INSTITUTION_FEATURES = [
  { icon: <ShieldCheck className="w-4 h-4" />, label: 'White-label branding', desc: 'Your logo, your colours, your domain.' },
  { icon: <KeyRound className="w-4 h-4" />, label: 'SSO & directory sync', desc: 'SAML and Google Workspace sign-in.' },
  { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Admin console', desc: 'Cohort analytics, usage and oversight.' },
  { icon: <Users className="w-4 h-4" />, label: 'Bulk seats', desc: 'Volume licensing from 25 learners up.' },
  { icon: <BookOpen className="w-4 h-4" />, label: 'Custom curriculum', desc: 'We ingest your schemes of work.' },
];

const SPARK_USES = [
  { title: 'Long-form generation', desc: 'Full podcast episodes, video storyboards and multi-chapter study guides.' },
  { title: 'Rich media', desc: 'Narrated audio, generated scene imagery and interactive infographics.' },
  { title: 'Deep exam work', desc: 'Full mock paper generation with rubric-based marking and gap analysis.' },
];

const FAQS = [
  {
    q: 'What are Sparks?',
    a: 'Sparks are the credits that power premium AI generation — long-form podcasts, narrated audio, generated imagery and full mock-paper marking. Everyday tutoring with Ayla and standard Quill generations do not consume Sparks on paid plans. Each plan includes a monthly allowance that resets on your billing date, and you can buy top-up packs at any time if you run out mid-term.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your dashboard in two clicks — no phone call, no retention script. Your plan stays active until the end of the period you have already paid for, and anything you have generated stays in your library on the Free plan afterwards.',
  },
  {
    q: 'Do you offer student discounts?',
    a: 'The Free plan is genuinely free forever. Beyond that we run a verified-student rate of 40% off Academic for learners in full-time education, and hardship places for those who need them. Email students@poketschool.ai from your school or university address and we will sort it out.',
  },
  {
    q: 'Is there a free trial?',
    a: 'There is no time-limited trial because the Free plan does the same job better — use Ayla and Quill every day, indefinitely, with daily caps instead of a ticking clock. When the caps start getting in your way, that is the honest signal to upgrade.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Visa, Mastercard and American Express, plus FPX online banking, GrabPay, Touch ’n Go eWallet and Boost for Malaysian learners. Institutional customers can pay by invoice and bank transfer in MYR or USD. All payments are processed by Stripe — we never see or store your card details.',
  },
];

/* ─── Page ──────────────────────────────────────────────────── */

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <div className="min-h-screen bg-white text-foreground overflow-x-hidden">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative pt-24 lg:pt-32 pb-14 bg-gradient-to-b from-[#EEF3FF] via-[#F5F1FF] to-white overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#1A73E8]/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#F5B400]/10 blur-3xl" aria-hidden />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <p className="text-xs font-bold tracking-[0.25em] text-[#1A73E8] mb-5">PLANS &amp; PRICING</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-7xl tracking-tight text-[#0B1B3F] leading-[0.98] mb-6">
              Learn free.
              <br />
              <span className="bg-gradient-to-r from-[#1A73E8] via-[#1E3A8A] to-[#1A73E8] bg-clip-text text-transparent">
                Upgrade when it earns it.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              One price, everything included — Ayla for tutoring, Quill for study materials, and every
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
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex items-center p-1 rounded-full bg-white border border-slate-200 shadow-sm"
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
                      active ? 'text-white' : 'text-slate-600 hover:text-[#0B1B3F]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="billing-pill"
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="absolute inset-0 rounded-full bg-[#0B1B3F]"
                      />
                    )}
                    <span className="relative">{b === 'monthly' ? 'Monthly' : 'Annual'}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-[#1A73E8] inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#F5B400]" />
              Pay annually and save 25% — three months free
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Plans ──────────────────────────────────────────────── */}
      <section className="bg-white pb-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
            {PLANS.map((plan, i) => (
              <PlanCard key={plan.id} plan={plan} billing={billing} index={i} />
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">
            All prices in Malaysian Ringgit (RM), inclusive of applicable taxes. Cancel anytime.
            International pricing is billed in USD — {PLANS.filter(p => p.usdMonthly > 0).map(p => `${p.name} $${p.usdMonthly}/mo`).join(' · ')}.
            Regional pricing is available for Nigeria, Pakistan, Bangladesh and Ghana — contact us.
          </p>
        </div>
      </section>

      {/* ── Add-ons ────────────────────────────────────────────── */}
      <section id="addons" className="bg-white pb-20 lg:pb-24 scroll-mt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7C3AED]">Add-ons</p>
            <h2 className="font-heading text-3xl sm:text-4xl text-slate-900 tracking-tight mt-2">
              Bought on top of a plan
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              Independent of your subscription — cancel either without touching the other.
            </p>
          </div>

          {ADDONS.map(a => (
            <div
              key={a.id}
              className="rounded-2xl border-2 border-slate-200 bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.4)]"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#1A73E8] grid place-items-center shrink-0">
                <Video className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-slate-900">{a.name}</h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{a.blurb}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Requires the {TIERS.find(t => t.tier === a.requiresTier)?.name} plan or above.
                </p>
              </div>
              <div className="text-center sm:text-right shrink-0">
                <p className="text-2xl font-extrabold text-slate-900">
                  RM{a.myrMonthly}<span className="text-sm font-medium text-slate-500">/mo</span>
                </p>
                <p className="text-[11px] text-slate-500">or ${a.usdMonthly}/mo</p>
                <a
                  href="mailto:hello@poketschool.ai?subject=Lyra%20Live%20add-on"
                  className="mt-3 inline-flex items-center justify-center h-10 px-5 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
                >
                  Request access
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sparks explainer ───────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-[#F8FAFF] border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-start">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
            >
              <p className="text-xs font-bold tracking-[0.2em] text-[#1A73E8] mb-4">THE SPARKS SYSTEM</p>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#0B1B3F] leading-[1.05] mb-5">
                What exactly is a{' '}
                <span className="bg-gradient-to-r from-[#1A73E8] to-[#1E3A8A] bg-clip-text text-transparent">
                  Spark
                </span>
                ?
              </h2>
              <p className="text-base text-slate-600 leading-relaxed mb-4">
                Sparks are credits for the heavyweight AI work — the generations that take real compute
                rather than a quick answer. Chatting with Ayla and making standard notes, flashcards or
                quizzes with Quill never touches them on a paid plan.
              </p>
              <p className="text-base text-slate-600 leading-relaxed mb-8">
                Every plan includes a monthly allowance that refreshes on your billing date. Run dry
                before exams? Top-up packs are available from your dashboard at any time.
              </p>

              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { plan: 'Free', amount: '0', note: 'top-ups only' },
                  { plan: 'Academic', amount: '400', note: 'per month' },
                  { plan: 'Professional', amount: '1,200', note: 'per month' },
                ].map((s) => (
                  <div
                    key={s.plan}
                    className="rounded-2xl bg-white border border-slate-200 p-4 text-center shadow-sm"
                  >
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400 mb-1.5">
                      {s.plan}
                    </p>
                    <p className="font-heading text-3xl text-[#0B1B3F] leading-none flex items-center justify-center gap-1.5">
                      <Zap className="w-4 h-4 text-[#F5B400] fill-[#F5B400]" />
                      {s.amount}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1.5">{s.note}</p>
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
              <p className="text-sm font-bold text-[#0B1B3F] mb-1">Sparks are spent on</p>
              {SPARK_USES.map((u) => (
                <div
                  key={u.title}
                  className="flex gap-4 rounded-2xl bg-white border border-slate-200 p-5 hover:border-[#1A73E8]/40 hover:shadow-[0_20px_50px_-20px_rgba(26,115,232,0.25)] transition-all"
                >
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[#FFF8E6] flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#F5B400] fill-[#F5B400]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#0B1B3F] mb-1">{u.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{u.desc}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-dashed border-[#1A73E8]/30 bg-[#EEF3FF] p-5">
                <p className="text-sm text-[#1E3A8A] leading-relaxed">
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
      <section className="py-20 lg:py-28 bg-[#0B1B3F] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(26,115,232,0.25),transparent)]"
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
              <p className="text-xs font-bold tracking-[0.25em] text-[#60A5FA] mb-5">FOR INSTITUTIONS</p>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white leading-[1.05] mb-5">
                Schools, colleges and
                <br />
                <span className="bg-gradient-to-r from-[#1A73E8] via-[#60A5FA] to-[#F5B400] bg-clip-text text-transparent">
                  training providers.
                </span>
              </h2>
              <p className="text-base text-white/70 leading-relaxed mb-8 max-w-md">
                Custom pricing built around your cohort size, curriculum and deployment. Pilot with one
                year group, scale across the whole institution.
              </p>
              <a
                href="mailto:institutions@poketschool.ai?subject=Institutional%20Pricing%20Enquiry"
                className="inline-flex items-center gap-2 rounded-full h-12 px-7 text-sm font-bold bg-[#1A73E8] hover:bg-[#1967D2] text-white shadow-xl shadow-[#1A73E8]/40 transition-colors"
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
                  <div className="w-9 h-9 rounded-xl bg-[#1A73E8]/20 text-[#60A5FA] flex items-center justify-center mb-3">
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
      <section className="pb-20 lg:pb-28 bg-white">
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
              No card needed. Meet Ayla, make something with Quill, and see whether it changes how you study.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-neutral-900 text-white font-semibold text-[0.95rem] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.4)]"
              style={{ padding: '14px 32px', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}
            >
              Create your free account <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <p className="mt-10 text-center text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Poket School is an independent learning platform. Not affiliated with or endorsed by any
            examination board.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ─── Plan card ─────────────────────────────────────────────── */

function PlanCard({ plan, billing, index }: { plan: Plan; billing: Billing; index: number }) {
  const isFree = plan.monthly === 0;
  const price = billing === 'monthly' ? plan.monthly : plan.annual;
  const suffix = isFree ? 'forever' : billing === 'monthly' ? '/month' : '/year';
  const saving = plan.monthly * 12 - plan.annual;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      custom={index}
      className={`relative flex flex-col rounded-2xl border transition-all h-full ${
        plan.popular
          ? 'border-[#1A73E8] bg-white shadow-[0_30px_70px_-30px_rgba(26,115,232,0.55)] lg:-mt-4 lg:mb-4'
          : 'border-slate-200 bg-white hover:border-[#1A73E8]/40 hover:shadow-[0_20px_50px_-20px_rgba(26,115,232,0.25)]'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold tracking-[0.15em] shadow-lg shadow-[#1A73E8]/30">
            <Sparkles className="w-3 h-3 text-[#F5B400]" />
            MOST POPULAR
          </span>
        </div>
      )}

      <div className={`p-7 sm:p-8 ${plan.popular ? 'pt-9 sm:pt-10' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className={`w-4 h-4 ${plan.popular ? 'text-[#1A73E8]' : 'text-slate-400'}`} />
          <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-[#0B1B3F]">{plan.name}</h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed min-h-[3.25rem]">{plan.tagline}</p>

        <div className="mt-6 flex items-end gap-2">
          <span className="text-lg font-bold text-slate-500 pb-2">RM</span>
          <span className="font-heading text-6xl leading-none text-[#0B1B3F] tracking-tight tabular-nums">
            {price}
          </span>
          <span className="text-sm font-semibold text-slate-500 pb-2">{suffix}</span>
        </div>

        <div className="mt-2 h-5">
          {!isFree && billing === 'annual' && (
            <p className="text-xs font-bold text-emerald-600">
              Save RM {saving} — two months free
            </p>
          )}
          {!isFree && billing === 'monthly' && (
            <p className="text-xs text-slate-500">
              or RM {plan.annual}/year — two months free
            </p>
          )}
          {isFree && <p className="text-xs text-slate-500">No card required</p>}
        </div>

        <Link
          href="/signup"
          className={`mt-6 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full text-sm font-bold transition-all ${
            plan.popular
              ? 'bg-[#1A73E8] hover:bg-[#1967D2] text-white shadow-lg shadow-[#1A73E8]/30'
              : 'bg-[#0B1B3F] hover:bg-[#132a5e] text-white'
          }`}
        >
          {plan.cta}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="px-7 sm:px-8 pb-8 pt-1 flex-1 flex flex-col">
        <div className="border-t border-slate-100 pt-6">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400 mb-4">
            What&rsquo;s included
          </p>
          <ul className="space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${
                    plan.popular ? 'bg-[#1A73E8]' : 'bg-[#EEF3FF]'
                  }`}
                >
                  <Check className={`w-2.5 h-2.5 ${plan.popular ? 'text-white' : 'text-[#1A73E8]'}`} strokeWidth={3.5} />
                </span>
                <span className="text-sm text-slate-700 leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-6">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-md border border-[#F5B400]/30 bg-[#FFF8E6] text-[#8A6100]">
            <Zap className="w-3 h-3 fill-current" />
            {plan.sparks}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── FAQ ───────────────────────────────────────────────────── */

function PricingFaq() {
  const [active, setActive] = useState<number | null>(0);

  return (
    <section className="py-20 lg:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold tracking-[0.2em] text-[#1A73E8] mb-4">PRICING QUESTIONS</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#0B1B3F] leading-[1.05]">
            The things people actually ask
          </h2>
        </motion.div>

        <div className="flex flex-col gap-3">
          {FAQS.map((item, i) => {
            const open = active === i;
            return (
              <div
                key={item.q}
                className="bg-white border rounded-xl transition-all duration-200 hover:border-[#eaeaea]"
                style={{
                  borderColor: open ? '#eaeaea' : '#f0f0f0',
                  boxShadow: open ? '0 4px 12px rgba(0,0,0,0.04)' : '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActive(open ? null : i)}
                  aria-expanded={open}
                  className="w-full text-left flex justify-between items-center gap-3 font-semibold text-[0.95rem] text-[#0B1B3F] px-5 py-[18px] cursor-pointer"
                >
                  <span className="flex-1">{item.q}</span>
                  {open ? (
                    <ChevronUp className="w-5 h-5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 shrink-0 text-slate-400" />
                  )}
                </button>
                {open && (
                  <div className="px-5 pb-5 -mt-1 text-[0.9rem] text-slate-600 leading-[1.65]">{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
