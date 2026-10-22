import Link from 'next/link';
import { PathwayFlow } from '@/components/flow/pathway-flow';
import { MarketingHero } from '@/components/marketing/illustrations';
import type { MarketPage } from '@/lib/marketing/pages';
import { PATHWAY_STEPS } from '@/lib/flow/pathways';
import { MARKET_BRAND } from '@/lib/marketing/nav';

export function ProductView({ page }: { page: MarketPage }) {
  const showPathway = PATHWAY_STEPS.some((step) => step.id === page.slug);
  return (
    <article className="bg-white text-[#203337]" style={{ fontFamily: 'var(--font-dm-sans), var(--font-sans), sans-serif' }}>
      <header className="overflow-x-clip bg-[linear-gradient(160deg,#0B1417_0%,#1E6A83_58%,#3FE0D0_140%)] px-6 py-16 text-white">
        <MarketingHero slug={page.slug}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3FE0D0]">{MARKET_BRAND}</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>{page.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85">{page.lede}</p>
        </MarketingHero>
      </header>
      <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
        {showPathway ? <PathwayFlow currentId={page.slug} /> : null}
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>{section.heading}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#203337]/85">{section.body}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#1E6A83]">
              {section.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </section>
        ))}
        <div className="flex flex-wrap gap-3">
          {page.links.map((link) => (
            link.href.startsWith('mailto:') ? (
              <a key={link.href} className="inline-flex min-h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337]" href={link.href}>{link.label}</a>
            ) : (
              <Link key={link.href} className="inline-flex min-h-11 items-center rounded-full bg-[#1E6A83] px-4 text-sm font-bold text-white" href={link.href}>{link.label}</Link>
            )
          ))}
        </div>
      </div>
    </article>
  );
}
