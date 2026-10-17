/**
 * Free welcome course for every account.
 * English source lives here and is seeded once into a normal course document.
 * Super admins edit that document afterwards. This module does not overwrite it.
 * Finishing a track awards a Welcome star badge. Sparks stay at zero.
 * This course does not issue a certificate.
 */

import { certificateStudentNumber } from './certificates';

export const ONBOARDING_COURSE_ID = 'onboarding-welcome';
export const WELCOME_SPARKS = 0;

export const ONBOARDING_TRACKS = ['student', 'parent', 'teacher', 'institution', 'independent'] as const;
export type OnboardingTrack = (typeof ONBOARDING_TRACKS)[number];

/** Stored lessons may still say forest, gold, coral, or blue. */
export const WELCOME_HUES = ['deep', 'mid', 'bright', 'mist'] as const;
export type WelcomeHue = (typeof WELCOME_HUES)[number];

const LEGACY_WELCOME_HUE: Record<string, WelcomeHue> = {
  forest: 'deep',
  gold: 'mid',
  coral: 'bright',
  blue: 'mist',
};

export function readWelcomeHue(value: unknown): WelcomeHue {
  if (typeof value === 'string' && (WELCOME_HUES as readonly string[]).includes(value)) return value as WelcomeHue;
  if (typeof value === 'string' && LEGACY_WELCOME_HUE[value]) return LEGACY_WELCOME_HUE[value];
  return 'deep';
}

export interface WelcomeCheck {
  question: string;
  options: readonly [string, string, string];
  /** Index into options. Stored on the lesson as the option text, not this index. */
  answer: 0 | 1 | 2;
}

export interface WelcomeAction {
  id: string;
  label: string;
  href: string;
  /** A page under this path also counts, such as one course inside the course list. */
  deep?: boolean;
}

export interface OnboardingLesson {
  id: string;
  title: string;
  minutes: 2 | 3;
  hue: WelcomeHue;
  body: string;
  check: WelcomeCheck;
  action: WelcomeAction;
}

export interface OnboardingTrackDef {
  id: OnboardingTrack;
  title: string;
  blurb: string;
  lessons: readonly OnboardingLesson[];
}

export interface WelcomeProfile {
  role?: string | null;
  roles?: readonly string[] | null;
  institutionId?: string | null;
  /** Open dashboard, when the person holds that role. */
  mode?: string | null;
  studentNumber?: unknown;
  childIds?: unknown;
}

interface LessonInput {
  id: string;
  title: string;
  minutes: 2 | 3;
  hue: WelcomeHue;
  body: string;
  question: string;
  options: readonly [string, string, string];
  answer: 0 | 1 | 2;
  action: WelcomeAction;
}

function lesson(input: LessonInput): OnboardingLesson {
  return {
    id: input.id,
    title: input.title,
    minutes: input.minutes,
    hue: input.hue,
    body: input.body.trim(),
    check: { question: input.question, options: input.options, answer: input.answer },
    action: input.action,
  };
}

