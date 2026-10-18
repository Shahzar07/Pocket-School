import { qrSvg } from '@/lib/certificate-qr';
import {
  CARD_BADGE,
  CARD_RATIO,
  SAFELINE_LABEL,
  code39Runs,
  displayLevel,
  monogram,
  themePaint,
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

function Field({ label, value, large = false, labelColor = '#1E6A83' }: { label: string; value: string; large?: boolean; labelColor?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[1.7cqw] font-bold uppercase tracking-[0.12em]" style={{ color: labelColor }}>{label}</p>
      <p className={`truncate font-semibold text-[#203337] ${large ? 'text-[4.2cqw] leading-none' : 'text-[2.5cqw] leading-tight'}`}>{value || '—'}</p>
    </div>
  );
}

export function IdCard({ view, side = 'front' }: { view: IdCardView; side?: 'front' | 'back' }) {
  const paint = themePaint(view.brand.theme);
  const label = view.brand.theme === 'rochford' ? paint.frame : '#1E6A83';
  const mark = monogram(view.brand.institutionName);
  const idText = view.studentId || 'Private';
  const qr = qrSvg(view.verifyPath || '/verify', 'QR code for the signed student ID check');
  const phone = view.brand.emergencyPhone
    ? `${SAFELINE_LABEL} · ${view.brand.emergencyPhone}`
    : SAFELINE_LABEL;

  return (
    <article
      className="relative w-full overflow-hidden bg-white shadow-[0_16px_40px_-24px_rgba(32,51,55,0.45)]"
      style={{ aspectRatio: String(CARD_RATIO), containerType: 'inline-size', borderRadius: '3.2cqw' }}
      aria-label={`${view.fullName}, ${CARD_BADGE}`}
    >
      {side === 'front' ? (
        <>
          <header className="absolute inset-x-0 top-0 flex h-[24%] items-center gap-[2cqw] px-[3cqw] text-white" style={{ background: paint.header }}>
            {view.brand.logoUrl ? (
              <img src={view.brand.logoUrl} alt="" className="h-[14cqw] w-[14cqw] rounded-[1.4cqw] bg-white object-contain" />
            ) : (
              <div className="flex h-[14cqw] w-[14cqw] items-center justify-center rounded-[1.4cqw] bg-white text-[4.2cqw] font-black" style={{ color: paint.frame }}>{mark}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[3.3cqw] font-black uppercase leading-none tracking-wide">{view.brand.institutionName}</p>
              <p className="mt-[0.8cqw] truncate text-[2cqw] leading-tight text-white/85">{view.brand.tagline}</p>
            </div>
            <div className="w-[28%] shrink-0 rounded-[1.6cqw] px-[1.4cqw] py-[1cqw] text-center" style={{ background: paint.accent, color: paint.accentInk }}>
              <p className="text-[2.1cqw] font-black leading-tight">{CARD_BADGE}</p>
              <p className="truncate text-[1.6cqw] font-semibold leading-tight">{view.brand.institutionName}</p>
            </div>
          </header>

          <div className="absolute inset-x-0 bottom-[12%] top-[24%] grid grid-cols-[30%_1fr] gap-[2cqw] px-[3cqw] py-[2cqw]">
            <div className="flex min-h-0 flex-col">
              <div className="relative min-h-0 flex-1 overflow-hidden bg-[#E9F7FA]" style={{ border: '1cqw solid', borderColor: paint.frame }}>
                {view.photoUrl ? (
                  <img src={view.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[8cqw] font-black" style={{ color: paint.frame }}>{view.fullName.slice(0, 1)}</div>
                )}
              </div>
              <div className="mt-[1cqw] bg-white">
                <div className="h-[3.6cqw]"><Bars value={view.studentId || view.fullName} /></div>
                <p className="text-center text-[1.8cqw] font-semibold tracking-[0.14em] text-[#203337]">{idText}</p>
              </div>
            </div>
            <div className="flex min-h-0 flex-col">
              <div className="flex items-start justify-between gap-[1cqw]">
                <Field label="Name" value={view.fullName} large labelColor={label} />
                <div className="flex shrink-0 items-start gap-[1cqw]">
                  <div className="text-right">
                    <p className="text-[1.7cqw] font-bold uppercase tracking-[0.12em]" style={{ color: label }}>Valid until</p>
                    <p className="text-[2.4cqw] font-semibold text-[#203337]">{view.validUntil}</p>
                  </div>
                  <div className="h-[8.4cqw] w-[8.4cqw] overflow-hidden rounded-[0.6cqw] bg-white [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
                  <div className="relative flex h-[8.4cqw] w-[8.4cqw] items-center justify-center rounded-full border-[0.28cqw] text-[2cqw] font-black" style={{ borderColor: paint.accent, color: paint.frame }}>
                    <span className="absolute inset-[0.55cqw] rounded-full border-[0.2cqw]" style={{ borderColor: paint.frame }} aria-hidden />
                    {mark}
                  </div>
                </div>
              </div>
              <div className="mt-[1.4cqw] grid grid-cols-2 gap-x-[2cqw] gap-y-[1.2cqw]">
                <Field label="Student ID" value={idText} labelColor={label} />
                <Field label="Level" value={displayLevel(view.levelName)} labelColor={label} />
                <Field label="Programme" value={view.programme} labelColor={label} />
                <Field label="Academic year" value={view.academicYear} labelColor={label} />
              </div>
              <div className="mt-auto flex items-center gap-[1.2cqw] rounded-[1.2cqw] bg-[#E9F7FA] px-[1.4cqw] py-[0.7cqw]">
                <svg viewBox="0 0 24 24" className="h-[3.2cqw] w-[3.2cqw] shrink-0" aria-hidden>
                  <path fill={paint.frame} d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .7-.3 1z" />
                </svg>
                <p className="min-w-0 leading-tight">
                  <span className="block text-[1.45cqw] font-bold uppercase tracking-[0.12em]" style={{ color: label }}>Emergency contact</span>
                  <span className="block truncate text-[2.1cqw] font-semibold text-[#203337]">{phone}</span>
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <header className="absolute inset-x-0 top-0 flex h-[16%] items-center justify-between px-[3cqw] text-white" style={{ background: paint.header }}>
            <p className="truncate text-[3cqw] font-black uppercase">{view.brand.institutionName}</p>
            <p className="text-[2.2cqw] font-semibold">{CARD_BADGE}</p>
          </header>
          <div className="absolute inset-x-0 bottom-[12%] top-[16%] grid grid-cols-[1fr_22%] gap-[2cqw] px-[3cqw] py-[2cqw]">
            <div className="flex min-h-0 flex-col justify-between">
              <p className="text-[2.3cqw] leading-snug text-[#203337]">This card is free. It is not a government ID. The QR is signed by Poket School and changes on a timer. Partners scan it to check a student.</p>
              <div>
                <p className="text-[2.4cqw] font-semibold text-[#203337]">If found, return to {view.brand.institutionName}.</p>
                <p className="mt-[0.6cqw] text-[2.2cqw] font-semibold" style={{ color: label }}>{phone}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-[1cqw] bg-white [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
        </>
      )}

      <footer className="absolute inset-x-0 bottom-0 flex h-[12%] items-center justify-center px-[3cqw]" style={{ background: paint.accent, color: paint.accentInk }}>
        <p className="truncate text-[2.3cqw] font-semibold">{view.brand.motto}</p>
      </footer>

      {view.sample ? (
        <>
          <p className="absolute left-[4.2cqw] top-[27%] z-20 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-[1.6cqw] py-[0.35cqw] text-[1.7cqw] font-semibold text-[#203337]">Sample card</p>
          <p aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[14cqw] font-black uppercase tracking-[0.28em] text-[#203337]" style={{ opacity: 0.18 }}>SAMPLE</p>
        </>
      ) : null}
    </article>
  );
}
