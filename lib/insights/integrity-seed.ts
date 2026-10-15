import { buildIntegrityCase, STUDENT_INTEGRITY_NOTICE } from './integrity';
import { applyReview, compareReexam, equivalentVariant, proctorLite, recordVerdict, vivaSet } from './reexam';
import { buildConcerns, DEFAULT_NOTIFY_SETTINGS, planDelivery } from './concerns';
import { assembleCard, parentSign, signOff, subjectLine, type ReportCardModel } from './report-card-model';
import { normaliseTemplate } from './report-cards';

export const SEED_SIGNALS = {
  pasteEvents: 2,
  largeInsertChars: 420,
  typingCadenceCv: 0.05,
  secondsToAnswer: 20,
  baselineSeconds: 180,
  focusLosses: 4,
  styleShift: 55,
  aiLikelihood: 70,
  similarity: 62,
  matchSource: 'classmate' as const,
  identicalWrongCount: 4,
};

export function seedCase() {
  return buildIntegrityCase({ assignmentTitle: 'Fractions essay', signals: SEED_SIGNALS });
}

export function seedReexam() {
  const variant = equivalentVariant({
    title: 'Fractions essay',
    topic: 'Fractions',
    bloom: 'apply',
    originalPrompts: ['Shade 1/4 of the bar.'],
  });
  const proctor = proctorLite(20);
  const viva = vivaSet('Fractions', 'apply');
  const comparison = compareReexam({
    originalText: 'I split the bar into four equal parts and shade one.',
    resitText: 'Four friends share a bar. Each person gets one equal piece, which is one quarter.',
    originalScore: 80,
    resitScore: 78,
    vivaAnswered: 3,
    vivaCount: viva.length,
  });
  return { variant, proctor, viva, comparison };
}

export function seedConcerns() {
  return buildConcerns({
    atRisk: true,
    studyMinutes: 150,
    previousStudyMinutes: 400,
    missedGoals: 2,
    attendanceRate: 80,
    absenceRun: 2,
    mood: 2,
  });
}

export function seedCard(decisions: string[]): ReportCardModel {
  const template = normaliseTemplate({
    institutionId: 'school-a',
    label: 'Poket School term',
    heading: 'Term report',
    scaleId: 'a_to_e',
    logoUrl: 'https://poketschool.ai/logo.png',
  });
  const subject = subjectLine({
    courseId: 'fractions',
    courseTitle: 'Fractions',
    percent: 74,
    scaleId: 'a_to_e',
    bloomMastery: 60,
    attendanceRate: 80,
    behaviour: 'Engaged',
    effort: 4,
    goalsAchieved: 3,
    goalsSet: 4,
    teacherId: 'teacher1',
    teacherName: 'Ada',
    studentName: 'Mina',
  });
  return assembleCard({
    studentId: 'mina',
    studentName: 'Mina',
    termId: 't4',
    year: 2026,
    template,
    subjects: [signOff({ ...subject, comment: subject.commentDraft }, 'teacher1')],
    decisions,
    previous: [{ courseId: 'fractions', courseTitle: 'Fractions', percent: 60 }],
  });
}

export interface DeskCheck { label: string; actual: string | number | boolean | null; expected: string | number | boolean | null }

export function deskChecks(side: 'student' | 'parent' | 'teacher' | 'institution'): DeskCheck[] {
  const drafted = seedCase();
  const reexam = seedReexam();
  const concerns = seedConcerns();
  const openCard = seedCard(['pending']);
  const confirmed = seedCard(['confirmed']);
  const quiet = planDelivery(concerns[0], 'parent', DEFAULT_NOTIFY_SETTINGS, new Date(2026, 9, 15, 22, 30));
  const day = planDelivery(concerns[0], 'parent', DEFAULT_NOTIFY_SETTINGS, new Date(2026, 9, 15, 10, 0));
  const schoolSeesWellbeing = concerns.filter(flag => flag.kind === 'wellbeing').some(flag => flag.notify.includes('institution'));
  const common: DeskCheck[] = [
    { label: 'Notice', actual: STUDENT_INTEGRITY_NOTICE.includes('Nothing is marked down automatically'), expected: true },
    { label: 'Penalty', actual: drafted.automaticPenalty, expected: false },
    { label: 'Level', actual: drafted.level === 'clear' ? 'clear' : 'flagged', expected: 'flagged' },
    { label: 'Paste', actual: drafted.evidence.some(item => item.label === 'Paste'), expected: true },
    { label: 'Bloom', actual: reexam.variant.bloom, expected: 'apply' },
    { label: 'Paste locked', actual: reexam.proctor.allowPaste, expected: false },
    { label: 'Open note', actual: openCard.integrityNote, expected: null },
    { label: 'Confirmed note', actual: confirmed.integrityNote ? 'yes' : 'no', expected: 'yes' },
    { label: 'Grade', actual: confirmed.subjects[0]?.grade ?? '', expected: 'B' },
    { label: 'Delta', actual: confirmed.comparison[0]?.delta ?? null, expected: 14 },
    { label: 'Quiet push', actual: quiet.push, expected: false },
    { label: 'Day push', actual: day.push, expected: true },
    { label: 'School wellbeing', actual: schoolSeesWellbeing, expected: false },
  ];
  if (side === 'student') {
    return common.concat([
      { label: 'Evidence', actual: drafted.evidence.length > 3, expected: true },
    ]);
  }
  if (side === 'parent') {
    return common.concat([
      { label: 'Inbox', actual: concerns.length, expected: 5 },
      { label: 'Reply', actual: parentSign({ parentId: 'parent1', parentName: 'Pat', reply: 'Read with Mina', at: '2026-10-15T12:00:00.000Z' }).reply, expected: 'Read with Mina' },
    ]);
  }
  if (side === 'teacher') {
    const review = applyReview('reexam');
    const verdict = recordVerdict('confirm');
    return common.concat([
      { label: 'Re-exam', actual: review.decision, expected: 'resit_ai_variant' },
      { label: 'Verdict', actual: reexam.comparison.recommendation, expected: 'supports_original' },
      { label: 'Confirm', actual: verdict.decision, expected: 'confirmed' },
    ]);
  }
  return common.concat([
    { label: 'Logo', actual: confirmed.template.logoUrl.startsWith('https://'), expected: true },
    { label: 'Wellbeing hidden', actual: concerns.some(flag => flag.kind === 'wellbeing' && flag.notify.includes('institution')), expected: false },
  ]);
}
