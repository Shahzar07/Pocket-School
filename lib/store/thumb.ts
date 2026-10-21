/** 1200px WebP made from the source PNG. Smaller sources are not enlarged. */
export async function webpThumb(png: Uint8Array): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  const out = await sharp(Buffer.from(png), { failOn: 'none' })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return new Uint8Array(out);
}

export async function webpPreview(bytes: Uint8Array): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  const out = await sharp(Buffer.from(bytes), { failOn: 'none' })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  return new Uint8Array(out);
}
