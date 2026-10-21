'use client';

import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { paletteColours, type CertificateDesign, type CertificateSample } from '@/lib/certificates/design';
import { copyrightNotice } from '@/lib/export/notice';
import { certificateLayout, type Box } from '@/lib/certificates/layout';

function place(box: Box, page: { width: number; height: number }): CSSProperties {
  if (box.w <= 0 || box.h <= 0) return { display: 'none' };
  return {
    position: 'absolute',
    left: `${(box.x / page.width) * 100}%`,
    top: `${(box.y / page.height) * 100}%`,
    width: `${(box.w / page.width) * 100}%`,
    height: `${(box.h / page.height) * 100}%`,
  };
}

function typeSize(points: number, pageHeight: number): string {
  return `${(points / pageHeight) * 100}cqh`;
}

function PoketMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <rect width="64" height="64" rx="10" fill="#3FE0D0" />
      <text x="32" y="44" textAnchor="middle" fontSize="32" fontWeight="700" fill="#203337" fontFamily="Noto Sans Certificate, sans-serif">P</text>
    </svg>
  );
}

export function CertificateSheet({
  design,
  sample,
}: {
  design: CertificateDesign;
  sample: CertificateSample;
}) {
  const layout = certificateLayout(design);
  const colours = paletteColours(design.palette);
  const page = layout.page;
  const text = {
    color: colours.ink,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    lineHeight: 1.15,
    overflow: 'hidden',
  };

  return (
    <div
      data-certificate-sheet="1"
      data-page-size={design.pageSize}
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: `${page.width} / ${page.height}`,
        containerType: 'size',
        background: colours.wash,
        color: colours.ink,
        fontFamily: '"Noto Sans Certificate", "Noto Sans", sans-serif',
      }}
    >
      <style>{`
        @font-face {
          font-family: 'Noto Sans Certificate';
          src: url('/fonts/NotoSans-Regular.ttf') format('truetype');
          font-weight: 400;
          font-display: swap;
        }
        @font-face {
          font-family: 'Noto Sans Certificate';
          src: url('/fonts/NotoSans-Bold.ttf') format('truetype');
          font-weight: 700;
          font-display: swap;
        }
      `}</style>
      <div style={{ ...place(layout.band, page), background: 'linear-gradient(90deg, #1E6A83 0%, #3FE0D0 100%)' }} />
      {design.border === 'line' || design.border === 'double' ? (
        <div style={{ ...place(layout.outer, page), border: `${design.border === 'double' ? 3 : 1.5}px solid ${colours.line}`, boxSizing: 'border-box' }} />
      ) : null}
      {design.border === 'double' && layout.inner ? (
        <div style={{ ...place(layout.inner, page), border: `1px solid ${colours.line}`, boxSizing: 'border-box' }} />
      ) : null}
      {design.border === 'corner' ? <CornerMarks box={layout.outer} page={page} color={colours.line} /> : null}
      <div style={place(layout.mark, page)}><PoketMark /></div>
      <div style={{ ...place(layout.wordmark, page), ...text, justifyContent: 'flex-start', fontWeight: 700, letterSpacing: '0.14em', fontSize: typeSize(layout.smallSize, page.height) }}>
        POKET SCHOOL
      </div>
      {design.logoUrl ? (
        <div style={place(layout.institution, page)}>
          <img src={design.logoUrl} alt="Institution logo" className="h-full w-full object-contain" />
        </div>
      ) : null}
      {design.coBrandLogoUrl ? (
        <div style={place(layout.coBrandLogo, page)}>
          <img src={design.coBrandLogoUrl} alt={design.coBrandName || 'Co-brand'} className="h-full w-full object-contain" />
        </div>
      ) : null}
      <div style={{ ...place(layout.title, page), ...text, fontWeight: 700, fontSize: typeSize(layout.titleSize, page.height) }}>{design.title}</div>
      {design.showRecipient ? <div style={{ ...place(layout.recipient, page), ...text, fontSize: typeSize(layout.nameSize, page.height) }}>{sample.recipient}</div> : null}
      {design.showCourse ? <div style={{ ...place(layout.course, page), ...text, color: colours.accent, fontSize: typeSize(layout.bodySize, page.height) }}>{sample.course}</div> : null}
      {design.showDate ? <div style={{ ...place(layout.date, page), ...text, fontSize: typeSize(layout.bodySize, page.height) }}>{sample.date}</div> : null}
      {design.showCertificateId ? <div style={{ ...place(layout.certificateId, page), ...text, fontSize: typeSize(layout.smallSize, page.height) }}>{sample.certificateId}</div> : null}
      {design.coBrandName ? <div style={{ ...place(layout.coBrandName, page), ...text, fontSize: typeSize(layout.bodySize, page.height) }}>With {design.coBrandName}</div> : null}
      <div data-certificate-footer="1" className="contents">
        {design.signatories.slice(0, layout.signatories.length).map((person, index) => {
          const slot = layout.signatories[index];
          if (!slot) return null;
          return (
            <div key={`${person.name}-${index}`} style={place(slot, page)} className="flex flex-col items-center justify-end text-center">
              {person.imageUrl ? (
                <img src={person.imageUrl} alt={`${person.name || 'Signatory'} signature`} className="max-h-[58%] w-auto max-w-full object-contain" />
              ) : (
                <div className="mb-1 h-px w-4/5" style={{ background: colours.accent }} />
              )}
              <p className="max-w-full truncate font-bold" style={{ fontSize: typeSize(layout.smallSize, page.height) }}>{person.name}</p>
              <p className="max-w-full truncate" style={{ color: colours.accent, fontSize: typeSize(layout.tinySize, page.height) }}>{person.title}</p>
            </div>
          );
        })}
        {design.showQr ? (
          <div style={place(layout.qr, page)} className="bg-white">
            <QRCodeSVG value={sample.verifyUrl} size={256} bgColor="#ffffff" fgColor={colours.ink} style={{ width: '100%', height: '100%' }} aria-label="QR code linking to the verify page" />
          </div>
        ) : null}
        {design.showQr ? (
          <p style={{ ...place(layout.verify, page), ...text, fontSize: typeSize(layout.tinySize, page.height), overflowWrap: 'anywhere' }}>{sample.verifyUrl}</p>
        ) : null}
      </div>
      <p style={{ ...place(layout.copyright, page), ...text, color: colours.accent, fontSize: typeSize(layout.tinySize, page.height) }}>{copyrightNotice()}</p>
    </div>
  );
}

