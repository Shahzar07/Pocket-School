import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCertificateAssets } from '../lib/certificates/assets';
import { CERTIFICATE_SAMPLE, builtinDesigns } from '../lib/certificates/design';
import { certificatePdf } from '../lib/certificates/pdf';
import { decorateSample } from '../lib/certificates/sample-placeholders';

const outDir = process.env.CERT_OUT || '/opt/cursor/artifacts';

async function main() {
  const base = builtinDesigns()[0];
  if (!base) throw new Error('Missing builtin template');
  const face = decorateSample(base);
  const regular = readFileSync(join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'));
  const bold = readFileSync(join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf'));
  const assets = await loadCertificateAssets(face);
  const bytes = await certificatePdf(base, CERTIFICATE_SAMPLE, {
    regular,
    bold,
    assets,
    labelledSample: true,
  });
  mkdirSync(outDir, { recursive: true });
  const pdfPath = join(outDir, 'certificate-amina-yusuf.pdf');
  writeFileSync(pdfPath, bytes);
  console.log(`wrote ${pdfPath} ${bytes.byteLength}`);
}

void main();
