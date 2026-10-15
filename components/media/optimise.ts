/** Resize in the browser so the reader does not download a camera original. */
export async function optimiseImage(file: Blob, maxEdge = 1600, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize images.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not compress the image.')), 'image/jpeg', quality);
  });
  return { blob, width, height };
}

export function cropImage(src: string, zoom: number, offsetX: number, offsetY: number, output = 1200): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = output;
      canvas.height = output;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('This browser cannot crop images.')); return; }
      const base = Math.max(output / image.width, output / image.height) * zoom;
      const drawW = image.width * base;
      const drawH = image.height * base;
      const x = (output - drawW) / 2 + offsetX;
      const y = (output - drawH) / 2 + offsetY;
      ctx.drawImage(image, x, y, drawW, drawH);
      canvas.toBlob(result => result ? resolve({ blob: result, width: output, height: output }) : reject(new Error('Could not crop the image.')), 'image/jpeg', 0.86);
    };
    image.onerror = () => reject(new Error('Could not read the image.'));
    image.src = src;
  });
}
