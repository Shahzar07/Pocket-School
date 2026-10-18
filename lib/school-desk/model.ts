/**
 * One class record for assignments, the gradebook, goals, and reports.
 * A signed-in teacher reads and writes Firestore. The Rochford fixture is
 * only a demo desk or a seed, never the live source.
 */

export const LEVELS = ['Primary', 'Lower Secondary', 'IGCSE', 'A-Level'] as const;
export type LevelName = (typeof LEVELS)[number];

export type ScaleId = 'igcse_9_1' | 'astar_g' | 'percent' | 'points' | 'pass_fail' | 'custom';
export type AssessmentKind = 'assignment' | 'test' | 'quiz' | 'exam' | 'coursework' | 'lesson_quiz';
export type MarkFlag = 'none' | 'missing' | 'late' | 'excused';
export type MarkState = 'draft' | 'published';
export type JoinMethod = 'roster' | 'csv' | 'invite' | 'qr' | 'code';
export type AttStatus = 'present' | 'late' | 'absent' | 'excused';
/** `self` matches older `student`. `et_ai` matches older `ai`. `institution` is this desk. */
export type GoalSource = 'self' | 'student' | 'et_ai' | 'ai' | 'teacher' | 'parent' | 'institution';
export type GoalSourceGroup = 'self' | 'et_ai' | 'teacher' | 'parent' | 'institution';
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';
export type DeskRole = 'teacher' | 'institution_admin' | 'student' | 'parent';

export interface GradeBand {
  min: number;
  grade: string;
}

export const SCALE_BANDS: Record<Exclude<ScaleId, 'percent' | 'points' | 'pass_fail' | 'custom'>, GradeBand[]> = {
  igcse_9_1: [
    { min: 90, grade: '9' }, { min: 80, grade: '8' }, { min: 70, grade: '7' },
    { min: 60, grade: '6' }, { min: 50, grade: '5' }, { min: 40, grade: '4' },
    { min: 30, grade: '3' }, { min: 20, grade: '2' }, { min: 0, grade: '1' },
  ],
  astar_g: [
    { min: 90, grade: 'A*' }, { min: 80, grade: 'A' }, { min: 70, grade: 'B' },
    { min: 60, grade: 'C' }, { min: 50, grade: 'D' }, { min: 40, grade: 'E' },
    { min: 30, grade: 'F' }, { min: 20, grade: 'G' }, { min: 0, grade: 'U' },
  ],
};

export const SCALE_LABEL: Record<ScaleId, string> = {
  igcse_9_1: 'IGCSE 9–1',
  astar_g: 'A*–G',
  percent: 'Percentage',
  points: 'Points',
  pass_fail: 'Pass / fail',
  custom: 'School scale',
};

export interface SchoolInstitution {
  id: string;
  name: string;
  campus: string;
  kind: 'school' | 'independent';
  defaultScale: ScaleId;
  customBands: GradeBand[];
  teachersCanCreateClasses: boolean;
  demo: boolean;
  branding: string;
}

export interface SchoolClass {
  id: string;
  institutionId: string;
  name: string;
  subject: string;
  level: LevelName;
  programme: string;
  term: string;
  campus: string;
  room: string;
  timetable: string;
  coTeachers: string[];
  capacity: number;
  status: 'active' | 'archived';
  joinCode: string;
  ownerTeacherId: string;
  ownerTeacherName: string;
  createdByRole: 'institution_admin' | 'teacher';
  announcements: string[];
}

export interface Enrolment {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  status: 'active' | 'pending';
  joinMethod: JoinMethod;
  under18: boolean;
  institutionMember: boolean;
  holdReason: string;
}

export interface RubricRow {
  criterion: string;
  points: number;
}

export interface LatePolicy {
  allow: boolean;
  penaltyPercentPerDay: number;
  cutoffDays: number;
}

export interface Assessment {
  id: string;
  classId: string;
  title: string;
  kind: AssessmentKind;
  scaleId: ScaleId;
  maxPoints: number;
  weight: number;
  category: string;
  dueAt: string;
  instructions: string;
  attachments: string[];
  rubric: RubricRow[];
  latePolicy: LatePolicy;
  lessonLabel: string;
  status: 'draft' | 'published';
  studentIds: string[];
}

export interface AiSuggestion {
  points: number;
  feedback: string;
  approved: boolean;
}

export interface SubmissionRow {
  id: string;
  assessmentId: string;
  studentId: string;
  studentName: string;
  body: string;
  submittedAt: string;
  status: 'submitted' | 'returned';
  suggestion: AiSuggestion | null;
}

export interface Mark {
  id: string;
  assessmentId: string;
  classId: string;
  studentId: string;
  points: number | null;
  flag: MarkFlag;
  comment: string;
  state: MarkState;
  enteredBy: string;
  updatedAt: string;
}

export interface AttendanceRow {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  session: string;
  status: AttStatus;
  reason: string;
  source: 'manual' | 'login' | 'live';
  activeMinutes: number;
  parentNote: string;
}

export interface GoalMove {
  at: string;
  fromDate: string;
  toDate: string;
  fromTime?: string;
  toTime?: string;
  by: string;
}

export interface AssignedGoal {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  title: string;
  source: GoalSource;
  assignedBy: string;
  assignedByName: string;
  due: string;
  dueTime: string;
  dueDateKey: string;
  status: GoalStatus;
  topic: string;
  focusMinutes: number;
  rescheduleCount: number;
  rescheduleLimit: number;
  rescheduleLog: GoalMove[];
  private: boolean;
  parentVisibility: boolean;
  shareWithTeachers: boolean;
  teacherIds: string[];
  mirrorId?: string;
}

export interface Merit {
  id: string;
  studentId: string;
  classId: string;
  note: string;
  points: number;
}

export interface ReportCard {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  term: string;
  level: string;
  subjectComment: string;
  formComment: string;
  principalComment: string;
  status: 'draft' | 'published';
  token: string;
  acknowledgement: 'pending' | 'acknowledged';
  effort: number;
}

export interface DeskNotice {
  id: string;
  audience: 'student' | 'parent';
  studentId: string;
  title: string;
  body: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}

export interface EarningRow {
  id: string;
  month: string;
  date: string;
  source: 'course' | 'live' | 'institution' | 'share';
  label: string;
  gross: number;
  split: number;
  fee: number;
  refund: number;
  status: 'pending' | 'available' | 'paid';
  sample: true;
}

export interface PayoutEvent {
  id: string;
  date: string;
  amount: number;
  status: 'scheduled' | 'paid';
  note: string;
}

export interface FlowRecord {
  id: string;
  flow: string;
  classId: string;
  studentId: string;
  studentName: string;
  title: string;
  detail: string;
  status: string;
  when: string;
}

export interface DeskState {
  seq: number;
  actorId: string;
  actorName: string;
  institution: SchoolInstitution;
  classes: SchoolClass[];
  enrolments: Enrolment[];
  assessments: Assessment[];
  submissions: SubmissionRow[];
  marks: Mark[];
  attendance: AttendanceRow[];
  goals: AssignedGoal[];
  merits: Merit[];
  reports: ReportCard[];
  notices: DeskNotice[];
  audit: AuditEntry[];
  earnings: EarningRow[];
  payouts: PayoutEvent[];
  payout: { schedule: string; method: string; tin: string; invoice: string; sst: string };
  flows: FlowRecord[];
}

