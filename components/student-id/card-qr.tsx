import { qrSvg } from '@/lib/certificate-qr';

export function CardQr({ path, code, codeValidUntil }: { path: string; code: string; codeValidUntil: number }) {
  const when = new Date(codeValidUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const svg = qrSvg(path, 'QR code linking to the Poket School student ID check');
  return (
    <section className="grid gap-4 rounded-[24px] border border-[#e5ebf2] bg-white p-4 sm:grid-cols-[180px_1fr]">
      <div className="mx-auto h-44 w-44" dangerouslySetInnerHTML={{ __html: svg }} />
      <div>
        <h2 className="font-heading text-xl text-[#11131b]">Student ID</h2>
        <p className="mt-1 text-sm text-[#626976]">The QR changes every 30 seconds. Partners scan it for a discount. It stays on this page.</p>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#096ab7]">Checkout code</p>
        <p className="font-heading text-4xl tracking-[0.2em] text-[#11131b]">{code}</p>
        <p className="text-sm text-[#626976]">Use by {when}. A shared card never shows this code.</p>
      </div>
    </section>
  );
}
