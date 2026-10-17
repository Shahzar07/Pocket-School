/**
 * Virus and malware scan hook. Uploads do not proceed when this returns unclean.
 * Set VIRUS_SCAN_URL to hand the bytes to an external scanner. The EICAR test
 * string is always rejected, including when no external scanner is configured.
 */

export interface ScanResult {
  clean: boolean;
  engine: string;
  detail: string;
}

export type ScanHook = (input: { bytes: Uint8Array; mime: string }) => Promise<ScanResult>;

const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

export async function scanBytes(bytes: Uint8Array, mime: string, hook?: ScanHook): Promise<ScanResult> {
  const text = Buffer.from(bytes).toString('latin1');
  if (text.includes(EICAR)) return { clean: false, engine: 'eicar', detail: 'malware test signature' };
  if (hook) return hook({ bytes, mime });
  const url = process.env.VIRUS_SCAN_URL;
  if (url) return postScan(url, bytes, mime);
  return { clean: true, engine: 'hook', detail: 'scanner hook' };
}

async function postScan(url: string, bytes: Uint8Array, mime: string): Promise<ScanResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': mime || 'application/octet-stream' },
    body: Buffer.from(bytes),
  });
  if (!response.ok) return { clean: false, engine: 'hook', detail: 'scanner rejected the file' };
  const body = await response.json().catch(() => ({})) as { clean?: boolean; detail?: string };
  return {
    clean: body.clean !== false,
    engine: 'hook',
    detail: typeof body.detail === 'string' ? body.detail.slice(0, 200) : 'scanner hook',
  };
}