const STORAGE_KEY = 'poket-school-desk-rochford-v3';

export function bandGrade(percent: number, bands: GradeBand[]): string {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const hit = sorted.find((band) => percent >= band.min);
  return hit?.grade ?? sorted[sorted.length - 1]?.grade ?? '—';
}

export function gradeOnScale(percent: number, scale: ScaleId, custom: GradeBand[] = []): string {
  if (!Number.isFinite(percent)) return '—';
  const rounded = Math.max(0, Math.min(100, percent));
  if (scale === 'percent') return `${Math.round(rounded)}%`;
  if (scale === 'points') return `${Math.round(rounded)}%`;
  if (scale === 'pass_fail') return rounded >= 40 ? 'Pass' : 'Fail';
  if (scale === 'custom') return bandGrade(rounded, custom.length ? custom : [{ min: 0, grade: '—' }]);
  return bandGrade(rounded, SCALE_BANDS[scale]);
}

/** 9–1, A*–G, and a percentage, shown together wherever a class grade appears. */
export function gradeSetLabel(percent: number): string {
  if (!Number.isFinite(percent)) return '—';
  return `${gradeOnScale(percent, 'igcse_9_1')} on 9–1 · ${gradeOnScale(percent, 'astar_g')} on A*–G · ${gradeOnScale(percent, 'percent')}`;
}

export function displayMark(points: number | null, max: number, scale: ScaleId, custom: GradeBand[]): string {
  if (points == null || !Number.isFinite(points)) return '—';
  const percent = max > 0 ? (points / max) * 100 : 0;
  const scales = gradeSetLabel(percent);
  if (scale === 'points') return `${points}/${max} · ${scales}`;
  return `${gradeOnScale(percent, scale, custom)} · ${scales}`;
}

export function suggestMark(body: string, maxPoints: number): AiSuggestion {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const ratio = Math.min(1, words / 80);
  const points = Math.max(0, Math.min(maxPoints, Math.round(maxPoints * (0.55 + 0.35 * ratio))));
  return {
    points,
    feedback: `ET AI draft: about ${words} words. Suggested ${points} of ${maxPoints}. This is not a grade until you approve it.`,
    approved: false,
  };
}

export function applyLatePenalty(points: number, max: number, policy: LatePolicy, daysLate: number): number {
  if (!policy.allow || daysLate <= 0) return points;
  if (daysLate > policy.cutoffDays) return 0;
  const next = points * (1 - (policy.penaltyPercentPerDay / 100) * daysLate);
  return Math.max(0, Math.min(max, Math.round(next)));
}

export function goalSourceGroup(source: GoalSource): GoalSourceGroup {
  if (source === 'student' || source === 'self') return 'self';
  if (source === 'ai' || source === 'et_ai') return 'et_ai';
  return source;
}

function ownsSelfGoal(goal: AssignedGoal, actorId: string): boolean {
  return goalSourceGroup(goal.source) === 'self' && goal.assignedBy === actorId;
}

export function canDeleteGoal(goal: AssignedGoal, actorId: string, role: DeskRole): boolean {
  if (role === 'student' || role === 'parent') return ownsSelfGoal(goal, actorId);
  if (goal.source === 'teacher') return goal.assignedBy === actorId || role === 'institution_admin';
  if (goal.source === 'institution') return role === 'institution_admin';
  return false;
}

export function canEditGoal(goal: AssignedGoal, actorId: string, role: DeskRole): boolean {
  return canDeleteGoal(goal, actorId, role);
}

type GoalWrite = Omit<AssignedGoal, 'dueTime' | 'dueDateKey' | 'focusMinutes' | 'rescheduleCount' | 'rescheduleLimit' | 'rescheduleLog' | 'private' | 'parentVisibility' | 'shareWithTeachers' | 'teacherIds' | 'mirrorId' | 'status'> & Partial<Pick<AssignedGoal, 'dueTime' | 'dueDateKey' | 'focusMinutes' | 'rescheduleCount' | 'rescheduleLimit' | 'rescheduleLog' | 'private' | 'parentVisibility' | 'shareWithTeachers' | 'teacherIds' | 'mirrorId' | 'status'>>;

export function goalRecord(input: GoalWrite): AssignedGoal {
  return {
    id: input.id,
    studentId: input.studentId,
    studentName: input.studentName,
    classId: input.classId,
    title: input.title,
    source: input.source,
    assignedBy: input.assignedBy,
    assignedByName: input.assignedByName,
    due: input.due,
    dueTime: input.dueTime || '16:00',
    dueDateKey: input.dueDateKey || input.due,
    status: input.status ?? 'not_started',
    topic: input.topic,
    focusMinutes: input.focusMinutes ?? 0,
    rescheduleCount: input.rescheduleCount ?? 0,
    rescheduleLimit: input.rescheduleLimit ?? 3,
    rescheduleLog: input.rescheduleLog ?? [],
    private: input.private ?? false,
    parentVisibility: input.parentVisibility ?? true,
    shareWithTeachers: input.shareWithTeachers ?? true,
    teacherIds: input.teacherIds?.length
      ? input.teacherIds
      : input.source === 'teacher' && input.assignedBy
        ? [input.assignedBy]
        : ['teacher-aisha'],
    mirrorId: input.mirrorId ?? input.id,
  };
}

export function goalsForRoster(state: DeskState, classId: string): AssignedGoal[] {
  const ids = new Set(roster(state, classId).map((row) => row.studentId));
  return state.goals.filter((goal) => ids.has(goal.studentId) && goal.private !== true);
}

export function canCreateClass(state: DeskState, role: DeskRole): boolean {
  if (role === 'institution_admin') return true;
  if (state.institution.kind === 'independent') return true;
  return state.institution.teachersCanCreateClasses;
}

function stamp(state: DeskState, actor: string, action: string, target: string): DeskState {
  const seq = state.seq + 1;
  return {
    ...state,
    seq,
    audit: [{ id: `aud-${seq}`, at: '2026-10-18T09:00:00.000Z', actor, action, target }, ...state.audit].slice(0, 40),
  };
}

function id(state: DeskState, prefix: string): { state: DeskState; id: string } {
  const seq = state.seq + 1;
  return { state: { ...state, seq }, id: `${prefix}-${seq}` };
}

export function termResult(state: DeskState, classId: string, studentId: string): { percent: number; grade: string; weight: number } {
  const assessments = state.assessments.filter((item) => item.classId === classId && item.status === 'published');
  let weighted = 0;
  let weight = 0;
  for (const assessment of assessments) {
    const mark = state.marks.find((item) => item.assessmentId === assessment.id && item.studentId === studentId);
    if (!mark || mark.points == null || mark.flag === 'excused' || mark.flag === 'missing') continue;
    const percent = assessment.maxPoints > 0 ? (mark.points / assessment.maxPoints) * 100 : 0;
    weighted += percent * assessment.weight;
    weight += assessment.weight;
  }
  const percent = weight ? Math.round(weighted / weight) : 0;
  return {
    percent,
    grade: gradeOnScale(percent, state.institution.defaultScale, state.institution.customBands),
    weight,
  };
}

export function attendanceRate(rows: AttendanceRow[]): number {
  const counted = rows.filter((row) => row.status !== 'excused');
  if (!counted.length) return 100;
  const present = counted.filter((row) => row.status === 'present' || row.status === 'late').length;
  return Math.round((present / counted.length) * 100);
}

