'use client';

import { Video } from 'lucide-react';

export interface Scene {
  title: string;
  visual: string;
  narration: string;
}

/* ───────────────────────── Narration cleaning ─────────────────────────
 * AI video scripts routinely leak script scaffolding into the narration —
 * "Narrator:", "[HOOK]", "(pause)", "**Visual:**", markdown emphasis and
 * ellipses. Anything left in the string gets spoken aloud by TTS ("dot dot
 * dot") or printed on the caption track, so it must be stripped before the
 * text is ever rendered or narrated.
 * ---------------------------------------------------------------------- */

/** Speaker labels that prefix a spoken line ("NARRATOR：", "VO -", …). */
const SPEAKER_LABEL_RE =
  /^\s*[*_~`"'\s]*(narrator|narration|presenter|host|voice\s*over|voiceover|v\.?\s?o\.?|speaker|teacher|announcer|reader|instructor)[*_~`\s]*\s*[:：\-–—]\s*/i;

/** Section labels used as script scaffolding, never meant to be spoken. */
const SECTION_LABELS = [
  'hook', 'intro', 'introduction', 'opening', 'open', 'outro', 'ending', 'closing',
  'close', 'recap', 'cta', 'call\\s+to\\s+action', 'conclusion', 'wrap\\s?-?\\s?up',
  'body', 'transition', 'segment', 'title\\s+card', 'end\\s+card', 'on\\s+screen',
  'music', 'sfx', 'sound\\s+effect', 'b\\s?-?\\s?roll', 'visual', 'visuals',
  'cut\\s+to', 'fade\\s+in', 'fade\\s+out', 'pause', 'beat',
];

/** "HOOK:" / "[HOOK]" / "OUTRO —" style label that prefixes a line or title. */
const SECTION_PREFIX_RE = new RegExp(
  `^\\s*[\\[(]?\\s*(?:${SECTION_LABELS.join('|')})\\s*[\\])]?\\s*[:：\\-–—]\\s*`,
  'i'
);

/** A whole line that is nothing but a section label ("HOOK", "OUTRO:"). */
const PURE_LABEL_RE = new RegExp(
  `^\\s*[\\[(*_#>\\s]*(?:${SECTION_LABELS.join('|')})[\\])*_\\s]*[:：]?\\s*$`,
  'i'
);

/** A whole line wrapped in brackets/parens — `[VISUAL: …]`, `(pause)`, `[SFX: whoosh]`. */
const BRACKETED_LINE_RE = /^\s*[[(][^\])]*[\])]\s*[.!?]?\s*$/;

/** Inline parenthetical stage directions worth deleting mid-sentence. */
const INLINE_DIRECTION_RE =
  /\((?:\s*(?:pause|short pause|long pause|beat|silence|laughs?|laughing|smiles?|smiling|chuckles?|sighs?|music[^)]*|upbeat[^)]*|sfx[^)]*|sound[^)]*)\s*)\)/gi;

