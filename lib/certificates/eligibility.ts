/**
 * When a Poket School certificate may be issued.
 * Finishing lessons is not enough. Passing one unit is not enough.
 * The student needs the course final assessment at the course pass mark,
 * and a pass on every unit that has a unit test.
 */

import { isNamedLevel } from '../example-courses';
import { displayLevels, toNamedLevel } from '../programmes';
import { resolvePassMark } from '../unit-test';

export interface UnitPassState {
  id: string;
  hasUnitTest: boolean;
}

export function courseCertificatePassMark(course?: { unitTestPassMark?: number } | null): number {
  return resolvePassMark(course, null);
}

export function isFinalAssessment(lesson: {
  finalAssessment?: boolean;
  assessmentConfig?: { kind?: string; certificateOnPass?: boolean };
} | null | undefined): boolean {
  if (!lesson) return false;
  if (lesson.finalAssessment === true) return true;
  if (lesson.assessmentConfig?.certificateOnPass === true) return true;
  return lesson.assessmentConfig?.kind === 'mock_exam';
}

/** A stored year number becomes a level name. Anything still numbered is left off the certificate. */
export function certificateLevelName(source?: { level?: string; yearGroup?: string; programmeId?: string } | null): string {
  const raw = (source?.level || source?.yearGroup || source?.programmeId || '').trim();
  if (!raw) return '';
  const named = toNamedLevel(raw);
  if (isNamedLevel(named)) return named;
  const parts = displayLevels([raw]).split(' · ').map((part) => part.trim()).filter((part) => isNamedLevel(part));
  return parts[0] ?? '';
}

export function allUnitsPassed(units: readonly UnitPassState[], passedUnitIds: readonly string[]): boolean {
  const required = units.filter((unit) => unit.hasUnitTest);
  if (required.length === 0) return false;
  const passed = new Set(passedUnitIds);
  return required.every((unit) => passed.has(unit.id));
}

export function certificateEligible(input: {
  finalPassed: boolean;
  finalScore: number;
  passMark: number;
  units: readonly UnitPassState[];
  passedUnitIds: readonly string[];
}): boolean {
  if (!input.finalPassed) return false;
  if (!Number.isFinite(input.finalScore) || input.finalScore < input.passMark) return false;
  return allUnitsPassed(input.units, input.passedUnitIds);
}
