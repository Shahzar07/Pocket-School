import {
  emptyReactions,
  type Audience,
  type Reaction,
  type WallComment,
  type WallPost,
} from './model';

const IMAGE_LIMIT = 5 * 1024 * 1024;

export function checkWallImage(file: { type: string; size: number }): string {
  if (!file.type.startsWith('image/')) return 'Photos need to be an image file.';
  if (file.size <= 0 || file.size >= IMAGE_LIMIT) return 'Photos need to be under 5 MB.';
  return '';
}

export function wallHandle(name: string, uid: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  return slug || `learner-${uid.slice(0, 6)}`;
}

export interface StoredComment {
  id: string;
  authorId: string;
  authorHandle: string;
  body: string;
  createdAt: number;
  parentId: string;
  image?: string;
}

export function nestComments(rows: readonly StoredComment[]): WallComment[] {
  const top = rows.filter((row) => !row.parentId);
  const replies = rows.filter((row) => row.parentId);
  return top.map((row) => ({
    id: row.id,
    authorHandle: row.authorHandle,
    body: row.body,
    createdAt: row.createdAt,
    image: row.image,
    replies: replies
      .filter((reply) => reply.parentId === row.id)
      .map((reply) => ({
        id: reply.id,
        authorHandle: reply.authorHandle,
        body: reply.body,
        createdAt: reply.createdAt,
        image: reply.image,
        replies: [],
      })),
  }));
}

export function postFromStored(
  id: string,
  data: Record<string, unknown>,
  comments: readonly StoredComment[],
  mine: Reaction | '',
): WallPost {
  const reactions = emptyReactions();
  const raw = data.reactions;
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(reactions) as Reaction[]) {
      const value = (raw as Record<string, unknown>)[key];
      reactions[key] = typeof value === 'number' ? value : 0;
    }
  }
  const audience = (data.audience as Audience) || 'school';
  const feed = data.feed === 'class' || data.feed === 'group' || data.feed === 'alumni' || data.feed === 'event'
    ? data.feed
    : 'school';
  return {
    id,
    authorHandle: String(data.authorHandle || ''),
    body: String(data.body || ''),
    audience,
    feed,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    feeling: typeof data.feeling === 'string' ? data.feeling : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    locationOn: data.locationOn === true,
    location: typeof data.location === 'string' ? data.location : undefined,
    images: Array.isArray(data.images) ? data.images.filter((src): src is string => typeof src === 'string') : [],
    schoolId: String(data.schoolId || ''),
    reactions,
    mine,
    comments: nestComments(comments),
    shares: typeof data.shares === 'number' ? data.shares : 0,
    saved: false,
    hidden: false,
    moderation: data.moderation === 'hold' || data.moderation === 'block' ? data.moderation : 'allow',
  };
}
