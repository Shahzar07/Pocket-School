'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download, QrCode } from 'lucide-react';
import { studentJoinUrl } from '@/lib/student-number';

export function StudentPassCard({
  name,
  level,
  code,
}: {
  name: string;
  level: string;
  code: string;
}) {
  const [copied, setCopied] = useState<'code' | 'link' | ''>('');
  const [origin, setOrigin] = useState('https://poketschool.ai');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const joinUrl = code ? studentJoinUrl(origin, code) : '';

  const copy = async (value: string, kind: 'code' | 'link') => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(''), 1600);
  };

  const download = async () => {
    if (!joinUrl) return;
    const QRCode = (await import('qrcode')).default;
    const dataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 640, color: { dark: '#203337', light: '#FFFFFF' } });
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `${code || 'poket-student'}.png`;
    anchor.click();
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#1E6A83]/50 bg-[#203337] text-white shadow-[0_18px_40px_-24px_rgba(26,60,52,0.8)]">
      <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#1E6A83]/40 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-[#3C8DFF]/30 blur-2xl" aria-hidden />
      <div className="relative grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E6A83]">Student pass</p>
          <h2 className="mt-1 font-heading text-2xl tracking-tight">{name || 'Student'}</h2>
          <p className="mt-1 text-sm text-white/75">{level || 'Learner'}</p>
          <p className="mt-4 font-mono text-2xl font-semibold tracking-[0.12em] text-[#E9F7FA]">{code || 'PS-••••-••••'}</p>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-white/70">
            A parent scans this code to ask for a link. You confirm it, unless you are under 13, in which case your institution admin confirms.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy(code, 'code')} disabled={!code} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] disabled:opacity-50">
              {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === 'code' ? 'Copied' : 'Copy number'}
            </button>
            <button type="button" onClick={() => void copy(joinUrl, 'link')} disabled={!joinUrl} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-semibold text-white disabled:opacity-50">
              {copied === 'link' ? <Check className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" onClick={() => void download()} disabled={!joinUrl} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-semibold text-white disabled:opacity-50">
              <Download className="h-4 w-4" /> Download QR
            </button>
          </div>
        </div>
        <div className="flex h-[148px] w-[148px] items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
          {joinUrl ? <QRCodeSVG value={joinUrl} size={128} fgColor="#203337" bgColor="#FFFFFF" /> : <QrCode className="h-10 w-10 text-[#203337]/30" />}
        </div>
      </div>
    </section>
  );
}
