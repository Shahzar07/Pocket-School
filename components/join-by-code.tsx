'use client';

import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { studentCodeFromScan } from '@/lib/student-number';

const CodeScanner = dynamic(() => import('@/components/code-scanner').then((mod) => mod.CodeScanner), { ssr: false });

export interface JoinStudentCard {
  studentNumber: string;
  name: string;
  level: string;
  photoUrl: string;
  membership: 'member' | 'pending' | 'open' | 'elsewhere';
}

export function JoinByCode({
  title,
  body,
  actionLabel,
  onResolve,
  card,
  message,
  busy,
  extra,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onResolve: (code: string) => void;
  card: JoinStudentCard | null;
  message: string;
  busy: boolean;
  extra?: ReactNode;
}) {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);

  const submit = (value: string) => {
    const next = studentCodeFromScan(value);
    if (!next) return;
    setCode(next);
    setScanning(false);
    onResolve(next);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-[#C8922A]/40 bg-card shadow-[var(--shadow-card)]">
      <div className="bg-gradient-to-r from-[#1A3C34] via-[#24685A] to-[#C8922A] px-5 py-4 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F8E7C4]">Poket School</p>
        <h2 className="mt-1 font-heading text-2xl">{title}</h2>
        <p className="mt-1 max-w-xl text-sm text-white/80">{body}</p>
      </div>
      <div className="space-y-4 p-5">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); submit(code); }}>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="PS-XXXX-XXXX"
            aria-label="Student number"
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 flex-1 rounded-2xl border border-[#1A3C34]/20 bg-background px-4 font-mono text-sm tracking-wider outline-none focus:border-[#C8922A]"
          />
          <button type="submit" disabled={busy} className="h-12 rounded-2xl bg-[#1A3C34] px-4 text-sm font-semibold text-white disabled:opacity-60">
            {actionLabel}
          </button>
          <button type="button" onClick={() => setScanning((open) => !open)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#C8922A] px-4 text-sm font-semibold text-[#1A3C34]">
            <Camera className="h-4 w-4" /> {scanning ? 'Hide camera' : 'Scan QR'}
          </button>
        </form>
        {scanning && <CodeScanner onCode={submit} onClose={() => setScanning(false)} />}
        {message && <p className="rounded-2xl bg-[#F8E7C4] px-4 py-3 text-sm text-[#1A3C34]">{message}</p>}
        {card && (
          <article className="flex items-center gap-4 rounded-2xl border border-[#3C8DFF]/30 bg-gradient-to-br from-[#E8F2FF] to-[#FFF6E4] p-4">
            {card.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E36A4F] text-xl font-bold text-white">
                {card.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-[#1A3C34]">{card.name}</p>
              <p className="text-sm text-[#1A3C34]/70">{card.level}</p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-mono text-xs text-[#1A3C34]">
                <ScanLine className="h-3 w-3" /> {card.studentNumber}
              </p>
            </div>
          </article>
        )}
        {extra}
      </div>
    </section>
  );
}