export function roster(state: DeskState, classId: string): Enrolment[] {
  return state.enrolments.filter((item) => item.classId === classId);
}

export function setMark(
  state: DeskState,
  input: { assessmentId: string; studentId: string; points: number | null; flag: MarkFlag; comment: string; state: MarkState; actor: string },
): DeskState {
  const assessment = state.assessments.find((item) => item.id === input.assessmentId);
  if (!assessment) return state;
  const existing = state.marks.find((item) => item.assessmentId === input.assessmentId && item.studentId === input.studentId);
  const nextMark: Mark = {
    id: existing?.id ?? `mark-new-${input.assessmentId}-${input.studentId}`,
    assessmentId: input.assessmentId,
    classId: assessment.classId,
    studentId: input.studentId,
    points: input.points,
    flag: input.flag,
    comment: input.comment,
    state: input.state,
    enteredBy: input.actor,
    updatedAt: '2026-10-18',
  };
  const marks = existing
    ? state.marks.map((item) => (item.id === existing.id ? nextMark : item))
    : [...state.marks, nextMark];
  let next = stamp({ ...state, marks }, input.actor, input.state === 'published' ? 'publish mark' : 'save draft mark', assessment.title);
  if (input.state === 'published') {
    const percent = input.points == null || assessment.maxPoints === 0 ? 100 : (input.points / assessment.maxPoints) * 100;
    const notices = [
      { id: `note-${next.seq}-s`, audience: 'student' as const, studentId: input.studentId, title: 'Grade published', body: `${assessment.title} is on your gradebook.` },
      { id: `note-${next.seq}-p`, audience: 'parent' as const, studentId: input.studentId, title: 'Grade published', body: `${assessment.title} was published to the family.` },
      ...next.notices,
    ];
    next = { ...next, notices };
    if (percent < 45 && input.flag !== 'excused') {
      const topic = assessment.title;
      const already = next.goals.some((goal) => goal.studentId === input.studentId && goal.topic === topic && goal.source === 'teacher');
      if (!already) {
        const made = id(next, 'goal');
        const student = next.enrolments.find((item) => item.studentId === input.studentId);
        next = {
          ...made.state,
          goals: [...made.state.goals, goalRecord({
            id: made.id,
            studentId: input.studentId,
            studentName: student?.studentName ?? 'Student',
            classId: assessment.classId,
            title: `Revise ${topic}`,
            source: 'teacher',
            assignedBy: input.actor,
            assignedByName: made.state.actorName,
            due: '2026-10-25',
            dueTime: '16:00',
            status: 'not_started',
            topic,
          })],
        };
      }
    }
  }
  return next;
}

export function publishAllDrafts(state: DeskState, classId: string, actor: string): DeskState {
  let next = state;
  for (const mark of state.marks.filter((item) => item.classId === classId && item.state === 'draft' && item.points != null)) {
    next = setMark(next, { ...mark, actor, state: 'published' });
  }
  return next;
}

export function importMarks(state: DeskState, csv: string, actor: string): { state: DeskState; imported: number; error: string } {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { state, imported: 0, error: 'Add a header and at least one row.' };
  const header = lines[0].toLowerCase();
  if (!header.includes('student') || !header.includes('assessment')) {
    return { state, imported: 0, error: 'Use columns student, assessment, points, flag, comment.' };
  }
  let next = state;
  let imported = 0;
  for (const line of lines.slice(1)) {
    const [studentName, title, points, flag, comment] = line.split(',').map((part) => part.trim());
    const student = next.enrolments.find((item) => item.studentName.toLowerCase() === studentName.toLowerCase());
    const assessment = next.assessments.find((item) => item.title.toLowerCase() === title.toLowerCase());
    if (!student || !assessment) continue;
    const parsed = points === '' ? null : Number(points);
    const safeFlag: MarkFlag = flag === 'missing' || flag === 'late' || flag === 'excused' ? flag : 'none';
    next = setMark(next, {
      assessmentId: assessment.id,
      studentId: student.studentId,
      points: parsed != null && Number.isFinite(parsed) ? parsed : null,
      flag: safeFlag,
      comment: comment ?? '',
      state: 'draft',
      actor,
    });
    imported += 1;
  }
  return { state: next, imported, error: imported ? '' : 'No rows matched a student and an assessment.' };
}

export function marksCsv(state: DeskState, classId: string): string {
  const lines = ['student,assessment,points,max,scale,flag,state,comment'];
  for (const mark of state.marks.filter((item) => item.classId === classId)) {
    const student = state.enrolments.find((item) => item.studentId === mark.studentId);
    const assessment = state.assessments.find((item) => item.id === mark.assessmentId);
    if (!student || !assessment) continue;
    lines.push([student.studentName, assessment.title, mark.points ?? '', assessment.maxPoints, assessment.scaleId, mark.flag, mark.state, mark.comment].join(','));
  }
  return lines.join('\n');
}

export function createAssessment(
  state: DeskState,
  input: Omit<Assessment, 'id' | 'status'> & { status?: Assessment['status'] },
  actor: string,
): DeskState {
  const made = id(state, 'assess');
  const assessment: Assessment = { ...input, id: made.id, status: input.status ?? 'published' };
  return stamp({ ...made.state, assessments: [...made.state.assessments, assessment] }, actor, 'create assessment', assessment.title);
}

export function submitWork(state: DeskState, assessmentId: string, studentId: string, body: string): DeskState {
  const assessment = state.assessments.find((item) => item.id === assessmentId);
  const student = state.enrolments.find((item) => item.studentId === studentId);
  if (!assessment || !student || student.status !== 'active') return state;
  const made = id(state, 'sub');
  const row: SubmissionRow = {
    id: made.id,
    assessmentId,
    studentId,
    studentName: student.studentName,
    body,
    submittedAt: '2026-10-18T08:40:00.000Z',
    status: 'submitted',
    suggestion: suggestMark(body, assessment.maxPoints),
  };
  return stamp({ ...made.state, submissions: [row, ...made.state.submissions] }, student.studentName, 'submit', assessment.title);
}

export function approveSuggestion(state: DeskState, submissionId: string): DeskState {
  return {
    ...state,
    submissions: state.submissions.map((item) => (
      item.id === submissionId && item.suggestion
        ? { ...item, suggestion: { ...item.suggestion, approved: true } }
        : item
    )),
  };
}

export function returnSubmission(state: DeskState, submissionId: string, actor: string, feedback: string): DeskState {
  const submission = state.submissions.find((item) => item.id === submissionId);
  if (!submission?.suggestion?.approved) return state;
  const assessment = state.assessments.find((item) => item.id === submission.assessmentId);
  if (!assessment) return state;
  const due = new Date(assessment.dueAt).getTime();
  const sent = new Date(submission.submittedAt).getTime();
  const daysLate = sent > due ? Math.ceil((sent - due) / 86_400_000) : 0;
  const points = applyLatePenalty(submission.suggestion.points, assessment.maxPoints, assessment.latePolicy, daysLate);
  const flagged: MarkFlag = daysLate > 0 ? 'late' : 'none';
  let next = setMark(state, {
    assessmentId: assessment.id,
    studentId: submission.studentId,
    points,
    flag: flagged,
    comment: feedback || submission.suggestion.feedback,
    state: 'published',
    actor,
  });
  next = {
    ...next,
    submissions: next.submissions.map((item) => (item.id === submissionId ? { ...item, status: 'returned' } : item)),
  };
  return stamp(next, actor, 'return work', assessment.title);
}

