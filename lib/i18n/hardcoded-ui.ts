import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['app', 'components', 'lib/email-otp.ts'];
const ATTRS = ['placeholder', 'aria-label', 'aria-description', 'title', 'alt'];

function walk(path: string, out: string[]) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    if (path.endsWith('node_modules') || path.includes(`${join('lib', 'i18n')}`)) return;
    for (const name of readdirSync(path)) walk(join(path, name), out);
    return;
  }
  if (!/\.(tsx|jsx)$/.test(path) && !path.endsWith('email-otp.ts')) return;
  if (path.includes('.test.') || path.includes('.baseline.')) return;
  out.push(path);
}

/** User-facing literals. Class names, routes and single tokens are ignored. */
export function hardcodedUiStrings(root: string): string[] {
  const files: string[] = [];
  for (const entry of ROOTS) walk(join(root, entry), files);
  const found = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(root, file).split('\\').join('/');
    const record = (value: string) => {
      const cleaned = value.replace(/\s+/g, ' ').trim();
      if (cleaned.length < 2) return;
      if (!/[A-Za-z\u00C0-\u024F\u0600-\u06FF\u0590-\u05FF]/.test(cleaned)) return;
      if (/^(https?:|\/|#|@[a-z]|[a-z0-9_-]+)$/i.test(cleaned)) return;
      if (/[{}<>]/.test(cleaned)) return;
      if (/^(true|false|null|undefined|en|ms|zh)$/.test(cleaned)) return;
      found.add(`${rel}\t${cleaned}`);
    };
    for (const match of text.matchAll(/>([^<{][^<{\n]{1,180})</g)) record(match[1] ?? '');
    for (const attr of ATTRS) {
      const pattern = new RegExp(`${attr}=["']([^"']{2,180})["']`, 'g');
      for (const match of text.matchAll(pattern)) record(match[1] ?? '');
    }
    for (const match of text.matchAll(/toast\.(?:success|error|message|info)\(\s*['"]([^'"]{2,180})['"]/g)) {
      record(match[1] ?? '');
    }
  }
  return [...found].sort();
}