const STUDENT_LESSONS: readonly OnboardingLesson[] = [
  lesson({
    id: 'meet-et',
    title: 'Meet ET AI',
    minutes: 2,
    hue: 'deep',
    body: `ET AI is the study partner inside Poket School. Ask it to explain a topic, quiz you, or turn notes into flashcards. It helps you practise. It does not hand in the work for you.

Open ET AI once. That visit is the tick for this lesson.`,
    question: 'What is ET AI for?',
    options: ['Writing and submitting your assignments', 'Explaining, quizzing, and practising with you', 'Replacing your ET Subject teacher'],
    answer: 1,
    action: { id: 'meet_et', label: 'Open ET AI', href: '/dashboard/studio/et' },
  }),
  lesson({
    id: 'ask-teacher',
    title: 'Ask your ET Subject teacher',
    minutes: 3,
    hue: 'mist',
    body: `Each subject has a named teacher. The name is ET plus the subject, such as ET Maths or ET English. Open a teacher and ask one question about the topic you are on.

The teacher stays with that subject. ET AI is the wider study partner.`,
    question: 'How is an ET Subject teacher named?',
    options: ['ET plus the subject, such as ET Maths', 'The letters ET on their own', 'A calendar year and a class code'],
    answer: 0,
    action: { id: 'ask_teacher', label: 'Open an ET Subject teacher', href: '/dashboard/studio/teachers', deep: true },
  }),
  lesson({
    id: 'courses',
    title: 'Find your courses',
    minutes: 2,
    hue: 'mid',
    body: `Your courses are the lessons your academy, or you, have opened. Start with the one that matches your level. A lesson is a short sitting, not a whole term.

Opening the course list is enough for this tick. Enrol or continue when you are ready.`,
    question: 'Where do you continue a course?',
    options: ['From your course list', 'Only by emailing support', 'From a Sparks pack'],
    answer: 0,
    action: { id: 'open_courses', label: 'Open your courses', href: '/dashboard/student/courses', deep: true },
  }),
  lesson({
    id: 'planner',
    title: 'Set the study planner',
    minutes: 2,
    hue: 'bright',
    body: `The study planner holds this week’s sessions. Add the subject and the day. A short plan beats a long list you will not open.

Open the planner. The tick lands when that page has been opened.`,
    question: 'What belongs on the study planner?',
    options: ['This week’s study sessions', 'A Sparks balance', 'Another person’s certificate'],
    answer: 0,
    action: { id: 'open_planner', label: 'Open the study planner', href: '/dashboard/planner' },
  }),
  lesson({
    id: 'sparks',
    title: 'See how Sparks work',
    minutes: 2,
    hue: 'mid',
    body: `Sparks pay for extra AI practice. This welcome course is free. Finishing it does not spend Sparks and does not add Sparks.

Open the Sparks page so you can see the balance before you use any.`,
    question: 'What does finishing this welcome course do to Sparks?',
    options: ['It adds a large Sparks bonus', 'It spends Sparks', 'It neither spends nor awards Sparks'],
    answer: 2,
    action: { id: 'open_sparks', label: 'Open Sparks', href: '/dashboard/student/sparks' },
  }),
  lesson({
    id: 'leaderboard',
    title: 'Look at the leaderboard',
    minutes: 2,
    hue: 'mist',
    body: `The leaderboard shows first name and last initial. A verified academy name, or a school name a super admin has approved, can sit under that. Email addresses stay off the board.

Open the board once. You can hide yourself later from your profile.`,
    question: 'What name does the leaderboard show?',
    options: ['Your email address', 'First name and last initial', 'Your student number'],
    answer: 1,
    action: { id: 'open_leaderboard', label: 'Open the leaderboard', href: '/dashboard/student/achievements' },
  }),
  lesson({
    id: 'student-pass',
    title: 'Your student code and QR',
    minutes: 3,
    hue: 'deep',
    body: `Your student number looks like PS-XXXX-XXXX. The QR on your pass opens the same code. A parent uses it to link to you. It is also printed on your certificates.

Open your profile and find the pass. If the number is already on your account, this lesson can tick before you scroll.`,
    question: 'What is the student code for?',
    options: ['A parent link, your pass, and your certificates', 'A Sparks top-up code', 'A one-time login password'],
    answer: 0,
    action: { id: 'student_code', label: 'Open your student pass', href: '/dashboard/profile' },
  }),
  lesson({
    id: 'integrity',
    title: 'Keep the work yours',
    minutes: 3,
    hue: 'bright',
    body: `Integrity means the work you hand in is yours. ET AI can explain and quiz. You write the answers. Your academy can see integrity notes that belong to your own work.

Open the integrity page so you know where those notes live.`,
    question: 'What may ET AI do with your assignment?',
    options: ['Submit it as if you wrote it', 'Help you practise while you write the work', 'Hide it from your teacher'],
    answer: 1,
    action: { id: 'open_integrity', label: 'Open integrity', href: '/dashboard/student/integrity' },
  }),
];

const PARENT_LESSONS: readonly OnboardingLesson[] = [
  lesson({
    id: 'link',
    title: 'Link with a code or QR',
    minutes: 3,
    hue: 'deep',
    body: `Ask your child for the student number on their pass, or scan the QR. They confirm the link. A learner under 13 is confirmed by their institution admin. After that, you can see progress and Parent Explainer.

The tick lands when a child is linked, or when you open the link box.`,
    question: 'How do you link to your child?',
    options: ['With their student code or the QR on their pass', 'By guessing their email', 'By buying Sparks'],
    answer: 0,
    action: { id: 'parent_link', label: 'Open the link box', href: '/dashboard/parent?link=1' },
  }),
  lesson({
    id: 'explainer',
    title: 'Parent Explainer for the week',
    minutes: 3,
    hue: 'mid',
    body: `Parent Explainer is a weekly summary in plain language. It describes what your child studied. It is not a new grade and it does not spend their Sparks.

Open Parent Explainer once so you know where the summary lives.`,
    question: 'What is Parent Explainer?',
    options: ['A weekly summary of study', 'A bill for the academy', 'A public leaderboard'],
    answer: 0,
    action: { id: 'parent_explainer', label: 'Open Parent Explainer', href: '/ai-studio?mode=parent-explainer' },
  }),
  lesson({
    id: 'progress',
    title: 'Read progress',
    minutes: 2,
    hue: 'mist',
    body: `Progress shows goals, courses, and certificates for each linked child. Your own learning stays in the Learning view. Open the progress view and look at one child, or the empty state if you are still waiting for a link.`,
    question: 'Whose courses appear on the parent progress view?',
    options: ['Only your linked children', 'Every student on the leaderboard', 'Your private drafts'],
    answer: 0,
    action: { id: 'parent_progress', label: 'Open progress', href: '/dashboard/parent/analytics' },
  }),
  lesson({
    id: 'payments',
    title: 'Payments and receipts',
    minutes: 2,
    hue: 'bright',
    body: `Family payments and receipts live on the parent billing page. A plan change and a receipt download happen there. This welcome course stays free.

Open billing so a later payment is not a surprise.`,
    question: 'Where do you open a family receipt?',
    options: ['Parent billing', 'The leaderboard', 'An ET Subject teacher chat'],
    answer: 0,
    action: { id: 'parent_payments', label: 'Open payments', href: '/dashboard/parent/billing' },
  }),
  lesson({
    id: 'reports',
    title: 'Reports you can sign',
    minutes: 2,
    hue: 'deep',
    body: `When a teacher publishes a report card, it appears for you to read and sign. It is separate from the weekly Parent Explainer. Open the reports page once, even if nothing is waiting yet.`,
    question: 'What is a published report card for?',
    options: ['You can read it and sign it', 'It replaces the student pass', 'It awards Sparks'],
    answer: 0,
    action: { id: 'parent_reports', label: 'Open reports', href: '/dashboard/parent/reports' },
  }),
  lesson({
    id: 'help',
    title: 'Help when you need a person',
    minutes: 2,
    hue: 'mist',
    body: `Help answers common questions first. ET can answer a matched question. A ticket is for the question that does not match. You can also reopen this welcome course from Help.

Open Help once so you know that path.`,
    question: 'When does a help question become a ticket?',
    options: ['When it does not match an answer ET already has', 'After every question', 'Only if you finish this course'],
    answer: 0,
    action: { id: 'open_help', label: 'Open Help', href: '/dashboard/helpdesk' },
  }),
];