export function createClass(
  state: DeskState,
  input: Omit<SchoolClass, 'id' | 'institutionId' | 'status' | 'announcements' | 'joinCode'>,
  role: DeskRole,
): { state: DeskState; error: string } {
  if (!canCreateClass(state, role)) {
    return { state, error: 'This school asks an institution admin to create classes. Teachers can create one only when the school allows it.' };
  }
  if (!LEVELS.includes(input.level)) return { state, error: 'Choose a level name.' };
  const made = id(state, 'class');
  const klass: SchoolClass = {
    ...input,
    id: made.id,
    institutionId: state.institution.id,
    status: 'active',
    announcements: [],
    joinCode: `JOIN-${made.id.slice(-4).toUpperCase()}`,
  };
  return { state: stamp({ ...made.state, classes: [...made.state.classes, klass] }, input.ownerTeacherName, 'create class', klass.name), error: '' };
}

export function updateClass(state: DeskState, classId: string, patch: Partial<SchoolClass>, actor: string): DeskState {
  return stamp({
    ...state,
    classes: state.classes.map((item) => (item.id === classId ? { ...item, ...patch, id: item.id } : item)),
  }, actor, patch.status === 'archived' ? 'archive class' : 'edit class', classId);
}

export function setTeachingMode(state: DeskState, mode: 'school' | 'independent'): DeskState {
  if (mode === 'school' && state.institution.demo) {
    return stamp({ ...state, institution: createDemoDesk().institution }, state.actorName, 'school classes', state.institution.name);
  }
  const institution: SchoolInstitution = mode === 'school'
    ? { ...state.institution, kind: 'school', teachersCanCreateClasses: true, demo: state.institution.demo }
    : {
      ...state.institution,
      id: state.institution.demo ? 'independent' : '',
      name: 'Independent teaching',
      campus: 'Online',
      kind: 'independent',
      teachersCanCreateClasses: true,
      demo: state.institution.demo,
      branding: 'No school attached',
    };
  return stamp({ ...state, institution }, state.actorName, mode === 'school' ? 'school classes' : 'independent classes', institution.name);
}

/** A teacher user id has no spaces. A display name stays on the class and the signed-in admin owns the record. */
function classOwner(teacher: string, state: DeskState): { ownerTeacherId: string; ownerTeacherName: string } {
  const name = teacher.trim();
  if (!name) return { ownerTeacherId: state.actorId, ownerTeacherName: state.actorName };
  if (!/\s/.test(name)) return { ownerTeacherId: name, ownerTeacherName: name };
  return { ownerTeacherId: state.actorId, ownerTeacherName: name };
}

export function bulkCreateClasses(state: DeskState, csv: string): { state: DeskState; created: number; error: string } {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { state, created: 0, error: 'Add a header and one class.' };
  let next = state;
  let created = 0;
  for (const line of lines.slice(1)) {
    const [name, subject, level, programme, term, campus, room, timetable, teacher, capacity] = line.split(',').map((part) => part.trim());
    if (!name || !LEVELS.includes(level as LevelName)) continue;
    const owner = classOwner(teacher || '', next);
    const result = createClass(next, {
      name,
      subject: subject || name,
      level: level as LevelName,
      programme: programme || 'Cambridge',
      term: term || 'Term 1',
      campus: campus || state.institution.campus,
      room: room || 'TBC',
      timetable: timetable || 'To be set',
      coTeachers: [],
      capacity: Number(capacity) || 20,
      ownerTeacherId: owner.ownerTeacherId,
      ownerTeacherName: owner.ownerTeacherName,
      createdByRole: 'institution_admin',
    }, 'institution_admin');
    if (!result.error) {
      next = result.state;
      created += 1;
    }
  }
  return { state: next, created, error: created ? '' : 'No class rows matched. Use a level name such as IGCSE.' };
}

export function earningNet(row: EarningRow): number {
  return row.split - row.fee - row.refund;
}

export function refundEarning(state: DeskState, earningId: string, amount: number, actor: string): DeskState {
  return stamp({
    ...state,
    earnings: state.earnings.map((row) => (
      row.id === earningId ? { ...row, refund: row.refund + amount } : row
    )),
  }, actor, 'record refund', earningId);
}

export function addFlow(
  state: DeskState,
  input: Omit<FlowRecord, 'id'>,
  actor: string,
): DeskState {
  const made = id(state, 'flow');
  let next: DeskState = stamp({
    ...made.state,
    flows: [{ ...input, id: made.id }, ...made.state.flows],
  }, actor, `create ${input.flow}`, input.title);
  if (input.flow === 'exam') {
    next = createAssessment(next, {
      classId: input.classId,
      title: input.title,
      kind: 'exam',
      scaleId: next.institution.defaultScale,
      maxPoints: 80,
      weight: 20,
      category: 'Exams',
      dueAt: `${input.when || '2026-10-28'}T09:00:00.000Z`,
      instructions: input.detail,
      attachments: [],
      rubric: [{ criterion: 'Paper', points: 80 }],
      latePolicy: { allow: false, penaltyPercentPerDay: 0, cutoffDays: 0 },
      lessonLabel: input.title,
      studentIds: input.studentId ? [input.studentId] : [],
      status: 'published',
    }, actor);
  }
  if ((input.flow === 'merit' || input.flow === 'behaviour') && input.studentId) {
    const merit = id(next, 'merit');
    next = {
      ...merit.state,
      merits: [...merit.state.merits, {
        id: merit.id,
        studentId: input.studentId,
        classId: input.classId,
        note: input.title,
        points: 1,
      }],
    };
  }
  if (input.flow === 'live' && input.studentId) {
    next = saveAttendance(next, [{
      classId: input.classId,
      studentId: input.studentId,
      date: (input.when || '2026-10-18').slice(0, 10),
      session: 'live',
      status: 'present',
      reason: input.title,
      source: 'live',
      activeMinutes: 40,
      parentNote: '',
    }], actor);
  }
  if (input.flow === 'approval' && input.title) {
    next = addEnrolment(next, {
      classId: input.classId,
      studentName: input.studentName || input.title,
      under18: true,
      institutionMember: true,
      joinMethod: 'invite',
    }, actor);
  }
  return next;
}

export function updateFlow(state: DeskState, flowId: string, patch: Partial<FlowRecord>, actor: string): DeskState {
  return stamp({
    ...state,
    flows: state.flows.map((item) => (item.id === flowId ? { ...item, ...patch, id: item.id } : item)),
  }, actor, 'update record', flowId);
}

export function addEnrolment(
  state: DeskState,
  input: { classId: string; studentName: string; under18: boolean; institutionMember: boolean; joinMethod: JoinMethod; studentId?: string },
  actor: string,
): DeskState {
  const made = id(state, 'enrol');
  const school = state.institution.kind === 'school';
  const blocked = input.under18 && school && !input.institutionMember;
  const recordId = input.studentId?.trim() || '';
  const row: Enrolment = {
    id: made.id,
    classId: input.classId,
    studentId: recordId || `stu-${made.id}`,
    studentName: input.studentName,
    status: blocked ? 'pending' : 'pending',
    joinMethod: input.joinMethod,
    under18: input.under18,
    institutionMember: input.institutionMember,
    holdReason: blocked ? 'Under 18s join only as members of the school.' : 'Waiting for the teacher or the school to approve.',
  };
  return stamp({ ...made.state, enrolments: [...made.state.enrolments, row] }, actor, 'join request', input.studentName);
}

