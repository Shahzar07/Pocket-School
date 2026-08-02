'use client';

/**
 * Legal & Policies — Terms, Privacy, Cookies, Creator Agreement, Acceptable Use.
 * Deep-linkable via ?doc=privacy (used by the signup consent links and footer).
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import { LEGAL_DOCS, LEGAL_ENTITY, LEGAL_COMPANY_NO, type LegalBlock } from '@/lib/legal-content';

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'p':
      return <p className="text-[15px] text-muted-foreground leading-[1.75] mb-3">{block.text}</p>;
    case 'sub':
      return <h3 className="text-[15px] font-bold text-foreground mt-5 mb-2">{block.text}</h3>;
    case 'ul':
      return (
        <ul className="list-disc pl-5 mb-3 space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="text-[15px] text-muted-foreground leading-[1.75]">{it}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="list-decimal pl-5 mb-3 space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="text-[15px] text-muted-foreground leading-[1.75]">{it}</li>
          ))}
        </ol>
      );
    case 'callout': {
      const tone =
        block.tone === 'danger' ? 'bg-red-50 border-red-500 text-red-900 dark:bg-red-950/30 dark:text-red-200'
        : block.tone === 'warn' ? 'bg-amber-50 border-amber-500 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
        : 'bg-blue-50 border-blue-500 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200';
      return (
        <div className={`border-l-4 rounded-r-xl px-5 py-4 mb-4 ${tone}`}>
          <p className="text-sm leading-relaxed">{block.text}</p>
        </div>
      );
    }
    case 'table':
      return (
        <div className="overflow-x-auto mb-4 rounded-xl border border-border">
          <table className="w-full text-sm border-collapse min-w-[520px]">
            <thead>
              <tr className="bg-muted/60">
                {block.head.map((h, i) => (
                  <th key={i} className="text-left font-semibold text-foreground px-4 py-2.5 border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5 text-muted-foreground align-top">
                      {j === 0 ? <strong className="text-foreground">{cell}</strong> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'contact':
      return (
        <div className="rounded-2xl border border-border bg-card p-5 mt-4">
          <p className="font-bold text-sm text-foreground mb-2">{block.title}</p>
          {block.rows.map((r, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">
              {r.label}:{' '}
              {r.href ? <a href={r.href} className="text-primary hover:underline">{r.value}</a> : r.value}
            </p>
          ))}
        </div>
      );
  }
}

function LegalInner() {
  const params = useSearchParams();
  const requested = params.get('doc');
  const [active, setActive] = useState(LEGAL_DOCS[0].id);

  useEffect(() => {
    if (requested && LEGAL_DOCS.some(d => d.id === requested)) setActive(requested);
  }, [requested]);

  const doc = LEGAL_DOCS.find(d => d.id === active) ?? LEGAL_DOCS[0];

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-14 flex flex-col lg:flex-row gap-10">
        {/* Sidebar */}
        <aside className="lg:w-56 shrink-0 lg:sticky lg:top-24 h-fit print:hidden">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Poket School
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-2 mb-2">Documents</p>
          <nav className="space-y-0.5">
            {LEGAL_DOCS.map(d => (
              <button
                key={d.id}
                onClick={() => { setActive(d.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                  active === d.id ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {d.title}
              </button>
            ))}
          </nav>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-2 mt-6 mb-2">Contact</p>
          <div className="space-y-0.5">
            {[
              { label: 'Legal', mail: 'legal@poketschool.ai' },
              { label: 'Privacy requests', mail: 'privacy@poketschool.ai' },
              { label: 'Data Protection Officer', mail: 'dpo@poketschool.ai' },
            ].map(c => (
              <a key={c.mail} href={`mailto:${c.mail}`} className="block px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                {c.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Document */}
        <motion.main
          key={doc.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex-1 min-w-0"
        >
          <header className="mb-8 pb-6 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Legal Document
                </p>
                <h1 className="font-heading text-3xl sm:text-4xl text-foreground leading-tight">{doc.title}</h1>
                <p className="text-xs text-muted-foreground mt-2">{doc.meta}</p>
              </div>
              <button
                onClick={() => window.print()}
                className="print:hidden shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </header>

          {doc.intro && <Block block={{ type: 'callout', tone: doc.intro.tone, text: doc.intro.text }} />}

          {doc.sections.map((s, i) => (
            <section key={i} className="mb-8">
              <h2 className="font-heading text-xl sm:text-2xl text-foreground mb-3">{s.heading}</h2>
              {s.blocks.map((b, j) => <Block key={j} block={b} />)}
            </section>
          ))}

          <footer className="pt-6 mt-8 border-t border-border text-xs text-muted-foreground">
            © {new Date().getFullYear()} {LEGAL_ENTITY} ({LEGAL_COMPANY_NO}) trading as Poket School. All rights reserved.
          </footer>
        </motion.main>
      </div>
    </div>
  );
}

export default function LegalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LegalInner />
    </Suspense>
  );
}
