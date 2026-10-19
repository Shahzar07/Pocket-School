import { blogImageError } from './images';

export const COVER_WIDTH = 1600;
export const COVER_HEIGHT = 900;
export const THUMB_WIDTH = 800;
export const THUMB_HEIGHT = 450;

function drawCover(source: ImageBitmap, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Could not prepare the image.'));
  const scale = Math.max(width / source.width, height / source.height);
  const w = source.width * scale;
  const h = source.height * scale;
  ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not compress the image.'));
    }, 'image/webp', 0.82);
  });
}

/** Centre-crop to a 1600×900 banner and an 800×450 thumbnail, both WebP. */
export async function prepareBlogImages(file: File): Promise<{ cover: Blob; thumb: Blob }> {
  const problem = blogImageError({ type: file.type, size: file.size }, 'banner');
  if (problem) throw new Error(problem);
  const bitmap = await createImageBitmap(file);
  try {
    const cover = await drawCover(bitmap, COVER_WIDTH, COVER_HEIGHT);
    const thumb = await drawCover(bitmap, THUMB_WIDTH, THUMB_HEIGHT);
    return { cover, thumb };
  } finally {
    bitmap.close();
  }
}
