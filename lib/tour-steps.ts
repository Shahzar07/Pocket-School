/**
 * The catalogue the onboarding guide walks people through.
 *
 * Each step points at a real element via `data-tour="<id>"` and the route that
 * element lives on. The guide navigates there, waits for the element, then
 * spotlights it — so the tour is the actual product rather than a slideshow of
 * screenshots that drifts out of date.
 *
 * `keywords` is what the AI matches a typed question against. Steps whose
 * target is missing are skipped at runtime, so a step can reference something
 * that only some roles or plans see.
 */

export type TourRole = 'student' | 'teacher' | 'parent' | 'admin' | 'institution_admin';

export interface TourStep {
  id: string;
  /** Element to spotlight: [data-tour="<id>"]. Omit to centre the card. */
  target?: string;
  /** Route the element lives on. Omit to stay where we are. */
  route?: string;
  title: string;
  body: string;
  roles: TourRole[];
  keywords: string[];
}

export const TOUR_STEPS: TourStep[] = [
  /* ── Shared orientation ── */
  {
    id: 'welcome',
    title: 'Hello — I’m Pip',
    body: 'I’ll show you around. Two minutes and you’ll know where everything lives. You can stop any time, and reopen me from the top-left whenever you get stuck.',
    roles: ['student', 'teacher', 'parent', 'admin', 'institution_admin'],
    keywords: ['start', 'begin', 'hello', 'tour', 'intro', 'help'],
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    title: 'Everything lives here',
    body: 'Your whole portal is in this sidebar, grouped by what you’re trying to do. It changes with your role, so you only ever see what applies to you.',
    roles: ['student', 'teacher', 'parent', 'admin', 'institution_admin'],
    keywords: ['menu', 'navigation', 'sidebar', 'where', 'find', 'navigate'],
  },
  {
    id: 'search',
    target: 'search',
    title: 'Jump straight to anything',
    body: 'Search finds courses, lessons and people without clicking through menus. If you only remember half a name, type that.',
    roles: ['student', 'teacher', 'parent', 'admin', 'institution_admin'],
    keywords: ['search', 'find', 'lookup', 'jump'],
  },
  {
    id: 'sparks',
    target: 'sparks',
    title: 'Your Sparks balance',
    body: 'Sparks unlock AI study materials. You started with a welcome grant, you earn more by finishing lessons, and this counter is always live.',
    roles: ['student', 'teacher', 'parent'],
    keywords: ['sparks', 'credits', 'balance', 'currency', 'cost', 'pay'],
  },
  {
    id: 'language',
    target: 'language',
    title: 'Learn in your language',
    body: 'Switch between 17 languages, including Bahasa Malaysia and Bahasa Indonesia. Lessons, the AI tutor and generated audio all follow your choice.',
    roles: ['student', 'teacher', 'parent', 'admin', 'institution_admin'],
    keywords: ['language', 'translate', 'malay', 'bahasa', 'indonesian', 'multilingual'],
  },
  {
    id: 'notifications',
    target: 'notifications',
    title: 'Nothing slips past',
    body: 'Due dates, marked work, replies and announcements land here.',
    roles: ['student', 'teacher', 'parent', 'admin', 'institution_admin'],
    keywords: ['notifications', 'alerts', 'bell', 'reminders'],
  },
  {
    id: 'profile-menu',
    target: 'profile',
    title: 'Your account',
    body: 'Your photo, details and preferences live here.',
    roles: ['student', 'teacher', 'parent', 'admin', 'institution_admin'],
    keywords: ['profile', 'account', 'settings', 'password', 'avatar'],
  },

  /* ── Student ── */
  {
    id: 'student-home',
    route: '/dashboard/student',
    title: 'Your learning home',
    body: 'Your courses, streak and what to do next — all on one screen. Start here each day.',
    roles: ['student'],
    keywords: ['dashboard', 'home', 'overview', 'progress', 'streak'],
  },
  {
    id: 'student-courses',
    route: '/dashboard/student/courses',
    title: 'Your courses',
    body: 'Everything you’re enrolled in. Open one and you get the chapters, lessons and your progress through them.',
    roles: ['student'],
    keywords: ['courses', 'enrolled', 'lessons', 'learn', 'study', 'chapters'],
  },
  {
    id: 'student-marketplace',
    route: '/courses',
    title: 'Find something new',
    body: 'Browse courses, eBooks and past papers. The first lesson of every paid course is free, so you can try before you commit.',
    roles: ['student', 'parent'],
    keywords: ['marketplace', 'buy', 'enrol', 'enroll', 'browse', 'new course', 'free'],
  },
  {
    id: 'student-ai-teachers',
    route: '/ai-teachers',
    title: 'Nine AI teachers',
    body: 'Each has their own subject and their own voice. Chat, or press Talk live to actually speak with them.',
    roles: ['student'],
    keywords: ['ai teacher', 'tutor', 'ayla', 'talk', 'voice', 'speak', 'ask'],
  },
  {
    id: 'student-goals',
    route: '/dashboard/student/tasks',
    title: 'Daily goals',
    body: 'Set what you’ll do today and tick it off. Finishing goals earns Sparks and keeps your streak alive.',
    roles: ['student'],
    keywords: ['goals', 'tasks', 'todo', 'daily', 'streak', 'plan'],
  },
  {
    id: 'student-transcript',
    route: '/dashboard/student/transcript',
    title: 'Your record',
    body: 'Grades, GPA and attendance for any term. The print button produces a proper report card you can hand to a parent.',
    roles: ['student'],
    keywords: ['transcript', 'grades', 'gpa', 'report card', 'results', 'print'],
  },
  {
    id: 'ai-studio',
    route: '/ai-studio',
    title: 'Turn anything into study material',
    body: 'Drop in notes, a PDF or a transcript and get flashcards, quizzes, mind maps, audio and video back.',
    roles: ['student', 'teacher'],
    keywords: ['ai studio', 'quill', 'generate', 'flashcards', 'quiz', 'notes', 'upload', 'pdf'],
  },

  /* ── Teacher ── */
  {
    id: 'teacher-home',
    route: '/dashboard/teacher',
    title: 'Your teaching overview',
    body: 'Classes, what needs marking, and how your students are doing.',
    roles: ['teacher'],
    keywords: ['dashboard', 'overview', 'home', 'classes'],
  },
  {
    id: 'teacher-courses',
    route: '/dashboard/teacher/courses',
    title: 'Build a course',
    body: 'Create courses and products here. Write the material, let Quill turn it into every study format, then publish.',
    roles: ['teacher'],
    keywords: ['create course', 'build', 'publish', 'product', 'upload', 'author'],
  },
  {
    id: 'teacher-gradebook',
    route: '/dashboard/teacher/gradebook',
    title: 'Marking',
    body: 'Everything awaiting a grade, filterable by student or lesson, with CSV export when you need it elsewhere.',
    roles: ['teacher'],
    keywords: ['gradebook', 'marking', 'grade', 'submissions', 'export'],
  },
  {
    id: 'teacher-reports',
    route: '/dashboard/teacher/report-cards',
    title: 'Report cards',
    body: 'Pick a term, generate the class, and the AI drafts a comment per student from their actual results. Always read them before sending.',
    roles: ['teacher'],
    keywords: ['report card', 'comments', 'term', 'parents', 'reports'],
  },
  {
    id: 'teacher-attendance',
    route: '/dashboard/teacher/attendance',
    title: 'Attendance',
    body: 'Mark a register by student name, in one pass.',
    roles: ['teacher'],
    keywords: ['attendance', 'register', 'present', 'absent'],
  },

  /* ── Parent ── */
  {
    id: 'parent-home',
    route: '/dashboard/parent',
    title: 'How your child is doing',
    body: 'Their activity, subject performance and goals — updated as they work.',
    roles: ['parent'],
    keywords: ['child', 'progress', 'dashboard', 'overview'],
  },
  {
    id: 'parent-duedates',
    route: '/dashboard/parent/duedates',
    title: 'What’s coming up',
    body: 'Assignments, exams and classes on the horizon, so nothing is a surprise.',
    roles: ['parent'],
    keywords: ['due dates', 'deadlines', 'homework', 'upcoming', 'exams'],
  },
  {
    id: 'parent-messages',
    route: '/dashboard/messages',
    title: 'Talk to teachers',
    body: 'Message your child’s teachers and the school directly.',
    roles: ['parent', 'student', 'teacher'],
    keywords: ['message', 'chat', 'contact', 'teacher', 'talk'],
  },

  /* ── Admin ── */
  {
    id: 'admin-home',
    route: '/dashboard/admin',
    title: 'Platform analytics',
    body: 'Sign-ups, activity and revenue across everything.',
    roles: ['admin', 'institution_admin'],
    keywords: ['analytics', 'dashboard', 'stats', 'revenue', 'overview'],
  },
  {
    id: 'admin-curriculum',
    route: '/dashboard/admin/curriculum',
    title: 'Curriculum CMS',
    body: 'Programmes, subjects, units and lessons. Quill can design a whole scheme of work, then you edit anything it proposes.',
    roles: ['admin', 'institution_admin'],
    keywords: ['curriculum', 'cms', 'programme', 'subject', 'unit', 'lesson', 'build', 'content'],
  },
  {
    id: 'admin-format',
    route: '/dashboard/admin/curriculum',
    title: 'Choose the content format',
    body: 'Each course picks a format template — prose, revision notes, law with IRAC and case law, STEM with worked examples. Generation follows it instead of defaulting to bullet points.',
    roles: ['admin', 'institution_admin'],
    keywords: ['format', 'template', 'bullet', 'prose', 'style', 'law', 'irac'],
  },
  {
    id: 'admin-courses',
    route: '/dashboard/admin/courses',
    title: 'Every course',
    body: 'Approve what teachers submit, publish, and seed the launch catalogue.',
    roles: ['admin'],
    keywords: ['courses', 'approve', 'publish', 'catalogue', 'seed', 'marketplace'],
  },
  {
    id: 'admin-users',
    route: '/dashboard/admin/users',
    title: 'Users and Sparks',
    body: 'Everyone who has signed up. Filter, sort, suspend, reset a password, and grant Sparks from the row itself.',
    roles: ['admin'],
    keywords: ['users', 'people', 'sparks', 'suspend', 'accounts', 'grant', 'manage'],
  },
  {
    id: 'admin-allocations',
    route: '/dashboard/admin/allocations',
    title: 'Access and coupons',
    body: 'Set someone’s tier, grant them a course outright, or issue scholarship codes that do it for you.',
    roles: ['admin'],
    keywords: ['access', 'allocation', 'tier', 'coupon', 'scholarship', 'grant', 'code', 'free'],
  },
  {
    id: 'admin-institutions',
    route: '/dashboard/admin/institutions',
    title: 'Institutions',
    body: 'Schools on the platform, each with its own white-label subdomain and branding.',
    roles: ['admin'],
    keywords: ['institution', 'school', 'white label', 'branding', 'subdomain', 'b2b'],
  },
];

