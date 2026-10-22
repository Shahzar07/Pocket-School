import { LEGAL_DOCS, type LegalBlock } from '@/lib/legal-content';

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'p') return <p className="mb-3 text-sm leading-relaxed text-foreground/80">{block.text}</p>;
  if (block.type === 'sub') return <h3 className="mb-2 mt-4 text-sm font-bold">{block.text}</h3>;
  if (block.type === 'ul' || block.type === 'ol') {
    const List = block.type === 'ul' ? 'ul' : 'ol';
    return (
      <List className="mb-3 list-disc space-y-1 pl-5 text-sm text-foreground/80">
        {block.items.map((item, index) => <li key={index}>{item}</li>)}
      </List>
    );
  }
  if (block.type === 'callout') return <p className="mb-3 rounded-xl border border-border bg-muted p-3 text-sm text-foreground">{block.text}</p>;
  if (block.type === 'table') {
    return (
      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr>{block.head.map((cell) => <th key={cell} className="border-b px-2 py-1">{cell}</th>)}</tr></thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index}>{row.map((cell) => <td key={cell} className="border-b px-2 py-1">{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="mb-4 text-sm">
      <p className="font-semibold">{block.title}</p>
      {block.rows.map((row) => (
        <p key={row.label}>{row.label}: {row.href ? <a href={row.href}>{row.value}</a> : row.value}</p>
      ))}
    </div>
  );
}

export function LegalArticle({ id }: { id: 'privacy' | 'terms' }) {
  const doc = LEGAL_DOCS.find((item) => item.id === id);
  if (!doc) return null;
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 text-foreground" data-theme-surface="page">
      <h1 className="font-heading text-4xl">{doc.title}</h1>
      <p className="mt-2 text-xs text-primary">{doc.meta}</p>
      <div className="mt-8">
        {doc.intro ? <Block block={{ type: 'callout', tone: doc.intro.tone, text: doc.intro.text }} /> : null}
        {doc.sections.map((section) => (
          <section key={section.heading} className="mb-8">
            <h2 className="mb-3 font-heading text-2xl">{section.heading}</h2>
            {section.blocks.map((block, index) => <Block key={index} block={block} />)}
          </section>
        ))}
      </div>
    </article>
  );
}