export function approveEnrolment(state: DeskState, enrolmentId: string, actor: string): DeskState {
  return stamp({
    ...state,
    enrolments: state.enrolments.map((item) => {
      if (item.id !== enrolmentId) return item;
      if (item.under18 && state.institution.kind === 'school' && !item.institutionMember) return item;
      return { ...item, status: 'active', holdReason: '' };
    }),
  }, actor, 'approve join', enrolmentId);
}

export function importRoster(state: DeskState, classId: string, csv: string, actor: string): DeskState {
  let next = state;
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [name, under, member] = line.split(',').map((part) => part.trim());
    if (!name) continue;
    next = addEnrolment(next, {
      classId,
      studentName: name,
      under18: under !== 'no',
      institutionMember: member !== 'no',
      joinMethod: 'csv',
    }, actor);
  }
  return next;
}

export function saveAttendance(
  state: DeskState,
  rows: Array<Omit<AttendanceRow, 'id' | 'source'> & { source?: AttendanceRow['source'] }>,
  actor: string,
): DeskState {
  let next = state;
  for (const row of rows) {
    const existing = next.attendance.find((item) => item.classId === row.classId && item.studentId === row.studentId && item.date === row.date && item.session === row.session);
    const made = existing ? { state: next, id: existing.id } : id(next, 'att');
    const stored: AttendanceRow = {
      id: made.id,
      classId: row.classId,
      studentId: row.studentId,
      date: row.date,
      session: row.session,
      status: row.status,
      reason: row.reason,
      source: row.source ?? 'manual',
      activeMinutes: row.activeMinutes,
      parentNote: row.parentNote,
    };
    const attendance = existing
      ? made.state.attendance.map((item) => (item.id === existing.id ? stored : item))
      : [...made.state.attendance, stored];
    next = { ...made.state, attendance };
    if (stored.status === 'absent' || stored.status === 'late') {
      next = {
        ...next,
        notices: [{
          id: `att-note-${stored.id}`,
          audience: 'parent',
          studentId: stored.studentId,
          title: stored.status === 'late' ? 'Late to class' : 'Absent from class',
          body: `${stored.date} ${stored.session}. ${stored.reason || 'No reason yet.'}`,
        }, ...next.notices.filter((item) => item.id !== `att-note-${stored.id}`)],
      };
    }
  }
  return stamp(next, actor, 'save register', rows[0]?.date ?? '');
}

export function autoAttendance(state: DeskState, classId: string, date: string, actor: string): DeskState {
  const active = roster(state, classId).filter((item) => item.status === 'active');
  return saveAttendance(state, active.map((item, index) => ({
    classId,
    studentId: item.studentId,
    date,
    session: 'Live',
    status: index === 2 ? 'absent' : 'present',
    reason: index === 2 ? 'No login in the live session' : 'Login during the live session',
    source: 'live',
    activeMinutes: index === 2 ? 0 : 42,
    parentNote: '',
  })), actor);
}

export function upsertGoal(
  state: DeskState,
  input: Omit<GoalWrite, 'id'> & { id?: string },
  actor: string,
  access?: { actorId: string; role: DeskRole },
): DeskState {
  if (input.id) {
    const existing = state.goals.find((item) => item.id === input.id);
    const actorId = access?.actorId ?? state.actorId;
    const role = access?.role ?? 'teacher';
    if (!existing || !canEditGoal(existing, actorId, role)) return state;
    const nextGoal = goalRecord({ ...existing, ...input, id: existing.id });
    return stamp({
      ...state,
      goals: state.goals.map((item) => (item.id === existing.id ? nextGoal : item)),
    }, actor, 'edit goal', nextGoal.title);
  }
  const made = id(state, 'goal');
  const goal = goalRecord({ ...input, id: made.id });
  return stamp({ ...made.state, goals: [...made.state.goals, goal] }, actor, 'assign goal', goal.title);
}

export function deleteGoal(state: DeskState, goalId: string, actorId: string, role: DeskRole): { state: DeskState; error: string } {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return { state, error: 'Goal not found.' };
  if (!canDeleteGoal(goal, actorId, role)) {
    return { state, error: 'This goal can only be changed by the person or school that assigned it.' };
  }
  return { state: stamp({ ...state, goals: state.goals.filter((item) => item.id !== goalId) }, actorId, 'delete goal', goal.title), error: '' };
}

export function bulkGoals(state: DeskState, classId: string, title: string, due: string, actorId: string, actorName: string, source: GoalSource = 'teacher'): DeskState {
  let next = state;
  for (const student of roster(state, classId).filter((item) => item.status === 'active')) {
    next = upsertGoal(next, {
      studentId: student.studentId,
      studentName: student.studentName,
      classId,
      title,
      source,
      assignedBy: actorId,
      assignedByName: actorName,
      due,
      topic: title,
    }, actorName);
  }
  return next;
}

export function draftReportComment(name: string, subject: string, grade: string, attendance: number, goalsDone: number, goalsTotal: number): string {
  return `${name} is working at ${grade} in ${subject}. Attendance is ${attendance}%. ${goalsDone} of ${goalsTotal} goals are complete. ET AI drafted this comment for the teacher to edit.`;
}

export function buildReport(state: DeskState, classId: string, studentId: string): ReportCard | null {
  const student = state.enrolments.find((item) => item.studentId === studentId && item.classId === classId);
  const klass = state.classes.find((item) => item.id === classId);
  if (!student || !klass) return null;
  const existing = state.reports.find((item) => item.classId === classId && item.studentId === studentId);
  const result = termResult(state, classId, studentId);
  const rate = attendanceRate(state.attendance.filter((item) => item.studentId === studentId && item.classId === classId));
  const goals = state.goals.filter((item) => item.studentId === studentId && item.classId === classId);
  const done = goals.filter((item) => item.status === 'completed').length;
  const effort = Math.max(1, Math.min(5, Math.round((rate / 100) * 5)));
  return {
    id: existing?.id ?? `report-${classId}-${studentId}`,
    classId,
    studentId,
    studentName: student.studentName,
    term: klass.term,
    level: klass.level,
    subjectComment: existing?.subjectComment || draftReportComment(student.studentName, klass.subject, result.grade, rate, done, goals.length),
    formComment: existing?.formComment || '',
    principalComment: existing?.principalComment || '',
    status: existing?.status ?? 'draft',
    token: existing?.token ?? `rc_${classId}_${studentId}`,
    acknowledgement: existing?.acknowledgement ?? 'pending',
    effort,
  };
}

export function saveReport(state: DeskState, report: ReportCard, actor: string): DeskState {
  const exists = state.reports.some((item) => item.id === report.id);
  const reports = exists ? state.reports.map((item) => (item.id === report.id ? report : item)) : [...state.reports, report];
  let next = stamp({ ...state, reports }, actor, report.status === 'published' ? 'publish report' : 'save report', report.studentName);
  if (report.status === 'published') {
    next = {
      ...next,
      notices: [{
        id: `report-note-${report.id}`,
        audience: 'parent',
        studentId: report.studentId,
        title: 'Report card published',
        body: `${report.studentName} has a ${report.term} report to acknowledge.`,
      }, ...next.notices.filter((item) => item.id !== `report-note-${report.id}`)],
    };
  }
  return next;
}

