'use client';

import ReactMarkdown from 'react-markdown';
import { AiOutputs } from '@/lib/db';
import { MindmapRenderer } from '@/components/mindmap-renderer';
import { InfographicRenderer } from '@/components/infographic-renderer';

const MARKDOWN_FORMATS = new Set([
  'text', 'videoScript', 'audioScript', 'problems', 'notes', 'summary',
]);

/** Read-only preview of one AI-generated content format, shared between the
 * lesson player and the admin curriculum CMS review screen. */
export function FormatPreview({ format, outputs }: { format: string; outputs: AiOutputs }) {
  const value = outputs[format as keyof AiOutputs];

  if (value == null || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && !value.trim())) {
    return <p className="text-sm text-muted-foreground italic">Not generated yet.</p>;
  }

  if (format === 'mindmap' && typeof value === 'string') {
    return <MindmapRenderer content={value} />;
  }

  if (format === 'infographic' && typeof value === 'string') {
    return <InfographicRenderer content={value} />;
  }

  if (MARKDOWN_FORMATS.has(format) && typeof value === 'string') {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{value}</ReactMarkdown>
      </div>
    );
  }

  if (format === 'flashcards' && Array.isArray(value)) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {(value as { question: string; answer: string }[]).map((c, i) => (
          <div key={i} className="bg-muted/40 rounded-xl p-3 text-sm">
            <p className="font-semibold text-foreground">{c.question}</p>
            <p className="text-muted-foreground mt-1">{c.answer}</p>
          </div>
        ))}
      </div>
    );
  }

  if (format === 'quiz' && Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {(value as any[]).map((q: any, i: number) => (
          <div key={i} className="bg-muted/40 rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-foreground">{i + 1}. {q.question}</p>
              {q.objectiveCode && (
                <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{q.objectiveCode}</span>
              )}
            </div>
            <ul className="space-y-0.5">
              {q.options?.map((opt: string, j: number) => (
                <li key={j} className={opt === q.answer ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}>
                  {opt === q.answer ? '✓ ' : '· '}{opt}
                </li>
              ))}
            </ul>
            {q.explanation && <p className="text-xs text-muted-foreground mt-1.5 italic">{q.explanation}</p>}
          </div>
        ))}
      </div>
    );
  }

  if (format === 'slides' && Array.isArray(value)) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {(value as { title: string; bullets: string[] }[]).map((s, i) => (
          <div key={i} className="bg-muted/40 rounded-xl p-3 text-sm">
            <p className="font-bold text-foreground mb-1">{s.title}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              {s.bullets?.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (format === 'glossary' && Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {(value as { term: string; definition: string }[]).map((g, i) => (
          <div key={i} className="bg-muted/40 rounded-xl p-3 text-sm">
            <p className="font-bold text-foreground">{g.term}</p>
            <p className="text-muted-foreground mt-0.5">{g.definition}</p>
          </div>
        ))}
      </div>
    );
  }

  return <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{JSON.stringify(value, null, 2)}</pre>;
}
