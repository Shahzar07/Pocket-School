'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { useAuthSTORE } from '@/hooks/use-auth';
import type { PublicCard } from '@/lib/cards/model';
import { academicYear, brandFromSchool, cardValidUntil, displayLevel, INDEPENDENT_VALID, poketBrand, type IdCardBrand, type IdCardView } from '@/lib/cards/id-face';
import { IdCardPanel } from './id-card-panel';
import { CardQr } from '@/components/student-id/card-qr';

interface OwnerPayload {
  studentNumber: string;
  referralCode: string;
  shareId: string;
  sharePath: string;
  publicCard: PublicCard;
  ageTier: 'under13' | 'teen' | 'adult';
  parentRequired: boolean;
  canShare: boolean;
  indexed: boolean;
  schoolName: string;
  holderName?: string;
  brand?: IdCardBrand;
}

interface ChildRow {
  uid: string;
  name: string;
  sharing: boolean;
  sharePath: string;
}

const CHANNELS = [
  ['copy', 'Copy link'],
  ['whatsapp', 'WhatsApp'],
  ['telegram', 'Telegram'],
  ['x', 'X'],
  ['email', 'Email'],
] as const;

function accountFace(profile: {
  displayName?: string;
  name?: string;
  institutionId?: string;
  studentNumber?: string;
  academyLevel?: string;
  level?: string;
  pathway?: string;
  avatarUrl?: string;
} | null): IdCardView | null {
  const fullName = profile?.displayName || profile?.name || '';
  if (!profile || !fullName) return null;
  const school = /rochford/i.test(profile.institutionId || '') ? "Rochford's International School" : '';
  return {
    brand: school ? brandFromSchool(school, null) : poketBrand(),
    fullName,
    studentId: profile.studentNumber || 'Not issued yet',
    levelName: displayLevel(profile.academyLevel || profile.level || 'Learner'),
    programme: profile.pathway || profile.level || 'General',
    academicYear: academicYear(),
    validUntil: school ? cardValidUntil() : INDEPENDENT_VALID,
    photoUrl: profile.avatarUrl || '',
    verifyPath: '/verify',
    sample: false,
  };
}

