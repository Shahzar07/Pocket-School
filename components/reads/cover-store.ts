'use client';

import { uploadPreparedMedia } from '@/lib/media/upload';
import { auth } from '@/lib/firebase';

const SIZE: Record<string, [number, number]> = {
  cover: [800, 1200],
  hero: [1600, 700],
  thumb: [240, 360],
  art: [800, 1200],
};

/** Re-encode a cover as WebP and store it at books/<bookId>/. A failed upload keeps the local picture. */
export async function storeBookWebp(bookId: string, src: string, role: 'cover' | 'hero' | 'thumb' | 'art'): Promise<string> {
  const [width, height] = SIZE[role];
  const blob = await srcToWebp(src, width, height);
  const id = bookId.replace(/[^a-zA-Z0-9_-]/g, '') || 'draft';
  const path = `books/${id}/${role}-${Date.now()}.webp`;
  try {
    if (auth.currentUser) return await uploadPreparedMedia(path, blob, 'image/webp');
  } catch {
    /* Rules or a signed-out desk. The preview still has the picture. */
  }
  return src;
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the cover.'));
    reader.readAsDataURL(file);
  });
}

function srcToWebp(src: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not prepare the cover.'));
        return;
      }
      const scale = Math.max(width / image.width, height / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not compress the cover.'));
      }, 'image/webp', 0.82);
    };
    image.onerror = () => reject(new Error('Could not read the cover.'));
    image.src = src;
  });
}
