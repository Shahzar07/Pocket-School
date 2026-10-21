import { CERTIFICATE_PAGE_POINTS, type CertificateDesign, type CertificatePageSize } from './design';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CertificateLayout {
  page: { width: number; height: number };
  outer: Box;
  inner: Box | null;
  corner: boolean;
  band: Box;
  mark: Box;
  wordmark: Box;
  institution: Box;
  coBrandLogo: Box;
  title: Box;
  recipient: Box;
  course: Box;
  date: Box;
  certificateId: Box;
  coBrandName: Box;
  signatories: Box[];
  qr: Box;
  verify: Box;
  copyright: Box;
  titleSize: number;
  nameSize: number;
  bodySize: number;
  smallSize: number;
  tinySize: number;
}

export const CERTIFICATE_GRADIENT = ['#1E6A83', '#3FE0D0'] as const;

export function gradientHex(t: number): string {
  const from = [0x1e, 0x6a, 0x83];
  const to = [0x3f, 0xe0, 0xd0];
  const clamped = Math.min(1, Math.max(0, t));
  const channels = from.map((start, index) => Math.round(start + ((to[index] ?? start) - start) * clamped));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

type LayoutDesign = Pick<
  CertificateDesign,
  | 'border'
  | 'pageSize'
  | 'signatories'
  | 'showRecipient'
  | 'showCourse'
  | 'showDate'
  | 'showCertificateId'
  | 'showQr'
  | 'coBrandName'
>;

function box(x: number, y: number, w: number, h: number): Box {
  return { x, y, w: Math.max(0, w), h: Math.max(0, h) };
}

/**
 * One geometry for the on-screen sheet and the PDF. Origin is the top left,
 * in PDF points, so a box cannot depend on which renderer draws it.
 */
export function certificateLayout(design: LayoutDesign, pageSize?: CertificatePageSize): CertificateLayout {
  const page = CERTIFICATE_PAGE_POINTS[pageSize ?? design.pageSize];
  const { width, height } = page;
  const scale = Math.min(width, height) / 595.28;
  const inset = Math.min(width, height) * 0.055;
  const outer = box(inset * 0.62, inset * 0.62, width - inset * 1.24, height - inset * 1.24);
  const double = design.border === 'double';
  const innerPad = 12 * scale;
  const inner = double
    ? box(outer.x + innerPad, outer.y + innerPad, outer.w - innerPad * 2, outer.h - innerPad * 2)
    : null;
  const frame = inner ?? outer;
  const pad = 14 * scale;
  const content = box(frame.x + pad, frame.y + pad, frame.w - pad * 2, frame.h - pad * 2);
  const titleSize = 26 * scale;
  const nameSize = 20 * scale;
  const bodySize = 12 * scale;
  const smallSize = 10 * scale;
  const tinySize = 8 * scale;
  const band = box(content.x, content.y, content.w, 7 * scale);
  const headerY = band.y + band.h + 10 * scale;
  const markSize = 36 * scale;
  const mark = box(content.x, headerY, markSize, markSize);
  const logoW = Math.min(96 * scale, content.w * 0.22);
  const coBrandLogo = box(content.x + content.w - logoW, headerY, logoW, markSize);
  const institution = box(coBrandLogo.x - 8 * scale - logoW, headerY, logoW, markSize);
  const wordmark = box(mark.x + mark.w + 8 * scale, headerY, Math.max(40, institution.x - mark.x - mark.w - 16 * scale), markSize);

  const copyright = box(content.x, content.y + content.h - 14 * scale, content.w, 14 * scale);
  const showQr = design.showQr !== false;
  const qrSize = showQr ? Math.min(104 * scale, content.w * 0.24, content.h * 0.28) : 0;
  const verifyH = showQr ? 24 * scale : 0;
  const footerH = qrSize + (showQr ? 4 * scale + verifyH : 0);
  const footerTop = copyright.y - 8 * scale - footerH;
  const qr = box(content.x + content.w - qrSize, footerTop, qrSize, qrSize);
  const verify = box(qr.x, qr.y + qr.h + 3 * scale, qr.w, verifyH);
  const sigCount = Math.max(1, Math.min(3, design.signatories.length || 1));
  const sigGap = 8 * scale;
  const sigWidth = showQr ? qr.x - content.x - 12 * scale : content.w;
  const sigW = (sigWidth - sigGap * (sigCount - 1)) / sigCount;
  const signatories = Array.from({ length: sigCount }, (_, index) => box(
    content.x + index * (sigW + sigGap),
    footerTop,
    sigW,
    qrSize || 64 * scale,
  ));

  const bodyTop = headerY + markSize + 16 * scale;
  const bodyBottom = footerTop - 12 * scale;
  const rows: Array<{ key: 'title' | 'recipient' | 'course' | 'date' | 'certificateId' | 'coBrandName'; h: number }> = [
    { key: 'title', h: titleSize + 6 * scale },
  ];
  if (design.showRecipient !== false) rows.push({ key: 'recipient', h: nameSize + 4 * scale });
  if (design.showCourse !== false) rows.push({ key: 'course', h: bodySize + 6 * scale });
  if (design.showDate !== false) rows.push({ key: 'date', h: bodySize + 4 * scale });
  if (design.showCertificateId !== false) rows.push({ key: 'certificateId', h: smallSize + 4 * scale });
  if (design.coBrandName.trim()) rows.push({ key: 'coBrandName', h: bodySize + 4 * scale });
  const used = rows.reduce((sum, row) => sum + row.h, 0);
  const slack = Math.max(0, bodyBottom - bodyTop - used);
  let cursor = bodyTop + slack / 2;
  const placed = {
    title: box(content.x, bodyTop, content.w, titleSize),
    recipient: box(0, 0, 0, 0),
    course: box(0, 0, 0, 0),
    date: box(0, 0, 0, 0),
    certificateId: box(0, 0, 0, 0),
    coBrandName: box(0, 0, 0, 0),
  };
  for (const row of rows) {
    placed[row.key] = box(content.x + 8 * scale, cursor, content.w - 16 * scale, row.h);
    cursor += row.h;
  }

  return {
    page,
    outer,
    inner,
    corner: design.border === 'corner',
    band,
    mark,
    wordmark,
    institution,
    coBrandLogo,
    title: placed.title,
    recipient: placed.recipient,
    course: placed.course,
    date: placed.date,
    certificateId: placed.certificateId,
    coBrandName: placed.coBrandName,
    signatories,
    qr,
    verify,
    copyright,
    titleSize,
    nameSize,
    bodySize,
    smallSize,
    tinySize,
  };
}