export function acknowledgeReport(state: DeskState, reportId: string): DeskState {
  return {
    ...state,
    reports: state.reports.map((item) => (item.id === reportId ? { ...item, acknowledgement: 'acknowledged' } : item)),
  };
}

export function postAnnouncement(state: DeskState, classId: string, text: string, actor: string): DeskState {
  return stamp({
    ...state,
    classes: state.classes.map((item) => (
      item.id === classId ? { ...item, announcements: [text, ...item.announcements] } : item
    )),
  }, actor, 'announce', classId);
}

export function reportLines(state: DeskState, report: ReportCard): string[] {
  const klass = state.classes.find((item) => item.id === report.classId);
  const result = termResult(state, report.classId, report.studentId);
  const rate = attendanceRate(state.attendance.filter((item) => item.studentId === report.studentId && item.classId === report.classId));
  const goals = state.goals.filter((item) => item.studentId === report.studentId && item.classId === report.classId);
  const done = goals.filter((item) => item.status === 'completed').length;
  const merits = state.merits.filter((item) => item.studentId === report.studentId).reduce((sum, item) => sum + item.points, 0);
  return [
    `${state.institution.name} · ${state.institution.branding}`,
    `${report.studentName} · ${klass?.name ?? 'Class'} · ${report.level} · ${report.term}`,
    `Subject grades ${gradeSetLabel(result.percent)}. School scale ${result.grade} on ${SCALE_LABEL[state.institution.defaultScale]}.`,
    `Effort ${report.effort} of 5 · Attendance ${rate}% · Merits ${merits} · Goals ${done}/${goals.length}`,
    `Integrity: ${state.flows.filter((item) => (item.flow === 'integrity' || item.flow === 'case') && item.studentId === report.studentId && item.status !== 'Closed').map((item) => item.title).join(', ') || 'None'}`,
    `Teacher: ${report.subjectComment}`,
    `Form teacher: ${report.formComment || '—'}`,
    `Principal: ${report.principalComment || '—'}`,
    `Verify https://poketschool.ai/verify/report/${report.token}`,
    report.status === 'published' ? `Family acknowledgement: ${report.acknowledgement}` : 'Draft. Not sent to the family.',
  ];
}

