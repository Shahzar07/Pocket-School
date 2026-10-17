'use client';

import { CountrySelect } from '@/components/country-select';
import { statesForCountry } from '@/lib/institution-states';
import type { JoinDirectoryRow } from '@/lib/institution-membership';

export function SelfJoinPicker({
  path,
  country,
  state,
  institutionId,
  institutions,
  inviteCode,
  childEmails,
  showChildren,
  tone = 'inverse',
  onPath,
  onCountry,
  onState,
  onInstitution,
  onInviteCode,
  onChildEmails,
}: {
  path: 'independent' | 'institution';
  country: string;
  state: string;
  institutionId: string;
  institutions: readonly JoinDirectoryRow[];
  inviteCode: string;
  childEmails: string;
  showChildren: boolean;
  tone?: 'inverse' | 'default';
  onPath: (path: 'independent' | 'institution') => void;
  onCountry: (country: string) => void;
  onState: (state: string) => void;
  onInstitution: (id: string) => void;
  onInviteCode: (code: string) => void;
  onChildEmails: (value: string) => void;
}) {
  const inverse = tone === 'inverse';
  const label = inverse ? 'text-white/60 text-xs font-semibold uppercase tracking-wider' : 'text-sm font-medium';
  const control = inverse
    ? 'w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white px-4 text-sm outline-none'
    : 'w-full h-11 rounded-xl border border-border bg-background px-3 text-sm';
  const states = statesForCountry(country);
  return (
    <div className="space-y-3">
      <p className={label}>How are you joining?</p>
      <div className="grid grid-cols-2 gap-2">
        {(['independent', 'institution'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPath(item)}
            className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
              path === item
                ? 'border-[#2786A4] bg-[#2786A4]/15 text-[#6FBBCE]'
                : inverse
                  ? 'border-white/10 bg-white/5 text-white/50'
                  : 'border-border bg-card text-muted-foreground'
            }`}
          >
            {item === 'independent' ? 'Independent' : 'From an institution'}
          </button>
        ))}
      </div>
      {path === 'independent' && (
        <p className={inverse ? 'text-xs text-white/45' : 'text-sm text-muted-foreground'}>
          You pay online. Students pay their level plan. Parents are free, and a second child is 30% off. Independent teachers pay the Teacher plan. If your school is not listed, this is the path to use.
        </p>
      )}
      {path === 'institution' && (
        <div className="space-y-3">
          <CountrySelect tone={tone} label="Country" value={country} onChange={onCountry} />
          <label className="block space-y-1.5">
            <span className={label}>State</span>
            <select className={control} value={state} onChange={(event) => onState(event.target.value)} aria-label="State">
              {states.map((item) => <option key={item} value={item} className="bg-[#0B0F1A]">{item}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={label}>Institution</span>
            <select className={control} value={institutionId} onChange={(event) => onInstitution(event.target.value)} aria-label="Institution">
              <option value="" className="bg-[#0B0F1A]">Choose a listed institution</option>
              {institutions.map((item) => <option key={item.id} value={item.id} className="bg-[#0B0F1A]">{item.name}</option>)}
            </select>
          </label>
          {institutions.length === 0 && country && state && (
            <p className={inverse ? 'text-xs text-amber-200' : 'text-sm text-amber-700'}>
              No listed institution in that state. Continue as Independent and pay online.
            </p>
          )}
          <label className="block space-y-1.5">
            <span className={label}>Invite code, if you have one</span>
            <input className={control} value={inviteCode} onChange={(event) => onInviteCode(event.target.value.toUpperCase())} placeholder="AB23CD45" aria-label="Invite code" />
          </label>
        </div>
      )}
      {showChildren && (
        <label className="block space-y-1.5">
          <span className={label}>Children&apos;s emails</span>
          <input className={control} value={childEmails} onChange={(event) => onChildEmails(event.target.value)} placeholder="child@school.edu" aria-label="Children emails" />
        </label>
      )}
    </div>
  );
}
