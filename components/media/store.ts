'use client';

import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

/**
 * Prefer Firebase Storage at `media/{scopeId}/{name}`.
 * A signed-out studio, or rules that reject the write, keeps the optimised file
 * as a data URL so the draft still renders.
 */
export async function storeMedia(scopeId: string, blob: Blob, name: string): Promise<{ src: string; storagePath?: string }> {
  const safeScope = scopeId.replace(/[^a-zA-Z0-9_-]/g, '') || 'draft';
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '') || `image-${Date.now()}.jpg`;
  const path = `media/${safeScope}/${safeName}`;
  try {
    if (auth.currentUser) {
      const stored = storageRef(storage, path);
      await uploadBytes(stored, blob, { contentType: blob.type || 'image/jpeg' });
      const src = await getDownloadURL(stored);
      return { src, storagePath: path };
    }
  } catch {
    /* Storage rules or network. The optimised bytes still belong to the draft. */
  }
  const src = await blobToDataUrl(blob);
  return { src };
}

/** Delete a file this user stored under media/{uid}/. Other paths are left alone. */
export async function removeStoredMedia(storagePath: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !storagePath.startsWith(`media/${user.uid}/`)) return;
  try {
    await deleteObject(storageRef(storage, storagePath));
  } catch {
    /* The file may already be gone. The profile field is cleared by the caller. */
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(blob);
  });
}
