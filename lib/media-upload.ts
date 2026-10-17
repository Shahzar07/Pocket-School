import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/** Store a lesson visual in Firebase Storage and return its download URL. */
export async function uploadLessonImage(
  courseId: string,
  lessonId: string,
  kind: string,
  data: Blob,
  contentType = 'image/png',
  extension = 'png',
): Promise<string> {
  const safeKind = kind.replace(/[^a-z0-9-]/gi, '') || 'image';
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'png';
  const path = `curriculum/${courseId}/${lessonId}/${safeKind}-${Date.now()}.${safeExt}`;
  const stored = storageRef(storage, path);
  await uploadBytes(stored, data, { contentType });
  return getDownloadURL(stored);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error('Could not read the generated image.');
  return response.blob();
}