const TEACHER_LESSONS: readonly OnboardingLesson[] = [
  lesson({
    id: 'toolkit',
    title: 'Teacher Toolkit',
    minutes: 3,
    hue: 'deep',
    body: `Teacher Toolkit drafts a lesson plan, worksheet, rubric, or exit ticket. You review it before anyone else sees it. Generating a pack can use Sparks. Opening the toolkit does not.

Open Teacher Toolkit so the desk is familiar.`,
    question: 'What should you do with a Teacher Toolkit draft?',
    options: ['Review it before anyone else sees it', 'Publish it unread', 'Send it as a certificate'],
    answer: 0,
    action: { id: 'teacher_toolkit', label: 'Open Teacher Toolkit', href: '/ai-studio?mode=teacher-toolkit' },
  }),
  lesson({
    id: 'publish',
    title: 'Publishing a course',
    minutes: 3,
    hue: 'mid',
    body: `A course that passes the content and brand check can go into your institution library on its own. The public marketplace stays with a super admin unless that rule is turned on. Brand names stay Poket School and ET AI, and levels keep their names.

Open your courses. Publishing one is optional for this tick.`,
    question: 'Where does a course go first when the library rule is on?',
    options: ['The institution library', 'The public marketplace, always', 'A parent’s billing page'],
    answer: 0,
    action: { id: 'teacher_publish', label: 'Open your courses', href: '/dashboard/teacher/courses', deep: true },
  }),
  lesson({
    id: 'classes',
    title: 'Your classes',
    minutes: 2,
    hue: 'mist',
    body: `Classes are the groups you teach. Rosters, live sessions, and assignments hang off a class. Open the class list so you can see who is already there.`,
    question: 'What is a class for?',
    options: ['The group you teach', 'A Sparks pack', 'A public certificate check'],
    answer: 0,
    action: { id: 'teacher_classes', label: 'Open classes', href: '/dashboard/teacher/classes' },
  }),
  lesson({
    id: 'grading',
    title: 'Grading',
    minutes: 3,
    hue: 'bright',
    body: `The gradebook is where waiting work is marked. Students see a result after you save it. Open the gradebook once during this lesson. Marking a paper can wait until something is actually in the queue.`,
    question: 'When does a student see a mark you enter?',
    options: ['After you save it in the gradebook', 'When they buy Sparks', 'When a parent scans a QR'],
    answer: 0,
    action: { id: 'teacher_grading', label: 'Open the gradebook', href: '/dashboard/teacher/gradebook' },
  }),
  lesson({
    id: 'analytics',
    title: 'Analytics',
    minutes: 2,
    hue: 'mid',
    body: `Analytics shows how the class is moving through lessons. It is for your teaching, not a public board. Open it once so the charts are not new on a busy day.`,
    question: 'Who is class analytics for?',
    options: ['You, while you teach', 'The public leaderboard', 'A Sparks shop'],
    answer: 0,
    action: { id: 'teacher_analytics', label: 'Open analytics', href: '/dashboard/teacher/analytics' },
  }),
  lesson({
    id: 'integrity',
    title: 'Integrity notes',
    minutes: 2,
    hue: 'deep',
    body: `Integrity notes flag work that needs a teacher’s eye. They are not a public score. Open the integrity desk so you know where a note will appear.`,
    question: 'What is an integrity note?',
    options: ['A flag for you to review', 'A Sparks refund', 'A branded login page'],
    answer: 0,
    action: { id: 'teacher_integrity', label: 'Open integrity', href: '/dashboard/teacher/integrity' },
  }),
];

