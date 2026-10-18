import { flowNote } from './flows';

export type AuditStatus = 'Built' | 'Partial' | 'Missing';

export interface AuditRow {
  route: string;
  title: string;
  audience: string;
  status: AuditStatus;
  who: string;
  data: string;
  created: string;
  syncs: string;
  notes: string;
}

export const AUDIT: AuditRow[] = [
  { route: '/dashboard/teacher', title: 'Teacher home', audience: 'Teacher', status: 'Built', who: 'The signed-in teacher', data: 'Own courses and the shared class when the school is attached', created: 'Courses from the course builder. Classes from the class desk.', syncs: 'Gradebook, assignments', notes: 'Home no longer dies on the submissions index error. It is still a course overview, not the class register.' },
  { route: '/dashboard/studio', title: 'ET AI Studio', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Studio tools', created: 'Inside Studio', syncs: 'Student learning', notes: 'Left to the Studio owner. Not rebuilt here.' },
  { route: '/dashboard/teacher/classes', title: 'Classes', audience: 'Teacher', status: 'Built', who: 'Teacher, or institution admin when the school requires it', data: 'school_classes and school_enrolments for one institution', created: 'Institution admin, or a teacher when teachersCanCreateClasses is on. Independent teachers create their own.', syncs: 'Assignments, gradebook, attendance, goals, reports, parent view', notes: 'Create, edit, and archive. Search, filters, and sort. Roster, attendance, assignments, goals, gradebook, and announcements. Join by CSV, invite link, QR, or code, with approval. Institution admins bulk-create and assign a teacher.' },
  { route: '/dashboard/teacher/courses', title: 'Courses and products', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'courses the teacher owns', created: 'Course builder', syncs: 'Marketplace, enrolments', notes: 'Scope bar added. Course products stay separate from the class register.' },
  { route: '/dashboard/teacher/courses/build', title: 'Build a course', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'One course draft', created: 'This form', syncs: 'Course editor', notes: 'Existing builder kept.' },
  { route: '/dashboard/teacher/courses/[courseId]', title: 'Edit course', audience: 'Teacher', status: 'Built', who: 'Course owner', data: 'One course', created: 'Course builder', syncs: 'Preview, marketplace', notes: 'Existing editor kept.' },
  { route: '/dashboard/teacher/courses/[courseId]/preview', title: 'Course preview', audience: 'Teacher', status: 'Built', who: 'Course owner', data: 'One course', created: 'Course builder', syncs: 'Student course page', notes: 'Existing preview kept.' },
  { route: '/dashboard/teacher/earnings', title: 'Earnings', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Sample ledger by course, live session, institution payment, and revenue share', created: 'Gateway webhooks when keys exist. Sample rows until then.', syncs: 'Wallet, admin finance, MyInvois-ready invoice fields', notes: 'Per-sale table with course, date, gross, split, fees, and net. Pending, available, and paid totals. Payout schedule and history, refunds, CSV, and a monthly chart. Labelled sample.' },
  { route: '/courses', title: 'Marketplace', audience: 'Teacher', status: 'Built', who: 'Teacher and learners', data: 'Published courses', created: 'Course publish', syncs: 'Earnings', notes: 'Public catalogue. Not redesigned in this pass.' },
  { route: '/reads', title: 'Books', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Reads library', created: 'Reads studio', syncs: 'Student reading goals', notes: 'Owned by the Reads work. Not redesigned here.' },
  { route: '/dashboard/wallet', title: 'Wallet', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Wallet ledger', created: 'Checkout', syncs: 'Earnings', notes: 'Existing wallet. Earnings explains the teacher split.' },
  { route: '/dashboard/referrals', title: 'Referrals', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Referral codes', created: 'Referral form', syncs: 'Wallet', notes: 'Existing page.' },
  { route: '/dashboard/messages', title: 'Messages', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Threads', created: 'Compose', syncs: 'Notifications', notes: 'Existing mailbox. Class announcements live on the class.' },
  { route: '/dashboard/teacher/hotline', title: 'Poket SafeLine', audience: 'Teacher', status: 'Built', who: 'Teacher in scope', data: 'hotline_tickets for the school', created: 'A report', syncs: 'Safety desk', notes: 'Already shipped on this branch.' },
  { route: '/dashboard/teacher/analytics', title: 'Class analytics', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Quiz submissions for owned courses, plus the class selector', created: 'Lesson quizzes', syncs: 'Insights, gradebook', notes: 'Scope bar added. Numbers still come from course quizzes.' },
  { route: '/dashboard/teacher/insights', title: 'Insights', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Class narrative', created: 'Insight job', syncs: 'Analytics', notes: 'Scope bar added.' },
  { route: '/dashboard/teacher/progress', title: 'Class risk', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'At-risk signals', created: 'Nightly job', syncs: 'Goals', notes: 'Scope bar added. Weak published marks also open a teacher goal.' },
  { route: '/dashboard/teacher/goals', title: 'Goals', audience: 'Teacher', status: 'Built', who: 'Teacher and institution admin', data: 'users/{uid}/goals with source teacher or institution', created: 'Assign, edit, bulk assign. Delete only when source is teacher and assignedBy is that teacher.', syncs: 'Student goals, report cards, ET AI planner', notes: 'Add, edit, and delete for one student or the whole class. Completed and overdue views are on this page. Students cannot delete assigned goals.' },
  { route: '/dashboard/teacher/references', title: 'References', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Reference letters', created: 'Reference form', syncs: 'Student record', notes: 'Scope bar added.' },
  { route: '/dashboard/teacher/gradebook', title: 'Gradebook', audience: 'Teacher', status: 'Built', who: 'Teacher of the class', data: 'school_marks on school_assessments for one class and term', created: 'Inline entry, CSV import, or a returned assignment', syncs: 'Student dashboard, parent notice, report cards, analytics, goals, certificates', notes: 'Root cause of the blank page: submissions query required a missing composite index.' },
  { route: '/dashboard/teacher/assignments', title: 'Assignments', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Class or named students, rubric, due time, scale, late policy', created: 'Create form. Students submit from the student view.', syncs: 'Gradebook, student, parent, goals', notes: 'ET AI suggests a mark. Nothing is returned until the teacher approves it.' },
  { route: '/dashboard/teacher/exams', title: 'Exam builder', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Exams, with the class selector', created: 'Existing exam form. Mock exam also sits on the gradebook.', syncs: 'Gradebook, student exams', notes: 'Scope bar and how-to added. Full paper builder was already present.' },
  { route: '/dashboard/teacher/report-cards', title: 'Report cards', audience: 'Teacher', status: 'Built', who: 'Teacher, form teacher, principal comment', data: 'Gradebook, attendance, merits, goals, school branding', created: 'Build per student or the whole class, review, publish', syncs: 'Parent acknowledgement, PDF, verification QR', notes: 'ET AI comment is a draft until the teacher edits it.' },
  { route: '/dashboard/teacher/report-studio', title: 'Report Studio', audience: 'Teacher and institution', status: 'Built', who: 'Teacher or institution admin', data: 'Templates over the same class record', created: 'Pick template, scope, dates, preview, export, schedule', syncs: 'Parents, PDF, CSV', notes: 'Intro explains how it differs from the gradebook and from report cards.' },
  { route: '/dashboard/teacher/attendance', title: 'Attendance', audience: 'Teacher', status: 'Built', who: 'Teacher of the class', data: 'school_attendance for a class session', created: 'Roster marks, bulk present, live-login sample', syncs: 'Report cards, Report Studio, parent dashboard', notes: 'Absent and late queue a parent notice. Live fill is sample active time.' },
  { route: '/dashboard/teacher/live', title: 'Live class', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Live rooms', created: 'Existing scheduler. Attendance can copy a live session.', syncs: 'Attendance', notes: 'Daily.co still needs its keys. Scope bar added.' },
  { route: '/dashboard/teacher/integrity', title: 'Integrity', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Integrity cases', created: 'Existing case form', syncs: 'Report card note', notes: 'Scope bar added.' },
  { route: '/dashboard/teacher/integrity/cases', title: 'Integrity cases', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Case queue', created: 'Integrity review', syncs: 'Integrity', notes: 'Scope bar added.' },
  { route: '/dashboard/reports', title: 'Reports', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Shared report pack', created: 'Report Studio', syncs: 'Report cards', notes: 'Scope bar points people to Report Studio.' },
  { route: '/dashboard/behaviour', title: 'Behaviour', audience: 'Teacher', status: 'Built', who: 'Teacher, parent, admin', data: 'Merits on the class record', created: 'Merits page', syncs: 'Report cards', notes: 'Scope bar added. Report cards read the sample merits.' },
  { route: '/dashboard/teacher/behaviour', title: 'Merits', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Merit notes', created: 'Existing merits form', syncs: 'Report cards, behaviour', notes: 'Scope bar added.' },
  { route: '/dashboard/community', title: 'Community', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Community spaces', created: 'Existing community tools', syncs: 'Messages', notes: 'Scope bar added. Not a second class register.' },
  { route: '/dashboard/network', title: 'Network', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Network profiles', created: 'Existing network', syncs: 'Community', notes: 'Scope bar added.' },
  { route: '/dashboard/tutors', title: 'Tutors', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Tutor offers', created: 'Existing tutor form', syncs: 'Earnings live sessions', notes: 'Scope bar added.' },
  { route: '/dashboard/exam-centre', title: 'Exam centre', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Sitting bookings', created: 'Existing exam centre', syncs: 'Exams', notes: 'Scope bar added.' },
  { route: '/dashboard/store', title: 'Creator store', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Creator resources', created: 'Existing store', syncs: 'Earnings share', notes: 'Scope bar added.' },
  { route: '/dashboard/announcements', title: 'Announcements', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'School announcements plus class announcements', created: 'Class desk for a class. This page for the school.', syncs: 'Class detail', notes: 'Scope bar added.' },
  { route: '/dashboard/calendar', title: 'Calendar and terms', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Term dates', created: 'Existing calendar', syncs: 'Report term selector', notes: 'Scope bar added.' },
  { route: '/dashboard/resources', title: 'Resources', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Files', created: 'Upload', syncs: 'Assignment attachments', notes: 'Scope bar added. Assignment attachments store the file name in the sample.' },
  { route: '/dashboard/card', title: 'Member card', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'Profile card', created: 'Account', syncs: 'Profile', notes: 'Not changed. Another area owns the card.' },
  { route: '/dashboard/profile', title: 'Profile', audience: 'Teacher', status: 'Built', who: 'Teacher', data: 'users/{uid}', created: 'Profile form', syncs: 'Class teacher name', notes: 'Existing profile.' },
  { route: '/dashboard/institution', title: 'Institution home', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'The school, its classes, roster CSV, and teacher assignment', created: 'Class desk on this page, plus the existing invite CSV', syncs: 'Teacher classes', notes: 'School admin is the institution admin in this product.' },
  { route: '/dashboard/institution/insights', title: 'Institution insights', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'School roll-up', created: 'Insight job', syncs: 'Teacher analytics', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/approvals', title: 'Approvals', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Join requests', created: 'Student request. Class join approval is on the class desk.', syncs: 'Enrolments', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/join', title: 'Join settings', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Join policy and teachersCanCreateClasses', created: 'This setting', syncs: 'Class create permission', notes: 'Scope bar added. The sample school allows teachers to create classes.' },
  { route: '/dashboard/institution/alumni', title: 'Alumni', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Alumni records', created: 'Existing alumni tools', syncs: 'Network', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/career', title: 'Career desk', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Destinations', created: 'Existing career desk', syncs: 'Student career', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/verify', title: 'Verify student', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Student id', created: 'Existing verifier', syncs: 'Enrolment', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/publishing', title: 'Course library', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'School courses', created: 'Publish action', syncs: 'Teacher courses', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/sparks', title: 'Sparks pool', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Sparks balance', created: 'Existing pool', syncs: 'Student Sparks', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/billing', title: 'Institution billing', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Seats and invoices', created: 'Existing billing', syncs: 'Admin finance', notes: 'Scope bar added. Gateway keys still required to charge.' },
  { route: '/dashboard/institution/usage', title: 'Usage', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Usage counters', created: 'Existing usage page', syncs: 'Billing', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/onboarding', title: 'Onboarding', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Setup steps', created: 'Existing checklist', syncs: 'Join settings', notes: 'Scope bar added.' },
  { route: '/dashboard/admin/institutions', title: 'Institutions', audience: 'School admin via platform', status: 'Built', who: 'Super admin creates the school. School admin then runs classes.', data: 'institutions/{id}', created: 'Admin institutions screen and the Rochford fixture', syncs: 'Institution home', notes: 'Shipped earlier on this branch.' },
  { route: '/dashboard/institution/templates', title: 'Report templates', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Report templates', created: 'Template editor. Report Studio runs them.', syncs: 'Report Studio, report cards', notes: 'Scope bar explains the split.' },
  { route: '/dashboard/institution/activity', title: 'Activity log', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Audit rows', created: 'Desk actions', syncs: 'Gradebook audit', notes: 'Scope bar added. The class audit is on the gradebook.' },
  { route: '/dashboard/institution/progress', title: 'At-risk learners', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Risk flags', created: 'Nightly job and weak grades', syncs: 'Teacher progress, goals', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/certificates', title: 'Certificates', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Published term grades', created: 'Certificate designer', syncs: 'Gradebook', notes: 'Designer shipped earlier. Issuance still needs a published grade.' },
  { route: '/dashboard/institution/hotline', title: 'Poket SafeLine', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'School hotline tickets', created: 'A report', syncs: 'Safety desk', notes: 'Already shipped.' },
  { route: '/dashboard/institution/emergency', title: 'Emergency alerts', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'emergency_alerts', created: 'Safety desk', syncs: 'SafeLine banner', notes: 'Already shipped.' },
  { route: '/dashboard/institution/groups', title: 'Groups', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Groups beside classes', created: 'Existing groups page', syncs: 'Classes', notes: 'Scope bar added. Teaching groups are classes.' },
  { route: '/dashboard/institution/destinations', title: 'Destinations', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Leaver destinations', created: 'Existing form', syncs: 'Career desk', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/pricing', title: 'Pricing', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Seat price', created: 'Existing pricing', syncs: 'Billing', notes: 'Scope bar added.' },
  { route: '/dashboard/institution/automation', title: 'Automation', audience: 'Institution admin', status: 'Built', who: 'School admin', data: 'Rules', created: 'Existing automation', syncs: 'Reports schedule', notes: 'Scope bar added. Weekly parent reports are queued from Report Studio.' },
  { route: '/dashboard/admin/schools', title: 'School leads', audience: 'Platform school admin', status: 'Built', who: 'Super admin', data: 'School lead inbox', created: 'Existing leads form', syncs: 'Institutions', notes: 'Platform pipeline, not the class register.' },
];

const FULL_DESK = new Set([
  '/dashboard/teacher/classes',
  '/dashboard/teacher/assignments',
  '/dashboard/teacher/gradebook',
  '/dashboard/teacher/attendance',
  '/dashboard/teacher/report-cards',
  '/dashboard/teacher/report-studio',
  '/dashboard/teacher/goals',
  '/dashboard/teacher/earnings',
  '/dashboard/institution',
]);

export function scopeIdFor(pathname: string): AuditRow | null {
  if (FULL_DESK.has(pathname)) return null;
  return AUDIT.find((row) => row.route === pathname) ?? null;
}

export function auditMarkdown(): string {
  const lines = [
    '# Teacher and institution feature audit',
    '',
    'Checked against `docs/SCHEMA_CHANGES.md`, `docs/DASHBOARD_AUDIT.md`, `docs/INSTITUTION_SYSTEM.md`, the dashboard page catalogue, and the teacher and institution navigation on 18 October 2026.',
    '',
    'School admin in this product is the institution admin. Platform school leads stay on `/dashboard/admin/schools`.',
    '',
    'The other agent `bc-fe6ce9aa` (`cursor/ai-teachers-content-language-02e8`) still stores daily goals on `daily_goals` with `source` of `student`, `parent`, or `ai`. It does not yet publish `users/{uid}/goals`. This branch adds that subcollection with `source` of `teacher` or `institution` and leaves `daily_goals` unchanged so the two branches can merge.',
    '',
    '## Gradebook root cause',
    '',
    '`getSubmissionsForTeacher` queried `submissions` with `where(courseId)` and `orderBy(submittedAt)`. That pair is not in `firestore.indexes.json`, so Firestore rejected the query. The gradebook caught the error and showed “Couldn’t load submissions”. The same call sits on the teacher home, so that page failed with it. The query now sorts in memory. The gradebook itself reads the shared class record, not that quiz-only list. A submission document without `answers` would also have crashed the old marker.',
    '',
    '## Shared record',
    '',
    'Assignments, the gradebook, attendance, goals, report cards, Report Studio, and the parent view read one sample for Rochford’s International School: institution, class IGCSE Mathematics, enrolments, assessments, marks, attendance, and goals. It is labelled sample. It stays in the browser until `scripts/seed-rochford-class.ts` can write with the Firebase Admin key.',
    '',
    '## Register',
    '',
    '| Route | Who | Status | Data | Created by | Syncs to |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of AUDIT) {
    lines.push(`| \`${row.route}\` | ${row.audience} | ${row.status} | ${row.data} | ${row.created} | ${row.syncs} |`);
  }
  lines.push('', '## Notes', '');
  for (const row of AUDIT) lines.push(`- \`${row.route}\` (${row.status}): ${flowNote(row.route, row.notes)}`);
  lines.push(
    '',
    '## Still open',
    '',
    '- Firestore rules for `school_*` and `users/{uid}/goals` are written and not deployed.',
    '- The Rochford class is not written to the live database until the Firebase Admin key exists.',
    '- Stripe, Daily.co, mail, and push stay sample or queued. Nothing is sent to a bank, a parent inbox, or MyInvois.',
    '- The school wall is WallScreen on pull request 144. This desk links to it and does not copy the feed.',
    '- Studio, the course builder, the member card, the profile form, and the mailbox stay on their pages, with a class record saved above them.',
    '',
  );
  return lines.join('\n');
}
