/** Markdown stored on the essay, HTML only inside the editor. */

import { isCoverPath } from '@/lib/blog/posts';

const BLOCK = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img']);

function parser(): DOMParser {
  if (typeof DOMParser === 'undefined') throw new Error('DOMParser is not available');
  return new DOMParser();
}

function parseFragment(html: string): HTMLElement {
  const doc = parser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');
  return doc.body;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

/** Drop scripts, embeds, and event handlers. Video embeds are not part of the journal. */
export function sanitizeHtml(html: string): string {
  const body = parseFragment(html);
  const clean = (node: Node) => {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType !== 1) continue;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed' || tag === 'form') {
        el.remove();
        continue;
      }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'style' || name === 'class' || name === 'srcdoc') el.removeAttribute(attr.name);
      }
      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        if (!(href.startsWith('/') || href.startsWith('https://') || href.startsWith('mailto:')) || href.startsWith('//')) {
          el.removeAttribute('href');
        }
      }
      if (tag === 'img') {
        const src = el.getAttribute('src') || '';
        const alt = (el.getAttribute('alt') || '').slice(0, 180);
        if (!isCoverPath(src)) {
          el.remove();
          continue;
        }
        el.setAttribute('alt', alt);
      }
      if (!BLOCK.has(tag) && tag !== 'strong' && tag !== 'b' && tag !== 'em' && tag !== 'i' && tag !== 'u' && tag !== 's' && tag !== 'del' && tag !== 'code' && tag !== 'a' && tag !== 'br') {
        const parent = el.parentNode;
        while (el.firstChild) parent?.insertBefore(el.firstChild, el);
        el.remove();
        continue;
      }
      clean(el);
    }
  };
  clean(body);
  return body.innerHTML;
}

function inlineMarkdown(text: string): string {
  const source = escapeText(text);
  return source
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) => (
      isCoverPath(src) ? `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />` : escapeText(alt)
    ))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
      if (!(href.startsWith('/') || href.startsWith('https://') || href.startsWith('mailto:')) || href.startsWith('//')) return label;
      return `<a href="${escapeAttr(href)}">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\+\+([^+]+)\+\+/g, '<u>$1</u>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** Editor HTML from the markdown the public essay already stores. */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let index = 0;
  const pushList = (ordered: boolean) => {
    const tag = ordered ? 'ol' : 'ul';
    const items: string[] = [];
    const pattern = ordered ? /^\d+\. / : /^[-*] /;
    while (index < lines.length && pattern.test(lines[index] ?? '')) {
      items.push(`<li><p>${inlineMarkdown((lines[index] ?? '').replace(pattern, ''))}</p></li>`);
      index += 1;
    }
    html.push(`<${tag}>${items.join('')}</${tag}>`);
  };
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if ((lines[index] ?? '').trim().startsWith('```')) index += 1;
      html.push(`<pre><code>${escapeText(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (line.trim() === '---') {
      html.push('<hr />');
      index += 1;
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
    if (image && isCoverPath(image[2] ?? '')) {
      html.push(`<img src="${escapeAttr(image[2] ?? '')}" alt="${escapeAttr(image[1] ?? '')}" />`);
      index += 1;
      continue;
    }
    const heading = /^(#{2,4})\s+(.+)$/.exec(line.trim());
    if (heading) {
      const level = heading[1]?.length ?? 2;
      html.push(`<h${level}>${inlineMarkdown(heading[2] ?? '')}</h${level}>`);
      index += 1;
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && (lines[index]?.startsWith('>') ?? false)) {
        quote.push(inlineMarkdown((lines[index] ?? '').replace(/^>\s?/, '')));
        index += 1;
      }
      html.push(`<blockquote><p>${quote.join(' ')}</p></blockquote>`);
      continue;
    }
    if (/^[-*] /.test(line)) {
      pushList(false);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      pushList(true);
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
        const cells = (lines[index] ?? '').trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-+:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      const body = rows.map((row, rowIndex) => {
        const cellTag = rowIndex === 0 ? 'th' : 'td';
        return `<tr>${row.map((cell) => `<${cellTag}>${inlineMarkdown(cell)}</${cellTag}>`).join('')}</tr>`;
      }).join('');
      html.push(`<table><tbody>${body}</tbody></table>`);
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length
      && (lines[index] ?? '').trim()
      && !/^(#{2,4})\s+/.test(lines[index] ?? '')
      && !(lines[index] ?? '').startsWith('>')
      && !/^[-*] /.test(lines[index] ?? '')
      && !/^\d+\. /.test(lines[index] ?? '')
      && (lines[index] ?? '').trim() !== '---'
      && !(lines[index] ?? '').trim().startsWith('```')
      && !(lines[index] ?? '').trim().startsWith('|')
      && !/^!\[([^\]]*)\]\(([^)]+)\)$/.test((lines[index] ?? '').trim())
    ) {
      paragraph.push((lines[index] ?? '').trim());
      index += 1;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
  }
  return html.join('');
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === 3) return (node.textContent || '').replace(/\u00a0/g, ' ');
  if (node.nodeType !== 1) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') return ' ';
  const inner = [...el.childNodes].map(inlineToMarkdown).join('');
  if (tag === 'strong' || tag === 'b') return `**${inner}**`;
  if (tag === 'em' || tag === 'i') return `*${inner}*`;
  if (tag === 'u') return `++${inner}++`;
  if (tag === 's' || tag === 'del' || tag === 'strike') return `~~${inner}~~`;
  if (tag === 'code') return `\`${inner}\``;
  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    return href ? `[${inner}](${href})` : inner;
  }
  if (tag === 'img') {
    const src = el.getAttribute('src') || '';
    if (!isCoverPath(src)) return '';
    return `![${el.getAttribute('alt') || ''}](${src})`;
  }
  return inner;
}