const INSTITUTION_LESSONS: readonly OnboardingLesson[] = [
  lesson({
    id: 'checklist',
    title: 'Setup checklist',
    minutes: 3,
    hue: 'deep',
    body: `The setup checklist is the order for a new academy: name, country, people, courses, billing, and Sparks. You can leave and come back. The academy opens when you say it is ready.

Open the checklist. This tick is that visit.`,
    question: 'What is the setup checklist for?',
    options: ['Finishing the academy in order', 'Buying a personal Sparks pack', 'Hiding the branded login page'],
    answer: 0,
    action: { id: 'institution_checklist', label: 'Open the setup checklist', href: '/dashboard/institution/onboarding' },
  }),
  lesson({
    id: 'login',
    title: 'Branded login page',
    minutes: 3,
    hue: 'mid',
    body: `Your branded login page is the door for students, teachers, and admins. Add a logo, colours, and an address. Co-admins sign in with an email code. Publish when the preview looks right.

Open the login step. Publishing can wait until the preview is one you want to share.`,
    question: 'Who uses the branded login page?',
    options: ['Students, teachers, and admins at your academy', 'Only Poket School support', 'The public marketplace'],
    answer: 0,
    action: { id: 'institution_login', label: 'Open the branded login step', href: '/dashboard/institution/onboarding?step=login' },
  }),
  lesson({
    id: 'invites',
    title: 'Invites, CSV, and QR',
    minutes: 3,
    hue: 'mist',
    body: `Invite people with a CSV of email, name, and role, or share the login link and a student QR. Parents still link with the student’s own code. Open the invite box on your academy home.`,
    question: 'What can a CSV invite include?',
    options: ['Email, name, and role', 'A student’s password', 'A Sparks balance for each row'],
    answer: 0,
    action: { id: 'institution_invites', label: 'Open invites', href: '/dashboard/institution#academy-invite' },
  }),
  lesson({
    id: 'verify',
    title: 'Verifying students',
    minutes: 2,
    hue: 'bright',
    body: `Verification confirms a student really belongs to your academy. Their student number and QR stay theirs. Open the verify desk so a waiting student is easy to find.`,
    question: 'What does verification confirm?',
    options: ['That the student belongs to your academy', 'That a parent has paid', 'That ET AI wrote the homework'],
    answer: 0,
    action: { id: 'institution_verify', label: 'Open verification', href: '/dashboard/institution/verify' },
  }),
  lesson({
    id: 'billing',
    title: 'Billing and seats',
    minutes: 2,
    hue: 'mid',
    body: `Seats are the people the plan covers. Adding or removing seats is priced for the days left in the period. Open billing and look at the seat count before you change it.`,
    question: 'What is a seat?',
    options: ['A person the plan covers', 'A Sparks coin', 'A certificate QR'],
    answer: 0,
    action: { id: 'institution_billing', label: 'Open billing and seats', href: '/dashboard/institution/billing' },
  }),
  lesson({
    id: 'sparks',
    title: 'Sparks allocation',
    minutes: 2,
    hue: 'bright',
    body: `The academy can hold a Sparks pool and share it with learners. This welcome course does not take from that pool. Open Sparks allocation so you can see what is already set aside.`,
    question: 'Does this welcome course spend the academy Sparks pool?',
    options: ['No', 'Yes, one Spark per lesson', 'Yes, when the badge is awarded'],
    answer: 0,
    action: { id: 'institution_sparks', label: 'Open Sparks allocation', href: '/dashboard/institution/sparks' },
  }),
  lesson({
    id: 'insights',
    title: 'Insights panel',
    minutes: 2,
    hue: 'mist',
    body: `Insights are aggregate counts for your academy. A bucket smaller than five people is hidden. You do not see a named list of who is in a bucket. Open the panel once.`,
    question: 'What does the Insights panel show?',
    options: ['Aggregate counts, with small groups hidden', 'Every student’s email', 'Individual wellbeing notes'],
    answer: 0,
    action: { id: 'institution_insights', label: 'Open Insights', href: '/dashboard/institution/insights' },
  }),
  lesson({
    id: 'automation',
    title: 'Automation settings',
    minutes: 3,
    hue: 'deep',
    body: `Signup, library publishing, seat changes, certificates, and help can run on their own. Your academy page shows which rules are on. A super admin is the person who turns a rule off. You do not need their login to read the list.

Open the automation view for your academy.`,
    question: 'Who changes an automation rule?',
    options: ['A super admin', 'Any student with a QR', 'Parent Explainer'],
    answer: 0,
    action: { id: 'institution_automation', label: 'Open automation settings', href: '/dashboard/institution/automation' },
  }),
];

