import Link from 'next/link';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { LANGUAGES } from '@/lib/languages';
import { HOME } from '@/lib/marketing/home';
import { FeaturedShowcase } from '@/components/courses/featured-showcase';

const serif = { fontFamily: 'var(--font-dm-serif), Georgia, serif' } as const;

export function HomeV3() {
  const teachers = String(AI_TEACHERS.length);
  const languages = String(LANGUAGES.length);
  return (
    <div className="bg-white text-[#203337]" style={{ fontFamily: 'var(--font-dm-sans), var(--font-sans), sans-serif' }} data-landing="v3">
      <section className="bg-[linear-gradient(165deg,#0B1417_0%,#1E6A83_52%,#3FE0D0_130%)] px-6 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3FE0D0]">{HOME.eyebrow}</p>
          <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl" style={serif}>
            {HOME.title}<br />
            <em className="text-[#3FE0D0]">{HOME.titleEm}</em>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85">{HOME.lede}</p>
          <p className="mt-3 text-sm text-white/75">{HOME.cred}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-[#203337]" href="/signup">{HOME.start}</Link>
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-semibold" href="/institutions/register">{HOME.schools}</Link>
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-semibold" href="/demo">{HOME.demo}</Link>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><dt className="text-2xl font-semibold" style={serif}>{HOME.levelsLabel}</dt><dd className="text-xs text-white/70">{HOME.formatsLabel}</dd></div>
            <div><dt className="text-2xl font-semibold" style={serif}>{teachers}</dt><dd className="text-xs text-white/70">{HOME.teachersLabel}</dd></div>
            <div><dt className="text-2xl font-semibold" style={serif}>{languages}</dt><dd className="text-xs text-white/70">{HOME.languagesLabel}</dd></div>
            <div><dt className="text-2xl font-semibold" style={serif}>{HOME.annual}</dt><dd className="text-xs text-white/70">{HOME.priceTag}</dd></div>
          </dl>
        </div>
      </section>
      <div className="border-b border-[#1E6A83]/15 bg-[#F4FBFA] px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1E6A83]">{HOME.aligned}</span>
          {HOME.boards.map((board) => (
            <span key={board} className="rounded-full border border-[#1E6A83]/20 bg-white px-3 py-1 text-xs text-[#203337]">{board}</span>
          ))}
        </div>
      </div>
      <section id="courses" className="mx-auto max-w-5xl px-6 py-12">
        <FeaturedShowcase variant="row" />
      </section>
      <section id="features" className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">{HOME.solveTag}</p>
        <h2 className="mt-2 max-w-2xl text-3xl sm:text-4xl" style={serif}>{HOME.solveTitle}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#203337]/80">{HOME.solveBody}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {HOME.problems.map((item) => (
            <li key={item.problem} className="rounded-2xl border border-[#1E6A83]/15 p-4">
              <p className="font-semibold">{item.problem}</p>
              <p className="mt-1 text-sm text-[#1E6A83]">{item.answer}</p>
            </li>
          ))}
        </ul>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOME.features.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl bg-[#F4FBFA] p-5 hover:bg-[#3FE0D0]/25">
              <h3 className="text-xl" style={serif}>{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#203337]/80">{item.body}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="bg-[#F4FBFA] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">{HOME.levelsTag}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl" style={serif}>{HOME.levelsTitle}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOME.levels.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block h-full rounded-2xl bg-white p-5">
                  <p className="text-xs font-bold text-[#1E6A83]">{item.price}</p>
                  <h3 className="mt-1 text-2xl" style={serif}>{item.title}</h3>
                  <p className="mt-2 text-sm text-[#203337]/80">{item.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-3xl sm:text-4xl" style={serif}>{HOME.rochfords}</h2>
        <p className="mt-4 text-sm leading-relaxed text-[#203337]/80">{HOME.rochfordsBody}</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-[#1E6A83]" href="/rochfords">{HOME.rochfords}</Link>
      </section>
      <section id="institutions" className="bg-[linear-gradient(165deg,#0B1417,#1E6A83)] px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3FE0D0]">{HOME.instTag}</p>
          <h2 className="mt-2 max-w-xl text-3xl sm:text-4xl" style={serif}>{HOME.instTitle}</h2>
          <p className="mt-3 max-w-2xl text-sm text-white/80">{HOME.instBody}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {HOME.instPoints.map((point) => (
              <li key={point} className="rounded-2xl bg-white/10 p-4 text-sm">{point}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-[#203337]" href="/institutions">{HOME.instTag}</Link>
            <a className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-semibold" href="mailto:institutions@poketschool.ai">{HOME.contact}</a>
          </div>
        </div>
      </section>
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">{HOME.priceTag}</p>
        <h2 className="mt-2 text-3xl sm:text-4xl" style={serif}>{HOME.priceTitle}</h2>
        <p className="mt-3 text-sm text-[#203337]/80">{HOME.priceBody}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOME.plans.map((plan) => (
            <li key={plan.name} className="flex flex-col rounded-2xl border border-[#1E6A83]/15 p-5">
              <h3 className="text-xl" style={serif}>{plan.name}</h3>
              <p className="mt-2 text-3xl font-semibold text-[#1E6A83]">{plan.amount}</p>
              <p className="text-xs text-[#1E6A83]">{plan.period}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed">{plan.body}</p>
              <Link className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337]" href={plan.href}>{plan.cta}</Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="bg-[#0B1417] px-6 py-14 text-center text-white">
        <h2 className="text-3xl" style={serif}>{HOME.close}</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337]" href="/signup">{HOME.start}</Link>
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/30 px-4 text-sm font-semibold" href="/institutions/register">{HOME.schools}</Link>
        </div>
      </section>
    </div>
  );
}
