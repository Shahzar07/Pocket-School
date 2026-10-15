import type { ContentBlock, ImportWarning } from './types';

/** Enough of the DOM for browser nodes and linkedom nodes. */
interface MarkupNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<MarkupNode>;
  getAttribute?: (name: string) => string | null;
}

const TEXT = 3;
const ELEMENT = 1;

export function cleanupMarkdown(markdown: string): string {
  return markdown
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function htmlToMarkdown(html: string, root?: MarkupNode): string {
  const start = root ?? bodyFromHtml(html);
  return cleanupMarkdown(renderChildren(start));
}

export function looksLikeManuscript(htmlOrMarkdown: string): boolean {
  const markdown = htmlOrMarkdown.includes('<') ? htmlToMarkdown(htmlOrMarkdown) : htmlOrMarkdown;
  const headings = markdown.split('\n').filter(line => /^#{1,2}\s+\S/.test(line.trim()));
  return headings.length >= 2;
}

export function splitByHeadings(markdown: string, origin: ContentBlock['origin'] = 'import'): ContentBlock[] {
  const cleaned = cleanupMarkdown(markdown);
  const blocks: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of cleaned.split('\n')) {
    const heading = /^(#{1,2})\s+(.+)$/.exec(line.trim());
    if (heading) {
      if (current) blocks.push(current);
      current = { title: heading[2].trim(), lines: [] };
    } else if (!current) {
      current = { title: 'Opening', lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks
    .filter(block => block.title !== 'Opening' || block.lines.join('').trim())
    .map((block, index) => ({
      id: `block-${index + 1}-${slug(block.title)}`,
      title: block.title,
      body: cleanupMarkdown(block.lines.join('\n')),
      origin,
    }));
}

export function importWarnings(blocks: ContentBlock[]): ImportWarning[] {
  const warnings: ImportWarning[] = [];
  if (blocks.length === 0) warnings.push({ message: 'No chapters were found. Add a heading and try again.' });
  for (const block of blocks) {
    if (!block.body.trim()) warnings.push({ blockId: block.id, message: `${block.title} has no body.` });
    const words = block.body.trim() ? block.body.trim().split(/\s+/).length : 0;
    if (words > 2500) warnings.push({ blockId: block.id, message: `${block.title} is ${words} words. Another heading would split it.` });
    if (/!(?:full)?\[\s*\]\(/.test(block.body)) {
      warnings.push({ blockId: block.id, message: `${block.title} has an image without alt text.` });
    }
  }
  return warnings;
}

/** A small, safe HTML view of the markdown subset the editor stores. */
export function markdownToHtml(markdown: string): string {
  const blocks = cleanupMarkdown(markdown).split(/\n{2,}/);
  return blocks.map(block => {
    const image = /^(!full|!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/.exec(block.trim());
    if (image) {
      const full = image[1] === '!full';
      const alt = escapeHtml(image[2] || '');
      const src = escapeAttr(image[3] || '');
      const caption = image[4] ? `<figcaption>${escapeHtml(image[4])}</figcaption>` : '';
      return `<figure data-full="${full ? '1' : '0'}"><img src="${src}" alt="${alt}" />${caption}</figure>`;
    }
    if (block.trim().startsWith('|') && block.includes('\n|')) return tableToHtml(block);
    const lines = block.split('\n');
    if (lines.every(line => /^\s*[-*]\s+/.test(line))) {
      return `<ul>${lines.map(line => `<li>${inlineHtml(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    if (lines.every(line => /^\s*\d+\.\s+/.test(line))) {
      return `<ol>${lines.map(line => `<li>${inlineHtml(line.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(block.trim());
    if (heading) {
      const level = heading[1].length;
      return `<h${level}>${inlineHtml(heading[2])}</h${level}>`;
    }
    if (lines.every(line => /^\s*>\s?/.test(line))) {
      return `<blockquote>${inlineHtml(lines.map(line => line.replace(/^\s*>\s?/, '')).join(' '))}</blockquote>`;
    }
    return `<p>${inlineHtml(block).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

export function imageMarkdown(alt: string, src: string, caption?: string, full = false): string {
  const marker = full ? '!full' : '!';
  const title = caption?.trim() ? ` "${caption.trim().replace(/"/g, "'")}"` : '';
  return `${marker}[${alt.trim()}](${src}${title})`;
}

function bodyFromHtml(html: string): MarkupNode {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html').body as unknown as MarkupNode;
  }
  throw new Error('HTML import needs a DOM parser.');
}

function renderChildren(node: MarkupNode): string {
  return Array.from(node.childNodes).map(renderNode).join('');
}

function renderNode(node: MarkupNode): string {
  if (node.nodeType === TEXT) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== ELEMENT) return '';
  const tag = node.nodeName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') return `\n\n${renderList(node, tag === 'ol')}\n\n`;
  if (tag === 'table') return `\n\n${renderTable(node)}\n\n`;
  if (tag === 'img') return `\n\n${renderImage(node)}\n\n`;
  if (tag === 'figure') return `\n\n${renderFigure(node)}\n\n`;
  const inner = renderChildren(node).trim();
  switch (tag) {
    case 'h1': return `\n\n# ${oneLine(inner)}\n\n`;
    case 'h2': return `\n\n## ${oneLine(inner)}\n\n`;
    case 'h3': return `\n\n### ${oneLine(inner)}\n\n`;
    case 'p':
    case 'div':
    case 'section':
    case 'article':
      return inner ? `\n\n${inner}\n\n` : '';
    case 'br': return '\n';
    case 'strong':
    case 'b': return `**${oneLine(inner)}**`;
    case 'em':
    case 'i': return `*${oneLine(inner)}*`;
    case 'a': {
      const href = node.getAttribute?.('href') ?? '';
      return href ? `[${oneLine(inner) || href}](${href})` : inner;
    }
    case 'li': return inner;
    default: return inner;
  }
}

function renderList(node: MarkupNode, ordered: boolean): string {
  const items = Array.from(node.childNodes).filter(child => child.nodeName.toLowerCase() === 'li');
  return items.map((item, index) => {
    const text = oneLine(renderChildren(item));
    return ordered ? `${index + 1}. ${text}` : `- ${text}`;
  }).join('\n');
}

function renderTable(node: MarkupNode): string {
  const rows = collect(node, 'tr').map(row => collect(row, 'td').concat(collect(row, 'th')).map(cell => oneLine(renderChildren(cell)).replace(/\|/g, '\\|')));
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map(row => row.length));
  const padded = rows.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
  const header = padded[0];
  const rule = header.map(() => '---');
  const body = padded.slice(1);
  return [header, rule, ...body].map(row => `| ${row.join(' | ')} |`).join('\n');
}

function renderFigure(node: MarkupNode): string {
  const img = Array.from(node.childNodes).find(child => child.nodeName.toLowerCase() === 'img');
  if (!img) return renderChildren(node);
  const captionNode = Array.from(node.childNodes).find(child => child.nodeName.toLowerCase() === 'figcaption');
  const caption = captionNode ? oneLine(renderChildren(captionNode)) : '';
  const full = node.getAttribute?.('data-full') === '1';
  return imageMarkdown(img.getAttribute?.('alt') ?? '', img.getAttribute?.('src') ?? '', caption, full);
}

function renderImage(node: MarkupNode): string {
  const src = node.getAttribute?.('src') ?? '';
  if (!src) return '';
  const alt = node.getAttribute?.('alt') ?? '';
  return imageMarkdown(alt, src);
}

function collect(node: MarkupNode, tag: string): MarkupNode[] {
  const found: MarkupNode[] = [];
  const walk = (current: MarkupNode) => {
    if (current.nodeName.toLowerCase() === tag) found.push(current);
    Array.from(current.childNodes).forEach(walk);
  };
  Array.from(node.childNodes).forEach(walk);
  return found;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'section';
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function inlineHtml(value: string): string {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function tableToHtml(block: string): string {
  const rows = block.split('\n').filter(line => line.trim().startsWith('|') && !/^\|\s*-+/.test(line.trim()));
  const cells = rows.map(row => row.split('|').slice(1, -1).map(cell => cell.trim()));
  if (cells.length === 0) return `<p>${inlineHtml(block)}</p>`;
  const head = cells[0].map(cell => `<th>${inlineHtml(cell)}</th>`).join('');
  const body = cells.slice(1).map(row => `<tr>${row.map(cell => `<td>${inlineHtml(cell)}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