function tableToMarkdown(table: HTMLElement): string {
  const rows = [...table.querySelectorAll('tr')];
  const cells = rows.map((row) => [...row.children].map((cell) => inlineToMarkdown(cell).replace(/\|/g, '\\|').trim()));
  if (!cells.length) return '';
  const width = Math.max(...cells.map((row) => row.length));
  const padded = cells.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
  const header = padded[0] ?? [];
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...padded.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ];
  return lines.join('\n');
}

function blockToMarkdown(node: Node): string {
  if (node.nodeType === 3) return (node.textContent || '').trim();
  if (node.nodeType !== 1) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'h2' || tag === 'h3' || tag === 'h4') return `${'#'.repeat(Number(tag[1]))} ${inlineToMarkdown(el).trim()}`;
  if (tag === 'p') return inlineToMarkdown(el).trim();
  if (tag === 'blockquote') return inlineToMarkdown(el).trim().split('\n').map((line) => `> ${line}`).join('\n');
  if (tag === 'hr') return '---';
  if (tag === 'pre') return `\`\`\`\n${el.textContent || ''}\n\`\`\``;
  if (tag === 'ul' || tag === 'ol') {
    return [...el.children].map((item, itemIndex) => {
      const text = inlineToMarkdown(item).trim();
      return tag === 'ol' ? `${itemIndex + 1}. ${text}` : `- ${text}`;
    }).join('\n');
  }
  if (tag === 'img') return inlineToMarkdown(el);
  if (tag === 'table') return tableToMarkdown(el);
  return [...el.childNodes].map(blockToMarkdown).filter(Boolean).join('\n\n');
}

/** Markdown the public renderer understands, including underline, strike, and tables. */
export function htmlToMarkdown(html: string): string {
  const body = parseFragment(sanitizeHtml(html));
  return [...body.childNodes].map(blockToMarkdown).filter((part) => part.trim()).join('\n\n').slice(0, 28000);
}

/** Source mode may paste HTML. Store markdown either way. */
export function storedBody(value: string): string {
  const trimmed = value.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return htmlToMarkdown(trimmed);
  return trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .slice(0, 28000);
}

export function wordCount(markdown: string): number {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/[#>*_~+`|[\]()-]/g, ' ');
  const words = plain.trim().split(/\s+/).filter(Boolean);
  return words.length;
}
