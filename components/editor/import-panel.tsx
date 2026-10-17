'use client';

import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { looksLikeManuscript, markdownToHtml } from './markdown';
import { importFile, resultFromHtml, resultFromMarkdown } from './import-file';
import type { ImportResult } from './types';

const ACCEPT = '.docx,.md,.txt,.pdf,.epub,.html,.htm';

/**
 * Paste or upload a manuscript, then preview the chapter split before it is applied.
 * Headings become blocks. The host decides whether a block is a chapter or a lesson.
 */
export function ImportPanel({ onApply }: { onApply: (result: ImportResult) => void }) {
  const [draft, setDraft] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const take = (result: ImportResult) => {
    setError('');
    setDraft(result);
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border border-dashed border-border bg-muted/30 p-4"
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) void read(file);
        }}
      >
        <label className="flex cursor-pointer flex-col items-start gap-2 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold"><FileUp className="h-4 w-4" /> {busy ? 'Reading the file…' : 'Upload .docx, .md, .txt, .pdf, or .epub'}</span>
          <input
            type="file"
            accept={ACCEPT}
            className="text-xs"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void read(file);
              event.target.value = '';
            }}
          />
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Or paste from Word, Google Docs, or a web page
          <div
            contentEditable
            role="textbox"
            aria-label="Paste a manuscript"
            className="mt-1 min-h-24 rounded-xl border border-border bg-card px-3 py-2 font-normal outline-none"
            onPaste={event => {
              const html = event.clipboardData.getData('text/html');
              const text = event.clipboardData.getData('text/plain');
              event.preventDefault();
              if (html) take(resultFromHtml(html, 'Pasted document'));
              else if (text && looksLikeManuscript(text)) take(resultFromMarkdown(text, 'Pasted text'));
              else if (text) take(resultFromMarkdown(`# Pasted text\n\n${text}`, 'Pasted text'));
              else setError('The clipboard had no text.');
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Headings become chapters. You can tidy the split before anything is kept. Bold, italic, lists, tables, and inline images are kept.</p>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {draft && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-[22px]">Cleanup preview{draft.sourceName ? ` · ${draft.sourceName}` : ''}</h3>
            <div className="flex gap-2">
              <button type="button" className="h-9 rounded-full border border-border px-3 text-sm font-semibold" onClick={() => setDraft(null)}>Discard</button>
              <button type="button" className="h-9 rounded-full bg-[#203337] px-3 text-sm font-bold text-white" onClick={() => { onApply(draft); setDraft(null); }}>Use these sections</button>
            </div>
          </div>
          {draft.warnings.length > 0 && (
            <ul className="space-y-1 text-sm text-[var(--ps-cyan-text)]">
              {draft.warnings.map(warning => <li key={warning.message}>{warning.message}</li>)}
            </ul>
          )}
          <ol className="space-y-3">
            {draft.blocks.map((block, index) => (
              <li key={block.id} className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold">{index + 1}. {block.title}</p>
                <div className="prose prose-sm mt-2 max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: markdownToHtml(block.body.slice(0, 700)) }} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );

  async function read(file: File) {
    setBusy(true);
    setError('');
    try {
      take(await importFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  }
}
