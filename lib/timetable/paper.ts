import type { Weekday } from './types';

const DAY_WORDS: Record<string, Weekday> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri',
  mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri',
};

export interface PaperRow {
  day: Weekday;
  period: string;
  subject: string;
  level: string;
  teacher: string;
  room: string;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  body.set(new TextEncoder().encode(type), 0);
  body.set(data, 4);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(8 + data.length, crc32(body));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** A one-pixel PNG whose text chunk carries the paper timetable. */
export function pngWithText(text: string): Uint8Array {
  const base = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));
  const keyword = new TextEncoder().encode('timetable');
  const payload = new Uint8Array(keyword.length + 1 + new TextEncoder().encode(text).length);
  payload.set(keyword, 0);
  payload.set(new TextEncoder().encode(text), keyword.length + 1);
  const textChunk = chunk('tEXt', payload);
  const iendAt = base.length - 12;
  return concat([base.slice(0, iendAt), textChunk, base.slice(iendAt)]);
}

export function textChunksFromPng(bytes: Uint8Array): string[] {
  if (bytes.length < 8 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return [];
  const texts: string[] = [];
  let offset = 8;
  const decoder = new TextDecoder();
  while (offset + 8 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = decoder.decode(bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    if (type === 'tEXt') {
      const zero = data.indexOf(0);
      if (zero >= 0) texts.push(decoder.decode(data.slice(zero + 1)));
    }
    if (type === 'iTXt') {
      const zero = data.indexOf(0);
      const rest = zero >= 0 ? data.slice(zero + 1) : data;
      const readable = decoder.decode(rest).replace(/^\0+/, '');
      if (readable.trim()) texts.push(readable);
    }
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  return texts;
}

export function decodeDataUrl(value: string): Uint8Array | null {
  const match = value.match(/^data:[^,]*,([\s\S]+)$/);
  if (!match) return null;
  try {
    const binary = atob(match[1] ?? '');
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function titleWord(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.toLowerCase() === 'maths') return 'Maths';
  return cleaned.replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

/** Lines such as "Monday, P1, Maths, Primary 2, Ms Rahman, Room A". */
export function parsePaperTimetable(text: string): PaperRow[] {
  const rows: PaperRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/\s*(?:,|\||—|–)\s*|\s+-\s+/).map(part => part.trim()).filter(Boolean);
    if (parts.length < 6) continue;
    const day = DAY_WORDS[parts[0]!.toLowerCase()];
    const periodMatch = parts[1]!.match(/^p?\s*(\d+)$/i);
    if (!day || !periodMatch) continue;
    const subject = titleWord(parts[2]!.replace(/^(mr|mrs|ms|dr)\.?\s+/i, ''));
    const level = titleWord(parts[3]!);
    if (!subject || !level || /\byear\s+\d+\b/i.test(level)) continue;
    rows.push({
      day,
      period: `P${periodMatch[1]}`,
      subject,
      level,
      teacher: parts[4]!.replace(/\s+/g, ' ').trim(),
      room: parts[5]!.replace(/\s+/g, ' ').trim(),
    });
  }
  return rows;
}