/** Strip every speaker/section label that prefixes a single line. */
function stripLabels(line: string): string {
  let out = line;
  for (let i = 0; i < 4; i++) {
    const next = out.replace(SPEAKER_LABEL_RE, '').replace(SECTION_PREFIX_RE, '');
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Remove markdown emphasis, code ticks and stray heading marks. */
function stripMarkdown(text: string): string {
  return text
    // escaped markdown produced by some providers: \*\*bold\*\*
    .replace(/\\([\\*_#`>[\]~-])/g, '$1')
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|\s)_([^_\n]+)_(?=$|[\s.,!?;:])/g, '$1$2')
    .replace(/`+/g, '')
    .replace(/[*]+/g, '')
    .replace(/^#{1,6}\s*/gm, '');
}

/** Ellipses are read aloud as "dot dot dot" — turn them into real punctuation. */
function stripEllipses(text: string): string {
  return text
    .replace(/\s*(?:\.{3,}|…)\s*/g, (_m, offset: number, full: string) => {
      const rest = full.slice(offset).replace(/^\s*(?:\.{3,}|…)\s*/, '');
      if (!rest) return '.';
      return /^[a-z]/.test(rest) ? ', ' : '. ';
    })
    .replace(/\.\s*\./g, '.');
}

/**
 * Turn a raw script fragment into plain spoken prose.
 * Safe to call more than once — the transform is idempotent.
 */
export function cleanNarration(raw: string): string {
  if (!raw) return '';

  const kept: string[] = [];
  for (const rawLine of raw.replace(/\r\n/g, '\n').split('\n')) {
    let line = rawLine.trim();
    if (!line) { kept.push(''); continue; }
    if (/^```/.test(line)) continue;                    // code fences
    if (/^(?:[-*_=]\s*){3,}$/.test(line)) continue;      // horizontal rules
    if (BRACKETED_LINE_RE.test(line)) continue;          // [HOOK] / (pause) / [SFX: …]

    // Leading markdown structure markers.
    line = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/^[-*+•]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .trim();

    if (!line) continue;
    if (PURE_LABEL_RE.test(line)) continue;              // "HOOK" / "OUTRO:"

    line = stripLabels(line).trim();
    if (!line || PURE_LABEL_RE.test(line)) continue;

    kept.push(line);
  }

  let text = kept.join('\n');

  text = text
    .replace(/\[[^\]\n]*\]/g, ' ')     // inline [VISUAL: …] / [SFX: …]
    .replace(INLINE_DIRECTION_RE, ' ');

  text = stripMarkdown(text);
  text = stripEllipses(text);

  return text
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim())
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Clean a scene/segment title: drops "HOOK: " style prefixes and markdown. */
export function cleanTitle(raw: string): string {
  if (!raw) return '';
  let t = raw.trim().replace(/^#{1,6}\s*/, '');
  if (BRACKETED_LINE_RE.test(t)) t = t.replace(/^[[(]\s*/, '').replace(/\s*[\])]$/, '');
  t = stripLabels(t);
  t = stripMarkdown(t).replace(/\s+/g, ' ').trim();
  return t.replace(/^[:：\-–—\s]+/, '').trim();
}

/* ───────────────────────────── Script parsing ─────────────────────────── */

export function parseScenes(script: string): Scene[] {
  const lines = (script ?? '').replace(/\r\n/g, '\n').split('\n');
  const scenes: Scene[] = [];
  let current: { title: string; visual: string; narration: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const narration = cleanNarration(current.narration.join('\n'));
    // A scene with neither narration nor a visual is script scaffolding
    // (a document title, a stray "SCRIPT" header) — never a real scene.
    if (!narration && !current.visual) return;
    let title = cleanTitle(current.title);
    if (!title || PURE_LABEL_RE.test(title)) title = `Scene ${scenes.length + 1}`;
    scenes.push({ title, visual: current.visual, narration });
  };

  for (const line of lines) {
    const sceneMatch =
      line.match(/^###?\s*Scene\s*\d+\s*[—–:-]?\s*(.*)/i) || line.match(/^###?\s*(\d+\.\s*.*)/);
    if (sceneMatch) {
      flush();
      current = { title: sceneMatch[1].trim() || `Scene ${scenes.length + 1}`, visual: '', narration: [] };
      continue;
    }
    if (!current) {
      const headerMatch = line.match(/^##?\s*(.*)/);
      if (headerMatch) {
        current = { title: headerMatch[1].trim(), visual: '', narration: [] };
        continue;
      }
      continue;
    }
    const visualMatch =
      line.match(/\[VISUAL:\s*(.*?)\]?$/i) || line.match(/^\*?\*?Visuals?\*?\*?:\s*(.*)/i);
    if (visualMatch) {
      const visual = stripMarkdown(visualMatch[1].replace(/]$/, '')).trim();
      current.visual = current.visual ? `${current.visual} ${visual}`.trim() : visual;
      continue;
    }
    if (line.trim()) current.narration.push(line);
  }
  flush();

  if (scenes.length === 0) {
    const narration = cleanNarration(script ?? '');
    scenes.push({ title: 'Full Script', visual: '', narration });
  }
  return scenes;
}

/* ───────────────────────────── Storyboard view ────────────────────────── */

export function VideoStoryboard({ script, dark }: { script: string; dark?: boolean }) {
  const scenes = parseScenes(script);

  const cardBg = dark ? 'border-white/10' : 'border-border';
  const headerBg = dark ? 'from-red-500/10 to-rose-500/5 border-white/10' : 'from-red-500/10 to-rose-500/5 border-border';
  const numBg = dark ? 'bg-red-500/20 text-red-400' : 'bg-red-500/15 text-red-600';
  const titleColor = dark ? 'text-white' : 'text-foreground';
  const visualBg = dark ? 'bg-white/[0.02] border-white/5' : 'bg-muted/50 border-border/50';
  const visualLabel = dark ? 'text-cyan-400' : 'text-cyan-600';
  const narrationColor = dark ? 'text-slate-300' : 'text-muted-foreground';
  const bannerBg = dark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200';
  const bannerText = dark ? 'text-amber-300' : 'text-amber-700';
  const bannerIcon = dark ? 'text-amber-400' : 'text-amber-500';
  const labelColor = dark ? 'text-slate-400' : 'text-muted-foreground';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
          <Video className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${labelColor}`}>Video Storyboard</p>
          <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-muted-foreground/60'}`}>Scene-by-scene script with visual directions</p>
        </div>
      </div>
      {scenes.map((scene, i) => (
        <div key={i} className={`relative rounded-xl border overflow-hidden ${cardBg}`}>
          <div className={`bg-gradient-to-r ${headerBg} px-5 py-3 border-b flex items-center gap-3`}>
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${numBg}`}>
              {i + 1}
            </div>
            <h4 className={`font-heading text-sm ${titleColor}`}>{scene.title}</h4>
          </div>
          {scene.visual && (
            <div className={`px-5 py-2.5 border-b flex items-start gap-2 ${visualBg}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 mt-0.5 ${visualLabel}`}>Visual</span>
              <p className={`text-xs italic ${narrationColor}`}>{scene.visual}</p>
            </div>
          )}
          <div className="px-5 py-4">
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${narrationColor}`}>{scene.narration}</p>
          </div>
        </div>
      ))}
      <div className={`rounded-xl px-5 py-3 flex items-center gap-3 border ${bannerBg}`}>
        <Video className={`w-4 h-4 shrink-0 ${bannerIcon}`} />
        <p className={`text-xs ${bannerText}`}>Full animated video production coming soon. This storyboard can be used as a study guide or production brief.</p>
      </div>
    </div>
  );
}
