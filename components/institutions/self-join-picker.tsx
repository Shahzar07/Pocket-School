'use client';

import { useId } from 'react';
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
  schoolName = '',
  student = false,
  place = false,
  tone = 'inverse',
  onPath,
  onCountry,
  onState,
  onInstitution,
  onInviteCode,
  onChildEmails,
  onSchoolName,
}: {
  path: 'independent' | 'institution';
  country: string;
  state: string;
  institutionId: string;
  institutions: readonly JoinDirectoryRow[];
  inviteCode: string;
  childEmails: string;
  showChildren: boolean;
  /** Typed when the school is not a registered institution. It does not join one. */
  schoolName?: string;
  /** Student signup always shows country, state, and the registered-institution list. */
  student?: boolean;
  /** Teachers and parents always see country, state, and a school or institution. */
  place?: boolean;
  tone?: 'inverse' | 'default';
  onPath: (path: 'independent' | 'institution') => void;
  onCountry: (country: string) => void;
  onState: (state: string) => void;
  onInstitution: (id: string) => void;
  onInviteCode: (code: string) => void;
  onChildEmails: (value: string) => void;
  onSchoolName?: (value: string) => void;
}) {
  const pathLabelId = useId();
  const inverse = tone === 'inverse';
  const label = inverse ? 'text-white/60 text-xs font-semibold uppercase tracking-wider' : 'text-sm font-medium';
  const control = inverse
    ? 'w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white px-4 text-sm outline-none'
    : 'w-full h-11 rounded-xl border border-border bg-background px-3 text-sm';
  const states = statesForCountry(country);
  const showDirectory = student || place || path === 'institution';
  const showSchoolName = (student || place) && !institutionId;
  const chosen = institutions.find((item) => item.id === institutionId);
  return (
    <div className="space-y-3">
      {student && (
        <p className="rounded-2xl border border-[#1E6A83]/50 bg-[#203337] px-4 py-3 text-sm leading-relaxed text-[#E9F7FA]">
          You can only join an institution that is registered on Poket School. If yours isn&apos;t listed, sign up as an independent learner and ask your school to register.
        </p>
      )}
      {!student && <p id={pathLabelId} className={label}>How are you joining?</p>}
      {!student && <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2" role="group" aria-labelledby={pathLabelId}>
        {(['independent', 'institution'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={path === item}
            onClick={() => onPath(item)}
            className={`min-h-12 rounded-2xl border px-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6FBBCE] ${
              path === item
                ? 'border-primary bg-primary/15 text-primary'
                : inverse
                  ? 'border-white/10 bg-white/5 text-white/50'
                  : 'border-border bg-card text-muted-foreground'
            }`}
          >
            {item === 'independent' ? 'Independent' : 'Join with my school'}
          </button>
        ))}
      </div>}
      {!student && path === 'independent' && (
        <p className={inverse ? 'text-xs text-white/45' : 'text-sm text-muted-foreground'}>
          You pay online. Students pay their level plan. Parents are free, and a second child is 30% off. Independent teachers pay the Teacher plan. If your school is not listed, this is the path to use.
        </p>
      )}
      {showDirectory && (
        <div className="space-y-3">
          <CountrySelect tone={tone} label="Country" value={country} onChange={onCountry} />
          <label className="block space-y-1.5">
            <span className={label}>State / region</span>
            <select className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6A83]`} value={state} onChange={(event) => onState(event.target.value)} aria-label="State or region">
              <option value="" className="bg-[#0B0F1A]">Choose a state / region</option>
              {states.map((item) => <option key={item} value={item} className="bg-[#0B0F1A]">{item}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={label}>{student || place ? 'School / institution' : 'Institution'}</span>
            <select
              className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6A83]`}
              value={institutionId}
              onChange={(event) => {
                onInstitution(event.target.value);
                if (student || place) onPath(event.target.value ? 'institution' : 'independent');
              }}
              aria-label="Institution"
            >
              <option value="" className="bg-[#0B0F1A]">{student || place ? "My school isn't listed" : 'Choose a listed institution'}</option>
              {institutions.map((item) => <option key={item.id} value={item.id} className="bg-[#0B0F1A]">{item.name}</option>)}
            </select>
          </label>
          {showSchoolName && (
            <label className="block space-y-1.5">
              <span className={label}>School name</span>
              <input
                className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6A83]`}
                value={schoolName}
                onChange={(event) => onSchoolName?.(event.target.value)}
                placeholder="Type your school name"
                aria-label="School name"
                autoComplete="organization"
                maxLength={80}
              />
              <span className={inverse ? 'block text-xs leading-relaxed text-[#3FE0D0]' : 'block text-xs leading-relaxed text-[#1E6A83]'}>
                This is your own school name. It does not join a Poket School institution.
              </span>
            </label>
          )}
          {chosen && (
            <div className="space-y-2">
              <p className={inverse ? 'text-sm text-[#3FE0D0]' : 'text-sm text-[#1E6A83]'}>You are joining {chosen.name}.</p>
              {chosen.slug && (
                <a
                  href={`/i/${chosen.slug}/join`}
                  className="inline-flex h-11 items-center rounded-2xl border border-[#1E6A83] bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]"
                >
                  Join with my school
                </a>
              )}
            </div>
          )}
          {country && state && institutions.length === 0 && (
            <p className={inverse ? 'text-xs text-[#3FE0D0]' : 'text-sm text-[#1E6A83]'}>
              No registered institution in that state or region. Continue as an independent learner and ask your school to register.
            </p>
          )}
          <label className="block space-y-1.5">
            <span className={label}>Invite code, if you have one</span>
            <input className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6FBBCE]`} value={inviteCode} onChange={(event) => onInviteCode(event.target.value.toUpperCase())} placeholder="AB23CD45" aria-label="Invite code" autoCapitalize="characters" autoComplete="off" />
          </label>
        </div>
      )}
      {showChildren && (
        <label className="block space-y-1.5">
          <span className={label}>Children&apos;s emails</span>
          <input className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6FBBCE]`} value={childEmails} onChange={(event) => onChildEmails(event.target.value)} placeholder="child@school.edu" aria-label="Children emails" autoComplete="email" inputMode="email" />
        </label>
      )}
    </div>
  );
}