const INDEPENDENT_LESSONS: readonly OnboardingLesson[] = [
  lesson({
    id: 'meet-et',
    title: 'Meet ET AI',
    minutes: 2,
    hue: 'deep',
    body: `You can learn on Poket School without an academy. ET AI is still your study partner. Ask it to explain a topic or quiz you. You write the work you submit.

Open ET AI once for this tick.`,
    question: 'Can you use ET AI without an academy?',
    options: ['Yes', 'Only after a school verifies you', 'Only after you spend Sparks'],
    answer: 0,
    action: { id: 'meet_et', label: 'Open ET AI', href: '/dashboard/studio/et' },
  }),
  lesson({
    id: 'ask-teacher',
    title: 'Ask an ET Subject teacher',
    minutes: 3,
    hue: 'mist',
    body: `Subject teachers are named ET plus the subject, such as ET Science. Open one and ask about the topic you chose. The teacher does not enrol you in a school.`,
    question: 'What does ET Science mean?',
    options: ['The ET Subject teacher for Science', 'A school year group', 'A Sparks bundle'],
    answer: 0,
    action: { id: 'ask_teacher', label: 'Open an ET Subject teacher', href: '/dashboard/studio/teachers', deep: true },
  }),
  lesson({
    id: 'courses',
    title: 'Courses you can start',
    minutes: 2,
    hue: 'mid',
    body: `Your course list is what you have opened yourself. Pick a course at your level and continue when you want a longer sitting. This welcome course is already yours, and it is free.

Open the course list.`,
    question: 'Which courses are on your list?',
    options: ['Courses you have opened', 'Every academy’s private classes', 'Only paid Sparks packs'],
    answer: 0,
    action: { id: 'open_courses', label: 'Open your courses', href: '/dashboard/student/courses', deep: true },
  }),
  lesson({
    id: 'planner',
    title: 'Plan your week',
    minutes: 2,
    hue: 'bright',
    body: `The study planner is yours. Put a subject on a day. Nobody at a school is assigned until you join an academy. Open the planner for this tick.`,
    question: 'Who is the study planner for while you learn independently?',
    options: ['You', 'An institution admin you have not met', 'The public marketplace'],
    answer: 0,
    action: { id: 'open_planner', label: 'Open the study planner', href: '/dashboard/planner' },
  }),
  lesson({
    id: 'sparks',
    title: 'Sparks stay optional',
    minutes: 2,
    hue: 'mid',
    body: `Sparks pay for extra AI practice. You can study this welcome course with none. Finishing it does not grant a Sparks pack. Open the Sparks page to see the balance, even if it is empty.`,
    question: 'Is a Sparks pack required to finish this course?',
    options: ['No', 'Yes', 'Only for the badge'],
    answer: 0,
    action: { id: 'open_sparks', label: 'Open Sparks', href: '/dashboard/student/sparks' },
  }),
  lesson({
    id: 'leaderboard',
    title: 'The leaderboard',
    minutes: 2,
    hue: 'mist',
    body: `If you appear on a board, people see your first name and last initial. Your email stays private. Open the board, then decide on your profile whether you want to be listed.`,
    question: 'What stays off the leaderboard?',
    options: ['Your email address', 'Your first name', 'Your points'],
    answer: 0,
    action: { id: 'open_leaderboard', label: 'Open the leaderboard', href: '/dashboard/student/achievements' },
  }),
  lesson({
    id: 'student-pass',
    title: 'Your student code and QR',
    minutes: 3,
    hue: 'deep',
    body: `Independent learners still have a student number and a QR. A parent can link with that code. The same number is printed on your certificates. Open your profile and find the pass.`,
    question: 'Where does the student number appear?',
    options: ['On your pass and on your certificates', 'Only inside an academy CSV', 'On the public leaderboard'],
    answer: 0,
    action: { id: 'student_code', label: 'Open your student pass', href: '/dashboard/profile' },
  }),
  lesson({
    id: 'integrity',
    title: 'Your own work',
    minutes: 2,
    hue: 'bright',
    body: `The integrity page is where notes about your own submissions live. ET AI can practise with you. The submission stays in your words. Open the page once.`,
    question: 'Who writes the work you submit?',
    options: ['You', 'ET AI, under your name', 'A super admin'],
    answer: 0,
    action: { id: 'open_integrity', label: 'Open integrity', href: '/dashboard/student/integrity' },
  }),
];

export const WELCOME_TRACKS: readonly OnboardingTrackDef[] = [
  {
    id: 'student',
    title: 'Student welcome',
    blurb: 'Meet ET AI, your courses, and your student pass.',
    lessons: STUDENT_LESSONS,
  },
  {
    id: 'parent',
    title: 'Parent welcome',
    blurb: 'Link to your child, then progress, Parent Explainer, and payments.',
    lessons: PARENT_LESSONS,
  },
  {
    id: 'teacher',
    title: 'Teacher welcome',
    blurb: 'Teacher Toolkit, courses, classes, grading, and analytics.',
    lessons: TEACHER_LESSONS,
  },
  {
    id: 'institution',
    title: 'Academy welcome',
    blurb: 'Checklist, branded login, invites, seats, Sparks, Insights, and automation.',
    lessons: INSTITUTION_LESSONS,
  },
  {
    id: 'independent',
    title: 'Independent learner welcome',
    blurb: 'Learn with ET AI before you join an academy.',
    lessons: INDEPENDENT_LESSONS,
  },
];

export interface WelcomeBadge {
  type: string;
  name: string;
  description: string;
  icon: string;
  sparks: 0;
}

export function isOnboardingTrack(value: unknown): value is OnboardingTrack {
  return typeof value === 'string' && (ONBOARDING_TRACKS as readonly string[]).includes(value);
}

