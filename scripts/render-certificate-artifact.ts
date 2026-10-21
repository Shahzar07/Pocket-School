import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { builtinDesigns, normaliseDesign, type CertificateDesign } from '../lib/certificates/design';
import { certificatePdf } from '../lib/certificates/pdf';

const outDir = process.env.CERT_OUT || '/opt/cursor/artifacts';

async function png(svg: string): Promise<Uint8Array> {
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

async function main() {
  const logo = await png(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96">
    <rect width="320" height="96" rx="16" fill="#E7FAF7"/>
    <circle cx="48" cy="48" r="28" fill="#1E6A83"/>
    <text x="48" y="58" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#3FE0D0">N</text>
    <text x="92" y="58" font-family="sans-serif" font-size="28" font-weight="700" fill="#203337">North Academy</text>
  </svg>`);
  const coBrand = await png(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="96">
    <rect width="240" height="96" rx="16" fill="#F4F7F8"/>
    <text x="120" y="58" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#1E6A83">Harbour</text>
  </svg>`);
  const signature = await png(`<svg xmlns="http://www.w3.org/2000/svg" width="280" height="80">
    <path d="M8 58 C 40 10, 70 70, 100 40 S 160 8, 200 48 S 250 70, 272 28" fill="none" stroke="#203337" stroke-width="3" stroke-linecap="round"/>
  </svg>`);
  const regular = readFileSync(join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'));
  const bold = readFileSync(join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf'));
  const base = builtinDesigns()[0];
  if (!base) throw new Error('Missing builtin template');
  const design: CertificateDesign = normaliseDesign({
    ...base,
    logoUrl: 'https://assets.poketschool.ai/institution.png',
    coBrandName: 'Harbour',
    coBrandLogoUrl: 'https://assets.poketschool.ai/harbour.png',
    signatories: [{ name: 'Poket School', title: 'Issuer', imageUrl: 'https://assets.poketschool.ai/sign.png' }],
  });
  const bytes = await certificatePdf(design, {
    recipient: 'Amina Yusuf',
    course: 'IGCSE Mathematics',
    date: '18 Oct 2026',
    certificateId: 'PS-1042',
    verifyUrl: 'https://poketschool.ai/verify/PS-1042',
  }, {
    regular,
    bold,
    assets: { logo, coBrand, signatures: [signature] },
  });
  mkdirSync(outDir, { recursive: true });
  const pdfPath = join(outDir, 'certificate-amina-yusuf.pdf');
  writeFileSync(pdfPath, bytes);
  console.log(`wrote ${pdfPath} ${bytes.byteLength}`);
}

void main();
