'use client';

/**
 * Formatting editor for lesson content.
 *
 * Everything downstream — the renderers, the AI generation pipeline, the
 * report exports — consumes lesson bodies as markdown, so this edits markdown
 * rather than HTML. Authors get a formatting toolbar, keyboard shortcuts and a
 * live rendered preview, and the stored value stays plain text that the rest
 * of the platform already understands.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Code,
  Link2, Sigma, Eye, PenLine, Columns2,
} from 'lucide-react';
import { MathMarkdown } from '@/components/math-markdown';

type Mode = 'write' | 'preview' | 'split';

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Minimum editing height in pixels. */
  minHeight?: number;
  id?: string;
  className?: string;
}

interface Action {
  id: string;
  icon: React.ReactNode;
  title: string;
  /** Wraps the selection. */
  prefix: string;
  suffix?: string;
  /** Applies at the start of each selected line instead of wrapping. */
  linePrefix?: boolean;
  /** Text inserted when nothing is selected, so the button is never a no-op. */
  placeholder?: string;
  shortcut?: string;
}

const ACTIONS: Action[] = [
  { id: 'h2', icon: <Heading2 className="w-4 h-4" />, title: 'Heading', prefix: '## ', linePrefix: true, placeholder: 'Heading' },
  { id: 'h3', icon: <Heading3 className="w-4 h-4" />, title: 'Subheading', prefix: '### ', linePrefix: true, placeholder: 'Subheading' },
  { id: 'bold', icon: <Bold className="w-4 h-4" />, title: 'Bold (Ctrl+B)', prefix: '**', suffix: '**', placeholder: 'bold text', shortcut: 'b' },
  { id: 'italic', icon: <Italic className="w-4 h-4" />, title: 'Italic (Ctrl+I)', prefix: '*', suffix: '*', placeholder: 'italic text', shortcut: 'i' },
  { id: 'ul', icon: <List className="w-4 h-4" />, title: 'Bulleted list', prefix: '- ', linePrefix: true, placeholder: 'List item' },
  { id: 'ol', icon: <ListOrdered className="w-4 h-4" />, title: 'Numbered list', prefix: '1. ', linePrefix: true, placeholder: 'List item' },
  { id: 'quote', icon: <Quote className="w-4 h-4" />, title: 'Quote', prefix: '> ', linePrefix: true, placeholder: 'Quote' },
  { id: 'code', icon: <Code className="w-4 h-4" />, title: 'Code', prefix: '`', suffix: '`', placeholder: 'code' },
  { id: 'link', icon: <Link2 className="w-4 h-4" />, title: 'Link (Ctrl+K)', prefix: '[', suffix: '](https://)', placeholder: 'link text', shortcut: 'k' },
  { id: 'math', icon: <Sigma className="w-4 h-4" />, title: 'Maths', prefix: '$', suffix: '$', placeholder: 'E = mc^2' },
];

export function RichTextEditor({
  value, onChange, placeholder, minHeight = 220, id, className = '',
}: RichTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<Mode>('write');

  const stats = useMemo(() => {
    const words = value.trim() ? value.trim().split(/\s+/).length : 0;
    return { chars: value.length, words };
  }, [value]);

  const apply = useCallback((action: Action) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);

    let next: string;
    let cursorStart: number;
    let cursorEnd: number;

    if (action.linePrefix) {
      // Expand the selection to whole lines so the marker lands at line starts.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = value.indexOf('\n', end);
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const block = value.slice(lineStart, lineEnd) || (action.placeholder ?? '');

      const lines = block.split('\n');
      const alreadyApplied = lines.every(l => l.startsWith(action.prefix));
      const rewritten = lines
        .map((line, i) => {
          if (alreadyApplied) return line.slice(action.prefix.length);
          // Numbered lists increment rather than repeating "1." on every line.
          const marker = action.id === 'ol' ? `${i + 1}. ` : action.prefix;
          return marker + line;
        })
        .join('\n');

      next = value.slice(0, lineStart) + rewritten + value.slice(lineEnd);
      cursorStart = lineStart;
      cursorEnd = lineStart + rewritten.length;
    } else {
      const body = selected || action.placeholder || '';
      const suffix = action.suffix ?? '';
      // Toggle off when the selection is already wrapped.
      const wrapped = value.slice(start - action.prefix.length, start) === action.prefix
        && value.slice(end, end + suffix.length) === suffix;

      if (wrapped) {
        next = value.slice(0, start - action.prefix.length) + selected + value.slice(end + suffix.length);
        cursorStart = start - action.prefix.length;
        cursorEnd = cursorStart + selected.length;
      } else {
        next = value.slice(0, start) + action.prefix + body + suffix + value.slice(end);
        cursorStart = start + action.prefix.length;
        cursorEnd = cursorStart + body.length;
      }
    }

    onChange(next);
    // Restore the selection after React re-renders the textarea.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }, [value, onChange]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const action = ACTIONS.find(a => a.shortcut && a.shortcut === e.key.toLowerCase());
    if (!action) return;
    e.preventDefault();
    apply(action);
  };

  const modeButton = (m: Mode, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      title={label}
      aria-pressed={mode === m}
      className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors ${
        mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/40">
        {ACTIONS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => apply(a)}
            title={a.title}
            aria-label={a.title}
            disabled={mode === 'preview'}
            className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {a.icon}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {modeButton('write', <PenLine className="w-3.5 h-3.5" />, 'Write')}
          {modeButton('split', <Columns2 className="w-3.5 h-3.5" />, 'Split')}
          {modeButton('preview', <Eye className="w-3.5 h-3.5" />, 'Preview')}
        </div>
      </div>

      {/* Panes */}
      <div className={mode === 'split' ? 'grid md:grid-cols-2 divide-x divide-border' : ''}>
        {mode !== 'preview' && (
          <textarea
            id={id}
            ref={ref}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            spellCheck
            style={{ minHeight }}
            className="w-full p-3 bg-transparent text-sm leading-relaxed outline-none resize-y font-mono"
          />
        )}
        {mode !== 'write' && (
          <div
            style={{ minHeight }}
            className="p-3 overflow-auto prose prose-sm dark:prose-invert max-w-none"
          >
            {value.trim()
              ? <MathMarkdown>{value}</MathMarkdown>
              : <p className="text-sm text-muted-foreground italic">Nothing to preview yet.</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/30 text-[11px] text-muted-foreground">
        <span>Markdown supported · $maths$ renders live</span>
        <span>{stats.chars} characters · {stats.words} words</span>
      </div>
    </div>
  );
}
