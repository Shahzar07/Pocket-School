/**
 * Checks that generated blocks are the format the editor asked for,
 * and that infographic figures actually appear in the lesson.
 */
import { isStudyNoteProse, parseBuzan, type BuzanMap } from './mindmap';

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'under', 'than', 'then', 'was', 'were', 'are', 'its', 'per', 'total']);

export function problemsAreWorked(text: string): boolean {
  const body = text.trim();
  if (!body) return false;
  const worked = /worked solution/i.test(body) && /\bproblem\b/i.test(body);
  if (isStudyNoteProse(body) && !worked) return false;
  return worked;
}

export function mindmapIsBuzan(text: string): BuzanMap | null {
  if (isStudyNoteProse(text)) return null;
  return parseBuzan(text);
}

interface Figure {
  key: string;
  index: number;
}

function canonical(raw: string, suffix: string): string | null {
  const number = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(number)) return null;
  const unit = suffix.toLowerCase();
  if (unit.startsWith('%') || unit.startsWith('percent')) return `pct:${number}`;
  if (unit === 'm' || unit.startsWith('million')) return `n:${number * 1_000_000}`;
  if (unit === 'bn' || unit.startsWith('billion')) return `n:${number * 1_000_000_000}`;
  if (unit === 'k' || unit.startsWith('thousand')) return `n:${number * 1_000}`;
  return `n:${number}`;
}

function figures(text: string): Figure[] {
  const found: Figure[] = [];
  const pattern = /(?:£|\$|€)?\s*(\d[\d,]*(?:\.\d+)?)(?:\s*(%|percent|m|million|bn|billion|k|thousand))?/gi;
  for (const match of text.matchAll(pattern)) {
    const key = canonical(match[1] ?? '', match[2] ?? '');
    if (!key || match.index == null) continue;
    found.push({ key, index: match.index });
  }
  return found;
}

function labelWords(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s/]+/)
    .map(word => word.trim())
    .filter(word => word.length >= 3 && !STOP.has(word));
}

function wordIn(window: string, word: string): boolean {
  const folded = window.toLowerCase();
  const forms = [word, word.replace(/-/g, ''), word.replace(/-/g, ' ')];
  return forms.some(form => form.length >= 3 && folded.includes(form));
}

/** A stat is grounded when its number is in the lesson and every label word sits beside that number. */
export function statGrounded(value: string, label: string, source: string): boolean {
  const statFigures = figures(value);
  if (statFigures.length === 0) return false;
  const sourceFigures = figures(source);
  const hit = statFigures.every(stat => sourceFigures.some(item => item.key === stat.key));
  if (!hit) return false;
  const words = labelWords(label);
  if (words.length === 0) return true;
  return statFigures.every(stat => {
    const at = sourceFigures.find(item => item.key === stat.key);
    if (!at) return false;
    const window = source.slice(Math.max(0, at.index - 80), at.index + 80);
    return words.every(word => wordIn(window, word));
  });
}

function statLine(line: string): { value: string; label: string } | null {
  const match = line.trim().match(/^\*\*\s*([^*]+?)\s*\*\*\s*[—–:-]\s*(.+)$/);
  if (!match) return null;
  return { value: match[1].trim(), label: match[2].trim() };
}

/**
 * Drop stat lines and bullets whose numbers are not in the lesson.
 * The returned markdown is safe to store.
 */
export function groundInfographic(markdown: string, source: string): { markdown: string; rejected: string[] } {
  const rejected: string[] = [];
  const kept = markdown.split('\n').filter(line => {
    const trimmed = line.trim();
    const stat = statLine(trimmed);
    if (stat) {
      if (statGrounded(stat.value, stat.label, source)) return true;
      rejected.push(`${stat.value} — ${stat.label}`);
      return false;
    }
    const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const prose = bullet?.[1] ?? '';
    if (prose && figures(prose).length > 0 && !figures(prose).every(item => figures(source).some(sourceItem => sourceItem.key === item.key))) {
      rejected.push(trimmed);
      return false;
    }
    return true;
  });
  return { markdown: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), rejected };
}
