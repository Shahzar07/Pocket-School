/**
 * Files on hotline tickets, comments, and alert updates.
 * The server always strips location data and runs the scan hook.
 * A client flag that claims EXIF is already gone is ignored.
 */

export const ATTACHMENT_LABELS = ['evidence', 'mc', 'report', 'photo', 'other'] as const;
export type AttachmentLabel = (typeof ATTACHMENT_LABELS)[number];

export const ATTACHMENT_KINDS = ['photo', 'mc', 'pdf', 'screenshot', 'video'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const PDF_LIMIT = 15 * 1024 * 1024;
export const VIDEO_LIMIT = 50 * 1024 * 1024;

const IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEOS = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export function isAttachmentLabel(value: string): value is AttachmentLabel {
  return (ATTACHMENT_LABELS as readonly string[]).includes(value);
}

export function sizeLimit(mime: string): number | null {
  if (IMAGES.has(mime)) return IMAGE_LIMIT;
  if (mime === 'application/pdf') return PDF_LIMIT;
  if (VIDEOS.has(mime)) return VIDEO_LIMIT;
  return null;
}

export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  const head = ascii(bytes, 0, Math.min(32, bytes.length));
  if (head.includes('ftyp')) return head.includes('qt') ? 'video/quicktime' : 'video/mp4';
  return null;
}

export function mimeMatches(declared: string, sniffed: string | null): boolean {
  const mime = declared.trim().toLowerCase();
  if (!sniffed) return false;
  if (mime === 'image/jpg') return sniffed === 'image/jpeg';
  if ((mime === 'video/mp4' || mime === 'video/quicktime') && (sniffed === 'video/mp4' || sniffed === 'video/quicktime')) return true;
  return mime === sniffed;
}

export function normalMime(declared: string, sniffed: string): string {
  const mime = declared.trim().toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'video/mp4' || mime === 'video/quicktime') return sniffed;
  return mime;
}

export function attachmentKind(mime: string, label: AttachmentLabel): AttachmentKind {
  if (label === 'mc') return 'mc';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (label === 'photo') return 'photo';
  return 'screenshot';
}

export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80);
  return cleaned || 'file';
}

export function hotlineStoragePath(institutionId: string, ticketId: string, fileId: string, name: string): string {
  return `institutions/${safeId(institutionId)}/hotline/${safeId(ticketId)}/${safeId(fileId)}-${safeFileName(name)}`;
}

export function alertStoragePath(institutionId: string, alertId: string, fileId: string, name: string): string {
  return `institutions/${safeId(institutionId)}/alerts/${safeId(alertId)}/${safeId(fileId)}-${safeFileName(name)}`;
}

export interface AttachmentViewInput {
  role: string;
  staffPost: string;
  actorId: string;
  assigneeUid: string;
  addressedTo: string;
  category: string;
  parentUid: string;
  label: string;
  internal: boolean;
}

/** Medical certificates and safeguarding evidence stay with the staff assigned to the ticket. */
export function canViewAttachment(input: AttachmentViewInput): boolean {
  const sensitive = isSafeguarding(input.category);
  const seesTicket = input.role === 'admin' || (
    input.role !== 'parent'
    && (sensitive
      ? input.staffPost === 'principal' || input.staffPost === 'safeguarding_lead'
      : input.role === 'teacher' || input.role === 'institution_admin')
  );
  const assigned = seesTicket && (
    input.role === 'admin'
    || (input.assigneeUid !== '' && input.actorId === input.assigneeUid)
    || input.staffPost === input.addressedTo
    || (sensitive && (input.staffPost === 'principal' || input.staffPost === 'safeguarding_lead'))
  );
  if (input.label === 'mc' || (input.label === 'evidence' && sensitive)) return assigned;
  if (input.internal) return seesTicket;
  if (input.parentUid === input.actorId) return true;
  return seesTicket;
}

/** A public alert photo needs guardian consent and the consent record. Other files stay private. */
export function alertAttachmentPublic(input: {
  label: string;
  mime: string;
  internal: boolean;
  guardianConsent: boolean;
  consentRecordId: string;
}): boolean {
  return input.label === 'photo'
    && input.mime.startsWith('image/')
    && input.internal !== true
    && input.guardianConsent === true
    && input.consentRecordId.trim().length > 0;
}

function isSafeguarding(category: string): boolean {
  return category === 'bullying' || category === 'safeguarding';
}

function safeId(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
  return cleaned || 'file';
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i += 1) out += String.fromCharCode(bytes[i] ?? 0);
  return out;
}