export function trackById(track: OnboardingTrack): OnboardingTrackDef {
  const found = WELCOME_TRACKS.find((item) => item.id === track);
  if (!found) throw new Error('Unknown welcome track');
  return found;
}

export function trackForProfile(input: WelcomeProfile): OnboardingTrack {
  const mode = (input.mode || '').toLowerCase();
  const held = new Set(
    [input.role, ...(input.roles ?? [])]
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => String(value).toLowerCase()),
  );
  const role = (input.role || '').toLowerCase();
  if (role === 'institution_admin') return 'institution';
  if (role === 'admin') return 'independent';
  if (mode === 'parent' && held.has('parent')) return 'parent';
  if (mode === 'teacher' && held.has('teacher')) return 'teacher';
  if (mode === 'student' && (held.has('student') || held.has('teacher') || held.has('parent'))) {
    return input.institutionId ? 'student' : 'independent';
  }
  if (role === 'parent') return 'parent';
  if (role === 'teacher') return 'teacher';
  return input.institutionId ? 'student' : 'independent';
}

export function welcomeBadge(track: OnboardingTrack): WelcomeBadge {
  const title = trackById(track).title;
  return {
    type: `welcome_${track}`,
    name: 'Welcome star',
    description: `Finished ${title} at Poket School. No Sparks were spent or awarded.`,
    icon: '⭐',
    sparks: WELCOME_SPARKS,
  };
}

export function recordsFromProfile(input: WelcomeProfile): string[] {
  const ids: string[] = [];
  if (certificateStudentNumber(input.studentNumber)) ids.push('student_code');
  if (Array.isArray(input.childIds) && input.childIds.length > 0) ids.push('parent_link');
  return ids;
}

export interface StoredWelcomeLesson {
  id: string;
  title?: string;
  minutes?: number;
  body?: string;
  question?: string;
  options?: string[];
  answer?: string;
  actionId?: string;
  actionLabel?: string;
  actionHref?: string;
  deep?: boolean;
}

export function storedFromDoc(id: string, data: Record<string, unknown>): StoredWelcomeLesson {
  const outputs = data.aiOutputs && typeof data.aiOutputs === 'object'
    ? data.aiOutputs as { text?: unknown; quiz?: unknown }
    : {};
  const quiz = Array.isArray(outputs.quiz) ? outputs.quiz[0] as { question?: unknown; options?: unknown; answer?: unknown } : undefined;
  const activity = data.activity && typeof data.activity === 'object'
    ? data.activity as { title?: unknown; instructions?: unknown; modelAnswer?: unknown; type?: unknown }
    : {};
  const options = Array.isArray(quiz?.options) ? quiz.options.filter((item): item is string => typeof item === 'string') : undefined;
  return {
    id,
    title: typeof data.title === 'string' ? data.title : undefined,
    minutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : undefined,
    body: typeof outputs.text === 'string' ? outputs.text : undefined,
    question: typeof quiz?.question === 'string' ? quiz.question : undefined,
    options,
    answer: typeof quiz?.answer === 'string' ? quiz.answer : undefined,
    actionId: typeof activity.instructions === 'string' ? activity.instructions : undefined,
    actionLabel: typeof activity.title === 'string' ? activity.title : undefined,
    actionHref: typeof activity.modelAnswer === 'string' ? activity.modelAnswer : undefined,
    deep: activity.type === 'onboarding_action_deep',
  };
}

function overlay(base: OnboardingLesson, stored: StoredWelcomeLesson): OnboardingLesson {
  const options = stored.options && stored.options.length >= 2
    ? stored.options.slice(0, 3)
    : [...base.check.options];
  while (options.length < 3) options.push(base.check.options[options.length] ?? 'Continue');
  const answerText = stored.answer?.trim();
  const answerIndex = answerText ? options.indexOf(answerText) : base.check.answer;
  const minutes = stored.minutes === 2 || stored.minutes === 3 ? stored.minutes : base.minutes;
  return {
    ...base,
    title: stored.title?.trim() || base.title,
    minutes,
    body: stored.body?.trim() || base.body,
    check: {
      question: stored.question?.trim() || base.check.question,
      options: [options[0] ?? '', options[1] ?? '', options[2] ?? ''] as [string, string, string],
      answer: answerIndex >= 0 && answerIndex <= 2 ? answerIndex as 0 | 1 | 2 : base.check.answer,
    },
    action: {
      id: stored.actionId?.trim() || base.action.id,
      label: stored.actionLabel?.trim() || base.action.label,
      href: stored.actionHref?.trim() || base.action.href,
      deep: stored.deep ?? base.action.deep,
    },
  };
}

