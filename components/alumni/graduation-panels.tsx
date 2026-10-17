'use client';

import { QRCodeSVG } from 'qrcode.react';
import { BRAND } from '@/lib/brand-theme';
import { canUndoGraduation, type GraduationBillPreview, type GraduationCard, type ReadyGraduate } from '@/lib/graduation';
import { shareLinks } from '@/lib/credentials/badge-model';

const CONFETTI = [BRAND.ink, BRAND.mid, BRAND.bright, BRAND.mist, BRAND.foam];

function Confetti() {
  return (
    <div className="grad-confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes grad-fall {
          from { transform: translateY(0) rotate(0deg); }
          to { transform: translateY(28px) rotate(160deg); }
        }
        .grad-confetti i {
          position: absolute;
          display: block;
          width: 8px;
          height: 14px;
          border-radius: 2px;
          animation: grad-fall 2.6s ease-in-out infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .grad-confetti i { animation: none; }
        }
      `}</style>
      {CONFETTI.concat(CONFETTI, CONFETTI, CONFETTI).map((color, index) => (
        <i
          key={`${color}-${index}`}
          style={{
            background: color,
            left: `${(index * 19) % 100}%`,
            top: `${(index * 11) % 72}%`,
            animationDelay: `${(index % 7) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

export function GraduationCelebration({ card }: { card: GraduationCard }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-brand-gradient px-6 py-8">
      <Confetti />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-mid">Graduation</p>
        <h2 className="mt-1 font-heading text-4xl tracking-tight">You graduated</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-on/80">
          {card.name}, this account is now individual. Your records stay, and the academy seat is free.
        </p>
        <div className="mt-6 grid items-center gap-4 sm:grid-cols-[1fr_160px]">
          <article className="rounded-3xl bg-brand-mist p-5 text-brand-ink">
            <span className="inline-flex rounded-full bg-brand-mid px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]">Graduate</span>
            <h3 className="mt-3 font-heading text-3xl tracking-tight">{card.publicName}</h3>
            <p className="mt-1 text-sm">{card.institutionName}{card.level ? ` · ${card.level}` : ''}</p>
            <p className="mt-3 font-mono text-sm">{card.studentNumber}</p>
            {card.graduatedOn ? <p className="mt-1 text-xs text-brand-ink/70">Graduated {card.graduatedOn}</p> : null}
            <p className="mt-3 text-xs leading-relaxed text-brand-ink/70">Share this card. The code opens the public profile once that profile is on.</p>
            <a className="mt-2 inline-flex text-sm font-semibold text-brand-mid" href={shareLinks(card.qrUrl, `${card.publicName} graduated on Poket School`).linkedin} target="_blank" rel="noreferrer">Share to LinkedIn</a>
          </article>
          <div className="flex items-center justify-center rounded-3xl bg-white p-4">
            <QRCodeSVG value={card.qrUrl} size={128} fgColor={BRAND.ink} bgColor="#ffffff" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function GraduationDesk({
  suggestions,
  preview,
  onPreview,
  onConfirm,
}: {
  suggestions: readonly ReadyGraduate[];
  preview: GraduationBillPreview | null;
  onPreview?: () => void;
  onConfirm?: () => void;
}) {
  return (
    <section className="space-y-4 rounded-[28px] border border-brand-ink/10 bg-white p-5 text-brand-ink">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-mid">Ready to graduate</p>
        <h2 className="font-heading text-3xl tracking-tight">Final level</h2>
        <p className="mt-1 text-sm leading-relaxed">
          {suggestions.length === 0
            ? 'No joined student is at the final level.'
            : `${suggestions.length} joined student${suggestions.length === 1 ? ' is' : 's are'} at the final level. Preview the seats and the bill, then confirm.`}
        </p>
      </div>
      {suggestions.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-brand-ink/10">
          {suggestions.map((person) => (
            <li key={person.email || person.studentId} className="flex items-center justify-between gap-3 border-b border-brand-ink/10 px-4 py-3 text-sm last:border-0">
              <span className="font-semibold">{person.name || person.email}</span>
              <span className="text-brand-ink/70">{person.level}</span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => onPreview?.()} disabled={suggestions.length === 0} className="h-11 rounded-full bg-brand-ink px-5 text-sm font-semibold text-white disabled:opacity-50">
        Preview seats and bill
      </button>
      {preview && (
        <div className="rounded-2xl bg-brand-mist p-4 text-sm leading-relaxed">
          <p className="font-semibold">{preview.seatsFreed} seat{preview.seatsFreed === 1 ? '' : 's'} freed · {preview.studentsAfter} students after</p>
          <p className="mt-1">{preview.message}</p>
          {preview.action === 'suggest_downgrade' && preview.savings > 0 ? (
            <p className="mt-1">Suggested at renewal: {preview.currency} {preview.savings.toFixed(2)} less. This period’s bill stays {preview.currency} {preview.currentTotal.toFixed(2)}.</p>
          ) : null}
          <p className="mt-2 text-xs text-brand-ink/70">Undo within 7 days restores the seat and academy access. Records stay either way.</p>
          <button type="button" onClick={() => onConfirm?.()} className="mt-3 h-10 rounded-full bg-brand-mid px-4 text-sm font-semibold text-white">
            Confirm graduation
          </button>
        </div>
      )}
    </section>
  );
}

export function undoLabel(person: { leftOn: string; undoneOn?: string; seatFreed?: boolean }, today: string): string {
  if (person.undoneOn) return 'Seat restored';
  if (canUndoGraduation({ leftOn: person.leftOn, today, undoneOn: person.undoneOn, seatFreed: person.seatFreed })) return 'Undo';
  return '';
}
