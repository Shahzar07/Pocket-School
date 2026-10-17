/**
 * Removes EXIF, XMP, and GPS from an upload.
 * Always run this on the server. Do not skip it when the client says the file is already clean.
 */

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) * 16777216 + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0)) >>> 0;
}

function typeAt(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
}

export function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes.slice();
  const parts: Uint8Array[] = [bytes.slice(0, 2)];
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      parts.push(bytes.slice(i));
      break;
    }
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.slice(i));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      parts.push(bytes.slice(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > bytes.length) break;
    const length = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (length < 2 || i + 2 + length > bytes.length) break;
    const drop = marker === 0xe1 || marker === 0xed;
    if (!drop) parts.push(bytes.slice(i, i + 2 + length));
    i += 2 + length;
  }
  return concat(parts);
}

export function stripPng(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 8) return bytes.slice();
  const drop = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);
  const parts: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = u32(bytes, offset);
    const kind = typeAt(bytes, offset + 4);
    const end = offset + 12 + length;
    if (end > bytes.length) break;
    if (!drop.has(kind)) parts.push(bytes.slice(offset, end));
    offset = end;
    if (kind === 'IEND') break;
  }
  return concat(parts);
}

export function stripWebp(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12 || typeAt(bytes, 0) !== 'RIFF' || typeAt(bytes, 8) !== 'WEBP') return bytes.slice();
  const parts: Uint8Array[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = typeAt(bytes, offset);
    const size = (bytes[offset + 4] ?? 0) | ((bytes[offset + 5] ?? 0) << 8) | ((bytes[offset + 6] ?? 0) << 16) | ((bytes[offset + 7] ?? 0) << 24);
    const end = offset + 8 + size + (size & 1);
    if (end > bytes.length) break;
    if (kind !== 'EXIF' && kind !== 'XMP ') parts.push(bytes.slice(offset, end));
    offset = end;
  }
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.slice(0, 4), 0);
  const riff = 4 + body.length;
  out[4] = riff & 255;
  out[5] = (riff >> 8) & 255;
  out[6] = (riff >> 16) & 255;
  out[7] = (riff >> 24) & 255;
  out.set(bytes.slice(8, 12), 8);
  out.set(body, 12);
  return out;
}

export function stripGif(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 13 || typeAt(bytes, 0) !== 'GIF8') return bytes.slice();
  const packed = bytes[10] ?? 0;
  const global = packed & 0x80 ? 3 * (2 << (packed & 7)) : 0;
  let offset = 13 + global;
  const parts: Uint8Array[] = [bytes.slice(0, offset)];
  while (offset < bytes.length) {
    const marker = bytes[offset];
    if (marker === 0x3b) {
      parts.push(bytes.slice(offset));
      break;
    }
    if (marker === 0x21) {
      const label = bytes[offset + 1];
      if (label === 0xfe || label === 0xff) {
        let cursor = offset + 2;
        if (label === 0xff) cursor += 1 + (bytes[cursor] ?? 0);
        while (cursor < bytes.length && bytes[cursor] !== 0) cursor += 1 + (bytes[cursor] ?? 0);
        offset = Math.min(bytes.length, cursor + 1);
        continue;
      }
      if (label === 0xf9) {
        parts.push(bytes.slice(offset, offset + 8));
        offset += 8;
        continue;
      }
    }
    if (marker === 0x2c && offset + 10 <= bytes.length) {
      const local = (bytes[offset + 9] ?? 0) & 0x80 ? 3 * (2 << ((bytes[offset + 9] ?? 0) & 7)) : 0;
      let cursor = offset + 10 + local + 1;
      const start = offset;
      while (cursor < bytes.length && bytes[cursor] !== 0) cursor += 1 + (bytes[cursor] ?? 0);
      offset = Math.min(bytes.length, cursor + 1);
      parts.push(bytes.slice(start, offset));
      continue;
    }
    parts.push(bytes.slice(offset));
    break;
  }
  return concat(parts);
}

export function stripPdf(bytes: Uint8Array): Uint8Array {
  const out = bytes.slice();
  const endMark = '<?xpacket end';
  let from = 0;
  while (from < out.length) {
    const at = asciiFind(out.subarray(from), '<?xpacket begin');
    if (at < 0) break;
    const absolute = from + at;
    const end = asciiFind(out.subarray(absolute), endMark);
    if (end < 0) break;
    const close = Math.min(out.length, absolute + end + endMark.length + 16);
    out.fill(0x20, absolute, close);
    from = close;
  }
  return out;
}

export function stripMp4(bytes: Uint8Array): Uint8Array {
  const out = bytes.slice();
  walkMp4(out, 0, out.length);
  return out;
}

const MP4_CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'edts']);

function walkMp4(bytes: Uint8Array, start: number, end: number) {
  let offset = start;
  while (offset + 8 <= end) {
    const size = u32(bytes, offset);
    const kind = typeAt(bytes, offset + 4);
    if (size < 8 || offset + size > end) break;
    const header = 8;
    if (kind === '©xyz' || kind === 'xyz ' || kind === 'loci') {
      bytes.fill(0, offset + header, offset + size);
    } else if (kind === 'uuid' && asciiFind(bytes.subarray(offset, offset + size), 'GPS') >= 0) {
      bytes.fill(0, offset + header, offset + size);
    } else if (MP4_CONTAINERS.has(kind)) {
      walkMp4(bytes, offset + header, offset + size);
    } else if (kind === 'meta' && offset + header + 4 < offset + size) {
      walkMp4(bytes, offset + header + 4, offset + size);
    }
    offset += size;
  }
}

export function stripLocation(bytes: Uint8Array, mime: string): Uint8Array {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return stripJpeg(bytes);
  if (mime === 'image/png') return stripPng(bytes);
  if (mime === 'image/webp') return stripWebp(bytes);
  if (mime === 'image/gif') return stripGif(bytes);
  if (mime === 'application/pdf') return stripPdf(bytes);
  if (mime === 'video/mp4' || mime === 'video/quicktime' || mime === 'video/webm') return stripMp4(bytes);
  return bytes.slice();
}

function asciiFind(bytes: Uint8Array, needle: string): number {
  const target = [...needle].map(char => char.charCodeAt(0));
  for (let i = 0; i + target.length <= bytes.length; i += 1) {
    let match = true;
    for (let j = 0; j < target.length; j += 1) {
      if (bytes[i + j] !== target[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}