export function createDemoDesk(): DeskState {
  const institution: SchoolInstitution = {
    id: 'rochfords-international-school',
    name: "Rochford's International School",
    campus: 'Falim',
    kind: 'school',
    defaultScale: 'igcse_9_1',
    customBands: [
      { min: 85, grade: 'Distinction' },
      { min: 60, grade: 'Merit' },
      { min: 40, grade: 'Pass' },
      { min: 0, grade: 'Fail' },
    ],
    teachersCanCreateClasses: true,
    demo: true,
    branding: 'Falim campus',
  };
  const klass: SchoolClass = {
    id: 'class-maths',
    institutionId: institution.id,
    name: 'IGCSE Mathematics',
    subject: 'Mathematics',
    level: 'IGCSE',
    programme: 'Cambridge IGCSE',
    term: 'Term 1',
    campus: 'Falim',
    room: 'F-12',
    timetable: 'Mon and Wed, 08:30',
    coTeachers: ['Daniel Ong'],
    capacity: 24,
    status: 'active',
    joinCode: 'FALIM-MATH',
    ownerTeacherId: 'teacher-aisha',
    ownerTeacherName: 'Aisha Rahman',
    createdByRole: 'institution_admin',
    announcements: ['Mock week starts 27 October. Bring a calculator.'],
  };
  const biology: SchoolClass = {
    id: 'class-bio',
    institutionId: institution.id,
    name: 'IGCSE Biology',
    subject: 'Biology',
    level: 'IGCSE',
    programme: 'Cambridge IGCSE',
    term: 'Term 1',
    campus: 'Ipoh Garden',
    room: 'G-2',
    timetable: 'Tue and Thu, 10:00',
    coTeachers: [],
    capacity: 20,
    status: 'archived',
    joinCode: 'IPOH-BIO',
    ownerTeacherId: 'teacher-daniel',
    ownerTeacherName: 'Daniel Ong',
    createdByRole: 'institution_admin',
    announcements: [],
  };
  const lower: SchoolClass = {
    id: 'class-lower',
    institutionId: institution.id,
    name: 'Lower Secondary Mathematics',
    subject: 'Mathematics',
    level: 'Lower Secondary',
    programme: 'Lower Secondary',
    term: 'Term 1',
    campus: 'Falim',
    room: 'F-4',
    timetable: 'Fri, 09:30',
    coTeachers: ['Siti Aminah'],
    capacity: 28,
    status: 'active',
    joinCode: 'FALIM-LSM',
    ownerTeacherId: 'teacher-aisha',
    ownerTeacherName: 'Aisha Rahman',
    createdByRole: 'teacher',
    announcements: [],
  };
  const people: Array<[string, string, Enrolment['status'], JoinMethod, string]> = [
    ['stu-amina', 'Amina Yusuf', 'active', 'roster', ''],
    ['stu-leo', 'Leo Tan', 'active', 'csv', ''],
    ['stu-priya', 'Priya Nair', 'active', 'invite', ''],
    ['stu-harun', 'Harun Aziz', 'active', 'qr', ''],
    ['stu-sofia', 'Sofia Lim', 'active', 'code', ''],
    ['stu-marcus', 'Marcus Lee', 'pending', 'code', 'Waiting for the teacher or the school to approve.'],
  ];
  const enrolments: Enrolment[] = people.map(([studentId, studentName, status, joinMethod, holdReason], index) => ({
    id: `enrol-${index + 1}`,
    classId: klass.id,
    studentId,
    studentName,
    status,
    joinMethod,
    under18: true,
    institutionMember: true,
    holdReason,
  }));
  const late: LatePolicy = { allow: true, penaltyPercentPerDay: 10, cutoffDays: 5 };
  const assessments: Assessment[] = [
    { id: 'assess-test', classId: klass.id, title: 'Algebra test', kind: 'test', scaleId: 'igcse_9_1', maxPoints: 40, weight: 25, category: 'Tests', dueAt: '2026-10-10T16:00:00.000Z', instructions: 'Show working for simultaneous equations.', attachments: ['algebra-brief.pdf'], rubric: [{ criterion: 'Method', points: 20 }, { criterion: 'Accuracy', points: 20 }], latePolicy: late, lessonLabel: 'Algebra 2', status: 'published', studentIds: [] },
    { id: 'assess-hw', classId: klass.id, title: 'Homework 4', kind: 'assignment', scaleId: 'points', maxPoints: 20, weight: 15, category: 'Homework', dueAt: '2026-10-16T23:00:00.000Z', instructions: 'Five questions on fractions.', attachments: [], rubric: [{ criterion: 'Working', points: 20 }], latePolicy: late, lessonLabel: 'Fractions', status: 'published', studentIds: [] },
    { id: 'assess-quiz', classId: klass.id, title: 'Fractions quiz', kind: 'lesson_quiz', scaleId: 'percent', maxPoints: 10, weight: 10, category: 'Quizzes', dueAt: '2026-10-08T10:00:00.000Z', instructions: 'Auto-graded lesson quiz.', attachments: [], rubric: [], latePolicy: { allow: false, penaltyPercentPerDay: 0, cutoffDays: 0 }, lessonLabel: 'Fractions', status: 'published', studentIds: [] },
    { id: 'assess-exam', classId: klass.id, title: 'Mock exam', kind: 'exam', scaleId: 'igcse_9_1', maxPoints: 80, weight: 35, category: 'Exams', dueAt: '2026-10-28T09:00:00.000Z', instructions: 'Full paper, calculator allowed.', attachments: ['mock-paper.pdf'], rubric: [{ criterion: 'Paper', points: 80 }], latePolicy: late, lessonLabel: 'Mock', status: 'published', studentIds: [] },
    { id: 'assess-cw', classId: klass.id, title: 'Investigation', kind: 'coursework', scaleId: 'custom', maxPoints: 30, weight: 15, category: 'Coursework', dueAt: '2026-10-20T16:00:00.000Z', instructions: 'A short investigation with a conclusion.', attachments: [], rubric: [{ criterion: 'Reasoning', points: 30 }], latePolicy: late, lessonLabel: 'Investigation', status: 'published', studentIds: [] },
  ];
  const mark = (id: string, assessmentId: string, studentId: string, points: number | null, flag: MarkFlag, state: MarkState, comment: string): Mark => ({
    id, assessmentId, classId: klass.id, studentId, points, flag, comment, state, enteredBy: 'teacher-aisha', updatedAt: '2026-10-17',
  });
  const marks: Mark[] = [
    mark('m1', 'assess-test', 'stu-amina', 34, 'none', 'published', 'Clear method.'),
    mark('m2', 'assess-test', 'stu-leo', 28, 'none', 'published', ''),
    mark('m3', 'assess-test', 'stu-priya', 18, 'none', 'published', 'Fractions need another pass.'),
    mark('m4', 'assess-test', 'stu-harun', 31, 'none', 'draft', ''),
    mark('m5', 'assess-test', 'stu-sofia', null, 'excused', 'published', 'Medical note.'),
    mark('m6', 'assess-hw', 'stu-amina', 16, 'none', 'published', ''),
    mark('m7', 'assess-hw', 'stu-leo', 11, 'late', 'draft', 'One day late.'),
    mark('m8', 'assess-hw', 'stu-priya', null, 'missing', 'draft', ''),
    mark('m9', 'assess-quiz', 'stu-amina', 9, 'none', 'published', 'Auto-graded.'),
    mark('m10', 'assess-quiz', 'stu-leo', 7, 'none', 'published', 'Auto-graded.'),
    mark('m11', 'assess-quiz', 'stu-priya', 4, 'none', 'published', 'Auto-graded.'),
    mark('m12', 'assess-exam', 'stu-amina', 62, 'none', 'draft', ''),
    mark('m13', 'assess-cw', 'stu-leo', 24, 'none', 'published', ''),
  ];
  const attendance: AttendanceRow[] = ['stu-amina', 'stu-leo', 'stu-priya', 'stu-harun', 'stu-sofia'].flatMap((studentId, index) => ([
    { id: `att-${studentId}-14`, classId: klass.id, studentId, date: '2026-10-14', session: '08:30', status: index === 2 ? 'absent' as const : 'present' as const, reason: index === 2 ? 'Family message' : '', source: 'manual' as const, activeMinutes: index === 2 ? 0 : 50, parentNote: index === 2 ? 'Priya had a clinic appointment.' : '' },
    { id: `att-${studentId}-16`, classId: klass.id, studentId, date: '2026-10-16', session: '08:30', status: index === 1 ? 'late' as const : 'present' as const, reason: index === 1 ? 'Bus' : '', source: 'login' as const, activeMinutes: 48, parentNote: '' },
  ]));
  const goals: AssignedGoal[] = [
    goalRecord({ id: 'goal-1', studentId: 'stu-amina', studentName: 'Amina Yusuf', classId: klass.id, title: 'Finish the algebra review', source: 'teacher', assignedBy: 'teacher-aisha', assignedByName: 'Aisha Rahman', due: '2026-10-12', dueTime: '16:00', status: 'overdue', topic: 'Algebra', focusMinutes: 35, rescheduleCount: 1, rescheduleLog: [{ at: '2026-10-11T08:00:00.000Z', fromDate: '2026-10-11', toDate: '2026-10-12', fromTime: '16:00', toTime: '16:00', by: 'stu-amina' }] }),
    goalRecord({ id: 'goal-2', studentId: 'stu-leo', studentName: 'Leo Tan', classId: klass.id, title: 'Ten fraction questions', source: 'teacher', assignedBy: 'teacher-aisha', assignedByName: 'Aisha Rahman', due: '2026-10-18', dueTime: '15:30', status: 'completed', topic: 'Fractions', focusMinutes: 40, rescheduleCount: 0 }),
    goalRecord({ id: 'goal-3', studentId: 'stu-priya', studentName: 'Priya Nair', classId: klass.id, title: 'Revise fractions', source: 'teacher', assignedBy: 'teacher-aisha', assignedByName: 'Aisha Rahman', due: '2026-10-22', dueTime: '18:00', status: 'in_progress', topic: 'Fractions', focusMinutes: 15, rescheduleCount: 0 }),
    goalRecord({ id: 'goal-4', studentId: 'stu-amina', studentName: 'Amina Yusuf', classId: klass.id, title: 'My own reading goal', source: 'self', assignedBy: 'stu-amina', assignedByName: 'Amina Yusuf', due: '2026-10-19', dueTime: '20:00', status: 'not_started', topic: 'Reading', focusMinutes: 20, rescheduleCount: 1, rescheduleLog: [{ at: '2026-10-17T19:00:00.000Z', fromDate: '2026-10-18', toDate: '2026-10-19', fromTime: '20:00', toTime: '20:00', by: 'stu-amina' }] }),
    goalRecord({ id: 'goal-5', studentId: 'stu-amina', studentName: 'Amina Yusuf', classId: klass.id, title: 'Evening reading with family', source: 'parent', assignedBy: 'parent-yusuf', assignedByName: 'Farah Yusuf', due: '2026-10-20', dueTime: '19:30', status: 'in_progress', topic: 'Reading', focusMinutes: 25, rescheduleCount: 0 }),
    goalRecord({ id: 'goal-6', studentId: 'stu-priya', studentName: 'Priya Nair', classId: '', title: 'ET AI fractions drill', source: 'et_ai', assignedBy: 'et-ai', assignedByName: 'ET AI', due: '2026-10-21', dueTime: '17:15', status: 'in_progress', topic: 'Fractions', focusMinutes: 12, rescheduleCount: 2, rescheduleLog: [{ at: '2026-10-18T07:00:00.000Z', fromDate: '2026-10-19', toDate: '2026-10-20', fromTime: '17:15', toTime: '17:15', by: 'stu-priya' }, { at: '2026-10-20T07:00:00.000Z', fromDate: '2026-10-20', toDate: '2026-10-21', fromTime: '17:15', toTime: '17:15', by: 'stu-priya' }] }),
    goalRecord({ id: 'goal-7', studentId: 'stu-leo', studentName: 'Leo Tan', classId: klass.id, title: 'School weekly practice target', source: 'institution', assignedBy: 'inst-rochford', assignedByName: "Rochford's International School", due: '2026-10-24', dueTime: '16:00', status: 'not_started', topic: 'Practice', focusMinutes: 45, rescheduleCount: 0 }),
  ];
  return {
    seq: 200,
    actorId: 'teacher-aisha',
    actorName: 'Aisha Rahman',
    institution,
    classes: [klass, lower, biology],
    enrolments,
    assessments,
    submissions: [{
      id: 'sub-amina',
      assessmentId: 'assess-hw',
      studentId: 'stu-amina',
      studentName: 'Amina Yusuf',
      body: 'I converted the mixed numbers first, then simplified each answer. Question 4 still feels uncertain because the denominators were different.',
      submittedAt: '2026-10-16T21:10:00.000Z',
      status: 'submitted',
      suggestion: suggestMark('I converted the mixed numbers first, then simplified each answer. Question 4 still feels uncertain because the denominators were different.', 20),
    }],
    marks,
    attendance,
    goals,
    merits: [
      { id: 'merit-1', studentId: 'stu-amina', classId: klass.id, note: 'Helped a partner check working.', points: 2 },
      { id: 'merit-2', studentId: 'stu-leo', classId: klass.id, note: 'Homework handed in after a late bus.', points: 1 },
    ],
    reports: [],
    notices: [],
    audit: [{ id: 'aud-1', at: '2026-10-17T02:00:00.000Z', actor: 'Aisha Rahman', action: 'save draft mark', target: 'Algebra test' }],
    earnings: [
      { id: 'earn-1', month: '2026-08', date: '2026-08-12', source: 'course', label: 'IGCSE Mathematics course', gross: 420, split: 294, fee: 18, refund: 0, status: 'paid', sample: true },
      { id: 'earn-2', month: '2026-09', date: '2026-09-03', source: 'live', label: 'Tuesday tutoring', gross: 180, split: 144, fee: 8, refund: 0, status: 'available', sample: true },
      { id: 'earn-3', month: '2026-09', date: '2026-09-15', source: 'institution', label: "Rochford's teaching payment", gross: 600, split: 600, fee: 0, refund: 0, status: 'pending', sample: true },
      { id: 'earn-4', month: '2026-10', date: '2026-10-02', source: 'share', label: 'Marketplace revenue share', gross: 95, split: 66, fee: 12, refund: 20, status: 'available', sample: true },
      { id: 'earn-5', month: '2026-10', date: '2026-10-11', source: 'course', label: 'Fractions clinic', gross: 150, split: 105, fee: 6, refund: 0, status: 'pending', sample: true },
    ],
    payouts: [
      { id: 'pay-1', date: '2026-09-15', amount: 276, status: 'paid', note: 'August course sales, sample' },
      { id: 'pay-2', date: '2026-10-15', amount: 136, status: 'scheduled', note: 'September tutoring, sample' },
    ],
    payout: {
      schedule: 'Monthly, on the 15th',
      method: 'Bank transfer, sample only',
      tin: 'C 00000000000',
      invoice: 'INV-SAMPLE-1042',
      sst: 'Not submitted. MyInvois stays ready until the gateway keys exist.',
    },
    flows: [
      { id: 'flow-exam', flow: 'exam', classId: klass.id, studentId: '', studentName: 'Whole class', title: 'Mock paper 2', detail: 'Calculator paper, 80 marks, on the school 9–1 scale.', status: 'Scheduled', when: '2026-10-28' },
      { id: 'flow-live', flow: 'live', classId: klass.id, studentId: 'stu-priya', studentName: 'Priya Nair', title: 'Wednesday fractions clinic', detail: 'Sample room. A live join waits for the Daily.co key.', status: 'Scheduled', when: '2026-10-21' },
      { id: 'flow-case', flow: 'integrity', classId: klass.id, studentId: 'stu-leo', studentName: 'Leo Tan', title: 'Unapproved notes in the quiz', detail: 'Held for the teacher. It is not a sanction until you close it.', status: 'Open', when: '2026-10-16' },
      { id: 'flow-merit', flow: 'merit', classId: klass.id, studentId: 'stu-amina', studentName: 'Amina Yusuf', title: 'Helped a partner check working', detail: 'Two merits already sit on the report card.', status: 'Recorded', when: '2026-10-14' },
      { id: 'flow-tutor', flow: 'tutor', classId: klass.id, studentId: '', studentName: 'Whole class', title: 'Fractions tutoring', detail: 'RM 60 a session. Sample offer until payouts are live.', status: 'Listed', when: '2026-10-18' },
      { id: 'flow-sit', flow: 'sitting', classId: klass.id, studentId: 'stu-amina', studentName: 'Amina Yusuf', title: 'Falim mock sitting', detail: 'Room F-12 at 09:00. The mark returns to the gradebook.', status: 'Booked', when: '2026-10-28' },
      { id: 'flow-ann', flow: 'announcement', classId: klass.id, studentId: '', studentName: 'Whole class', title: 'Mock week', detail: 'Bring a calculator on 27 October.', status: 'Published', when: '2026-10-18' },
      { id: 'flow-ref', flow: 'reference', classId: klass.id, studentId: 'stu-amina', studentName: 'Amina Yusuf', title: 'Mathematics reference', detail: 'Predicted grade 8. Draft until the teacher signs it.', status: 'Draft', when: '2026-10-18' },
    ],
  };
}

