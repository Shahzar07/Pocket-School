/**
 * One photographic portrait per ET AI teacher.
 * The id is the source of truth. The same id always resolves to the same file.
 */

import type { AiTeacher } from './ai-teachers';

/** Files in public/teachers. One distinct person per subject. */
export const PORTRAIT_FILES = [
  'et-science',
  'et-biology',
  'et-chemistry',
  'et-physics',
  'et-human-biology',
  'et-medicine',
  'et-nursing',
  'et-maths',
  'et-further-maths',
  'et-additional-maths',
  'et-english',
  'et-english-sl',
  'et-malay',
  'et-mandarin',
  'et-french',
  'et-german',
  'et-russian',
  'et-languages',
  'et-global-citizenship',
  'et-psychology',
  'et-sociology',
  'et-media-studies',
  'et-history',
  'et-geography',
  'et-business',
  'et-economics',
  'et-accounting',
  'et-computer-science',
  'et-ict',
  'et-law',
  'et-engineering',
  'et-art',
  'et-music',
  'et-exam-coach',
  'et-study-coach',
  'et-ai',
] as const;

const FILE_SET = new Set<string>(PORTRAIT_FILES);

/** Spoken subject labels that are not the file id. */
const ALIASES: Record<string, (typeof PORTRAIT_FILES)[number]> = {
  mathematics: 'et-maths',
  math: 'et-maths',
  'further-maths': 'et-further-maths',
  'additional-maths': 'et-additional-maths',
  'business-studies': 'et-business',
  business: 'et-business',
  'art-design': 'et-art',
  'art-and-design': 'et-art',
  'human-biology': 'et-human-biology',
  'computer-science': 'et-computer-science',
  'global-citizenship': 'et-global-citizenship',
  'media-studies': 'et-media-studies',
  'exam-coach': 'et-exam-coach',
  'study-coach': 'et-study-coach',
  sciences: 'et-science',
  science: 'et-science',
  coach: 'et-study-coach',
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function closestFile(key: string): (typeof PORTRAIT_FILES)[number] {
  if (ALIASES[key]) return ALIASES[key];
  const bare = key.replace(/^et-/, '');
  if (FILE_SET.has(`et-${bare}`)) return `et-${bare}` as (typeof PORTRAIT_FILES)[number];
  if (ALIASES[bare]) return ALIASES[bare];
  let best: (typeof PORTRAIT_FILES)[number] = 'et-ai';
  let score = 0;
  for (const file of PORTRAIT_FILES) {
    const subject = file.replace(/^et-/, '');
    if (bare.includes(subject) || subject.includes(bare)) {
      const next = Math.min(bare.length, subject.length);
      if (next > score) {
        score = next;
        best = file;
      }
    }
  }
  return best;
}

export function portraitFor(_category: string, id = ''): string {
  const key = slug(id || _category || 'et-ai') || 'et-ai';
  const file = FILE_SET.has(key) ? key : closestFile(key);
  return `/teachers/${file}.webp`;
}

/** Photo used on cards and anywhere an ET avatar is shown. */
export function teacherPortrait(teacher: Pick<AiTeacher, 'id' | 'category'>): string {
  return portraitFor(teacher.category, teacher.id);
}

/** Alt text is always "ET <Subject>". */
export function portraitAlt(name: string): string {
  const subject = name.replace(/^ET\s+/i, '').trim() || 'AI';
  return `ET ${subject}`;
}
