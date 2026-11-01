import Link from 'next/link';
import { PathwayFlow } from '@/components/flow/pathway-flow';
import { MarketingHero } from '@/components/marketing/illustrations';
import type { MarketPage } from '@/lib/marketing/pages';
import { PATHWAY_STEPS } from '@/lib/flow/pathways';
import { MARKET_BRAND } from '@/lib/marketing/nav';

export function ProductView({ page }: { page: MarketPage }) {
  const showPathway = PATHWAY_STEPS.some((step) => step.id === page.slug);
  return (
    <article className="bg-background text-foreground" data-theme-surface="page" style={{ fontFamily: 'var(--font-sans)' }}>
      <header className="overflow-x-clip bg-[linear-gradient(160deg,#0B1417_0%,#1E6A83_58%,#3FE0D0_140%)] px-6 py-16 text-foreground">
        <MarketingHero slug={page.slug}>
          <p className="text-xs font-medium text-primary">{MARKET_BRAND}</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>{page.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{page.lede}</p>
        </MarketingHero>
      </header>
      <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
        {showPathway ? <PathwayFlow currentId={page.slug} /> : null}
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl" style={{ fontFamily: 'var(--font-heading)' }}>{section.heading}</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/85">{section.body}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-primary">
              {section.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </section>
        ))}
        <div className="flex flex-wrap gap-3">
          {page.links.map((link) => (
            link.href.startsWith('mailto:') ? (
              <a key={link.href} className="inline-flex min-h-11 items-center rounded-full bg-[#d9efff] px-4 text-sm font-bold text-[#11131b]" href={link.href}>{link.label}</a>
            ) : (
              <Link key={link.href} className="inline-flex min-h-11 items-center rounded-full bg-[#096ab7] px-4 text-sm font-bold text-white" href={link.href}>{link.label}</Link>
            )
          ))}
        </div>
      </div>
    </article>
  );
}
