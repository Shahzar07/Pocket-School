import type { AlertTone, DashRole } from './home';
import { roleHome } from './home';

export interface PreviewStat {
  id: string;
  label: string;
  value: string;
  hint: string;
  series?: number[];
  ring?: number;
}

export interface PreviewAlert {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
}

export interface PreviewRow {
  id: string;
  title: string;
  detail: string;
}

export interface PreviewChild {
  id: string;
  name: string;
  tone: AlertTone;
  level: string;
}

export interface PreviewBadge {
  id: string;
  label: string;
  earned: boolean;
}

export interface PreviewHome {
  role: DashRole;
  name: string;
  stats: PreviewStat[];
  alerts: PreviewAlert[];
  rows: PreviewRow[];
  listTitle: string;
  children: PreviewChild[];
  badges: PreviewBadge[];
  showMap: boolean;
  notices: { id: string; title: string; type: string; link?: string }[];
}

const student: PreviewHome = {
  role: 'student',
  name: 'Mina',
  stats: [
    { id: 'streak', label: 'Streak', value: '4 days', hint: 'Keep the rhythm', series: [1, 2, 2, 3, 4] },
    { id: 'level', label: 'Level', value: 'Level 3', hint: '620 XP to go', ring: 38 },
    { id: 'lessons', label: 'This week', value: '3 lessons', hint: 'Fractions is next', series: [1, 0, 1, 0, 1] },
  ],
  alerts: [{
    id: 'note',
    tone: 'good',
    title: 'A note from ET AI',
    detail: 'Fractions is a good place to spend twenty minutes today.',
  }],
  rows: [
    { id: 'fractions', title: 'Fractions', detail: 'Mathematics · Lower Secondary' },
    { id: 'quest', title: "Today's quest", detail: 'Finish one practice set' },
  ],
  listTitle: 'Up next',
  children: [],
  badges: [
    { id: 'streak', label: '4-day streak', earned: true },
    { id: 'comeback', label: 'Comeback', earned: false },
  ],
  showMap: false,
  notices: [
    { id: 'n1', title: 'Fractions is ready', type: 'assignment', link: '/dashboard/student/learning' },
    { id: 'n2', title: 'Your streak is intact', type: 'goal' },
  ],
};

const parent: PreviewHome = {
  role: 'parent',
  name: 'Amina',
  stats: [
    { id: 'open', label: 'Open alerts', value: '1', hint: 'Mina · Lower Secondary', series: [2, 2, 1, 1, 1] },
    { id: 'seen', label: 'Actions taken', value: '3', hint: 'This month' },
    { id: 'streak', label: 'Engagement', value: '2 weeks', hint: 'You have stayed with them', series: [1, 1, 2, 2, 2] },
  ],
  alerts: [{
    id: 'mina',
    tone: 'cyan',
    title: 'Mina · Mathematics',
    detail: 'Version B is waiting. A short review comes first.',
  }],
  rows: [
    { id: 'talk', title: 'Talked with my child', detail: 'Logged yesterday' },
    { id: 'study', title: 'Study time', detail: '20 minutes after school' },
  ],
  listTitle: 'What you have done',
  children: [
    { id: 'mina', name: 'Mina', tone: 'cyan', level: 'Lower Secondary' },
    { id: 'arun', name: 'Arun', tone: 'coral', level: 'IGCSE' },
    { id: 'leila', name: 'Leila', tone: 'good', level: 'A-Level' },
  ],
  badges: [{ id: 'engaged', label: 'Engaged Parent', earned: true }],
  showMap: false,
  notices: [
    { id: 'n1', title: 'Mina’s progress note', type: 'general', link: '/dashboard/parent/progress' },
    { id: 'n2', title: 'Fee receipt', type: 'payment' },
  ],
};

const teacher: PreviewHome = {
  role: 'teacher',
  name: 'Ms Rahman',
  stats: [
    { id: 'open', label: 'Open alerts', value: '4', hint: '1 waiting on you', series: [3, 4, 4, 5, 4] },
    { id: 'reply', label: 'Average reply', value: '6h', hint: 'Inside the window' },
    { id: 'back', label: 'Back on track', value: '2', hint: 'This month', ring: 50 },
  ],
  alerts: [{
    id: 'noah',
    tone: 'critical',
    title: 'Noah · Biology',
    detail: 'Projected result 61. A check-in is due in 2 hours.',
  }],
  rows: [
    { id: 'mark', title: '6 pieces to mark', detail: 'Algebra · IGCSE' },
    { id: 'register', title: 'Register', detail: 'Lower Secondary · today' },
  ],
  listTitle: 'Today',
  children: [],
  badges: [{ id: 'rapid', label: 'Rapid Responder', earned: true }],
  showMap: false,
  notices: [
    { id: 'n1', title: 'Noah needs a check-in', type: 'general', link: '/dashboard/teacher/progress' },
    { id: 'n2', title: 'New submission', type: 'assignment' },
  ],
};

