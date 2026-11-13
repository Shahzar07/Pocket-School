import Link from 'next/link';
import { PathwayFlow } from '@/components/flow/pathway-flow';
import { MarketingHero } from '@/components/marketing/illustrations';
import { pathwayFaqJsonLd, pathwayTeacher, type PathwayRecord } from '@/lib/pathways/catalog';

const serif = { fontFamily: 'var(--font-heading)' } as const;

export function PathwayView({ pathway }: { pathway: PathwayRecord }) {
  const jsonLd = JSON.stringify(pathwayFaqJsonLd(pathway)).replace(/</g, '\\u003c');
  return (
    <article className="bg-background text-foreground" data-pathway={pathway.slug} style={{ fontFamily: 'var(--font-sans)' }}>
      <script type="application/ld+json" data-faq-jsonld="1" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="overflow-x-clip bg-[linear-gradient(160deg,#0B1417_0%,#1E6A83_58%,#3FE0D0_140%)] px-5 py-14 text-foreground sm:px-6 sm:py-16">
        <MarketingHero slug={pathway.slug}>
          <p className="text-xs font-medium text-primary">Pathways</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl" style={serif}>{pathway.title}</h1>
          <p className="mt-4 text-sm font-semibold text-foreground" data-pathway-price={pathway.priceLabel}>{pathway.priceLabel}</p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{pathway.overview}</p>
          {pathway.disclaimer ? (
            <p className="mt-4 max-w-2xl text-sm font-semibold text-primary" data-pathway-disclaimer="1">{pathway.disclaimer}</p>
          ) : null}
        </MarketingHero>
      </header>
      <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-6">
        <PathwayFlow currentId={pathway.slug} />
      </div>
      <nav className="sticky top-[76px] z-30 border-b border-foreground/15 bg-background/95 backdrop-blur" aria-label="Stages" data-stage-nav="1">
        <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-5 py-3 sm:px-6">
          {pathway.stages.map((stage) => (
            <li key={stage.id} className="shrink-0">
              <a className="inline-flex min-h-11 items-center rounded-full border border-foreground/15 px-3 text-sm font-semibold text-[#096ab7] whitespace-nowrap dark:text-primary" href={`#${stage.id}`}>
                {stage.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto max-w-3xl space-y-10 px-5 py-12 sm:px-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <Info title="Who it is for" body={pathway.audience} />
          <Info title="Entry" body={pathway.entry} />
          <Info title="Duration" body={pathway.duration} />
        </section>
        {pathway.stages.map((stage) => (
          <section key={stage.id} id={stage.id} className="scroll-mt-36" data-pathway-stage={stage.id}>
            <h2 className="text-2xl text-foreground" style={serif}>{stage.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">{stage.note}</p>
            <ul className="mt-4 space-y-2">
              {stage.subjects.map((item) => {
                const teacher = pathwayTeacher(item.teacherId);
                return (
                  <li key={`${stage.id}-${item.name}`} className="flex flex-col gap-2 rounded-2xl border border-foreground/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-pathway-subject={item.name}>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#096ab7] dark:text-primary" data-subject-kind={item.kind}>
                        {item.kind === 'core' ? 'Core' : 'Optional'}
                      </p>
                    </div>
                    {teacher ? (
                      <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#096ab7] dark:text-primary" href={`/ai-teachers/${teacher.id}/session`} data-pathway-teacher={teacher.id}>
                        {teacher.name}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <section>
          <h2 className="text-2xl" style={serif}>Assessment</h2>
          <p className="mt-3 text-sm leading-relaxed text-foreground/80">{pathway.boardNote}</p>
          {pathway.boards.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#096ab7] dark:text-primary">
              {pathway.boards.map((board) => <li key={board} data-pathway-board={board}>{board}</li>)}
            </ul>
          ) : null}
        </section>
        <section>
          <h2 className="text-2xl" style={serif}>What the plan includes</h2>
          <p className="mt-3 text-sm font-semibold text-foreground" data-pathway-plan={pathway.priceLabel}>{pathway.priceLabel}</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{pathway.priceDetail}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground/85">
            {pathway.included.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section>
          <h2 className="text-2xl" style={serif}>Progression</h2>
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {pathway.progression.map((link) => (
              <li key={link.href}>
                <Link className="inline-flex min-h-11 items-center rounded-full border border-foreground/15 px-4 text-sm font-semibold text-[#096ab7] dark:text-primary" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-2xl" style={serif}>Questions</h2>
          <div className="mt-4 space-y-4">
            {pathway.faqs.map((faq) => (
              <details key={faq.question} className="rounded-2xl border border-foreground/15 px-4 py-3" data-pathway-faq="1">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">{faq.question}</summary>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <div className="flex flex-wrap gap-3">
          {pathway.ctas.map((link, index) => {
            const className = index === 0
              ? 'inline-flex min-h-11 items-center rounded-full bg-[#d9efff] px-4 text-sm font-bold text-[#11131b]'
              : 'inline-flex min-h-11 items-center rounded-full bg-[#096ab7] px-4 text-sm font-bold text-white';
            return link.href.startsWith('mailto:') ? (
              <a key={link.href} className={className} href={link.href}>{link.label}</a>
            ) : (
              <Link key={link.href} className={className} href={link.href} data-pathway-cta={link.label}>{link.label}</Link>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-foreground/15 p-4">
      <h2 className="text-base" style={serif}>{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground/80">{body}</p>
    </section>
  );
}
