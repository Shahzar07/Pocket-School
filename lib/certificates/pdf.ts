import { PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { paletteColours, type CertificateDesign, type CertificateSample } from './design';
import { copyrightNotice } from '../export/notice';
import { certificateLayout, gradientHex, type Box } from './layout';

export interface CertificatePdfAssets {
  logo?: Uint8Array | null;
  coBrand?: Uint8Array | null;
  signatures?: Array<Uint8Array | null>;
}

export interface CertificatePdfOptions {
  regular: Uint8Array;
  bold: Uint8Array;
  assets?: CertificatePdfAssets;
}

function paint(hex: string) {
  const value = hex.replace('#', '');
  const parsed = Number.parseInt(value, 16);
  return rgb(((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255);
}

function topToPdf(pageHeight: number, box: Box): number {
  return pageHeight - box.y - box.h;
}

function fitSize(text: string, font: PDFFont, size: number, maxWidth: number): number {
  let next = size;
  while (next > 7 && font.widthOfTextAtSize(text, next) > maxWidth) next -= 0.5;
  return next;
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  box: Box,
  color: ReturnType<typeof paint>,
) {
  if (!text || box.h <= 0 || box.w <= 0) return;
  const next = fitSize(text, font, size, box.w);
  const width = font.widthOfTextAtSize(text, next);
  const x = box.x + Math.max(0, (box.w - width) / 2);
  const y = topToPdf(page.getHeight(), box) + Math.max(0, (box.h - next) / 2);
  page.drawText(text, { x, y, size: next, font, color });
}

function drawLeft(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  box: Box,
  color: ReturnType<typeof paint>,
) {
  if (!text || box.w <= 0) return;
  const next = fitSize(text, font, size, box.w);
  const y = topToPdf(page.getHeight(), box) + Math.max(0, (box.h - next) / 2);
  page.drawText(text, { x: box.x, y, size: next, font, color });
}

async function embedImage(pdf: PDFDocument, bytes: Uint8Array | null | undefined): Promise<PDFImage | null> {
  if (!bytes || bytes.length < 8) return null;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (png) return pdf.embedPng(bytes);
  if (jpg) return pdf.embedJpg(bytes);
  return null;
}

function drawContained(page: PDFPage, image: PDFImage, box: Box) {
  if (box.w <= 0 || box.h <= 0) return;
  const scale = Math.min(box.w / image.width, box.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const x = box.x + (box.w - w) / 2;
  const y = topToPdf(page.getHeight(), box) + (box.h - h) / 2;
  page.drawImage(image, { x, y, width: w, height: h });
}

function wrapChars(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const next = line + ch;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

async function qrPng(value: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: { dark: '#203337', light: '#FFFFFF' },
  });
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** PDF of the same layout the designer preview draws. */
export async function certificatePdf(
  design: CertificateDesign,
  sample: CertificateSample,
  options: CertificatePdfOptions,
): Promise<Uint8Array> {
  const layout = certificateLayout(design);
  const colours = paletteColours(design.palette);
  const ink = paint(colours.ink);
  const line = paint(colours.line);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(options.regular, { subset: true });
  const bold = await pdf.embedFont(options.bold, { subset: true });
  const page = pdf.addPage([layout.page.width, layout.page.height]);
  const pageHeight = layout.page.height;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: layout.page.width,
    height: pageHeight,
    color: paint(colours.wash),
  });

  const strips = 28;
  for (let index = 0; index < strips; index += 1) {
    const slice = layout.band.w / strips;
    page.drawRectangle({
      x: layout.band.x + index * slice,
      y: topToPdf(pageHeight, layout.band),
      width: slice + 0.6,
      height: layout.band.h,
      color: paint(gradientHex(index / (strips - 1))),
    });
  }

  if (design.border === 'line' || design.border === 'double') {
    page.drawRectangle({
      x: layout.outer.x,
      y: topToPdf(pageHeight, layout.outer),
      width: layout.outer.w,
      height: layout.outer.h,
      borderColor: line,
      borderWidth: design.border === 'double' ? 2.4 : 1.4,
    });
  }
  if (design.border === 'double' && layout.inner) {
    page.drawRectangle({
      x: layout.inner.x,
      y: topToPdf(pageHeight, layout.inner),
      width: layout.inner.w,
      height: layout.inner.h,
      borderColor: line,
      borderWidth: 1,
    });
  }
  if (design.border === 'corner') {
    const len = Math.min(layout.page.width, layout.page.height) * 0.06;
    const corners = [
      [layout.outer.x, layout.outer.y, 1, 1],
      [layout.outer.x + layout.outer.w, layout.outer.y, -1, 1],
      [layout.outer.x, layout.outer.y + layout.outer.h, 1, -1],
      [layout.outer.x + layout.outer.w, layout.outer.y + layout.outer.h, -1, -1],
    ] as const;
    for (const [x, y, dx, dy] of corners) {
      const pdfY = pageHeight - y;
      page.drawLine({ start: { x, y: pdfY }, end: { x: x + dx * len, y: pdfY }, thickness: 2.2, color: line });
      page.drawLine({ start: { x, y: pdfY }, end: { x, y: pdfY - dy * len }, thickness: 2.2, color: line });
    }
  }

  page.drawRectangle({
    x: layout.mark.x,
    y: topToPdf(pageHeight, layout.mark),
    width: layout.mark.w,
    height: layout.mark.h,
    color: paint('#3FE0D0'),
  });
  drawCentered(page, 'P', bold, layout.mark.h * 0.46, layout.mark, ink);
  drawLeft(page, 'POKET SCHOOL', bold, layout.smallSize + 1, {
    ...layout.wordmark,
    y: layout.wordmark.y + layout.wordmark.h * 0.18,
    h: layout.wordmark.h * 0.4,
  }, ink);

  const logo = await embedImage(pdf, options.assets?.logo);
  const coBrand = await embedImage(pdf, options.assets?.coBrand);
  if (logo) drawContained(page, logo, layout.institution);
  if (coBrand) drawContained(page, coBrand, layout.coBrandLogo);

  drawCentered(page, design.title || 'Certificate', bold, layout.titleSize, layout.title, ink);
  if (design.showRecipient) drawCentered(page, sample.recipient, regular, layout.nameSize, layout.recipient, ink);
  if (design.showCourse) drawCentered(page, sample.course, regular, layout.bodySize, layout.course, paint(colours.accent));
  if (design.showDate) drawCentered(page, sample.date, regular, layout.bodySize, layout.date, ink);
  if (design.showCertificateId) drawCentered(page, sample.certificateId, regular, layout.smallSize, layout.certificateId, ink);
  if (design.coBrandName.trim()) drawCentered(page, `With ${design.coBrandName}`, regular, layout.bodySize, layout.coBrandName, ink);

  const signatureImages = await Promise.all((options.assets?.signatures ?? []).map((bytes) => embedImage(pdf, bytes)));
  design.signatories.slice(0, layout.signatories.length).forEach((person, index) => {
    const slot = layout.signatories[index];
    if (!slot) return;
    const imageBox = boxOf(slot, 0, 0.58);
    const nameBox = boxOf(slot, 0.62, 0.22);
    const titleBox = boxOf(slot, 0.84, 0.16);
    const image = signatureImages[index];
    if (image) {
      drawContained(page, image, imageBox);
    } else {
      const lineY = topToPdf(pageHeight, imageBox);
      page.drawLine({
        start: { x: imageBox.x + imageBox.w * 0.12, y: lineY + 2 },
        end: { x: imageBox.x + imageBox.w * 0.88, y: lineY + 2 },
        thickness: 0.8,
        color: paint(colours.accent),
      });
    }
    drawCentered(page, person.name, bold, layout.smallSize, nameBox, ink);
    drawCentered(page, person.title, regular, layout.tinySize, titleBox, paint(colours.accent));
  });

  if (design.showQr && layout.qr.w > 0) {
    const png = await embedImage(pdf, await qrPng(sample.verifyUrl));
    if (png) drawContained(page, png, layout.qr);
    const lines = wrapChars(sample.verifyUrl, regular, layout.tinySize, layout.verify.w);
    lines.forEach((text, index) => {
      const slice = layout.verify.h / Math.max(1, lines.length);
      drawCentered(page, text, regular, layout.tinySize, {
        x: layout.verify.x,
        y: layout.verify.y + index * slice,
        w: layout.verify.w,
        h: slice,
      }, ink);
    });
    const link = pdf.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [
        layout.qr.x,
        topToPdf(pageHeight, layout.qr),
        layout.qr.x + layout.qr.w,
        topToPdf(pageHeight, layout.qr) + layout.qr.h,
      ],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(sample.verifyUrl) },
    });
    page.node.set(PDFName.of('Annots'), pdf.context.obj([link]));
  }

  drawCentered(page, copyrightNotice(), regular, layout.tinySize, layout.copyright, paint(colours.accent));

  pdf.setTitle(design.title || 'Certificate');
  pdf.setAuthor('Poket School');
  pdf.setSubject(sample.verifyUrl);
  pdf.setCreator('Poket School certificate template');
  return pdf.save({ useObjectStreams: false });
}

function boxOf(slot: Box, topFraction: number, heightFraction: number): Box {
  return {
    x: slot.x,
    y: slot.y + slot.h * topFraction,
    w: slot.w,
    h: slot.h * heightFraction,
  };
}
