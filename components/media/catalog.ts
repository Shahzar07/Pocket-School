'use client';

import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { MediaAsset } from './types';

/**
 * Firestore metadata for a picture that already lives in Storage
 * (or as a data URL when Storage is unavailable).
 * `scopeId` is a course id or a book id, so the same picture can be reused.
 */
export async function recordMediaAsset(scopeId: string, asset: MediaAsset): Promise<void> {
  const user = auth.currentUser;
  if (!user || !asset.src) return;
  const id = asset.id.replace(/[^a-zA-Z0-9_-]/g, '') || `img-${Date.now()}`;
  try {
    await setDoc(doc(db, 'media_assets', id), {
      scopeId,
      ownerId: user.uid,
      src: asset.src,
      alt: asset.alt,
      caption: asset.caption ?? '',
      width: asset.width,
      height: asset.height,
      fullBleed: Boolean(asset.fullBleed),
      storagePath: asset.storagePath ?? '',
      updatedAt: Date.now(),
    }, { merge: true });
  } catch {
    /* The picture is still saved. The shared index can catch up later. */
  }
}

export async function listSharedMedia(scopeId: string): Promise<MediaAsset[]> {
  if (!scopeId) return [];
  const snap = await getDocs(query(collection(db, 'media_assets'), where('scopeId', '==', scopeId)));
  return snap.docs.map(item => {
    const data = item.data();
    return {
      id: item.id,
      src: String(data.src ?? ''),
      alt: String(data.alt ?? ''),
      caption: data.caption ? String(data.caption) : undefined,
      width: Number(data.width) || 0,
      height: Number(data.height) || 0,
      fullBleed: Boolean(data.fullBleed),
      storagePath: data.storagePath ? String(data.storagePath) : undefined,
    };
  }).filter(asset => asset.src);
}
