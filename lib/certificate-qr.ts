import QRCode from 'qrcode';

/** Quiet zone required by the QR specification so a camera can find the code. */
export const QR_QUIET_ZONE = 4;

export interface QrMatrix {
  size: number;
  dark: (row: number, col: number) => boolean;
}

/** Error correction M. The matrix is what both the PDF and the print view draw. */
export function qrMatrix(value: string): QrMatrix {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  return {
    size: qr.modules.size,
    dark: (row, col) => qr.modules.get(row, col) === 1,
  };
}

export function qrSvg(value: string, label = 'QR code linking to the certificate verification page'): string {
  const matrix = qrMatrix(value);
  const quiet = QR_QUIET_ZONE;
  const dim = matrix.size + quiet * 2;
  const cells: string[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (!matrix.dark(row, col)) continue;
      cells.push(`<rect x="${col + quiet}" y="${row + quiet}" width="1" height="1"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="${dim}" height="${dim}" fill="#ffffff"/><g fill="#111111">${cells.join('')}</g></svg>`;
}
