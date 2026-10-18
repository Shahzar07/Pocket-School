/**
 * Facebook-style wall shared by community, class, school, groups, alumni,
 * and profile timelines. The mobile app should use these same fields.
 */

import { asAgeTier, isMinorTier, type AgeTier } from '../age-tier';
import { moderateText, type ModerationDecision } from '../community/moderation';

export const AUDIENCES = ['public', 'school', 'class', 'group', 'only-me'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const REACTIONS = ['like', 'love', 'celebrate', 'insightful', 'support'] as const;
export type Reaction = (typeof REACTIONS)[number];

export const FEEDS = ['all', 'school', 'class', 'group', 'alumni', 'event'] as const;
export type FeedFilter = (typeof FEEDS)[number];

export const FEELINGS = ['focused', 'proud', 'curious', 'grateful', 'ready'] as const;

export interface WallPerson {
  handle: string;
  name: string;
  role: string;
  school: string;
  schoolId: string;
  verified: boolean;
  initials: string;
  tint: string;
  about: string;
  skills: string[];
  groups: string[];
  cover: string;
  photos: string[];
}

export interface WallComment {
  id: string;
  authorHandle: string;
  body: string;
  createdAt: number;
  image?: string;
  replies: WallComment[];
}

export interface WallPost {
  id: string;
  authorHandle: string;
  body: string;
  audience: Audience;
  feed: Exclude<FeedFilter, 'all'>;
  createdAt: number;
  feeling?: string;
  tags: string[];
  locationOn: boolean;
  location?: string;
  images: string[];
  link?: { title: string; domain: string; image?: string };
  poll?: { question: string; options: { id: string; label: string; votes: number }[]; voted?: string };
  event?: { title: string; when: string; place: string };
  sharedId?: string;
  pinned?: boolean;
  schoolId: string;
  reactions: Record<Reaction, number>;
  mine: Reaction | '';
  comments: WallComment[];
  shares: number;
  saved: boolean;
  hidden: boolean;
  moderation: ModerationDecision;
}

export interface WallViewer {
  handle: string;
  ageTier: AgeTier;
  schoolId: string;
}

export interface WallSide {
  events: { id: string; title: string; when: string; place: string }[];
  groups: { id: string; name: string; members: number }[];
  moments: { id: string; name: string; detail: string }[];
  online: { handle: string; name: string }[];
}

const HOUR = 60 * 60 * 1000;

export function emptyReactions(): Record<Reaction, number> {
  return { like: 0, love: 0, celebrate: 0, insightful: 0, support: 0 };
}

export function audienceChoices(ageTier: unknown): Audience[] {
  if (isMinorTier(asAgeTier(ageTier))) return ['school', 'class', 'group'];
  return ['public', 'school', 'class', 'group', 'only-me'];
}

export function audienceLabel(audience: Audience): string {
  if (audience === 'public') return 'Public adults';
  if (audience === 'school') return 'School';
  if (audience === 'class') return 'Class';
  if (audience === 'group') return 'Group';
  return 'Only me';
}

export function canUseAudience(ageTier: unknown, audience: Audience): { ok: boolean; reason: string } {
  if (!audienceChoices(ageTier).includes(audience)) {
    return { ok: false, reason: 'Under-18 posts stay in your school, class, or group.' };
  }
  return { ok: true, reason: '' };
}

export function canSeePost(post: WallPost, viewer: WallViewer): boolean {
  if (post.hidden || post.moderation === 'block') return false;
  if (post.authorHandle === viewer.handle) return true;
  if (post.audience === 'only-me') return false;
  if (isMinorTier(viewer.ageTier)) {
    if (post.audience === 'public') return false;
    if (!viewer.schoolId || post.schoolId !== viewer.schoolId) return false;
  }
  if (post.moderation === 'hold' && post.authorHandle !== viewer.handle) return false;
  return true;
}

export function screenWallDraft(input: {
  body: string;
  ageTier: unknown;
  audience: Audience;
  authorSchoolId: string;
  hasImage: boolean;
}): { decision: ModerationDecision; reason: string } {
  const scope = canUseAudience(input.ageTier, input.audience);
  if (!scope.ok) return { decision: 'block', reason: scope.reason };
  if (isMinorTier(asAgeTier(input.ageTier)) && !input.authorSchoolId.trim()) {
    return { decision: 'block', reason: 'Under-18 posts stay inside your school.' };
  }
  const local = moderateText(input.body || (input.hasImage ? 'photo' : ''));
  if (local.decision === 'block') return { decision: 'block', reason: 'ET AI blocked this post.' };
  if (input.hasImage && isMinorTier(asAgeTier(input.ageTier))) {
    return { decision: 'hold', reason: 'ET AI is holding this photo for your school Safety Desk.' };
  }
  if (local.decision === 'hold') return { decision: 'hold', reason: 'ET AI is holding this for the Safety Desk.' };
  return { decision: 'allow', reason: '' };
}

export function postScore(post: WallPost): number {
  const reactions = REACTIONS.reduce((sum, key) => sum + post.reactions[key], 0);
  const comments = post.comments.reduce((sum, comment) => sum + 1 + comment.replies.length, 0);
  return reactions * 2 + comments * 3 + post.shares;
}

export function sortFeed(posts: readonly WallPost[], mode: 'top' | 'recent'): WallPost[] {
  const pinned = posts.filter((post) => post.pinned);
  const rest = posts.filter((post) => !post.pinned);
  const ordered = [...rest].sort((a, b) => mode === 'recent' ? b.createdAt - a.createdAt : postScore(b) - postScore(a) || b.createdAt - a.createdAt);
  return [...pinned, ...ordered];
}

export function filterFeed(posts: readonly WallPost[], filter: FeedFilter, viewer: WallViewer): WallPost[] {
  return posts.filter((post) => {
    if (!canSeePost(post, viewer)) return false;
    if (filter === 'all') return true;
    return post.feed === filter;
  });
}

export function parseTokens(body: string): { mentions: string[]; tags: string[] } {
  const mentions = [...body.matchAll(/@([a-z0-9-]{2,32})/gi)].map((match) => match[1].toLowerCase());
  const tags = [...body.matchAll(/#([a-z0-9-]{2,32})/gi)].map((match) => match[1].toLowerCase());
  return { mentions: [...new Set(mentions)], tags: [...new Set(tags)] };
}

export function toggleReaction(post: WallPost, reaction: Reaction): WallPost {
  const reactions = { ...post.reactions };
  if (post.mine) reactions[post.mine] = Math.max(0, reactions[post.mine] - 1);
  const mine = post.mine === reaction ? '' : reaction;
  if (mine) reactions[mine] += 1;
  return { ...post, reactions, mine };
}

export function relativeTime(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function gridSpans(count: number): number[] {
  if (count <= 1) return [2];
  if (count === 2) return [1, 1];
  if (count === 3) return [2, 1, 1];
  if (count === 4) return [1, 1, 1, 1];
  return [1, 1, 1, 1, 1];
}

export function reactionTotal(post: WallPost): number {
  return REACTIONS.reduce((sum, key) => sum + post.reactions[key], 0);
}

export function rochfordWall(now = Date.UTC(2026, 9, 18, 8, 0, 0)): { people: WallPerson[]; posts: WallPost[]; side: WallSide } {
  const people: WallPerson[] = [
    {
      handle: 'amina', name: 'Amina Rahman', role: 'Student · IGCSE', school: "Rochford's International School", schoolId: 'rochford',
      verified: true, initials: 'AR', tint: '#D4F6F2', about: 'Biology and coastal fieldwork. I keep lab notes on the class wall.',
      skills: ['Microscopy', 'Data tables', 'Field sketches'], groups: ['Biology bench', 'Coastal club'],
      cover: '/blog/how-schools-use-poket-school.webp', photos: ['/landing/exams.webp', '/landing/reads.webp', '/landing/goals.webp'],
    },
    {
      handle: 'wei', name: 'Wei Lin', role: 'Student · IGCSE', school: "Rochford's International School", schoolId: 'rochford',
      verified: true, initials: 'WL', tint: '#D7EAF8', about: 'Maths first, then a short run. I share worked examples with my class.',
      skills: ['Algebra', 'Graphs'], groups: ['Maths clinic'],
      cover: '/landing/analytics.webp', photos: ['/landing/analytics.webp'],
    },
    {
      handle: 'priya', name: 'Priya Shah', role: 'Student · A-Level', school: "Rochford's International School", schoolId: 'rochford',
      verified: true, initials: 'PS', tint: '#E7E1F5', about: 'Chemistry practicals and the school science fair.',
      skills: ['Titration', 'Lab safety'], groups: ['Science fair crew'],
      cover: '/landing/integrity.webp', photos: ['/landing/integrity.webp', '/blog/igcse-revision-with-et-ai.webp'],
    },
    {
      handle: 'omar', name: 'Omar Haddad', role: 'Alumni · class of 2019', school: "Rochford's International School", schoolId: 'rochford',
      verified: true, initials: 'OH', tint: '#D7EFE6', about: 'Marine engineering in Penang. I mentor IGCSE science when the school asks.',
      skills: ['Mentoring', 'Engineering'], groups: ['Alumni 2019'],
      cover: '/landing/tutors.webp', photos: ['/landing/tutors.webp', '/blog/igcse-revision-with-et-ai.webp'],
    },
    {
      handle: 'et-biology', name: 'ET Biology', role: 'ET AI teacher', school: "Rochford's International School", schoolId: 'rochford',
      verified: true, initials: 'EB', tint: '#D4F6F2', about: 'School biology tutor. Posts stay on the class wall.',
      skills: ['Cell biology', 'Ecology'], groups: ['Biology bench'],
      cover: '/landing/modes.webp', photos: ['/landing/modes.webp'],
    },
  ];

  const posts: WallPost[] = [
    {
      id: 'fair', authorHandle: 'et-biology', audience: 'school', feed: 'school', pinned: true, createdAt: now - 5 * HOUR,
      body: 'Pinned for the whole school. The science fair benches open on Thursday at 16:00 in the atrium. Class 10B brings the pond study. #sciencefair',
      tags: [], locationOn: false, images: ['/blog/how-schools-use-poket-school.webp'], schoolId: 'rochford',
      reactions: { like: 18, love: 4, celebrate: 6, insightful: 2, support: 3 }, mine: '', comments: [], shares: 2, saved: false, hidden: false, moderation: 'allow',
    },
    {
      id: 'pond', authorHandle: 'amina', audience: 'class', feed: 'class', createdAt: now - 2 * HOUR,
      feeling: 'proud', tags: ['wei', 'priya'], locationOn: false,
      body: 'Pond sample is in. Six species on the bench, and the dragonfly made the write-up. @wei the count table is in the shared lesson. #fieldwork',
      images: ['/landing/exams.webp', '/landing/reads.webp', '/landing/goals.webp', '/landing/behaviour.webp', '/landing/snap.webp'],
      schoolId: 'rochford',
      reactions: { like: 11, love: 6, celebrate: 3, insightful: 4, support: 1 }, mine: 'love',
      comments: [
        {
          id: 'c1', authorHandle: 'wei', body: 'The third photo is the one for the graph axis.', createdAt: now - 90 * 60 * 1000, replies: [
            { id: 'c1a', authorHandle: 'amina', body: '@wei I cropped it and dropped the location data before uploading.', createdAt: now - 80 * 60 * 1000, replies: [] },
          ],
        },
        { id: 'c2', authorHandle: 'priya', body: 'Adding the fair caption under this.', createdAt: now - 70 * 60 * 1000, image: '/landing/integrity.webp', replies: [] },
      ],
      shares: 1, saved: true, hidden: false, moderation: 'allow',
    },
    {
      id: 'poll', authorHandle: 'priya', audience: 'school', feed: 'school', createdAt: now - 3 * HOUR,
      body: 'When should the chemistry clinic meet this week?', locationOn: false, tags: [], images: [], schoolId: 'rochford',
      poll: { question: 'Clinic time', options: [{ id: 'tue', label: 'Tuesday 16:00', votes: 14 }, { id: 'wed', label: 'Wednesday 16:30', votes: 9 }, { id: 'thu', label: 'Thursday 15:30', votes: 6 }] },
      reactions: { like: 7, love: 1, celebrate: 0, insightful: 2, support: 4 }, mine: '', comments: [], shares: 0, saved: false, hidden: false, moderation: 'allow',
    },
    {
      id: 'talk', authorHandle: 'omar', audience: 'group', feed: 'alumni', createdAt: now - 26 * HOUR,
      body: 'Alumni career talk next month. Marine engineering, live from Penang, and a short question time for IGCSE science. Adults only in the chat afterwards.',
      locationOn: false, tags: [], images: ['/landing/tutors.webp'], schoolId: 'rochford',
      event: { title: 'Marine engineering talk', when: 'Thu 12 Nov · 18:00 Asia/Kuala_Lumpur', place: 'Online · Meet link after you register' },
      reactions: { like: 9, love: 2, celebrate: 5, insightful: 3, support: 2 }, mine: '', comments: [], shares: 3, saved: false, hidden: false, moderation: 'allow',
    },
    {
      id: 'lesson', authorHandle: 'wei', audience: 'class', feed: 'class', createdAt: now - 4 * HOUR,
      body: 'Sharing the worked example ET Maths set for simultaneous equations. The graph is the part I want checked.',
      locationOn: false, tags: [], images: [], schoolId: 'rochford',
      link: { title: 'Simultaneous equations · lesson', domain: 'poketschool.ai', image: '/landing/analytics.webp' },
      reactions: { like: 5, love: 0, celebrate: 1, insightful: 8, support: 1 }, mine: '', comments: [], shares: 1, saved: false, hidden: false, moderation: 'allow',
    },
    {
      id: 'passport', authorHandle: 'amina', audience: 'school', feed: 'school', createdAt: now - 8 * HOUR,
      body: 'Skills passport update. Microscopy is now verified from the unit test, not typed in by me. #skillspassport',
      locationOn: false, tags: [], images: ['/blog/igcse-revision-with-et-ai.webp'], schoolId: 'rochford',
      reactions: { like: 6, love: 2, celebrate: 9, insightful: 1, support: 2 }, mine: '', comments: [], shares: 0, saved: false, hidden: false, moderation: 'allow',
    },
    {
      id: 'reads', authorHandle: 'wei', audience: 'group', feed: 'group', createdAt: now - 6 * HOUR,
      feeling: 'focused', body: 'Reading group finished the coastal chapter. Notes stay private until I share them here.',
      locationOn: false, tags: [], images: ['/blog/make-it-stick-review.webp'], schoolId: 'rochford',
      reactions: { like: 4, love: 1, celebrate: 0, insightful: 3, support: 2 }, mine: '', comments: [], shares: 0, saved: false, hidden: false, moderation: 'allow',
    },
    {
      id: 'open-day', authorHandle: 'omar', audience: 'group', feed: 'event', createdAt: now - 30 * HOUR,
      body: 'Open afternoon for the alumni year group. Maps stay off unless you turn location on yourself.',
      locationOn: false, tags: [], images: ['/landing/payments.webp', '/landing/store.webp'], schoolId: 'rochford',
      event: { title: 'Alumni open afternoon', when: 'Sat 21 Nov · 14:00', place: "Rochford's International School atrium" },
      reactions: { like: 8, love: 3, celebrate: 4, insightful: 0, support: 1 }, mine: '', comments: [], shares: 2, saved: false, hidden: false, moderation: 'allow',
    },
  ];

  return {
    people,
    posts,
    side: {
      events: [
        { id: 'fair-day', title: 'Science fair', when: 'Thu 16:00', place: 'Atrium' },
        { id: 'talk', title: 'Marine engineering talk', when: '12 Nov · 18:00', place: 'Online' },
      ],
      groups: [
        { id: 'bio', name: 'Biology bench', members: 28 },
        { id: 'coast', name: 'Coastal club', members: 16 },
        { id: 'alumni', name: 'Alumni 2019', members: 42 },
      ],
      moments: [
        { id: 'priya-b', name: 'Priya Shah', detail: 'Birthday today' },
        { id: 'amina-s', name: 'Amina Rahman', detail: 'Microscopy verified' },
      ],
      online: [
        { handle: 'wei', name: 'Wei Lin' },
        { handle: 'priya', name: 'Priya Shah' },
        { handle: 'et-biology', name: 'ET Biology' },
      ],
    },
  };
}

export function personByHandle(people: readonly WallPerson[], handle: string): WallPerson | undefined {
  return people.find((person) => person.handle === handle);
}

export function postsByAuthor(posts: readonly WallPost[], handle: string, viewer: WallViewer): WallPost[] {
  return sortFeed(posts.filter((post) => post.authorHandle === handle && canSeePost(post, viewer)), 'recent');
}
