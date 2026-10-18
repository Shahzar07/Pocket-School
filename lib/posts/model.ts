/**
 * One post shape for community, groups, alumni, clubs, and the yearbook wall.
 * The mobile app should send the same fields.
 */

import { asAgeTier, isMinorTier } from '../age-tier';
import { MEDIA_LIMITS, mediaKind, postStoragePath } from '../media/prepare';

export const POST_SURFACES = ['community', 'group', 'alumni', 'club', 'yearbook'] as const;
export type PostSurface = (typeof POST_SURFACES)[number];
export const REACTIONS = ['clap', 'thanks', 'idea'] as const;
export type ReactionId = (typeof REACTIONS)[number];

export interface PostMedia {
  path: string;
  kind: 'image' | 'video';
  width: number;
  height: number;
  contentType: string;
  url?: string;
}

export interface FeedPost {
  id: string;
  authorName: string;
  body: string;
  kind: string;
  media: PostMedia[];
  reactions: Record<ReactionId, number>;
  mine: ReactionId | '';
  comments: { id: string; authorName: string; body: string }[];
  shares: number;
  createdAt: number;
  moderation: string;
}

export function emptyReactions(): Record<ReactionId, number> {
  return { clap: 0, thanks: 0, idea: 0 };
}

export function minorSchoolScope(input: {
  ageTier: unknown;
  authorSchoolId: string;
  surfaceSchoolId: string;
}): { ok: boolean; reason: string } {
  if (!isMinorTier(asAgeTier(input.ageTier))) return { ok: true, reason: '' };
  const school = input.authorSchoolId.trim();
  if (!school || school !== input.surfaceSchoolId.trim()) {
    return { ok: false, reason: 'Under-18 posts stay inside your school.' };
  }
  return { ok: true, reason: '' };
}

export function cleanPostMedia(uid: string, value: unknown): PostMedia[] {
  if (!Array.isArray(value)) return [];
  const prefix = `media/${uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)}/posts/`;
  return value.slice(0, MEDIA_LIMITS.maxItems).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<PostMedia>;
    const path = typeof row.path === 'string' ? row.path : '';
    const kind = row.kind === 'video' ? 'video' : row.kind === 'image' ? 'image' : null;
    const contentType = typeof row.contentType === 'string' ? row.contentType : '';
    if (!kind || !path.startsWith(prefix) || mediaKind(contentType) !== kind) return [];
    return [{
      path,
      kind,
      width: typeof row.width === 'number' ? Math.max(0, Math.round(row.width)) : 0,
      height: typeof row.height === 'number' ? Math.max(0, Math.round(row.height)) : 0,
      contentType,
      url: typeof row.url === 'string' ? row.url : '',
    }];
  });
}

export function toggleReaction(
  reactions: Record<ReactionId, number>,
  mine: ReactionId | '',
  next: ReactionId,
): { reactions: Record<ReactionId, number>; mine: ReactionId | '' } {
  const copy = { ...reactions };
  if (mine && copy[mine] > 0) copy[mine] -= 1;
  if (mine === next) return { reactions: copy, mine: '' };
  copy[next] += 1;
  return { reactions: copy, mine: next };
}

export function gridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  return 'grid-cols-2';
}

export function samplePosts(): FeedPost[] {
  return [
    {
      id: 'lab-day',
      authorName: 'Amina',
      body: 'The biology bench after the pond sample. We logged six species.',
      kind: 'win',
      media: [
        { path: postStoragePath('demo', 'pond-1', 'image/jpeg'), kind: 'image', width: 1200, height: 800, contentType: 'image/jpeg', url: '' },
        { path: postStoragePath('demo', 'pond-2', 'image/jpeg'), kind: 'image', width: 1200, height: 800, contentType: 'image/jpeg', url: '' },
      ],
      reactions: { clap: 4, thanks: 1, idea: 0 },
      mine: '',
      comments: [{ id: 'c1', authorName: 'Wei', body: 'The dragonfly shot is the one for the write-up.' }],
      shares: 1,
      createdAt: 1_760_000_000_000,
      moderation: 'allow',
    },
  ];
}
