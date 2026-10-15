/**
 * Turns a lesson asset into lines a PDF, Word file, or slide deck can carry.
 * The answer key is omitted when the student turns it off.
 */
import { parseBuzan } from '../mindmap';

export type ExportAsset =
  | 'notes'
  | 'glossary'
  | 'flashcards'
  | 'quiz'
  | 'problems'
  | 'slides'
  | 'infographic'
  | 'mindmap'
  | 'image';

export type ExportFormat = 'pdf' | 'docx' | 'jpg' | 'png' | 'pptx';

export function formatsFor(asset: ExportAsset): ExportFormat[] {
  if (asset === 'slides') return ['pptx', 'pdf', 'docx'];
  if (asset === 'image') return ['png', 'jpg'];
  if (asset === 'mindmap' || asset === 'infographic') return ['pdf', 'docx', 'png', 'jpg'];
  return ['pdf', 'docx'];
}

export function problemsForExport(markdown: string, answerKey: boolean): string {
  if (answerKey) return markdown;
  const lines = markdown.split('\n');
  const kept: string[] = [];
  let hiding = false;
  for (const line of lines) {
    if (/^###\s+worked solution\b/i.test(line.trim())) {
      hiding = true;
      continue;
    }
    if (hiding && /^##\s+/.test(line.trim())) hiding = false;
    if (!hiding) kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function linesOf(text: string): string[] {
  return text.split('\n').map(line => line.replace(/\s+$/g, ''));
}

export function assetLines(asset: ExportAsset, content: unknown, answerKey: boolean): string[] {
  if (asset === 'problems' && typeof content === 'string') {
    return linesOf(problemsForExport(content, answerKey));
  }
  if ((asset === 'notes' || asset === 'infographic') && typeof content === 'string') {
    return linesOf(content);
  }
  if (asset === 'mindmap' && typeof content === 'string') {
    const map = parseBuzan(content);
    if (!map) return [];
    const lines = [map.center];
    for (const branch of map.branches) {
      lines.push(`${branch.icon} ${branch.keyword}`);
      for (const child of branch.children) {
        lines.push(`  ${child.icon} ${child.keyword}`);
        for (const grand of child.children) lines.push(`    ${grand.icon} ${grand.keyword}`);
      }
    }
    return lines;
  }
  if (asset === 'glossary' && Array.isArray(content)) {
    return content.flatMap(item => {
      const row = asRecord(item);
      if (!row) return [];
      return [`${String(row.term ?? '')}`, String(row.definition ?? ''), ''];
    });
  }
  if (asset === 'flashcards' && Array.isArray(content)) {
    return content.flatMap((item, index) => {
      const row = asRecord(item);
      if (!row) return [];
      return [`Card ${index + 1}`, `Q: ${String(row.question ?? '')}`, `A: ${String(row.answer ?? '')}`, ''];
    });
  }
  if (asset === 'quiz' && Array.isArray(content)) {
    return content.flatMap((item, index) => {
      const row = asRecord(item);
      if (!row) return [];
      const options = Array.isArray(row.options) ? row.options.map(option => String(option)) : [];
      const lines = [`Question ${index + 1}`, String(row.question ?? ''), ...options.map(option => `- ${option}`)];
      if (answerKey) {
        lines.push(`Answer: ${String(row.answer ?? '')}`);
        if (row.explanation) lines.push(`Why: ${String(row.explanation)}`);
      }
      lines.push('');
      return lines;
    });
  }
  if (asset === 'slides' && Array.isArray(content)) {
    return content.flatMap((item, index) => {
      const row = asRecord(item);
      if (!row) return [];
      const bullets = Array.isArray(row.bullets) ? row.bullets.map(bullet => `- ${String(bullet)}`) : [];
      return [`Slide ${index + 1}: ${String(row.title ?? '')}`, ...bullets, ''];
    });
  }
  return [];
}

export interface SlidePage {
  title: string;
  bullets: string[];
}

export function slidePages(content: unknown): SlidePage[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((item, index) => {
    const row = asRecord(item);
    if (!row) return [];
    const bullets = Array.isArray(row.bullets) ? row.bullets.map(bullet => String(bullet)).filter(Boolean) : [];
    return [{ title: String(row.title ?? `Slide ${index + 1}`), bullets }];
  });
}
