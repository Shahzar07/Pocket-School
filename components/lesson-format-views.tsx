'use client';

import { MathMarkdown } from '@/components/math-markdown';
import { AiOutputs } from '@/lib/db';
import { MindmapRenderer } from '@/components/mindmap-renderer';
import { InfographicRenderer } from '@/components/infographic-renderer';
import { VideoStoryboard } from '@/components/video-storyboard';
import { VideoPlayer } from '@/components/video-player';
import { SmartAudioPlayer } from '@/components/smart-audio-player';

const MARKDOWN_FORMATS = new Set([
  'text', 'problems', 'notes', 'summary',
]);

/**
 * Repair the malformed markdown providers occasionally emit so react-markdown
 * actually renders it instead of printing raw `#` / `***` on screen.
 * - unescapes `\#`, `\*\*` style escaped markers
 * - `***bold italic***` → `**bold**` (react-markdown renders the nested form
 *   inconsistently when the model unbalances the markers)
 * - `##Title` → `## Title` (no space = not a heading = literal hashes)
 * - drops separator lines made of bare `#` runs
 * - collapses 3+ blank lines
 */
export function normalizeMarkdown(input: string): string {
  if (!input) return '';
  let md = String(input).replace(/\r\n/g, '\n');

  // Providers sometimes JSON-escape the payload: "\n" and "\t" arrive literal.
  if (!md.includes('\n') && /\\n/.test(md)) md = md.replace(/\\n/g, '\n').replace(/\\t/g, '  ');

  md = md
    // Unescape markdown markers that were escaped by the model.
    .replace(/\\([#*_`>[\]~-])/g, '$1')
    // ***text*** → **text**
    .replace(/\*\*\*(.+?)\*\*\*/g, '**$1**')
    // Heading marks with no space after them are not headings.
    .replace(/^(\s{0,3})(#{1,6})(?=[^\s#])/gm, '$1$2 ')
    // Bullets with no space after the marker (never `*`, which is emphasis).
    .replace(/^(\s*)([-+])(?=[A-Za-z])/gm, '$1$2 ')
    // Lines that are only `#` characters were used as separators.
    .replace(/^\s*#{1,6}\s*$/gm, '')
    // Stray leading `#` runs used as decoration before real text on a heading.
    .replace(/^(\s{0,3}#{1,6}) *#+ */gm, '$1 ')
    // Collapse runaway blank lines.
    .replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

type Slide = { title: string; bullets: string[] };

/** Coerce whatever shape the model returned into `{title, bullets[]}` slides. */
export function normalizeSlides(value: unknown): Slide[] | null {
  let raw: unknown = value;

  // Slides can arrive as a JSON string (or a fenced JSON block).
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    if (!text) return null;
    const candidate = text.startsWith('[') || text.startsWith('{')
      ? text
      : (text.match(/\[[\s\S]*\]/)?.[0] ?? '');
    if (!candidate) return null;
    try { raw = JSON.parse(candidate); } catch { return null; }
  }

  // Sometimes wrapped: { slides: [...] }
  if (raw && !Array.isArray(raw) && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const inner = obj.slides ?? obj.items ?? obj.data;
    if (Array.isArray(inner)) raw = inner;
  }
  if (!Array.isArray(raw)) return null;

  const toBullets = (input: unknown): string[] => {
    if (Array.isArray(input)) {
      return input
        .map((b) => (typeof b === 'string' ? b : (b as any)?.text ?? (b as any)?.point ?? ''))
        .map((b) => String(b).replace(/^\s*[-*•]\s*/, '').trim())
        .filter(Boolean);
    }
    if (typeof input === 'string') {
      return input
        .split('\n')
        .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
        .filter(Boolean);
    }
    return [];
  };

  const slides: Slide[] = [];
  raw.forEach((item, i) => {
    if (typeof item === 'string') {
      const lines = item.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return;
      slides.push({ title: lines[0].replace(/^#+\s*/, ''), bullets: toBullets(lines.slice(1).join('\n')) });
      return;
    }
    if (!item || typeof item !== 'object') return;
    const s = item as Record<string, unknown>;
    const title = String(s.title ?? s.heading ?? s.header ?? s.name ?? s.subject ?? `Slide ${i + 1}`).trim();
    const bullets = toBullets(s.bullets ?? s.points ?? s.content ?? s.body ?? s.items ?? s.text ?? s.notes);
    if (!title && !bullets.length) return;
    slides.push({ title: title || `Slide ${i + 1}`, bullets });
  });

  return slides.length ? slides : null;
}

/** True when an option is the stored answer, tolerating legacy letter
 * answers ("B") that refer to the option at that index. */
function isCorrectOption(opt: string, answer: string | undefined, options: string[] = [], index = -1): boolean {
  const ans = (answer ?? '').trim();
  if (opt === ans) return true;
  if (/^[A-D]$/i.test(ans)) {
    const answerIndex = ans.toUpperCase().charCodeAt(0) - 65;
    return index >= 0 ? index === answerIndex : options[answerIndex] === opt;
  }
  return false;
}

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

  if (format === 'videoScript' && typeof value === 'string') {
    return (
      <div className="space-y-4">
        <VideoPlayer script={value} />
        <details className="rounded-xl border border-border overflow-hidden">
          <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            View storyboard &amp; script
          </summary>
          <div className="px-4 pb-4">
            <VideoStoryboard script={value} />
          </div>
        </details>
      </div>
    );
  }

  if (format === 'audioScript' && typeof value === 'string') {
    return <SmartAudioPlayer script={value} title="Audio Summary" />;
  }

  if (MARKDOWN_FORMATS.has(format) && typeof value === 'string') {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <MathMarkdown>{normalizeMarkdown(value)}</MathMarkdown>
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
              {q.options?.map((opt: string, j: number) => {
                const correct = isCorrectOption(opt, q.answer, q.options, j);
                return (
                  <li key={j} className={correct ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}>
                    {correct ? '✓ ' : '· '}{opt}
                  </li>
                );
              })}
            </ul>
            {q.explanation && <p className="text-xs text-muted-foreground mt-1.5 italic">{q.explanation}</p>}
          </div>
        ))}
      </div>
    );
  }

  if (format === 'slides') {
    const slides = normalizeSlides(value);
    if (!slides) {
      return (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            We couldn&apos;t parse these slides.
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-200/70">
            The generated slide data wasn&apos;t in the expected format. Regenerate this format to fix it — the raw output is below.
          </p>
          <pre className="text-[11px] whitespace-pre-wrap text-muted-foreground max-h-56 overflow-auto">
            {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          </pre>
        </div>
      );
    }
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {slides.map((s, i) => (
          <div key={i} className="bg-muted/40 rounded-xl p-3 text-sm">
            <p className="font-bold text-foreground mb-1">{s.title}</p>
            {s.bullets.length > 0 && (
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            )}
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
