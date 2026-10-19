'use client';

import { useEffect, useId, useState } from 'react';
import { CountrySelect } from '@/components/country-select';
import { statesForCountry } from '@/lib/institution-states';
import type { PublicInstitution } from '@/lib/institutions/public-directory';
import { SIGNUP_SCHOOL } from '@/lib/institutions/signup-copy';

export function SelfJoinPicker({
  path,
  country,
  state,
  institutionId,
  inviteCode,
  childEmails,
  showChildren,
  schoolName = '',
  role = 'student',
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
  inviteCode: string;
  childEmails: string;
  showChildren: boolean;
  schoolName?: string;
  role?: 'student' | 'teacher' | 'parent' | string;
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
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const inverse = tone === 'inverse';
  const label = inverse ? 'text-white/60 text-xs font-semibold uppercase tracking-wider' : 'text-sm font-medium';
  const control = inverse
    ? 'w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white px-4 text-sm outline-none'
    : 'w-full h-11 rounded-xl border border-border bg-background px-3 text-sm';
  const states = statesForCountry(country);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PublicInstitution[]>([]);
  const [note, setNote] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const chosen = rows.find((item) => item.id === institutionId);

  useEffect(() => {
    if (path !== 'institution' || !country) {
      setRows([]);
      return;
    }
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({ country, state, q: query });
      fetch(`/api/institutions/directory?${params.toString()}`)
        .then((res) => res.json())
        .then((data: { institutions?: PublicInstitution[]; configured?: boolean; message?: string }) => {
          setRows(Array.isArray(data.institutions) ? data.institutions : []);
          setNote(data.configured === false ? (data.message || SIGNUP_SCHOOL.setup) : '');
        })
        .catch(() => {
          setRows([]);
          setNote(SIGNUP_SCHOOL.setup);
        });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [path, country, state, query]);

  useEffect(() => {
    const code = inviteCode.trim();
    if (path !== 'institution' || code.length < 4) return;
    const handle = window.setTimeout(() => {
      fetch(`/api/institutions/directory?code=${encodeURIComponent(code)}`)
        .then((res) => res.json())
        .then((data: { institution?: PublicInstitution | null; valid?: boolean }) => {
          if (data.valid && data.institution) {
            onInstitution(data.institution.id);
            setRows((current) => current.some((item) => item.id === data.institution?.id) ? current : [data.institution as PublicInstitution, ...current]);
          }
        })
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [inviteCode, path, onInstitution]);

  const sendInvite = async () => {
    setInviteNote('');
    const res = await fetch('/api/institutions/membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'invite-school',
        schoolName,
        email: schoolEmail,
        country,
        state,
        role,
      }),
    });
    const data = await res.json().catch(() => ({})) as { sent?: boolean; error?: string };
    if (!res.ok) {
      setInviteNote(data.error || SIGNUP_SCHOOL.inviteMissing);
      return;
    }
    setInviteNote(data.sent ? SIGNUP_SCHOOL.inviteSent : SIGNUP_SCHOOL.inviteMissing);
  };

  return (
    <div className="space-y-3" data-signup-school="1" data-hydrated={hydrated ? '1' : '0'}>
      <p id={pathLabelId} className={label}>{SIGNUP_SCHOOL.how}</p>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2" role="group" aria-labelledby={pathLabelId}>
        <button
          type="button"
          data-join-path="independent"
          aria-pressed={path === 'independent'}
          onClick={() => { onPath('independent'); onInstitution(''); }}
          className={`min-h-12 rounded-2xl border px-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6FBBCE] ${
            path === 'independent'
              ? 'border-primary bg-primary/15 text-primary'
              : inverse ? 'border-white/10 bg-white/5 text-white/50' : 'border-border bg-card text-muted-foreground'
          }`}
        >
          {SIGNUP_SCHOOL.independent}
        </button>
        <button
          type="button"
          data-join-path="institution"
          aria-pressed={path === 'institution'}
          onClick={() => onPath('institution')}
          className={`min-h-12 rounded-2xl border px-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6FBBCE] ${
            path === 'institution'
              ? 'border-primary bg-primary/15 text-primary'
              : inverse ? 'border-white/10 bg-white/5 text-white/50' : 'border-border bg-card text-muted-foreground'
          }`}
        >
          {SIGNUP_SCHOOL.school}
        </button>
      </div>
      {path === 'independent' && (
        <p className={inverse ? 'text-xs text-white/45' : 'text-sm text-muted-foreground'}>{SIGNUP_SCHOOL.independentNote}</p>
      )}
      {path === 'institution' && (
        <div className="space-y-3">
          <p className={inverse ? 'text-xs leading-relaxed text-[#E9F7FA]' : 'text-sm text-[#1E6A83]'}>
            {role === 'teacher' ? SIGNUP_SCHOOL.teacherStaff : role === 'parent' ? SIGNUP_SCHOOL.parentNote : SIGNUP_SCHOOL.studentNote}
          </p>
          <CountrySelect tone={tone} label={SIGNUP_SCHOOL.country} value={country} onChange={onCountry} />
          <label className="block space-y-1.5">
            <span className={label}>{SIGNUP_SCHOOL.state}</span>
            <select className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6A83]`} value={state} onChange={(event) => onState(event.target.value)} aria-label={SIGNUP_SCHOOL.state}>
              <option value="" className="bg-[#0B0F1A]">{SIGNUP_SCHOOL.stateEmpty}</option>
              {states.map((item) => <option key={item} value={item} className="bg-[#0B0F1A]">{item}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={label}>{SIGNUP_SCHOOL.search}</span>
            <input
              className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6A83]`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={SIGNUP_SCHOOL.searchPlaceholder}
              aria-label={SIGNUP_SCHOOL.search}
              data-school-search="1"
              autoComplete="organization"
            />
          </label>
          <div className="space-y-2" role="listbox" aria-label={SIGNUP_SCHOOL.directoryLabel}>
            <button
              type="button"
              data-school-id=""
              aria-pressed={!institutionId}
              onClick={() => onInstitution('')}
              className={`flex min-h-11 w-full items-center rounded-2xl border px-3 text-left text-sm ${!institutionId ? 'border-[#3FE0D0] text-[#3FE0D0]' : 'border-white/10 text-white/70'}`}
            >
              {SIGNUP_SCHOOL.notListed}
            </button>
            {rows.map((item) => (
              <button
                key={item.id}
                type="button"
                data-school-id={item.id}
                aria-pressed={institutionId === item.id}
                onClick={() => onInstitution(item.id)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-2xl border px-3 text-left text-sm ${institutionId === item.id ? 'border-[#3FE0D0] text-white' : 'border-white/10 text-white/80'}`}
              >
                {item.logo ? <img src={item.logo} alt="" className="h-8 w-8 rounded-lg object-cover" /> : null}
                <span>
                  <span className="block font-semibold">{item.displayName}</span>
                  <span className="block text-xs text-white/50">{[item.city, item.state].filter(Boolean).join(', ')}</span>
                </span>
              </button>
            ))}
          </div>
          {note ? <p className="text-xs text-[#3FE0D0]">{note}</p> : null}
          {country && state && rows.length === 0 && !note ? <p className="text-xs text-[#3FE0D0]">{SIGNUP_SCHOOL.listedEmpty}</p> : null}
          {!institutionId && (
            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className={label}>{SIGNUP_SCHOOL.schoolName}</span>
                <input
                  className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6A83]`}
                  value={schoolName}
                  onChange={(event) => onSchoolName?.(event.target.value)}
                  aria-label={SIGNUP_SCHOOL.schoolName}
                  autoComplete="organization"
                  maxLength={80}
                />
                <span className={inverse ? 'block text-xs leading-relaxed text-[#3FE0D0]' : 'block text-xs leading-relaxed text-[#1E6A83]'}>{SIGNUP_SCHOOL.schoolNameHint}</span>
              </label>
              <label className="block space-y-1.5">
                <span className={label}>{SIGNUP_SCHOOL.inviteEmail}</span>
                <input
                  className={control}
                  value={schoolEmail}
                  onChange={(event) => setSchoolEmail(event.target.value)}
                  aria-label={SIGNUP_SCHOOL.inviteEmail}
                  inputMode="email"
                  autoComplete="email"
                />
              </label>
              <button type="button" data-invite-school="1" onClick={() => void sendInvite()} className="inline-flex h-11 items-center rounded-2xl bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]">
                {SIGNUP_SCHOOL.inviteSchool}
              </button>
              {inviteNote ? <p className="text-xs text-[#3FE0D0]">{inviteNote}</p> : null}
            </div>
          )}
          {chosen ? <p className="text-sm text-[#3FE0D0]">{SIGNUP_SCHOOL.joining} {chosen.displayName}.</p> : null}
          <label className="block space-y-1.5">
            <span className={label}>{SIGNUP_SCHOOL.code}</span>
            <input className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6FBBCE]`} value={inviteCode} onChange={(event) => onInviteCode(event.target.value.toUpperCase())} aria-label={SIGNUP_SCHOOL.code} autoCapitalize="characters" autoComplete="off" data-invite-code="1" />
          </label>
        </div>
      )}
      {showChildren && (
        <label className="block space-y-1.5">
          <span className={label}>{SIGNUP_SCHOOL.parentNote}</span>
          <input className={`${control} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6FBBCE]`} value={childEmails} onChange={(event) => onChildEmails(event.target.value)} aria-label={SIGNUP_SCHOOL.parentNote} autoComplete="email" inputMode="email" />
        </label>
      )}
    </div>
  );
}