/** A signed-in teacher starts here. No Rochford rows. */
export function emptyDesk(actor: { uid: string; name: string; institutionId?: string; institutionName?: string }): DeskState {
  const institutionId = actor.institutionId?.trim() || '';
  const institution: SchoolInstitution = {
    id: institutionId,
    name: actor.institutionName?.trim() || (institutionId ? 'School' : 'Independent teaching'),
    campus: '',
    kind: institutionId ? 'school' : 'independent',
    defaultScale: 'igcse_9_1',
    customBands: [
      { min: 85, grade: 'Distinction' },
      { min: 60, grade: 'Merit' },
      { min: 40, grade: 'Pass' },
      { min: 0, grade: 'Fail' },
    ],
    teachersCanCreateClasses: true,
    demo: false,
    branding: '',
  };
  return {
    seq: 1,
    actorId: actor.uid,
    actorName: actor.name || 'Teacher',
    institution,
    classes: [],
    enrolments: [],
    assessments: [],
    submissions: [],
    marks: [],
    attendance: [],
    goals: [],
    merits: [],
    reports: [],
    notices: [],
    audit: [],
    earnings: [],
    payouts: [],
    payout: { schedule: '', method: '', tin: '', invoice: '', sst: '' },
    flows: [],
  };
}

export function readDesk(): DeskState {
  if (typeof window === 'undefined') return createDemoDesk();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoDesk();
    const parsed = JSON.parse(raw) as DeskState;
    if (!parsed?.institution?.id || !Array.isArray(parsed.classes) || !Array.isArray(parsed.flows)) return createDemoDesk();
    if (!Array.isArray(parsed.earnings) || !Array.isArray(parsed.payouts) || parsed.earnings.some((row) => typeof row.split !== 'number' || !row.date)) return createDemoDesk();
    if (!Array.isArray(parsed.goals) || parsed.goals.some((goal) => typeof goal.focusMinutes !== 'number' || !goal.dueTime || !goal.source)) return createDemoDesk();
    return parsed;
  } catch {
    return createDemoDesk();
  }
}

export function writeDesk(state: DeskState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetDesk(): DeskState {
  const fresh = createDemoDesk();
  writeDesk(fresh);
  return fresh;
}
