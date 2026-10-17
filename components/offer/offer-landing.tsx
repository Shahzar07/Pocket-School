import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  Globe,
  GraduationCap,
  PenLine,
  Users,
} from 'lucide-react';
import { MarketingHero } from '@/components/marketing/illustrations';
import {
  OFFER_BUNDLE_EXTRAS,
  OFFER_ROUTES,
  offerCopy,
  offerIncludedFeatures,
  offerPlans,
  type OfferPlan,
} from '@/lib/offer';

const BENEFIT_ICONS = [Camera, PenLine, GraduationCap, Users, BadgeCheck] as const;

function Cta({
  href,
  external,
  children,
  tone,
  className = '',
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
  tone: 'solid' | 'ghost' | 'ink' | 'line' | 'cyan';
  className?: string;
}) {
  const tones = {
    solid: 'bg-white text-[#1E6A83] hover:bg-[#E9F7FA]',
    ghost: 'border border-white/70 text-white hover:bg-white/10',
    ink: 'bg-[#1E6A83] text-white hover:bg-[#18586e]',
    line: 'border border-[#1E6A83]/30 text-[#1E6A83] hover:bg-[#E9F7FA] dark:border-[#6FBBCE]/40 dark:text-[#A7D9E5] dark:hover:bg-white/5',
    cyan: 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337] hover:bg-[#14B8A6]',
  } as const;
  const classNames = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-cyan)] ${tones[tone]} ${className}`;
  if (external) {
    return (
      <a href={href} className={classNames}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classNames}>
      {children}
    </Link>
  );
}

function PlanCard({ plan }: { plan: OfferPlan }) {
  return (
    <article
      className={`flex h-full flex-col rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)] ${
        plan.popular
          ? 'border-[#1E6A83] ring-2 ring-[#1E6A83]/20'
          : 'border-border'
      }`}
    >
      {plan.popular ? (
        <p className="mb-3">
          <span className="rounded-full bg-[#1E6A83] px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-white">
            {offerCopy.plans.popular}
          </span>
        </p>
      ) : null}
      <h3 className="font-heading text-lg leading-tight text-foreground">{plan.name}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.tagline}</p>
      <p className="mt-5 font-heading text-4xl tracking-tight text-foreground">{plan.price}</p>
      <p className="mt-1 text-sm font-medium text-[#1E6A83] dark:text-[#8ecbda]">{plan.priceNote}</p>
      <ul className="mt-5 flex-1 space-y-2.5 text-sm leading-relaxed text-foreground">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1E6A83] dark:text-[#8ecbda]" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Cta
        href={plan.href}
        external={plan.external}
        tone={plan.ctaTone === 'cyan' ? 'cyan' : plan.popular ? 'ink' : 'line'}
        className="mt-6 w-full"
      >
        {plan.cta}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Cta>
    </article>
  );
}

export function OfferLanding() {
  const plans = offerPlans(OFFER_BUNDLE_EXTRAS);
  const features = offerIncludedFeatures(OFFER_BUNDLE_EXTRAS);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#offer-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[#1E6A83]">
        Skip to content
      </a>
      <header className="bg-[#1E6A83] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href={OFFER_ROUTES.home} className="inline-flex min-w-0 items-center gap-2 font-semibold">
            <Globe className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">
              {offerCopy.brand}
              <span className="ml-2 hidden text-xs font-medium text-white/75 sm:inline">{offerCopy.domain}</span>
            </span>
          </Link>
          <nav aria-label="Offer" className="flex items-center gap-2 sm:gap-4">
            <Link href={OFFER_ROUTES.home} className="rounded-full px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
              {offerCopy.home}
            </Link>
            <Cta href={OFFER_ROUTES.signup} tone="solid" className="px-4">
              {offerCopy.startFree}
            </Cta>
          </nav>
        </div>
      </header>

      <main id="offer-main">
        <section className="text-white" style={{ background: 'var(--ps-hero)' }}>
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
            <MarketingHero slug="offer">
            <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/80">{offerCopy.hero.eyebrow}</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              {offerCopy.hero.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
              {offerCopy.hero.subhead}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Cta href={OFFER_ROUTES.allIn} tone="solid" className="w-full sm:w-auto">
                {offerCopy.hero.primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Cta>
              <Cta href={OFFER_ROUTES.signup} tone="ghost" className="w-full sm:w-auto">
                {offerCopy.hero.secondaryCta}
              </Cta>
            </div>
            <p className="mt-4 text-sm text-white/80">{offerCopy.hero.micro}</p>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/90">{offerCopy.hero.worth}</p>
            </div>
            </MarketingHero>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16" aria-labelledby="offer-benefits">
          <h2 id="offer-benefits" className="font-heading text-3xl tracking-tight sm:text-4xl">
            {offerCopy.benefits.title}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {offerCopy.benefits.items.map((item, index) => {
              const Icon = BENEFIT_ICONS[index] ?? Check;
              const span = index < 3 ? 'xl:col-span-2' : 'xl:col-span-3';
              return (
                <li key={item.title} className={`rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] ${span}`}>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E9F7FA] text-[#1E6A83] dark:bg-[#17282D] dark:text-[#8ecbda]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-heading text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border-y border-border bg-[#E9F7FA]/60 py-14 dark:bg-[#121E22] sm:py-16" aria-labelledby="offer-plans">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="offer-plans" className="font-heading text-3xl tracking-tight sm:text-4xl">
              {offerCopy.plans.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{offerCopy.plans.lede}</p>
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {plans.filter((plan) => plan.id !== 'institutions').map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
            {plans.filter((plan) => plan.id === 'institutions').map((plan) => (
              <article key={plan.id} className="mt-5 flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <h3 className="font-heading text-lg text-foreground">{plan.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.tagline}</p>
                  <p className="mt-3 font-heading text-3xl tracking-tight text-foreground">{plan.price}</p>
                  <p className="mt-1 text-sm font-medium text-[#1E6A83] dark:text-[#8ecbda]">{plan.priceNote}</p>
                  <ul className="mt-4 space-y-2 text-sm leading-relaxed text-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1E6A83] dark:text-[#8ecbda]" aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Cta href={plan.href} external={plan.external} tone="ink" className="w-full shrink-0 lg:w-auto">
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Cta>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16" aria-labelledby="offer-included">
          <h2 id="offer-included" className="font-heading text-3xl tracking-tight sm:text-4xl">
            {offerCopy.features.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{offerCopy.features.lede}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title} className="rounded-3xl border border-border bg-card p-5">
                <h3 className="font-semibold text-[#1E6A83] dark:text-[#8ecbda]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-[#1E6A83] text-white" aria-label="Poket School at a glance">
          <dl className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {offerCopy.stats.map((stat) => (
              <div key={stat.label}>
                <dd className="font-heading text-3xl tracking-tight">{stat.value}</dd>
                <dt className="mt-1 text-sm text-white/75">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16" aria-labelledby="offer-faq">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-10">
            <h2 id="offer-faq" className="font-heading text-3xl tracking-tight sm:text-4xl">
              {offerCopy.faq.title}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">{offerCopy.faq.body}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Cta href={OFFER_ROUTES.allIn} tone="ink" className="w-full sm:w-auto">
                {offerCopy.hero.primaryCta}
              </Cta>
              <Cta href={OFFER_ROUTES.signup} tone="line" className="w-full sm:w-auto">
                {offerCopy.startFree}
              </Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#203337] text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-semibold text-white/70">{offerCopy.footer.domain}</p>
            <p className="mt-3 font-heading text-xl">{offerCopy.footer.company}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">{offerCopy.footer.line}</p>
          </div>
          <Link href={OFFER_ROUTES.home} className="text-sm font-semibold text-white underline-offset-4 hover:underline">
            {offerCopy.home}
          </Link>
        </div>
      </footer>
    </div>
  );
}
