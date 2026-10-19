/**
 * One portrait per ET AI teacher. The id is the source of truth.
 * The same id always resolves to the same file, on the site and in app data.
 */

import type { AiTeacher } from './ai-teachers';

export function portraitFor(_category: string, id = ''): string {
  const key = (id || _category || 'et-ai').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'et-ai';
  return `/teachers/${key}.svg`;
}

/** Photo used on cards and anywhere an ET avatar is shown. */
export function teacherPortrait(teacher: Pick<AiTeacher, 'id' | 'category'>): string {
  return portraitFor(teacher.category, teacher.id);
}