export function CardDesk() {
  const { profile } = useAuthSTORE();
  const [card, setCard] = useState<OwnerPayload | null>(null);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<{ verifyPath: string; code: string; codeValidUntil: number } | null>(null);

  const load = async () => {
    const data = await authedFetch('/api/card');
    setCard(data.card as OwnerPayload);
    setChildren(Array.isArray(data.children) ? data.children as ChildRow[] : []);
  };

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'The card could not be loaded.'));
    let stop = false;
    const refreshProof = () => {
      authedFetch('/api/student-id')
        .then((data) => {
          if (stop) return;
          const origin = window.location.origin;
          setProof({
            verifyPath: `${origin}${String(data.verifyPath ?? '')}`,
            code: String(data.code ?? ''),
            codeValidUntil: Number(data.codeValidUntil ?? 0),
          });
        })
        .catch(() => undefined);
    };
    refreshProof();
    const timer = window.setInterval(refreshProof, 25_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  const act = async (body: Record<string, unknown>) => {
    setNote('');
    await authedFetch('/api/card', { method: 'POST', body: JSON.stringify(body) });
    await load();
  };

  if (error) {
    const local = accountFace(profile);
    if (!local) return <p className="text-sm text-[#203337]">{error}</p>;
    return (
      <div className="space-y-4">
        <IdCardPanel view={local} />
        <p className="text-sm text-[#1E6A83]">The share link is unavailable right now. This card still shows the signed-in account.</p>
      </div>
    );
  }
  if (!card) return <p className="text-sm text-[#5F7074]">Loading your card…</p>;

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const link = card.sharePath ? `${origin}${card.sharePath}` : '';
  const face: PublicCard = card.schoolName
    ? { ...card.publicCard, schoolName: card.schoolName }
    : card.publicCard;
  const view: IdCardView = {
    brand: card.brand ?? (card.schoolName ? { ...poketBrand(), institutionName: card.schoolName } : poketBrand()),
    fullName: card.holderName || face.firstName,
    studentId: card.studentNumber,
    levelName: face.levelName || 'Learner',
    programme: face.badges[0] || 'General',
    academicYear: academicYear(),
    validUntil: card.schoolName ? cardValidUntil() : INDEPENDENT_VALID,
    photoUrl: face.showPhoto ? face.avatarUrl : '',
    verifyPath: proof?.verifyPath || '/verify',
    sample: false,
  };

  return (
    <div className="space-y-6">
      <IdCardPanel view={view} />
      {proof?.code ? <CardQr path={proof.verifyPath} code={proof.code} codeValidUntil={proof.codeValidUntil} /> : null}
      <p className="text-sm text-[#203337]">
        Your number is <span className="font-semibold">{card.studentNumber}</span>. It stays on this page. A shared card never shows it.
      </p>
      {card.parentRequired && !card.canShare ? (
        <p className="rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm text-[#1E6A83]">A verified parent turns sharing on for this card. The public page uses an avatar, not a photo.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!card.shareId ? (
            <button type="button" className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]" onClick={() => act({ action: 'share' }).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not create the link.'))}>
              Create share link
            </button>
          ) : (
            <>
              <button type="button" className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]" onClick={() => act({ action: 'regenerate' }).then(() => setNote('New link ready. The old one no longer opens.')).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not replace the link.'))}>
                New link
              </button>
              <button type="button" className="rounded-full border border-[#E7EDED] px-4 py-2 text-sm font-semibold text-[#203337]" onClick={() => act({ action: 'revoke' }).then(() => setNote('Share link turned off.')).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not turn the link off.'))}>
                Turn off
              </button>
            </>
          )}
        </div>
      )}
      {link ? (
        <div className="space-y-3">
          <p className="break-all text-sm text-[#1E6A83]">{link}</p>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map(([channel, label]) => (
              <button
                key={channel}
                type="button"
                className="rounded-full border border-[#E7EDED] px-3 py-1.5 text-xs font-semibold text-[#203337]"
                onClick={() => {
                  const url = link;
                  if (channel === 'copy') void navigator.clipboard.writeText(url);
                  if (channel === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener');
                  if (channel === 'telegram') window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}`, '_blank', 'noopener');
                  if (channel === 'x') window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`, '_blank', 'noopener');
                  if (channel === 'email') window.location.href = `mailto:?subject=${encodeURIComponent('Poket School')}&body=${encodeURIComponent(url)}`;
                  void act({ action: 'channel', channel }).then(() => setNote(`Shared by ${label}.`)).catch(() => setNote('The share was not logged.'));
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {card.ageTier === 'adult' ? (
        <label className="flex items-center gap-2 text-sm text-[#203337]">
          <input
            type="checkbox"
            checked={card.indexed}
            onChange={(event) => act({ action: 'index', indexed: event.target.checked }).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not update indexing.'))}
          />
          Let search engines index this card
        </label>
      ) : (
        <p className="text-sm text-[#5F7074]">This card is not indexed by search engines.</p>
      )}
      {children.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-heading text-xl text-[#203337]">Under-13 sharing</h3>
          {children.map((child) => (
            <div key={child.uid} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7EDED] px-4 py-3">
              <span className="text-sm font-semibold text-[#203337]">{child.name}</span>
              <button
                type="button"
                className="rounded-full border border-[#1E6A83] px-3 py-1.5 text-xs font-semibold text-[#1E6A83]"
                onClick={() => act({ action: 'parent-share', childUid: child.uid, enabled: !child.sharing }).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not update sharing.'))}
              >
                {child.sharing ? 'Turn sharing off' : 'Turn sharing on'}
              </button>
            </div>
          ))}
        </section>
      ) : null}
      {note ? <p className="text-sm text-[#203337]">{note}</p> : null}
    </div>
  );
}
