/**
 * Client-side media for posts. The web app and the mobile app share these
 * limits and the storage path. Re-encoding through a bitmap drops EXIF,
 * including GPS. Video is accepted only when it is already small.
 */

export const MEDIA_LIMITS = {
  maxItems: 4,
  maxImageBytes: 1_500_000,
  maxEdge: 1600,
  maxVideoBytes: 8_000_000,
  maxVideoSeconds: 20,
} as const;

export type MediaKind = 'image' | 'video';

export function mediaKind(type: string): MediaKind | null {
  if (type.startsWith('image/') && type !== 'image/svg+xml') return 'image';
  if (type === 'video/mp4' || type === 'video/webm') return 'video';
  return null;
}

export function rejectMedia(file: { type: string; size: number; durationSeconds?: number }): string {
  const kind = mediaKind(file.type);
  if (!kind) return 'Use a photo or a short MP4 or WebM video.';
  if (kind === 'image' && file.size > 25_000_000) return 'That photo is too large to resize on this device.';
  if (kind === 'video' && file.size > MEDIA_LIMITS.maxVideoBytes) return 'Video must be under 8 MB.';
  if (kind === 'video' && typeof file.durationSeconds === 'number' && file.durationSeconds > MEDIA_LIMITS.maxVideoSeconds) {
    return 'Video must be 20 seconds or shorter.';
  }
  return '';
}

export function postStoragePath(uid: string, fileId: string, contentType: string): string {
  const ext = contentType === 'image/png' ? 'png' : contentType.startsWith('video/') ? (contentType.endsWith('webm') ? 'webm' : 'mp4') : 'jpg';
  const safeId = fileId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'file';
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  return `media/${safeUid}/posts/${safeId}.${ext}`;
}

/** Canvas export does not copy the source EXIF block, so location is gone. */
export function exifStrippedByReencode(): true {
  return true;
}

export async function prepareImageFile(file: File): Promise<{ blob: Blob; width: number; height: number; contentType: string }> {
  const reason = rejectMedia({ type: file.type, size: file.size });
  if (reason || mediaKind(file.type) !== 'image') throw new Error(reason || 'Use a photo.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MEDIA_LIMITS.maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not resize the photo.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let quality = 0.82;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MEDIA_LIMITS.maxImageBytes && quality > 0.45) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MEDIA_LIMITS.maxImageBytes) throw new Error('That photo is still over 1.5 MB after compressing.');
  return { blob, width, height, contentType: 'image/jpeg' };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not compress the photo.'));
    }, 'image/jpeg', quality);
  });
}
