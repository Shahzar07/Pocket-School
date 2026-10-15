export type Verdict = 'correct' | 'partly' | 'wrong' | 'none';

/**
 * Split the tutor's hidden control line from what the student sees. While
 * the line is still arriving, nothing is shown, so the tags never flash.
 */
export function parseTutorReply(raw: string): { verdict: Verdict; done: number | null; text: string; ready: boolean } {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('[[') && !/\n/.test(trimmed) && !/\]\]\s*\[\[[^\]]*\]\]/.test(trimmed)) {
    return { verdict: 'none', done: null, text: '', ready: false };
  }
  const verdict = (/\[\[verdict:(correct|partly|wrong|none)\]\]/i.exec(raw)?.[1]?.toLowerCase() ?? 'none') as Verdict;
  const doneMatch = /\[\[done:(\d+)\]\]/i.exec(raw);
  const text = raw
    .replace(/\[\[(verdict|done):[^\]]*\]\]/gi, '')
    .replace(/\[\[[^\]]*$/, '') // a tag still arriving
    .replace(/^\s+/, '');
  return { verdict, done: doneMatch ? Number(doneMatch[1]) : null, text, ready: true };
}
