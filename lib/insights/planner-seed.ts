import {
  absenceCounts, brandedTitle, changeNotice, eventsForViewer, expandWeekly, milestoneDates,
  paceCurriculum, personalCopy, replan, revisionGoalDrafts, teachingDays, termWindow, toIcs,
  upcomingReminders, type PlannerEvent, type YearPlan,
} from './planner';

export const SEED_UNITS = [
  { id: 'fractions', title: 'Fractions', lessons: ['Equal parts', 'Comparing'] },
  { id: 'decimals', title: 'Decimals', lessons: ['Tenths'] },
];

export const SEED_EVENTS: PlannerEvent[] = [
  { id: 'term', title: 'Term 4', date: '2026-10-01', endDate: '2026-11-06', kind: 'term', source: 'template', audience: 'all' },
  { id: 'deepavali', title: 'Deepavali', date: '2026-10-19', kind: 'holiday', source: 'template', audience: 'all' },
  { id: 'exams', title: 'Exam week', date: '2026-10-26', endDate: '2026-10-30', kind: 'exam', source: 'template', audience: 'all' },
  { id: 'ptm', title: 'Parent meeting', date: '2026-11-05', kind: 'ptm', source: 'manual', audience: 'parents', campusId: 'north', classId: '4A', yearGroup: 'Primary' },
  { id: 'south', title: 'South campus sports', date: '2026-10-16', kind: 'event', source: 'manual', audience: 'all', campusId: 'south' },
  { id: 'period', title: 'P1 Fractions', date: '2026-10-05', kind: 'period', source: 'manual', audience: 'students', classId: '4A', yearGroup: 'Primary', campusId: 'north', recurrence: 'weekly', period: '08:30–09:10' },
  { id: 'report', title: 'Report cards', date: '2026-10-30', kind: 'report', source: 'manual', audience: 'all', campusId: 'north' },
];

export function seedPlan(): YearPlan {
  return {
    id: 'school-a-2026',
    institutionId: 'school-a',
    label: '2026 year',
    brand: 'North Campus Academy',
    visibility: 'school',
    ownerId: 'instadmin1',
    ownerRole: 'institution',
    subscribeToken: 'cal_school_a',
    events: SEED_EVENTS,
  };
}

const north = { campusId: 'north', classId: '4A', yearGroup: 'Primary' };

export function seedChecks(side: 'institution' | 'teacher' | 'parent' | 'student') {
  const plan = seedPlan();
  const days = teachingDays('2026-10-01', '2026-11-06', plan.events);
  const pacing = replan(SEED_UNITS, '2026-10-01', '2026-11-06', plan.events);
  const moved = plan.events.map(event => event.id === 'deepavali' ? { ...event, date: '2026-10-12' } : event);
  const shifted = replan(SEED_UNITS, '2026-10-01', '2026-11-06', moved);
  const goals = revisionGoalDrafts('Exam week', '2026-10-26', ['Fractions', 'Decimals', 'Percent'], plan.events);
  const viewer = side === 'institution'
    ? eventsForViewer(plan.events, { role: 'institution' })
    : eventsForViewer(plan.events, { role: side, ...north });
  const personal = personalCopy(plan, 'teacher1', 'teacher');
  const milestones = milestoneDates('2026-11-06');
  const term = termWindow(plan.events, '2026-10-15');
  const ics = toIcs(plan);
  return [
    { label: 'Brand', actual: brandedTitle(plan.brand), expected: 'North Campus Academy calendar' },
    { label: 'Holiday absence', actual: absenceCounts('2026-10-19', plan.events), expected: false },
    { label: 'School day', actual: absenceCounts('2026-10-20', plan.events), expected: true },
    { label: 'Exam absence', actual: absenceCounts('2026-10-27', plan.events), expected: false },
    { label: 'Deepavali off the grid', actual: days.includes('2026-10-19'), expected: false },
    { label: 'Exam Monday off', actual: days.includes('2026-10-26'), expected: false },
    { label: 'First lesson', actual: pacing[0]?.date ?? '', expected: '2026-10-01' },
    { label: 'Lessons', actual: pacing.length, expected: 3 },
    { label: 'Replan moves', actual: pacing.some((row, index) => row.date !== shifted[index]?.date), expected: true },
    { label: 'Revision', actual: goals.length, expected: 3 },
    { label: 'Revision skips holiday', actual: goals.some(goal => goal.dateKey === '2026-10-19'), expected: false },
    { label: 'Term', actual: term?.title ?? '', expected: 'Term 4' },
    { label: 'Assessment', actual: milestones.assessment, expected: '2026-10-23' },
    { label: 'Report date', actual: milestones.report, expected: '2026-10-30' },
    { label: 'ICS', actual: ics.includes('DTSTART;VALUE=DATE:20261019') && ics.includes('North Campus Academy calendar'), expected: true },
    { label: 'Periods', actual: expandWeekly(plan.events.find(event => event.id === 'period')!, '2026-10-19').length, expected: 3 },
    { label: 'Reminders', actual: upcomingReminders(plan.events, '2026-10-24', 7).some(row => row.kind === 'exam'), expected: true },
    { label: 'Change note', actual: changeNotice(plan.events, moved)[0]?.title ?? '', expected: 'Calendar date moved' },
    { label: 'South hidden', actual: viewer.some(event => event.id === 'south'), expected: side === 'institution' },
    { label: 'PTM', actual: viewer.some(event => event.id === 'ptm'), expected: side !== 'student' },
    { label: 'Personal', actual: personal.visibility, expected: 'personal' },
  ];
}

export function seedPacing() {
  return paceCurriculum(SEED_UNITS, teachingDays('2026-10-01', '2026-11-06', seedPlan().events));
}
