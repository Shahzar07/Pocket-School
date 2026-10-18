'use client';

import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadPreparedMedia(path: string, body: Blob, contentType: string): Promise<string> {
  const stored = ref(storage, path);
  await uploadBytes(stored, body, { contentType, customMetadata: { exif: 'stripped' } });
  return getDownloadURL(stored);
}
