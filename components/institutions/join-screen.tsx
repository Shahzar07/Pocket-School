'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { parentFinalSummary } from '@/lib/alumni';
import { ageOn, parentExplainerCopy, type JoinAttempt } from '@/lib/institution-join';
import { accentInk } from '@/lib/white-label';

export interface JoinScreenResult {
  status: string;
  message: string;
  level: string;
  className: string;
  programmes: { id: string; title: string }[];
  credit?: number | null;
}

function tone(status: string): string {
  if (status === 'approved') return 'bg-[#203337] text-white';
  if (status === 'waiting_for_seat') return 'bg-[#E36A4F] text-white';
  if (status === 'needs_consent') return 'bg-[#E9F7FA] text-[#203337]';
  return 'bg-white text-[#203337]';
}

export function InstitutionAcademyDoor({
  schoolName,
  slug,
  primaryColor,
  secondaryColor,
  showPoweredBy = true,
  alumniCount,
}: {
  schoolName: string;
  slug: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  showPoweredBy?: boolean;
  alumniCount?: number;
}) {
  const [count, setCount] = useState(alumniCount ?? 0);
  useEffect(() => {
    if (alumniCount != null) {
      setCount(alumniCount);
      return;
    }
    fetch(`/api/alumni?slug=${encodeURIComponent(slug)}`)
      .then((response) => response.json())
      .then((data: { alumni?: number }) => setCount(typeof data.alumni === 'number' ? data.alumni : 0))
      .catch(() => setCount(0));
  }, [alumniCount, slug]);
  const accent = /^#[0-9a-fA-F]{6}$/.test(primaryColor ?? '') ? primaryColor ?? '#203337' : '#203337';
  const gold = /^#[0-9a-fA-F]{6}$/.test(secondaryColor ?? '') ? secondaryColor ?? '#1E6A83' : '#1E6A83';
  const ink = accentInk(accent);
  return (
    <main className="min-h-screen bg-[#F6F1E7] text-[#203337]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <section className="rounded-[28px] border border-[#203337]/10 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(26,60,52,0.45)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: gold }}>Poket School academy</p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">{schoolName}</h1>
          {count > 0 ? <p className="mt-3 inline-flex rounded-full bg-[#E9F7FA] px-3 py-1 text-xs font-semibold">{count} alumni</p> : null}
          <p className="mt-3 text-sm leading-relaxed text-[#203337]/75">
            Students and parents register with {schoolName} here. Everyone else signs up as an individual.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <a href={`/i/${slug}/join`} className="flex h-12 items-center justify-center rounded-2xl text-sm font-semibold" style={{ background: accent, color: ink }}>Sign up</a>
            <a href={`/i/${slug}/login`} className="flex h-12 items-center justify-center rounded-2xl border border-[#203337]/15 text-sm font-semibold">Log in</a>
          </div>
          {showPoweredBy && <p className="mt-6 text-xs text-[#203337]/50">Powered by Poket School</p>}
        </section>
      </div>
    </main>
  );
}

export function InstitutionJoinScreen({
  schoolName,
  slug,
  primaryColor,
  secondaryColor,
  showPoweredBy = true,
  result,
  busy,
  signedIn,
  initial,
  onCheck,
  onAttach,
}: {
  schoolName: string;
  slug: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  showPoweredBy?: boolean;
  result?: JoinScreenResult | null;
  busy?: boolean;
  signedIn?: boolean;
  initial?: Partial<JoinAttempt> & { childStudentNumber?: string };
  onCheck: (input: JoinAttempt & { childStudentNumber: string }) => void;
  onAttach?: (input: JoinAttempt & { childStudentNumber: string; takeCredit: boolean }) => void;
}) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(primaryColor ?? '') ? primaryColor ?? '#203337' : '#203337';
  const gold = /^#[0-9a-fA-F]{6}$/.test(secondaryColor ?? '') ? secondaryColor ?? '#1E6A83' : '#1E6A83';
  const ink = accentInk(accent);
  const today = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }, []);
  const [role, setRole] = useState<'student' | 'parent'>(initial?.role === 'parent' ? 'parent' : 'student');
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [dob, setDob] = useState(initial?.dob ?? '');
  const [studentId, setStudentId] = useState(initial?.studentId ?? '');
  const [inviteCode, setInviteCode] = useState(initial?.inviteCode ?? '');
  const [childStudentNumber, setChildStudentNumber] = useState(initial?.childStudentNumber ?? '');
  const [parentConsent, setParentConsent] = useState(initial?.parentConsent ?? false);
  const [takeCredit, setTakeCredit] = useState(true);
  const age = useMemo(() => ageOn(dob, today), [dob]);
  const under13 = role === 'student' && age != null && age < 13;
  const payload = (): JoinAttempt & { childStudentNumber: string } => ({
    role,
    email,
    name,
    dob,
    today,
    studentId,
    inviteCode,
    parentConsent,
    programmeId: '',
    level: '',
    childStudentNumber,
  });
  const signup = () => {
    const params = new URLSearchParams({ role, join: slug });
    if (email.trim()) params.set('email', email.trim());
    if (name.trim()) params.set('name', name.trim());
    if (dob) params.set('dob', dob);
    if (studentId.trim()) params.set('studentId', studentId.trim());
    if (inviteCode.trim()) params.set('code', inviteCode.trim());
    if (childStudentNumber.trim()) params.set('child', childStudentNumber.trim());
    if (parentConsent) params.set('consent', '1');
    return `/signup?${params.toString()}`;
  };

  return (
    <main className="min-h-screen bg-[#F6F1E7] text-[#203337]">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: gold }}>{schoolName}</p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight">Join {schoolName}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#203337]/75">
              Students and parents register with this academy. Everyone else signs up as an individual, and can join an academy later. Progress stays with the account.
            </p>
          </div>
          <div className="flex gap-2">
            <a href={signup()} className="inline-flex h-11 items-center rounded-2xl px-4 text-sm font-semibold" style={{ background: accent, color: ink }}>Sign up</a>
            <a href={`/i/${slug}/login`} className="inline-flex h-11 items-center rounded-2xl border border-[#203337]/15 bg-white px-4 text-sm font-semibold">Log in</a>
          </div>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            className="rounded-[28px] border border-[#203337]/10 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(26,60,52,0.45)]"
            onSubmit={(event) => {
              event.preventDefault();
              onCheck(payload());
            }}
          >
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#F6F1E7] p-1">
              {(['student', 'parent'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRole(item)}
                  className="rounded-xl px-3 py-2 text-sm font-semibold"
                  style={role === item ? { background: accent, color: ink } : undefined}
                >
                  {item === 'student' ? 'Student' : 'Parent'}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
              Name
              <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-[#203337]/15 bg-[#F6F1E7]/60 px-4 text-base font-normal normal-case tracking-normal" />
            </label>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
              Email
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-[#203337]/15 bg-[#F6F1E7]/60 px-4 text-base font-normal normal-case tracking-normal" />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
                Date of birth
                <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-[#203337]/15 bg-[#F6F1E7]/60 px-4 text-base font-normal normal-case tracking-normal" />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
                {role === 'parent' ? 'Child student number' : 'Student ID'}
                <input
                  value={role === 'parent' ? childStudentNumber : studentId}
                  onChange={(event) => (role === 'parent' ? setChildStudentNumber(event.target.value) : setStudentId(event.target.value))}
                  placeholder={role === 'parent' ? 'PS-XXXX-XXXX' : 'School ID'}
                  className="mt-1 h-12 w-full rounded-2xl border border-[#203337]/15 bg-[#F6F1E7]/60 px-4 text-base font-normal normal-case tracking-normal"
                />
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
              Class or invite code
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="IGCSE1" className="mt-1 h-12 w-full rounded-2xl border border-[#203337]/15 bg-[#F6F1E7]/60 px-4 text-base font-normal normal-case tracking-normal" />
            </label>
            {under13 && (
              <label className="mt-4 flex items-start gap-3 rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm leading-relaxed">
                <input type="checkbox" checked={parentConsent} onChange={(event) => setParentConsent(event.target.checked)} className="mt-1" />
                <span>A parent or guardian agrees to this account.</span>
              </label>
            )}
            {signedIn && role === 'student' && (
              <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed">
                <input type="checkbox" checked={takeCredit} onChange={(event) => setTakeCredit(event.target.checked)} className="mt-1" />
                <span>Offer the unused days on a personal plan as a credit. Progress stays either way.</span>
              </label>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={busy} className="h-12 flex-1 rounded-2xl text-sm font-semibold disabled:opacity-60" style={{ background: accent, color: ink }}>
                {busy ? 'Checking…' : 'Check my place'}
              </button>
              {signedIn && onAttach && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAttach({ ...payload(), takeCredit })}
                  className="h-12 flex-1 rounded-2xl border border-[#203337]/15 text-sm font-semibold"
                >
                  Join with this account
                </button>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[#203337]/60">
              <a className="font-semibold underline" href="/signup">Sign up as an individual</a>
              {' '}when this academy is not yours. A parent can link more than one child, including children at other academies.
            </p>
          </form>
          <aside className={`rounded-[28px] border border-[#203337]/10 p-6 ${result ? tone(result.status) : 'bg-white'}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: result?.status === 'approved' || result?.status === 'waiting_for_seat' ? '#E9F7FA' : gold }}>Your place</p>
            {result ? (
              <>
                <h2 className="mt-2 font-heading text-2xl tracking-tight">{result.status === 'approved' ? 'You are in' : result.status === 'waiting_for_seat' ? 'Waiting for a seat' : result.status === 'needs_consent' ? 'Parent agreement' : 'With the academy'}</h2>
                <p className="mt-3 text-sm leading-relaxed">{result.message}</p>
                {result.level && <p className="mt-3 text-sm font-semibold">{result.level}{result.className ? ` · ${result.className}` : ''}</p>}
                {result.programmes.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {result.programmes.map((item) => <li key={item.id}>{item.title}</li>)}
                  </ul>
                )}
                {result.credit != null && result.credit > 0 && <p className="mt-3 text-sm">Credit offered: {result.credit.toFixed(2)}</p>}
                {role === 'parent' && (
                  <a href={`/i/${slug}/explainer`} className="mt-4 inline-flex text-sm font-semibold underline">Parent Explainer</a>
                )}
              </>
            ) : (
              <>
                <h2 className="mt-2 font-heading text-2xl tracking-tight">The academy checks the rules</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#203337]/75">
                  A school email domain, a class code, or a roster row can open the account. Anything else waits for the admin. A full level waits for a seat. Students see the programmes assigned to their level.
                </p>
                <div className="mt-5 flex items-center gap-4">
                  <div className="rounded-2xl border border-[#203337]/10 bg-[#F6F1E7] p-2">
                    <QRCodeSVG value={`https://poketschool.ai/i/${slug}/join`} size={96} fgColor="#203337" bgColor="#F6F1E7" />
                  </div>
                  <p className="text-sm leading-relaxed text-[#203337]/75">The poster QR opens this page. A class code can sit beside it.</p>
                </div>
              </>
            )}
            {showPoweredBy && <p className={`mt-6 text-xs ${result?.status === 'approved' || result?.status === 'waiting_for_seat' ? 'text-white/70' : 'text-[#203337]/45'}`}>Powered by Poket School</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}

export function ParentExplainerScreen({
  schoolName,
  primaryColor,
  secondaryColor,
  graduate,
}: {
  schoolName: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  graduate?: { childName: string; level: string; certificates: number } | null;
}) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(primaryColor ?? '') ? primaryColor ?? '#203337' : '#203337';
  const gold = /^#[0-9a-fA-F]{6}$/.test(secondaryColor ?? '') ? secondaryColor ?? '#1E6A83' : '#1E6A83';
  const copy = graduate
    ? parentFinalSummary({ institutionName: schoolName, childName: graduate.childName, level: graduate.level, certificates: graduate.certificates })
    : parentExplainerCopy(schoolName);
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-12 text-[#203337]">
      <article className="mx-auto max-w-xl rounded-[28px] border border-[#203337]/10 bg-white p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: gold }}>{schoolName}</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight" style={{ color: accent }}>{copy.title}</h1>
        <p className="mt-4 text-sm leading-relaxed">{copy.body}</p>
      </article>
    </main>
  );
}
