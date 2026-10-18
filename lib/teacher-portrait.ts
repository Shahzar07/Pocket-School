/**
 * Realistic portraits for the AI teachers. Six photographs cover the faculty.
 * A subject picks a portrait so every ET avatar is the same person for that bench.
 */

import type { AiTeacher, TeacherCategory } from './ai-teachers';

const PORTRAIT = {
  english: '/teachers/portrait-english.jpg',
  maths: '/teachers/portrait-maths.jpg',
  science: '/teachers/portrait-science.jpg',
  humanities: '/teachers/portrait-humanities.jpg',
  arts: '/teachers/portrait-arts.jpg',
  coach: '/teachers/portrait-coach.jpg',
} as const;

export function portraitFor(category: TeacherCategory | string, id = ''): string {
  if (id === 'et-ai' || category === 'Study Support' || category === 'Computer Science') return PORTRAIT.coach;
  if (category === 'Mathematics' || category === 'Engineering') return PORTRAIT.maths;
  if (category === 'English' || category === 'Languages') return PORTRAIT.english;
  if (category === 'Sciences' || category === 'Medicine') return PORTRAIT.science;
  if (category === 'Arts') return PORTRAIT.arts;
  if (category === 'Humanities' || category === 'Law' || category === 'Business') return PORTRAIT.humanities;
  return PORTRAIT.coach;
}

/** Photo used on cards and anywhere an ET avatar is shown. */
export function teacherPortrait(teacher: Pick<AiTeacher, 'id' | 'category'>): string {
  return portraitFor(teacher.category, teacher.id);
}
