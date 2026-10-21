import { imageSource, type CertificateDesign } from './design';
import type { CertificatePdfAssets } from './pdf';

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function readImageBytes(url: string): Promise<Uint8Array | null> {
  const source = imageSource(url);
  if (!source) return null;
  if (source.startsWith('data:')) {
    const bytes = decodeBase64(source.split(',')[1] ?? '');
    if (bytes.length > 80_000) return null;
    return bytes;
  }
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 500_000) return null;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpg) return null;
    return bytes;
  } catch {
    return null;
  }
}

export async function loadCertificateAssets(design: CertificateDesign): Promise<CertificatePdfAssets> {
  const [logo, coBrand, ...signatures] = await Promise.all([
    readImageBytes(design.logoUrl),
    readImageBytes(design.coBrandLogoUrl),
    ...design.signatories.map((person) => readImageBytes(person.imageUrl)),
  ]);
  return { logo, coBrand, signatures };
}

export async function loadCertificateFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  const [regularRes, boldRes] = await Promise.all([
    fetch('/fonts/NotoSans-Regular.ttf'),
    fetch('/fonts/NotoSans-Bold.ttf'),
  ]);
  if (!regularRes.ok || !boldRes.ok) throw new Error('Certificate fonts did not load.');
  return {
    regular: new Uint8Array(await regularRes.arrayBuffer()),
    bold: new Uint8Array(await boldRes.arrayBuffer()),
  };
}