function lessonFromStored(stored: StoredWelcomeLesson, hue: WelcomeHue): OnboardingLesson | null {
  const title = stored.title?.trim();
  if (!title) return null;
  const options = (stored.options ?? []).filter(Boolean).slice(0, 3);
  while (options.length < 3) options.push('Continue');
  const answerText = stored.answer?.trim() ?? '';
  const found = options.indexOf(answerText);
  return {
    id: stored.id,
    title,
    minutes: stored.minutes === 3 ? 3 : 2,
    hue,
    body: stored.body?.trim() || title,
    check: {
      question: stored.question?.trim() || title,
      options: [options[0] ?? '', options[1] ?? '', options[2] ?? ''] as [string, string, string],
      answer: found >= 0 && found <= 2 ? found as 0 | 1 | 2 : 0,
    },
    action: {
      id: stored.actionId?.trim() || '',
      label: stored.actionLabel?.trim() || 'Continue',
      href: stored.actionHref?.trim() || '/dashboard/welcome',
      deep: stored.deep,
    },
  };
}

/** Admin edits win. A missing catalog lesson stays deleted. Added lessons are kept. */
export function mergeOutline(track: OnboardingTrack, stored: readonly StoredWelcomeLesson[] | null): OnboardingLesson[] {
  const catalog = trackById(track).lessons;
  if (!stored) return [...catalog];
  const byId = new Map(stored.map((item) => [item.id, item]));
  const known = new Set(catalog.map((item) => item.id));
  const hues: WelcomeHue[] = ['deep', 'mid', 'bright', 'mist'];
  const kept = catalog.filter((item) => byId.has(item.id)).map((item) => overlay(item, byId.get(item.id)!));
  const extra = stored
    .filter((item) => !known.has(item.id))
    .map((item, index) => lessonFromStored(item, hues[index % hues.length] ?? 'deep'))
    .filter((item): item is OnboardingLesson => item !== null);
  return [...kept, ...extra];
}

export interface LessonProgress {
  lessonId: string;
  checkCorrect: boolean;
  actionDone: boolean;
}

export function actionIsDone(lesson: OnboardingLesson, done: ReadonlySet<string>): boolean {
  if (!lesson.action.id) return true;
  return done.has(lesson.action.id);
}

export function lessonIsDone(row: Pick<LessonProgress, 'checkCorrect' | 'actionDone'>): boolean {
  return row.checkCorrect && row.actionDone;
}

export function starsEarned(rows: readonly LessonProgress[]): number {
  return rows.filter(lessonIsDone).length;
}

/** Opening run of finished lessons. A gap ends the streak. */
export function streakEarned(lessons: readonly { id: string }[], rows: readonly LessonProgress[]): number {
  const done = new Set(rows.filter(lessonIsDone).map((row) => row.lessonId));
  let streak = 0;
  for (const lesson of lessons) {
    if (!done.has(lesson.id)) break;
    streak += 1;
  }
  return streak;
}

export function trackComplete(lessons: readonly { id: string }[], rows: readonly LessonProgress[]): boolean {
  return lessons.length > 0 && lessons.every((lesson) => rows.some((row) => row.lessonId === lesson.id && lessonIsDone(row)));
}

export function choiceCorrect(lesson: OnboardingLesson, choice: number): boolean {
  return lesson.check.options[choice] === lesson.check.options[lesson.check.answer];
}

interface HrefParts {
  path: string;
  query: URLSearchParams;
  hash: string;
}

function splitHref(value: string): HrefParts {
  const hashAt = value.indexOf('#');
  const hash = hashAt >= 0 ? value.slice(hashAt + 1) : '';
  const withoutHash = hashAt >= 0 ? value.slice(0, hashAt) : value;
  const queryAt = withoutHash.indexOf('?');
  const path = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash;
  const query = new URLSearchParams(queryAt >= 0 ? withoutHash.slice(queryAt + 1) : '');
  return { path, query, hash };
}

function normPath(path: string): string {
  const trimmed = path.trim() || '/';
  if (trimmed.length > 1 && trimmed.endsWith('/')) return trimmed.slice(0, -1);
  return trimmed;
}

export function hrefMatches(actionHref: string, current: string, deep = false): boolean {
  const action = splitHref(actionHref);
  const now = splitHref(current);
  if (action.hash && now.hash !== action.hash) return false;
  const actionPath = normPath(action.path);
  const currentPath = normPath(now.path);
  const same = actionPath === currentPath;
  const child = deep && currentPath.startsWith(`${actionPath}/`);
  if (!same && !child) return false;
  for (const [key, value] of action.query) {
    if (now.query.get(key) !== value) return false;
  }
  return true;
}

export function matchingActionIds(lessons: readonly OnboardingLesson[], href: string): string[] {
  return lessons
    .filter((lesson) => lesson.action.id && hrefMatches(lesson.action.href, href, lesson.action.deep === true))
    .map((lesson) => lesson.action.id);
}

export interface WelcomeLessonView {
  id: string;
  title: string;
  minutes: number;
  hue: WelcomeHue;
  body: string;
  question: string;
  options: [string, string, string];
  actionLabel: string;
  actionHref: string;
  checkCorrect: boolean;
  actionDone: boolean;
  done: boolean;
}

export interface WelcomeState {
  courseId: string;
  track: OnboardingTrack;
  trackTitle: string;
  blurb: string;
  skipped: boolean;
  stars: number;
  streak: number;
  total: number;
  complete: boolean;
  badgeName: string;
  showCard: boolean;
  lessons: WelcomeLessonView[];
}

