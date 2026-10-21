/**
 * One learner-level list for every select, chip, and filter.
 * Stored values from older forms still resolve through the alias table.
 * Nothing here is a data migration.
 */

export const LEVEL_GROUPS = [
  { id: 'school', label: 'School' },
  { id: 'pre-university', label: 'Pre-University' },
  { id: 'university', label: 'University' },
  { id: 'postgraduate', label: 'Postgraduate' },
  { id: 'other', label: 'Other' },
] as const;

export type LevelGroupId = (typeof LEVEL_GROUPS)[number]['id'];

export const LEARNER_LEVELS = [
  { id: 'primary', label: 'Primary', group: 'school' },
  { id: 'lower-secondary', label: 'Lower Secondary', group: 'school' },
  { id: 'upper-secondary', label: 'Upper Secondary', group: 'school' },
  { id: 'igcse', label: 'IGCSE / O Level', group: 'school' },
  { id: 'a-level', label: 'A-Level', group: 'pre-university' },
  { id: 'pre-university', label: 'Pre-University / Foundation', group: 'pre-university' },
  { id: 'undergraduate', label: 'Undergraduate (Degree)', group: 'university' },
  { id: 'masters', label: 'Postgraduate: Masters', group: 'postgraduate' },
  { id: 'phd', label: 'Postgraduate: PhD / Doctoral', group: 'postgraduate' },
  { id: 'professional', label: 'Professional', group: 'other' },
  { id: 'independent', label: 'Independent learner', group: 'other' },
] as const;

export type LevelId = (typeof LEARNER_LEVELS)[number]['id'];

const ALIASES: Record<string, LevelId> = {
  primary: 'primary',
  'lower secondary': 'lower-secondary',
  'lower-secondary': 'lower-secondary',
  lowersecondary: 'lower-secondary',
  secondary: 'lower-secondary',
  'upper secondary': 'upper-secondary',
  'upper-secondary': 'upper-secondary',
  uppersecondary: 'upper-secondary',
  igcse: 'igcse',
  'igcse / o level': 'igcse',
  'igcse/o level': 'igcse',
  'o level': 'igcse',
  'o-level': 'igcse',
  olevel: 'igcse',
  gcse: 'igcse',
  'a-level': 'a-level',
  'a level': 'a-level',
  alevel: 'a-level',
  'pre-university': 'pre-university',
  'pre university': 'pre-university',
  preuniversity: 'pre-university',
  'pre-university / foundation': 'pre-university',
  'pre-university/foundation': 'pre-university',
  foundation: 'pre-university',
  undergraduate: 'undergraduate',
  'undergraduate (degree)': 'undergraduate',
  degree: 'undergraduate',
  'degree (undergraduate)': 'undergraduate',
  university: 'undergraduate',
  masters: 'masters',
  master: 'masters',
  "master's": 'masters',
  'postgraduate: masters': 'masters',
  postgraduate: 'masters',
  postgrad: 'masters',
  phd: 'phd',
  doctoral: 'phd',
  doctorate: 'phd',
  'ph.d': 'phd',
  'postgraduate: phd / doctoral': 'phd',
  'postgraduate: phd': 'phd',
  professional: 'professional',
  independent: 'independent',
  'independent learner': 'independent',
};

function aliasKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveLevel(value: string | null | undefined): LevelId | null {
  if (!value) return null;
  const direct = LEARNER_LEVELS.find((level) => level.id === value);
  if (direct) return direct.id;
  return ALIASES[aliasKey(value)] ?? null;
}

export function levelLabel(value: string | null | undefined): string {
  const id = resolveLevel(value);
  if (!id) return (value ?? '').trim();
  return LEARNER_LEVELS.find((level) => level.id === id)?.label ?? id;
}

export function sameLevel(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = resolveLevel(left);
  const b = resolveLevel(right);
  if (!a || !b) return false;
  return a === b;
}

export function isKnownLevel(value: string | null | undefined): boolean {
  return resolveLevel(value) !== null;
}

export function levelsInGroup(group: LevelGroupId) {
  return LEARNER_LEVELS.filter((level) => level.group === group);
}

/** Programme + year used when a learner level still has a placement row. */
export function placementForLevel(value: string | null | undefined): { programme: string; year: string } | null {
  switch (resolveLevel(value)) {
    case 'primary':
      return { programme: 'Primary', year: 'Primary' };
    case 'lower-secondary':
      return { programme: 'Lower Secondary', year: 'Lower Secondary' };
    case 'igcse':
      return { programme: 'IGCSE', year: 'IGCSE' };
    case 'a-level':
      return { programme: 'A-Level', year: 'A-Level' };
    case 'pre-university':
      return { programme: 'Pre-University', year: 'Pre-University' };
    case 'undergraduate':
      return { programme: 'Micro Degree', year: 'Degree' };
    case 'professional':
      return { programme: 'Professional Certification', year: 'Professional' };
    case 'independent':
      return { programme: 'Independent Learning', year: 'Not applicable' };
    default:
      return null;
  }
}
