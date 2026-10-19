import { qrMatrix } from '@/lib/certificate-qr';
import {
  BACK_SAFELINE,
  BACK_TERMS,
  CARD_BADGE,
  SAFELINE_ROW,
  VERIFY_LABEL,
  code39Runs,
  displayLevel,
  monogram,
  type IdCardView,
} from '@/lib/cards/id-face';

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number) {
  const matrix = qrMatrix(value || '/verify');
  const quiet = 4;
  const dim = matrix.size + quiet * 2;
  const cell = size / dim;
  ctx.fillStyle = '#111111';
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (!matrix.dark(row, col)) continue;
      ctx.fillRect(x + (col + quiet) * cell, y + (row + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > max) next = next.slice(0, -1);
  return `${next}…`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number): number {
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
  return cursor;
}

function book(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 48, size / 48);
  ctx.fillStyle = '#1E6A83';
  ctx.beginPath();
  ctx.moveTo(7, 13.2);
  ctx.bezierCurveTo(13, 10.8, 17, 12, 23.2, 14.7);
  ctx.lineTo(23.2, 36.1);
  ctx.bezierCurveTo(17, 33.5, 13, 32.3, 7, 34.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1E6A83';
  ctx.beginPath();
  ctx.moveTo(41, 13.2);
  ctx.bezierCurveTo(35, 10.8, 31, 12, 24.8, 14.7);
  ctx.lineTo(24.8, 36.1);
  ctx.bezierCurveTo(31, 33.5, 35, 32.3, 41, 34.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3FE0D0';
  ctx.fillRect(22.2, 15.2, 3.6, 20.6);
  ctx.restore();
}

/** Draws the approved 820×526 card. `width` and `height` scale that layout. */
export function drawIdCard(
  ctx: CanvasRenderingContext2D,
  view: IdCardView,
  side: 'front' | 'back',
  width: number,
  height: number,
): void {
  const sx = width / 820;
  const sy = height / 526;
  const px = (n: number) => n * sx;
  const py = (n: number) => n * sy;
  const mark = (view.brand.monogram || monogram(view.brand.institutionName)).slice(0, 4);
  const idText = view.studentId || 'Private';
  const radius = px(28);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  round(ctx, px(0.5), py(0.5), width - px(1), height - py(1), radius);
  ctx.fillStyle = '#F3FEFE';
  ctx.fill();
  ctx.clip();

  const header = ctx.createLinearGradient(0, 0, width, 0);
  header.addColorStop(0, '#1E6A83');
  header.addColorStop(1, '#1E6A83');
  ctx.fillStyle = header;
  ctx.fillRect(0, 0, width, py(80));

  round(ctx, px(18), py(16), px(48), py(48), px(10));
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  book(ctx, px(26), py(24), px(32));

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${Math.round(px(22))}px sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(fit(ctx, view.brand.institutionName.toUpperCase(), px(430)), px(78), py(38));
  ctx.font = `500 ${Math.round(px(14))}px sans-serif`;
  ctx.fillText(fit(ctx, view.brand.tagline, px(430)), px(78), py(58));

  const badge = CARD_BADGE;
  ctx.font = `800 ${Math.round(px(13))}px sans-serif`;
  const badgeW = ctx.measureText(badge).width + px(28);
  const badgeX = width - px(18) - badgeW;
  round(ctx, badgeX, py(22), badgeW, py(36), py(18));
  ctx.fillStyle = '#3FE0D0';
  ctx.fill();
  ctx.fillStyle = '#203337';
  ctx.fillText(badge, badgeX + px(14), py(45));

  if (side === 'front') {
    const photoX = px(20);
    const photoY = py(96);
    const photo = px(188);
    round(ctx, photoX, photoY, photo, photo, px(14));
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(photoX, photoY, photo, photo);
    ctx.fillStyle = '#1E6A83';
    ctx.font = `800 ${Math.round(px(72))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText((view.fullName.trim().slice(0, 1) || 'S').toUpperCase(), photoX + photo / 2, photoY + photo * 0.64);
    ctx.textAlign = 'left';
    const chipW = px(40);
    const chipH = py(24);
    const chipX = photoX + photo - chipW - px(12);
    const chipY = photoY + py(12);
    const chip = ctx.createLinearGradient(chipX, chipY, chipX + chipW, chipY + chipH);
    chip.addColorStop(0, '#FFFFFF');
    chip.addColorStop(0.4, '#3FE0D0');
    chip.addColorStop(0.62, '#F4FEFF');
    chip.addColorStop(1, '#8FD0E4');
    round(ctx, chipX, chipY, chipW, chipH, px(4));
    ctx.fillStyle = chip;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#1E6A83';
    ctx.lineWidth = Math.max(4, px(6));
    round(ctx, photoX, photoY, photo, photo, px(14));
    ctx.stroke();

    round(ctx, photoX, py(298), photo, py(62), px(12));
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    const runs = code39Runs(view.studentId || view.fullName);
    const total = runs.reduce((sum, bar) => sum + bar, 0) || 1;
    let cursor = photoX + px(10);
    const barMax = photo - px(20);
    runs.forEach((bar, index) => {
      const barW = (barMax * bar) / total;
      if (index % 2 === 0) {
        ctx.fillStyle = '#203337';
        ctx.fillRect(cursor, py(312), Math.max(barW, 0.4), py(34));
      }
      cursor += barW;
    });

    const labels: Array<[string, string]> = [
      ['NAME', view.fullName],
      ['STUDENT ID', idText],
      ['LEVEL', displayLevel(view.levelName)],
      ['DEPARTMENT/PROGRAMME', view.programme],
      ['ACADEMIC YEAR', view.academicYear],
      ['VALID UNTIL', view.validUntil],
    ];
    const textX = px(228);
    labels.forEach((row, index) => {
      const top = py(104 + index * 52);
      ctx.fillStyle = '#1E6A83';
      ctx.font = `700 ${Math.round(px(11))}px sans-serif`;
      ctx.fillText(row[0], textX, top);
      ctx.fillStyle = '#203337';
      ctx.font = `700 ${Math.round(px(18))}px sans-serif`;
      ctx.fillText(fit(ctx, row[1] || '—', px(360)), textX, top + py(22));
    });

    const sealX = px(742);
    const sealY = py(150);
    ctx.beginPath();
    ctx.arc(sealX, sealY, px(42), 0, Math.PI * 2);
    ctx.strokeStyle = '#3FE0D0';
    ctx.lineWidth = px(3.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sealX, sealY, px(32), 0, Math.PI * 2);
    ctx.strokeStyle = '#1E6A83';
    ctx.lineWidth = px(2.2);
    ctx.stroke();
    ctx.fillStyle = '#1E6A83';
    ctx.font = `800 ${Math.round(px(16))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(mark, sealX, sealY + py(6));
    ctx.textAlign = 'left';

    round(ctx, px(700), py(300), px(100), py(100), px(12));
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    drawQr(ctx, view.verifyPath, px(710), py(310), px(80));

    ctx.strokeStyle = 'rgba(30,106,131,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(20), py(448));
    ctx.lineTo(width - px(20), py(448));
    ctx.stroke();
    ctx.fillStyle = '#203337';
    ctx.font = `700 ${Math.round(px(13))}px sans-serif`;
    ctx.fillText(SAFELINE_ROW, px(20), py(470));
  } else {
    ctx.fillStyle = '#203337';
    ctx.font = `500 ${Math.round(px(15))}px sans-serif`;
    let cursor = wrap(ctx, BACK_TERMS, px(24), py(130), px(500), py(22));
    ctx.font = `700 ${Math.round(px(16))}px sans-serif`;
    cursor = wrap(ctx, `If found, please return to ${view.brand.institutionName}.`, px(24), cursor + py(28), px(500), py(22));
    ctx.font = `500 ${Math.round(px(15))}px sans-serif`;
    cursor = wrap(ctx, BACK_SAFELINE, px(24), cursor + py(28), px(500), py(22));
    ctx.fillStyle = '#1E6A83';
    ctx.font = `700 ${Math.round(px(16))}px sans-serif`;
    ctx.fillText(VERIFY_LABEL, px(24), cursor + py(32));
    round(ctx, px(560), py(140), px(220), py(220), px(16));
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    drawQr(ctx, view.verifyPath, px(580), py(160), px(180));
  }

  ctx.fillStyle = '#3FE0D0';
  ctx.fillRect(0, height - py(46), width, py(46));
  ctx.fillStyle = '#203337';
  ctx.font = `700 ${Math.round(px(18))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(fit(ctx, view.brand.motto, width - px(40)), width / 2, height - py(18));
  ctx.textAlign = 'left';

  if (view.sample) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#203337';
    ctx.font = `800 ${Math.round(px(84))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SAMPLE', width / 2, height * 0.58);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.font = `600 ${Math.round(px(12))}px sans-serif`;
    const chip = 'Sample card';
    const chipW = ctx.measureText(chip).width + px(16);
    round(ctx, px(22), py(96), chipW, py(22), py(11));
    ctx.fillStyle = '#3FE0D0';
    ctx.fill();
    ctx.strokeStyle = '#1E6A83';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#203337';
    ctx.fillText(chip, px(30), py(111));
  }

  ctx.restore();
  ctx.strokeStyle = '#1E6A83';
  ctx.lineWidth = Math.max(1, px(1));
  round(ctx, px(0.5), py(0.5), width - px(1), height - py(1), radius);
  ctx.stroke();
}