const institution: PreviewHome = {
  role: 'institution',
  name: 'Harbour Academy',
  stats: [
    { id: 'seats', label: 'Seats left', value: '18', hint: 'of 120', ring: 85 },
    { id: 'joins', label: 'Joins waiting', value: '3', hint: 'Oldest is 1 day' },
    { id: 'overdue', label: 'Overdue cases', value: '2', hint: 'Groups under 5 stay hidden', series: [4, 3, 3, 2, 2] },
  ],
  alerts: [{
    id: 'sla',
    tone: 'cyan',
    title: 'Two replies are past the window',
    detail: 'Both are high alerts. The academic lead can take them.',
  }],
  rows: [
    { id: 'join', title: '3 people waiting to join', detail: 'Approvals' },
    { id: 'plan', title: '4 recovery plans open', detail: 'Lower Secondary and IGCSE' },
  ],
  listTitle: 'This week',
  children: [],
  badges: [],
  showMap: true,
  notices: [
    { id: 'n1', title: 'Weekly wins', type: 'announcement' },
    { id: 'n2', title: 'Join request', type: 'general' },
  ],
};

const adminHome: PreviewHome = {
  role: 'admin',
  name: 'Harry',
  stats: [
    { id: 'schools', label: 'Institutions', value: '12', hint: '3 new this month', series: [8, 9, 9, 11, 12] },
    { id: 'alerts', label: 'Open alerts', value: '26', hint: 'Platform-wide' },
    { id: 'sla', label: 'Inside SLA', value: '91%', hint: 'Teacher replies', ring: 91 },
  ],
  alerts: [{
    id: 'mod',
    tone: 'coral',
    title: 'Moderation has 4 items',
    detail: 'Community posts waiting for a decision.',
  }],
  rows: [
    { id: 'price', title: 'Pricing', detail: 'Plans and Sparks' },
    { id: 'auto', title: 'Automation', detail: 'Progress alerts are on' },
  ],
  listTitle: 'Platform',
  children: [],
  badges: [],
  showMap: true,
  notices: [
    { id: 'n1', title: 'Insights refreshed', type: 'general', link: '/dashboard/admin/insights' },
    { id: 'n2', title: 'Moderation queue', type: 'integrity' },
  ],
};

const alumniHome: PreviewHome = {
  role: 'alumni',
  name: 'Leila',
  stats: [
    { id: 'certs', label: 'Certificates', value: '2', hint: 'Ready to share' },
    { id: 'level', label: 'Level', value: 'A-Level', hint: 'Completed' },
    { id: 'profile', label: 'Profile', value: 'Ready', hint: 'Schools you choose can see it', ring: 100 },
  ],
  alerts: [{
    id: 'share',
    tone: 'good',
    title: 'Your record is yours',
    detail: 'Share a certificate when you want to. Nothing is sent until you do.',
  }],
  rows: [
    { id: 'bio', title: 'Biology certificate', detail: 'A-Level · verified' },
    { id: 'maths', title: 'Mathematics certificate', detail: 'IGCSE · verified' },
  ],
  listTitle: 'You can share',
  children: [],
  badges: [{ id: 'done', label: 'Course complete', earned: true }],
  showMap: false,
  notices: [{ id: 'n1', title: 'Certificate ready', type: 'grade' }],
};

const recruiterHome: PreviewHome = {
  role: 'recruiter',
  name: 'North Clinic',
  stats: [
    { id: 'lists', label: 'Talent lists', value: '1', hint: 'Shared by Harbour Academy' },
    { id: 'people', label: 'Profiles', value: '6', hint: 'With consent' },
    { id: 'messages', label: 'Messages', value: '2', hint: 'Unread', series: [0, 1, 1, 2, 2] },
  ],
  alerts: [{
    id: 'consent',
    tone: 'good',
    title: 'Only shared profiles appear',
    detail: 'A school sends a list. Poket does not invent people or scores.',
  }],
  rows: [
    { id: 'list', title: 'A-Level science', detail: '6 profiles · Harbour Academy' },
    { id: 'note', title: 'Message from the school', detail: 'Levels and certificates only' },
  ],
  listTitle: 'Shared with you',
  children: [],
  badges: [],
  showMap: false,
  notices: [{ id: 'n1', title: 'A list was shared', type: 'message' }],
};

const PREVIEWS: Record<DashRole, PreviewHome> = {
  student,
  parent,
  teacher,
  institution,
  admin: adminHome,
  alumni: alumniHome,
  recruiter: recruiterHome,
};

export function previewHome(role: DashRole): PreviewHome {
  return PREVIEWS[role];
}

export function previewTitle(role: DashRole): string {
  return roleHome(role).label;
}
