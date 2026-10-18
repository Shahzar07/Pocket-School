import { qrMatrix } from '@/lib/certificate-qr';
import { CARD_BADGE, SAFELINE_LABEL, code39Runs, displayLevel, monogram, themePaint, type IdCardView } from '@/lib/cards/id-face';

function headerPaint(ctx: CanvasRenderingContext2D, paint: string, width: number): string | CanvasGradient {
  if (!paint.startsWith('linear')) return paint;
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#123844');
  gradient.addColorStop(1, '#1E6A83');
  return gradient;
}

function drawQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number) {
  const matrix = qrMatrix(value || '/verify');
  const quiet = 4;
  const dim = matrix.size + quiet * 2;
  const cell = size / dim;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#111111';
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (!matrix.dark(row, col)) continue;
      ctx.fillRect(x + (col + quiet) * cell, y + (row + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

export function drawIdCard(
  ctx: CanvasRenderingContext2D,
  view: IdCardView,
  side: 'front' | 'back',
  width: number,
  height: number,
): void {
  const paint = themePaint(view.brand.theme);
  const label = view.brand.theme === 'rochford' ? paint.frame : '#1E6A83';
  const mark = monogram(view.brand.institutionName);
  const idText = view.studentId || 'Private';
  const phone = view.brand.emergencyPhone ? `${SAFELINE_LABEL} · ${view.brand.emergencyPhone}` : SAFELINE_LABEL;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  const headerH = side === 'front' ? height * 0.24 : height * 0.16;
  const footerH = height * 0.12;
  ctx.fillStyle = headerPaint(ctx, paint.header, width);
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = paint.accent;
  ctx.fillRect(0, height - footerH, width, footerH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(width * 0.028)}px sans-serif`;
  ctx.fillText(view.brand.institutionName.toUpperCase(), width * 0.16, headerH * 0.42);
  ctx.font = `500 ${Math.round(width * 0.018)}px sans-serif`;
  ctx.fillText(side === 'front' ? view.brand.tagline : CARD_BADGE, width * 0.16, headerH * 0.72);
  if (side === 'front') {
    ctx.fillStyle = paint.accent;
    round(ctx, width * 0.7, headerH * 0.16, width * 0.26, headerH * 0.68, 12);
    ctx.fill();
    ctx.fillStyle = paint.accentInk;
    ctx.font = `700 ${Math.round(width * 0.018)}px sans-serif`;
    ctx.fillText(CARD_BADGE, width * 0.725, headerH * 0.42);
    ctx.font = `600 ${Math.round(width * 0.014)}px sans-serif`;
    const badgeName = view.brand.institutionName.length > 22 ? `${view.brand.institutionName.slice(0, 20)}…` : view.brand.institutionName;
    ctx.fillText(badgeName, width * 0.725, headerH * 0.66);
  }
  ctx.fillStyle = paint.accentInk;
  ctx.font = `600 ${Math.round(width * 0.022)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(view.brand.motto, width / 2, height - footerH * 0.38);
  ctx.textAlign = 'left';
  if (side === 'front') {
    const photoX = width * 0.04;
    const photoY = headerH + height * 0.03;
    const photoW = width * 0.24;
    const photoH = height * 0.42;
    ctx.strokeStyle = paint.frame;
    ctx.lineWidth = 8;
    ctx.strokeRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = '#E9F7FA';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = paint.frame;
    ctx.font = `800 ${Math.round(width * 0.06)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(view.fullName.slice(0, 1), photoX + photoW / 2, photoY + photoH * 0.62);
    ctx.textAlign = 'left';
    const runs = code39Runs(view.studentId || view.fullName);
    const total = runs.reduce((sum, bar) => sum + bar, 0) || 1;
    let cursor = photoX;
    const barY = photoY + photoH + 10;
    const barH = height * 0.06;
    runs.forEach((bar, index) => {
      const barW = (photoW * bar) / total;
      if (index % 2 === 0) {
        ctx.fillStyle = '#203337';
        ctx.fillRect(cursor, barY, barW, barH);
      }
      cursor += barW;
    });
    ctx.fillStyle = '#203337';
    ctx.font = `600 ${Math.round(width * 0.018)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(idText, photoX + photoW / 2, barY + barH + 18);
    ctx.textAlign = 'left';
    const textX = width * 0.34;
    ctx.fillStyle = label;
    ctx.font = `700 ${Math.round(width * 0.015)}px sans-serif`;
    ctx.fillText('NAME', textX, headerH + height * 0.07);
    ctx.fillStyle = '#203337';
    ctx.font = `700 ${Math.round(width * 0.034)}px sans-serif`;
    ctx.fillText(view.fullName, textX, headerH + height * 0.13);
    ctx.fillStyle = label;
    ctx.font = `700 ${Math.round(width * 0.013)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('VALID UNTIL', width * 0.78, headerH + height * 0.06);
    ctx.fillStyle = '#203337';
    ctx.font = `600 ${Math.round(width * 0.02)}px sans-serif`;
    ctx.fillText(view.validUntil, width * 0.78, headerH + height * 0.1);
    ctx.textAlign = 'left';
    const qrSize = width * 0.075;
    drawQr(ctx, view.verifyPath, width * 0.8, headerH + height * 0.03, qrSize);
    ctx.beginPath();
    ctx.arc(width * 0.93, headerH + height * 0.07, qrSize * 0.48, 0, Math.PI * 2);
    ctx.strokeStyle = paint.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = paint.frame;
    ctx.font = `800 ${Math.round(width * 0.016)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(mark, width * 0.93, headerH + height * 0.08);
    ctx.textAlign = 'left';
    const rows = [
      ['STUDENT ID', idText, 'LEVEL', displayLevel(view.levelName)],
      ['PROGRAMME', view.programme, 'ACADEMIC YEAR', view.academicYear],
    ];
    rows.forEach((row, index) => {
      const y = headerH + height * (0.26 + index * 0.13);
      ctx.fillStyle = label;
      ctx.font = `700 ${Math.round(width * 0.014)}px sans-serif`;
      ctx.fillText(row[0] ?? '', textX, y);
      ctx.fillText(row[2] ?? '', width * 0.62, y);
      ctx.fillStyle = '#203337';
      ctx.font = `600 ${Math.round(width * 0.022)}px sans-serif`;
      ctx.fillText(row[1] ?? '', textX, y + height * 0.042);
      ctx.fillText(row[3] ?? '', width * 0.62, y + height * 0.042);
    });
    ctx.fillStyle = '#E9F7FA';
    ctx.fillRect(textX, height - footerH - height * 0.1, width * 0.62, height * 0.075);
    ctx.fillStyle = label;
    ctx.font = `700 ${Math.round(width * 0.013)}px sans-serif`;
    ctx.fillText('EMERGENCY CONTACT', textX + 12, height - footerH - height * 0.068);
    ctx.fillStyle = '#203337';
    ctx.font = `600 ${Math.round(width * 0.018)}px sans-serif`;
    ctx.fillText(phone, textX + 12, height - footerH - height * 0.038);
  } else {
    ctx.fillStyle = '#203337';
    ctx.font = `500 ${Math.round(width * 0.024)}px sans-serif`;
    wrap(ctx, 'This card is free. It is not a government ID. The QR is signed by Poket School and changes on a timer.', width * 0.05, headerH + height * 0.1, width * 0.68, Math.round(width * 0.03));
    ctx.font = `600 ${Math.round(width * 0.024)}px sans-serif`;
    ctx.fillText(`If found, return to ${view.brand.institutionName}.`, width * 0.05, height - footerH - height * 0.12);
    ctx.fillStyle = label;
    ctx.fillText(phone, width * 0.05, height - footerH - height * 0.06);
    drawQr(ctx, view.verifyPath, width * 0.76, headerH + height * 0.08, width * 0.18);
  }
  if (view.sample) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#203337';
    ctx.font = `800 ${Math.round(width * 0.12)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SAMPLE', width / 2, height * 0.58);
    ctx.restore();
    ctx.fillStyle = '#3FE0D0';
    round(ctx, width * 0.05, headerH + height * 0.04, width * 0.16, height * 0.045, 12);
    ctx.fill();
    ctx.fillStyle = '#203337';
    ctx.font = `600 ${Math.round(width * 0.016)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Sample card', width * 0.13, headerH + height * 0.07);
    ctx.textAlign = 'left';
  }
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  const words = text.split(' ');
  let row = '';
  let cursor = y;
  for (const word of words) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > max) {
      ctx.fillText(row, x, cursor);
      row = word;
      cursor += line;
    } else {
      row = next;
    }
  }
  if (row) ctx.fillText(row, x, cursor);
}