export function buildWelcomeState(input: {
  track: OnboardingTrack;
  lessons: readonly OnboardingLesson[];
  checks: ReadonlySet<string>;
  actions: ReadonlySet<string>;
  skipped: boolean;
}): WelcomeState {
  const rows: LessonProgress[] = input.lessons.map((lesson) => ({
    lessonId: lesson.id,
    checkCorrect: input.checks.has(lesson.id),
    actionDone: actionIsDone(lesson, input.actions),
  }));
  const stars = starsEarned(rows);
  const streak = streakEarned(input.lessons, rows);
  const complete = trackComplete(input.lessons, rows);
  const lessons: WelcomeLessonView[] = input.lessons.map((lesson, index) => ({
    id: lesson.id,
    title: lesson.title,
    minutes: lesson.minutes,
    hue: lesson.hue,
    body: lesson.body,
    question: lesson.check.question,
    options: [...lesson.check.options] as [string, string, string],
    actionLabel: lesson.action.label,
    actionHref: lesson.action.href,
    checkCorrect: rows[index]?.checkCorrect === true,
    actionDone: rows[index]?.actionDone === true,
    done: rows[index] ? lessonIsDone(rows[index]) : false,
  }));
  return {
    courseId: ONBOARDING_COURSE_ID,
    track: input.track,
    trackTitle: trackById(input.track).title,
    blurb: trackById(input.track).blurb,
    skipped: input.skipped,
    stars,
    streak,
    total: input.lessons.length,
    complete,
    badgeName: welcomeBadge(input.track).name,
    showCard: input.lessons.length > 0 && !input.skipped && !complete,
    lessons,
  };
}

export function lessonTranslationFields(lesson: Pick<WelcomeLessonView, 'title' | 'body' | 'question' | 'options' | 'actionLabel'>): Record<string, string> {
  return {
    title: lesson.title,
    body: lesson.body,
    question: lesson.question,
    option0: lesson.options[0] ?? '',
    option1: lesson.options[1] ?? '',
    option2: lesson.options[2] ?? '',
    action: lesson.actionLabel,
  };
}

export interface WelcomeCourseSeed {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  ownerId: string;
  ownerName: string;
  status: 'published';
  reviewStatus: 'published';
  priceType: 'FREE';
  price: 0;
  kind: 'curriculum';
  category: string;
  subject: string;
  language: string;
  isPublic: false;
  audiences: string[];
  tags: string[];
}

export interface WelcomeLessonSeed {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  order: number;
  durationMinutes: number;
  status: 'published';
  lessonType: 'lesson';
  blocksOrder: string[];
  aiOutputs: {
    text: string;
    quiz: { question: string; options: string[]; answer: string; explanation: string }[];
  };
  activity: {
    title: string;
    type: string;
    instructions: string;
    modelAnswer: string;
  };
}

export function welcomeCourseSeed(): WelcomeCourseSeed {
  return {
    id: ONBOARDING_COURSE_ID,
    title: 'Welcome to Poket School',
    subtitle: 'A short first course for every account',
    description: 'Five short tracks: student, parent, teacher, academy admin, and independent learner. Each lesson is a few minutes, with a quick check and a task that ticks when you do it in Poket School. Finishing awards a Welcome star badge. It does not issue a certificate and it does not use Sparks. Edit these lessons in the curriculum builder. English here is the source for translation.',
    ownerId: 'poket-school',
    ownerName: 'Poket School',
    status: 'published',
    reviewStatus: 'published',
    priceType: 'FREE',
    price: 0,
    kind: 'curriculum',
    category: 'onboarding',
    subject: 'Welcome',
    language: 'en',
    isPublic: false,
    audiences: ['students', 'teachers', 'parents', 'institutions', 'all'],
    tags: ['onboarding', 'welcome'],
  };
}

export function welcomeLessonSeeds(): { moduleId: string; moduleTitle: string; order: number; lessons: WelcomeLessonSeed[] }[] {
  return WELCOME_TRACKS.map((track, order) => ({
    moduleId: track.id,
    moduleTitle: track.title,
    order,
    lessons: track.lessons.map((item, lessonOrder) => ({
      id: item.id,
      moduleId: track.id,
      courseId: ONBOARDING_COURSE_ID,
      title: item.title,
      order: lessonOrder,
      durationMinutes: item.minutes,
      status: 'published' as const,
      lessonType: 'lesson' as const,
      blocksOrder: ['text', 'quiz', 'activity'],
      aiOutputs: {
        text: item.body,
        quiz: [{
          question: item.check.question,
          options: [...item.check.options],
          answer: item.check.options[item.check.answer],
          explanation: 'This welcome check is here so the first sitting is active.',
        }],
      },
      activity: {
        title: item.action.label,
        type: item.action.deep ? 'onboarding_action_deep' : 'onboarding_action',
        instructions: item.action.id,
        modelAnswer: item.action.href,
      },
    })),
  }));
}
