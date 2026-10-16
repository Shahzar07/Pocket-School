'use client';

/**
 * Typing maths on a phone is miserable. A row of the symbols students
 * actually need, inserted at the cursor, plus a live rendered preview so
 * they can see the question is right before ET AI reads it.
 */

import { useRef } from 'react';
import { MathMarkdown } from '@/components/math-markdown';

const KEYS: { label: string; insert: string; title?: string }[] = [
  { label: 'x²', insert: '²' }, { label: 'x³', insert: '³' }, { label: 'xⁿ', insert: '^' },
  { label: '√', insert: '√(' }, { label: 'a/b', insert: '/', title: 'Fraction' }, { label: 'π', insert: 'π' },
  { label: '×', insert: '×' }, { label: '÷', insert: '÷' }, { label: '±', insert: '±' },
  { label: '≤', insert: '≤' }, { label: '≥', insert: '≥' }, { label: '≠', insert: '≠' },
  { label: '°', insert: '°' }, { label: 'θ', insert: 'θ' }, { label: 'sin', insert: 'sin(' },
  { label: 'cos', insert: 'cos(' }, { label: 'tan', insert: 'tan(' }, { label: 'log', insert: 'log(' },
  { label: '∫', insert: '∫' }, { label: 'd/dx', insert: 'd/dx ' }, { label: '( )', insert: '()' },
];

export function MathInput({ value, onChange, onSubmit, placeholder, disabled }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (text: string) => {
    const el = ref.current;
    if (!el) { onChange(value + text); return; }
    const s = el.selectionStart ?? value.length, e = el.selectionEnd ?? value.length;
    const next = value.slice(0, s) + text + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + text.length - (text.endsWith('()') ? 1 : 0);
      el.setSelectionRange(pos, pos);
    });
  };

  const hasMath = /[$\\^²³√π∫]|\\frac/.test(value);

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit?.(); } }}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-shadow placeholder:text-muted-foreground/70"
      />
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {KEYS.map(k => (
          <button
            key={k.label}
            type="button"
            title={k.title ?? k.label}
            disabled={disabled}
            onClick={() => insert(k.insert)}
            className="shrink-0 h-8 min-w-9 px-2.5 rounded-lg border border-border bg-card text-[13px] font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            {k.label}
          </button>
        ))}
      </div>
      {hasMath && value.trim() && (
        <div className="rounded-xl bg-muted/50 border border-border px-4 py-2.5 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-2">Preview</span>
          <span className="prose prose-sm max-w-none inline-block align-middle [&_p]:my-0"><MathMarkdown>{value}</MathMarkdown></span>
        </div>
      )}
    </div>
  );
}
