'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadPreparedMedia } from '@/lib/media/upload';
import { screenWallDraft, type Audience, type Reaction, type WallPost } from './model';
import { checkWallImage, postFromStored, wallHandle, type StoredComment } from './live-shape';

export interface WallActor {
  uid: string;
  name: string;
  schoolId: string;
  ageTier: string;
  adult: boolean;
}

function handleOf(actor: WallActor): string {
  return wallHandle(actor.name, actor.uid);
}

async function hydrate(id: string, data: Record<string, unknown>, uid: string): Promise<WallPost> {
  const [commentsSnap, reactionSnap] = await Promise.all([
    getDocs(query(collection(db, 'wall_posts', id, 'comments'), orderBy('createdAt', 'asc'), limit(80))),
    getDoc(doc(db, 'wall_posts', id, 'reactions', uid)),
  ]);
  const comments: StoredComment[] = commentsSnap.docs.map((row) => {
    const value = row.data();
    return {
      id: row.id,
      authorId: String(value.authorId || ''),
      authorHandle: String(value.authorHandle || ''),
      body: String(value.body || ''),
      createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
      parentId: String(value.parentId || ''),
      image: typeof value.image === 'string' ? value.image : undefined,
    };
  });
  const kind = reactionSnap.exists() ? reactionSnap.data().kind : '';
  const mine = kind === 'like' || kind === 'love' || kind === 'celebrate' || kind === 'insightful' || kind === 'support' ? kind : '';
  return postFromStored(id, data, comments, mine);
}

export function watchWall(
  actor: WallActor,
  onPosts: (posts: WallPost[]) => void,
  onError: (message: string) => void,
): () => void {
  const buckets = new Map<string, WallPost[]>();
  const emit = () => {
    const seen = new Map<string, WallPost>();
    for (const rows of buckets.values()) {
      for (const post of rows) seen.set(post.id, post);
    }
    onPosts([...seen.values()].sort((a, b) => b.createdAt - a.createdAt));
  };
  const listen = (key: string, view: Query) => onSnapshot(view, (snap) => {
    Promise.all(snap.docs.map((row) => hydrate(row.id, row.data() as Record<string, unknown>, actor.uid)))
      .then((posts) => {
        buckets.set(key, posts);
        emit();
      })
      .catch((error: Error) => onError(error.message));
  }, (error) => onError(error.message));

  const stops = [
    listen('mine', query(collection(db, 'wall_posts'), where('authorId', '==', actor.uid), orderBy('createdAt', 'desc'), limit(40))),
  ];
  if (actor.schoolId) {
    for (const audience of ['school', 'class', 'group'] as const) {
      stops.push(listen(audience, query(
        collection(db, 'wall_posts'),
        where('schoolId', '==', actor.schoolId),
        where('audience', '==', audience),
        orderBy('createdAt', 'desc'),
        limit(40),
      )));
    }
  }
  if (actor.adult) {
    stops.push(listen('public', query(
      collection(db, 'wall_posts'),
      where('audience', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(20),
    )));
  }
  return () => stops.forEach((stop) => stop());
}

export function watchHandle(
  actor: WallActor,
  handle: string,
  onPosts: (posts: WallPost[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!actor.schoolId) {
    onPosts([]);
    return () => {};
  }
  const view = query(
    collection(db, 'wall_posts'),
    where('authorHandle', '==', handle),
    where('schoolId', '==', actor.schoolId),
    where('audience', '==', 'school'),
    orderBy('createdAt', 'desc'),
    limit(40),
  );
  return onSnapshot(view, (snap) => {
    Promise.all(snap.docs.map((row) => hydrate(row.id, row.data() as Record<string, unknown>, actor.uid)))
      .then(onPosts)
      .catch((error: Error) => onError(error.message));
  }, (error) => onError(error.message));
}

export async function uploadWallPhoto(uid: string, file: File): Promise<string> {
  const reason = checkWallImage(file);
  if (reason) throw new Error(reason);
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(0, 40);
  return uploadPreparedMedia(`media/${uid}/${Date.now()}-${safe}`, file, file.type);
}

export async function publishWallPost(actor: WallActor, draft: {
  body: string;
  audience: Audience;
  feed: WallPost['feed'];
  images: string[];
  feeling?: string;
  tags: string[];
  locationOn: boolean;
}): Promise<{ id: string; moderation: 'allow' | 'hold' }> {
  const screened = screenWallDraft({
    body: draft.body || 'photo',
    ageTier: actor.ageTier,
    audience: draft.audience,
    authorSchoolId: actor.schoolId,
    hasImage: draft.images.length > 0,
  });
  if (screened.decision === 'block') throw new Error(screened.reason);
  const ref = await addDoc(collection(db, 'wall_posts'), {
    authorId: actor.uid,
    authorHandle: handleOf(actor),
    authorName: actor.name,
    body: draft.body,
    audience: draft.audience,
    schoolId: actor.schoolId,
    feed: draft.feed,
    locationOn: actor.adult && draft.locationOn,
    moderation: screened.decision,
    images: draft.images,
    feeling: draft.feeling || '',
    tags: draft.tags,
    reactions: { like: 0, love: 0, celebrate: 0, insightful: 0, support: 0 },
    shares: 0,
    createdAt: Date.now(),
  });
  return { id: ref.id, moderation: screened.decision };
}

export async function setWallReaction(postId: string, uid: string, previous: Reaction | '', next: Reaction | ''): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (previous && previous !== next) patch[`reactions.${previous}`] = increment(-1);
  if (next && previous !== next) patch[`reactions.${next}`] = increment(1);
  await updateDoc(doc(db, 'wall_posts', postId), patch);
  const reaction = doc(db, 'wall_posts', postId, 'reactions', uid);
  if (next) await setDoc(reaction, { kind: next });
  else await deleteDoc(reaction);
}

export async function addWallComment(actor: WallActor, postId: string, body: string, parentId = ''): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const screened = screenWallDraft({
    body: text,
    ageTier: actor.ageTier,
    audience: 'school',
    authorSchoolId: actor.schoolId,
    hasImage: false,
  });
  if (screened.decision === 'block') throw new Error(screened.reason);
  await addDoc(collection(db, 'wall_posts', postId, 'comments'), {
    authorId: actor.uid,
    authorHandle: handleOf(actor),
    body: text,
    parentId,
    createdAt: Date.now(),
    moderation: screened.decision,
  });
}

export async function reportWallPost(actor: WallActor, postId: string, reason: string): Promise<void> {
  await addDoc(collection(db, 'wall_reports'), {
    reporterId: actor.uid,
    postId,
    reason: reason.slice(0, 500) || 'Reported from the school wall',
    createdAt: Date.now(),
  });
}
