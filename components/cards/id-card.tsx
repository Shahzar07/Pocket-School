import { qrSvg } from '@/lib/certificate-qr';
import {
  BACK_SAFELINE,
  BACK_TERMS,
  CARD_BADGE,
  CARD_RATIO,
  SAFELINE_ROW,
  VERIFY_LABEL,
  code39Runs,
  displayLevel,
  monogram,
  type IdCardView,
} from '@/lib/cards/id-face';

function Bars({ value }: { value: string }) {
  const runs = code39Runs(value || 'ID');
  const total = runs.reduce((sum, width) => sum + width, 0) || 1;
  let x = 0;
  const rects = runs.map((width, index) => {
    const bar = index % 2 === 0
      ? <rect key={index} x={x} y={0} width={width} height={1} fill="#203337" />
      : null;
    x += width;
    return bar;
  });
  return (
    <svg viewBox={`0 0 ${total} 1`} className="h-full w-full" role="img" aria-label="Barcode">
      {rects}
    </svg>
  );
}

function BookMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-[62%] w-[62%]" aria-hidden>
      <path fill="#1E6A83" d="M7 13.2c6.2-2.4 10.2-1.1 16.2 1.5v21.4c-6-2.6-10-3.8-16.2-1.4V13.2z" />
      <path fill="#1E6A83" d="M41 13.2c-6.2-2.4-10.2-1.1-16.2 1.5v21.4c6-2.6 10-3.8 16.2-1.4V13.2z" />
      <path fill="#3FE0D0" d="M22.2 15.2h3.6v20.6h-3.6z" />
    </svg>
  );
}

