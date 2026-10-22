'use client';

import { useState } from 'react';
import { displayLogoUrl } from '@/lib/certificates';
import {
  INSTITUTION_LOGIN_TABS,
  PLATFORM_LOGIN_URL,
  institutionLoginRefusal,
  type InstitutionLoginTab,
} from '@/lib/institution-login';
import { accentInk } from '@/lib/white-label';

export function InstitutionLoginScreen({
  schoolName,
  logoUrl,
  primaryColor,
  secondaryColor,
  headline,
  body,
  showPoweredBy,
  status,
  busy,
  step,
  error,
  refused,
  emailForCode,
  signupPolicy,
  embedded = false,
  onCredentials,
  onGoogle,
  onVerify,
  onResend,
  onCancel,
  joinHref,
}: {
  schoolName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  headline: string;
  body: string;
  showPoweredBy: boolean;
  status: 'loading' | 'missing' | 'paused' | 'unpublished' | 'ready';
  busy?: boolean;
  step: 'credentials' | 'code';
  error?: string;
  refused?: boolean;
  emailForCode?: string;
  signupPolicy?: 'open' | 'invite' | 'domain';
  /** Fits inside the onboarding preview instead of filling the window. */
  embedded?: boolean;
  onCredentials: (input: { email: string; password: string; tab: InstitutionLoginTab }) => void;
  onGoogle: (tab: InstitutionLoginTab) => void;
  onVerify: (code: string) => void;
  onResend: () => void;
  onCancel: () => void;
  /** Branded registration for students and parents of this academy. */
  joinHref?: string;
}) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(primaryColor ?? '') ? primaryColor ?? '#203337' : '#203337';
  const gold = /^#[0-9a-fA-F]{6}$/.test(secondaryColor ?? '') ? secondaryColor ?? '#1E6A83' : '#1E6A83';
  const ink = accentInk(accent);
  const logo = displayLogoUrl(logoUrl);
  const [tab, setTab] = useState<InstitutionLoginTab>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  return (
    <main className={`${embedded ? 'bg-[#E9F7FA]' : 'min-h-screen'} text-[#203337]`} style={{ fontFamily: 'var(--font-institution), inherit' }}>
      <div className={`mx-auto flex max-w-lg flex-col justify-center px-5 py-12 ${embedded ? '' : 'min-h-screen'}`}>
        <section className="rounded-[28px] border border-[#203337]/10 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(26,60,52,0.45)] sm:p-8">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="h-14 w-14 rounded-2xl border border-[#203337]/10 bg-[#E9F7FA] object-contain p-1.5" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold" style={{ background: accent, color: ink }}>
                {(schoolName || 'P').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: gold }}>Academy login</p>
              <h1 className="font-heading text-2xl tracking-tight">{schoolName || 'Academy'}</h1>
            </div>
          </div>

          {status === 'loading' && <p className="mt-8 text-sm text-[#203337]/70">Opening this academy…</p>}

          {status === 'missing' && (
            <div className="mt-8 space-y-3">
              <p className="text-sm leading-relaxed">This academy login page is not set up yet.</p>
              <a href={PLATFORM_LOGIN_URL} className="inline-flex text-sm font-semibold underline">Sign in at Poket School</a>
            </div>
          )}

          {status === 'paused' && (
            <div className="mt-8 space-y-3">
              <p className="text-sm leading-relaxed">{schoolName} is paused. Sign-in opens again when the academy is active.</p>
              <a href={PLATFORM_LOGIN_URL} className="inline-flex text-sm font-semibold underline">Sign in at Poket School</a>
            </div>
          )}

          {status === 'unpublished' && (
            <div className="mt-8 space-y-3">
              <p className="text-sm leading-relaxed">This branded login page is not published yet. The academy admin publishes it from the setup checklist.</p>
              <a href={PLATFORM_LOGIN_URL} className="inline-flex text-sm font-semibold underline">Sign in at Poket School</a>
            </div>
          )}

          {status === 'ready' && step === 'credentials' && (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                onCredentials({ email: email.trim(), password, tab });
              }}
            >
              <div>
                <h2 className="font-heading text-xl tracking-tight">{headline}</h2>
                <p className="mt-1 text-sm text-[#203337]/70">{body}</p>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#E9F7FA] p-1" role="tablist" aria-label="Sign in as">
                {INSTITUTION_LOGIN_TABS.map((item) => {
                  const selected = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setTab(item.id)}
                      className="rounded-xl px-2 py-2 text-center text-xs font-semibold leading-tight"
                      style={selected ? { background: accent, color: ink } : { color: '#203337' }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {tab === 'institution_admin' && (
                <p className="text-xs text-[#203337]/70">Institution admins confirm with a code sent to their email.</p>
              )}
              {signupPolicy === 'invite' && (
                <p className="text-xs text-[#203337]/70">This academy adds people by invitation.</p>
              )}
              {signupPolicy === 'domain' && (
                <p className="text-xs text-[#203337]/70">New accounts use an email on an allowed academy domain.</p>
              )}
              {refused && (
                <div role="alert" className="rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm leading-relaxed">
                  <p>{institutionLoginRefusal(schoolName)}</p>
                  <a href={PLATFORM_LOGIN_URL} className="mt-2 inline-flex font-semibold underline">Sign in at Poket School</a>
                </div>
              )}
              {error && !refused && <p role="alert" className="rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm">{error}</p>}
              <button
                type="button"
                onClick={() => onGoogle(tab)}
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#203337]/15 text-sm font-semibold disabled:opacity-60"
              >
                <GoogleMark />
                Continue with Google
              </button>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  placeholder="name@school.edu"
                  className="mt-1 h-12 w-full rounded-2xl border border-[#203337]/15 bg-[#E9F7FA]/60 px-4 text-base font-normal normal-case tracking-normal text-[#203337]"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  className="mt-1 h-12 w-full rounded-2xl border border-[#203337]/15 bg-[#E9F7FA]/60 px-4 text-base font-normal normal-case tracking-normal"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-2xl text-sm font-semibold disabled:opacity-60"
                style={{ background: accent, color: ink }}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              {joinHref && (
                <a href={joinHref} className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#203337]/15 text-sm font-semibold">
                  Sign up with {schoolName}
                </a>
              )}
            </form>
          )}

          {status === 'ready' && step === 'code' && (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                onVerify(code.trim());
              }}
            >
              <div>
                <h2 className="font-heading text-xl tracking-tight">Check your email</h2>
                <p className="mt-1 text-sm text-[#203337]/70">
                  We sent a 6-digit code to <span className="font-semibold text-[#203337]">{emailForCode}</span>.
                </p>
              </div>
              {error && <p role="alert" className="rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm">{error}</p>}
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
                Email code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={busy}
                  placeholder="123456"
                  className="mt-1 h-14 w-full rounded-2xl border border-[#203337]/15 bg-[#E9F7FA]/60 text-center text-2xl font-bold tracking-[0.4em]"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-2xl text-sm font-semibold disabled:opacity-60"
                style={{ background: accent, color: ink }}
              >
                {busy ? 'Checking…' : 'Confirm and continue'}
              </button>
              <button type="button" onClick={onResend} disabled={busy} className="w-full text-xs font-semibold underline" style={{ color: gold }}>
                Send a new code
              </button>
              <button type="button" onClick={onCancel} disabled={busy} className="w-full text-sm text-[#203337]/60">
                Use a different account
              </button>
            </form>
          )}

          {showPoweredBy && status !== 'loading' && (
            <p className="mt-8 text-center text-xs text-[#203337]/55">Powered by Poket School</p>
          )}
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#1E6A83" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#1E6A83" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
