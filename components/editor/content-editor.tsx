'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bold, Italic, Heading2, List, ListOrdered, Quote } from 'lucide-react';
import { htmlToMarkdown, looksLikeManuscript, markdownToHtml } from './markdown';
import { resultFromHtml } from './import-file';
import type { ImportResult } from './types';

/**
 * One markdown body, edited visually.
 *
 * The stored value stays markdown so readers, lesson exports, and AI prompts
 * do not grow a second format. Paste from Word, Docs, or a web page is
 * converted here. A paste with two or more headings is handed back as a
 * manuscript instead of being dumped into this block.
 */
export function ContentEditor({
  value,
  onChange,
  placeholder = 'Write, or paste from a document',
  onManuscript,
  onPasteImages,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  onManuscript?: (result: ImportResult) => void;
  onPasteImages?: (files: File[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const [empty, setEmpty] = useState(!value.trim());

  useEffect(() => {
    const el = ref.current;
    if (!el || dirty.current) return;
    el.innerHTML = value.trim() ? markdownToHtml(value) : '';
    setEmpty(!value.trim());
  }, [value]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const markdown = htmlToMarkdown('', el as unknown as Parameters<typeof htmlToMarkdown>[1]);
    dirty.current = true;
    onChange(markdown);
    setEmpty(!markdown.trim());
  };

  const wrap = (before: string, after = before) => {
    document.execCommand('insertText', false, '');
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    document.execCommand('insertHTML', false, `${before}${selection.toString() || 'text'}${after}`);
    commit();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        <ToolButton label="Bold" onClick={() => { document.execCommand('bold'); commit(); }}><Bold className="h-4 w-4" /></ToolButton>
        <ToolButton label="Italic" onClick={() => { document.execCommand('italic'); commit(); }}><Italic className="h-4 w-4" /></ToolButton>
        <ToolButton label="Heading" onClick={() => wrap('<h2>', '</h2>')}><Heading2 className="h-4 w-4" /></ToolButton>
        <ToolButton label="Bulleted list" onClick={() => { document.execCommand('insertUnorderedList'); commit(); }}><List className="h-4 w-4" /></ToolButton>
        <ToolButton label="Numbered list" onClick={() => { document.execCommand('insertOrderedList'); commit(); }}><ListOrdered className="h-4 w-4" /></ToolButton>
        <ToolButton label="Quote" onClick={() => wrap('<blockquote>', '</blockquote>')}><Quote className="h-4 w-4" /></ToolButton>
      </div>
      <div className="relative">
        {empty && <p className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">{placeholder}</p>}
        <div
          ref={ref}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          className="prose prose-sm min-h-[220px] max-w-none px-3 py-3 text-sm leading-relaxed outline-none [&_img]:max-h-64 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_th]:border [&_th]:border-border [&_th]:px-2"
          onInput={commit}
          onBlur={() => { dirty.current = false; }}
          onPaste={event => {
            const images = [...event.clipboardData.files].filter(file => file.type.startsWith('image/'));
            if (images.length && onPasteImages) {
              event.preventDefault();
              onPasteImages(images);
              return;
            }
            const html = event.clipboardData.getData('text/html');
            const text = event.clipboardData.getData('text/plain');
            if (html && looksLikeManuscript(html) && onManuscript) {
              event.preventDefault();
              onManuscript(resultFromHtml(html, 'Pasted document'));
              return;
            }
            if (html) {
              event.preventDefault();
              document.execCommand('insertHTML', false, markdownToHtml(htmlToMarkdown(html)));
              commit();
              return;
            }
            if (text) {
              event.preventDefault();
              document.execCommand('insertText', false, text);
              commit();
            }
          }}
        />
      </div>
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onMouseDown={event => event.preventDefault()} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
      {children}
    </button>
  );
}