function Header({ view }: { view: IdCardView }) {
  return (
    <header
      className="absolute inset-x-0 top-0 flex h-[15.21%] items-center gap-[1.6cqw] px-[2.2cqw] text-white"
      style={{ background: 'linear-gradient(90deg, #1E6A83 0%, #1E6A83 100%)' }}
    >
      {view.brand.logoUrl ? (
        <img src={view.brand.logoUrl} alt="" className="h-[9.1cqw] w-[9.1cqw] shrink-0 rounded-[1.4cqw] bg-white object-contain p-[0.6cqw]" />
      ) : (
        <div className="flex h-[9.1cqw] w-[9.1cqw] shrink-0 items-center justify-center rounded-[1.4cqw] bg-white">
          <BookMark />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[2.7cqw] font-black uppercase leading-none tracking-[0.04em]">{view.brand.institutionName}</p>
        <p className="mt-[0.7cqw] truncate text-[1.7cqw] font-medium leading-tight text-white">{view.brand.tagline}</p>
      </div>
      <div className="shrink-0 rounded-full bg-[#3FE0D0] px-[1.8cqw] py-[0.85cqw]">
        <p className="text-[1.85cqw] font-black tracking-[0.03em] text-[#203337]">{CARD_BADGE}</p>
      </div>
    </header>
  );
}

function Footer({ motto }: { motto: string }) {
  return (
    <footer className="absolute inset-x-0 bottom-0 flex h-[8.75%] items-center justify-center bg-[#3FE0D0] px-[3cqw]">
      <p className="truncate text-[2.35cqw] font-bold text-[#203337]">{motto}</p>
    </footer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[1.55cqw] font-bold uppercase leading-none tracking-[0.08em] text-[#1E6A83]">{label}</p>
      <p className="mt-[0.35cqw] truncate text-[2.35cqw] font-bold leading-tight text-[#203337]">{value || '—'}</p>
    </div>
  );
}

export function IdCard({ view, side = 'front' }: { view: IdCardView; side?: 'front' | 'back' }) {
  const mark = (view.brand.monogram || monogram(view.brand.institutionName)).slice(0, 4);
  const idText = view.studentId || 'Private';
  const qr = qrSvg(view.verifyPath || '/verify', 'QR code for the signed student ID check');
  const initial = (view.fullName.trim().slice(0, 1) || 'S').toUpperCase();

  return (
    <article
      className="relative w-full overflow-hidden border border-[#1E6A83] bg-[#F3FEFE]"
      style={{ aspectRatio: String(CARD_RATIO), containerType: 'inline-size', borderRadius: '3.41cqw' }}
      aria-label={`${view.fullName}, ${CARD_BADGE}`}
    >
      <Header view={view} />
      {side === 'front' ? (
        <>
          <div className="absolute inset-x-0 grid grid-cols-[27%_1fr_16%] gap-[2cqw] px-[2.4cqw] py-[1.6cqw]" style={{ top: '15.21%', bottom: '14.85%' }}>
            <div className="flex min-h-0 flex-col">
              <div className="relative aspect-square w-full overflow-hidden rounded-[1.8cqw] border-[0.7cqw] border-[#1E6A83] bg-white">
                {view.photoUrl ? (
                  <img src={view.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11cqw] font-black text-[#1E6A83]">{initial}</div>
                )}
                <span
                  aria-hidden
                  className="absolute right-[7%] top-[7%] h-[14%] w-[24%] rounded-[0.45cqw] border border-[#1E6A83]/30"
                  style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #3FE0D0 40%, #F4FEFF 62%, #8FD0E4 100%)' }}
                />
              </div>
              <div className="mt-[1.3cqw] rounded-[1.5cqw] bg-white px-[1.1cqw] py-[0.9cqw]">
                <div className="h-[4.4cqw]"><Bars value={view.studentId || view.fullName} /></div>
              </div>
            </div>
            <div className="flex min-h-0 flex-col justify-between py-[0.4cqw]">
              <Field label="NAME" value={view.fullName} />
              <Field label="STUDENT ID" value={idText} />
              <Field label="LEVEL" value={displayLevel(view.levelName)} />
              <Field label="DEPARTMENT/PROGRAMME" value={view.programme} />
              <Field label="ACADEMIC YEAR" value={view.academicYear} />
              <Field label="VALID UNTIL" value={view.validUntil} />
            </div>
            <div className="flex min-h-0 flex-col items-center justify-between py-[0.2cqw]">
              <div className="relative flex h-[12.2cqw] w-[12.2cqw] items-center justify-center rounded-full" style={{ boxShadow: 'inset 0 0 0 0.42cqw #3FE0D0' }}>
                <span className="absolute inset-[0.95cqw] rounded-full" style={{ boxShadow: 'inset 0 0 0 0.28cqw #1E6A83' }} aria-hidden />
                <span className="text-[2.5cqw] font-black text-[#1E6A83]">{mark}</span>
              </div>
              <div className="w-full overflow-hidden rounded-[1.4cqw] bg-white p-[0.7cqw] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
          </div>
          <div className="absolute inset-x-0 flex items-center border-t border-[#1E6A83]/30 px-[2.4cqw]" style={{ bottom: '8.75%', height: '6.1%' }}>
            <p className="truncate text-[1.7cqw] font-bold text-[#203337]">{SAFELINE_ROW}</p>
          </div>
        </>
      ) : (
        <div className="absolute inset-x-0 grid grid-cols-[1fr_30%] items-center gap-[3cqw] px-[3.2cqw]" style={{ top: '15.21%', bottom: '8.75%' }}>
          <div className="flex flex-col gap-[1.5cqw]">
            <p className="text-[2.05cqw] leading-snug text-[#203337]">{BACK_TERMS}</p>
            <p className="text-[2.2cqw] font-bold leading-snug text-[#203337]">If found, please return to {view.brand.institutionName}.</p>
            <p className="text-[2.05cqw] leading-snug text-[#203337]">{BACK_SAFELINE}</p>
            <p className="text-[2.15cqw] font-bold text-[#1E6A83]">{VERIFY_LABEL}</p>
          </div>
          <div className="overflow-hidden rounded-[1.8cqw] bg-white p-[1.2cqw] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      )}
      <Footer motto={view.brand.motto} />
      {view.sample ? (
        <>
          <p className="absolute left-[2.6cqw] top-[18%] z-20 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-[1.4cqw] py-[0.3cqw] text-[1.55cqw] font-semibold text-[#203337]">Sample card</p>
          <p aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[12cqw] font-black uppercase tracking-[0.28em] text-[#203337]" style={{ opacity: 0.18 }}>SAMPLE</p>
        </>
      ) : null}
    </article>
  );
}
