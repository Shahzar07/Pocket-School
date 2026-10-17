/** Reader view of the markdown the shared editor stores. Images stay inside the page width. */
export function ChapterProse({
  markdown,
  quotes,
}: {
  markdown: string;
  quotes: string[];
}) {
  const blocks = markdown.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  return (
    <>
      {blocks.map(block => {
        const image = /^(!full|!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/.exec(block);
        if (image) {
          const full = image[1] === '!full';
          const alt = image[2] || 'Illustration';
          return (
            <figure key={block.slice(0, 48)} className={full ? '-mx-4 my-8 sm:mx-0' : 'my-6'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image[3]}
                alt={alt}
                className={full ? 'max-h-[78vh] w-full rounded-none object-contain sm:rounded-2xl' : 'mx-auto max-h-[70vh] w-full rounded-2xl object-contain'}
              />
              {image[4] && <figcaption className="mt-2 text-center text-[13px] opacity-70">{image[4]}</figcaption>}
            </figure>
          );
        }
        if (block.startsWith('|')) return <Table key={block.slice(0, 24)} block={block} />;
        const lines = block.split('\n');
        if (lines.every(line => /^[-*]\s+/.test(line))) {
          return <ul key={block.slice(0, 24)} className="mb-[1em] list-disc space-y-1 pl-5">{lines.map(line => <li key={line}>{line.replace(/^[-*]\s+/, '')}</li>)}</ul>;
        }
        const heading = /^(#{1,3})\s+(.+)$/.exec(block);
        if (heading) return <h3 key={heading[2]} className="mb-3 mt-6 font-heading text-[26px]">{heading[2]}</h3>;
        return <p key={block.slice(0, 32)} className="mb-[1em]">{renderInline(block, quotes)}</p>;
      })}
    </>
  );
}

export function proseForSpeech(markdown: string): string {
  return markdown.replace(/!full?\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[#>*]/g, ' ');
}

function renderInline(text: string, quotes: string[]) {
  const hit = quotes.find(quote => quote && text.includes(quote));
  const parts = hit ? text.split(hit) : [text];
  return parts.map((part, index) => (
    <span key={`${index}-${part.slice(0, 12)}`}>
      {formatInline(part)}
      {hit && index < parts.length - 1 && <mark className="rounded bg-secondary px-0.5 text-foreground">{hit}</mark>}
    </span>
  ));
}

function formatInline(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return chunks.map(chunk => {
    if (chunk.startsWith('**') && chunk.endsWith('**')) return <strong key={chunk}>{chunk.slice(2, -2)}</strong>;
    if (chunk.startsWith('*') && chunk.endsWith('*')) return <em key={chunk}>{chunk.slice(1, -1)}</em>;
    return <span key={chunk}>{chunk}</span>;
  });
}

function Table({ block }: { block: string }) {
  const rows = block.split('\n').filter(line => line.trim().startsWith('|') && !/^\|\s*-+/.test(line.trim()));
  const cells = rows.map(row => row.split('|').slice(1, -1).map(cell => cell.trim()));
  if (cells.length === 0) return null;
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.9em]">
        <thead>
          <tr>{cells[0].map(cell => <th key={cell} className="border-b px-2 py-1 font-semibold">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {cells.slice(1).map(row => (
            <tr key={row.join('|')}>{row.map(cell => <td key={cell} className="border-b border-black/10 px-2 py-1">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
