export interface TermSpan {
  name: string;
  from: string;
  to: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** CSV or tab lines: name, from, to. Blank lines are skipped. */
export function parseTermFile(text: string): TermSpan[] {
  const rows: TermSpan[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [name, from, to] = line.split(/[,|\t]/).map((part) => part.trim());
    if (!name || !from || !to || !DATE.test(from) || !DATE.test(to) || from > to) continue;
    rows.push({ name, from, to });
  }
  return rows;
}

export function termsToLines(rows: TermSpan[]): string {
  return rows.map((row) => `${row.name}: ${row.from} to ${row.to}`).join('\n');
}

export function nextTermName(existing: string): string {
  const used = existing.split('\n').map((line) => line.trim()).filter(Boolean).length;
  return `Term ${used + 1}`;
}
