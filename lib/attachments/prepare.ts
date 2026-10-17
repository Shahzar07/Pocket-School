import { scanBytes, type ScanHook, type ScanResult } from './scan';
import { stripLocation } from './strip';
import {
  attachmentKind,
  isAttachmentLabel,
  mimeMatches,
  normalMime,
  sizeLimit,
  sniffMime,
  type AttachmentKind,
  type AttachmentLabel,
} from './policy';

export interface PreparedFile {
  mime: string;
  bytes: Uint8Array;
  kind: AttachmentKind;
  label: AttachmentLabel;
  scan: ScanResult;
  exifStripped: true;
}

/** Strips location data, then runs the malware hook. Client EXIF claims are not an input. */
export async function prepareAttachment(input: {
  declaredMime: string;
  label: string;
  bytes: Uint8Array;
  scan?: ScanHook;
}): Promise<{ ok: true; file: PreparedFile } | { ok: false; error: string }> {
  if (!isAttachmentLabel(input.label)) return { ok: false, error: 'Choose a file label.' };
  const sniffed = sniffMime(input.bytes);
  if (!mimeMatches(input.declaredMime, sniffed) || !sniffed) {
    return { ok: false, error: 'The file type does not match its contents.' };
  }
  const mime = normalMime(input.declaredMime, sniffed);
  const limit = sizeLimit(mime);
  if (limit == null) return { ok: false, error: 'Use a photo, a PDF, or a short video.' };
  if (input.bytes.byteLength > limit) return { ok: false, error: 'This file is over the size limit.' };
  const bytes = stripLocation(input.bytes, mime);
  const scan = await scanBytes(bytes, mime, input.scan);
  if (!scan.clean) return { ok: false, error: 'This file did not pass the malware check.' };
  return {
    ok: true,
    file: {
      mime,
      bytes,
      kind: attachmentKind(mime, input.label),
      label: input.label,
      scan,
      exifStripped: true,
    },
  };
}