function CornerMarks({ box, page, color }: { box: Box; page: { width: number; height: number }; color: string }) {
  const len = Math.min(page.width, page.height) * 0.06;
  const marks = [
    { x: box.x, y: box.y, bx: 0, by: 0 },
    { x: box.x + box.w, y: box.y, bx: 1, by: 0 },
    { x: box.x, y: box.y + box.h, bx: 0, by: 1 },
    { x: box.x + box.w, y: box.y + box.h, bx: 1, by: 1 },
  ];
  return (
    <>
      {marks.map((mark) => (
        <span
          key={`${mark.bx}-${mark.by}`}
          style={{
            position: 'absolute',
            left: `${((mark.x - (mark.bx ? len : 0)) / page.width) * 100}%`,
            top: `${((mark.y - (mark.by ? len : 0)) / page.height) * 100}%`,
            width: `${(len / page.width) * 100}%`,
            height: `${(len / page.height) * 100}%`,
            borderColor: color,
            borderStyle: 'solid',
            borderTopWidth: mark.by ? 0 : 2,
            borderBottomWidth: mark.by ? 2 : 0,
            borderLeftWidth: mark.bx ? 0 : 2,
            borderRightWidth: mark.bx ? 2 : 0,
            boxSizing: 'border-box',
          }}
        />
      ))}
    </>
  );
}
