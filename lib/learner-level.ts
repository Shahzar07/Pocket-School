/**
 * The tutor speaks differently to a Year 8 and to a postgraduate. Onboarding
 * records a free-text level; this maps it to the tutor's register so a child
 * never gets the university voice by default.
 */
export type TutorMode = 'k12' | 'college' | 'professional';

export function tutorModeFor(level?: string | null): TutorMode {
  const l = (level ?? '').toLowerCase();
  if (/professional/.test(l)) return 'professional';
  if (/undergrad|postgrad|university|college|degree/.test(l)) return 'college';
  return 'k12';
}