export function stepsForRole(role: TourRole): TourStep[] {
  return TOUR_STEPS.filter(s => s.roles.includes(role));
}

export function getStep(id: string): TourStep | undefined {
  return TOUR_STEPS.find(s => s.id === id);
}

/**
 * The default tour: orientation first, then the handful of destinations that
 * matter most for that role. Deliberately short — a 20-step tour gets skipped.
 */
const DEFAULT_ORDER: Record<TourRole, string[]> = {
  student: ['welcome', 'sidebar', 'sparks', 'student-home', 'student-courses', 'student-ai-teachers', 'ai-studio', 'student-goals'],
  teacher: ['welcome', 'sidebar', 'teacher-home', 'teacher-courses', 'ai-studio', 'teacher-gradebook', 'teacher-reports'],
  parent: ['welcome', 'sidebar', 'parent-home', 'parent-duedates', 'parent-messages'],
  admin: ['welcome', 'sidebar', 'admin-home', 'admin-curriculum', 'admin-format', 'admin-users', 'admin-allocations'],
  institution_admin: ['welcome', 'sidebar', 'admin-home', 'admin-curriculum', 'admin-format'],
};

export function defaultTour(role: TourRole): TourStep[] {
  return (DEFAULT_ORDER[role] ?? DEFAULT_ORDER.student)
    .map(getStep)
    .filter((s): s is TourStep => !!s);
}

/**
 * Keyword fallback for when the AI is unavailable.
 *
 * Scores a step by how many of the question's words appear in its keywords,
 * title or body. Always returns something — an empty tour would leave the
 * person staring at a guide that did nothing.
 */
export function matchSteps(question: string, role: TourRole, limit = 5): TourStep[] {
  const words = question.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  if (!words.length) return defaultTour(role);

  const scored = stepsForRole(role)
    .filter(s => s.id !== 'welcome')
    .map(step => {
      const hay = `${step.keywords.join(' ')} ${step.title} ${step.body}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (step.keywords.some(k => k.includes(w) || w.includes(k))) score += 3;
        else if (hay.includes(w)) score += 1;
      }
      return { step, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.step);

  return scored.length ? scored : defaultTour(role).slice(0, limit);
}
