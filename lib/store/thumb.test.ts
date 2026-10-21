import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { webpThumb } from './thumb';

describe('store thumbnail', () => {
  it('makes a 1200px WebP from a 2000px PNG', async () => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: '#3FE0D0' },
    }).png().toBuffer();
    const webp = await webpThumb(new Uint8Array(png));
    const meta = await sharp(Buffer.from(webp)).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 600);
  });
});
