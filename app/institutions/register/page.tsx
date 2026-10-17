'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { GenderSelect } from '@/components/account/demographic-fields';
import { CountrySelect } from '@/components/country-select';
import { InstitutionJourneyFrame, journeyButton, journeyField } from '@/components/institutions/journey-frame';
import { auth } from '@/lib/firebase';
import { INSTITUTION_TYPES } from '@/lib/enterprise';
import { INSTITUTION_ADMIN_CODE_UNAVAILABLE } from '@/lib/institution-login';
import { validateInstitutionApplication } from '@/lib/institution-journey';
import { statesForCountry } from '@/lib/institution-states';

const TYPES: { id: (typeof INSTITUTION_TYPES)[number]; label: string }[] = [
  { id: 'school', label: 'School' },
  { id: 'university', label: 'University' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'government', label: 'Government' },
];

export default function InstitutionRegisterPage() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [step, setStep] = useState<'organisation' | 'account' | 'code'>('organisation');
  const [organisation, setOrganisation] = useState('');
  const [type, setType] = useState<(typeof INSTITUTION_TYPES)[number] | ''>('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const states = useMemo(() => statesForCountry(country), [country]);

  const draft = {
    organisation,
    type,
    country,
    state,
    name,
    email,
    phone,
    title,
    gender,
    password,
  };

  const sendCode = async () => {
    const parsed = validateInstitutionApplication(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      setStep(parsed.error.includes('organisation') || parsed.error.includes('country') || parsed.error.includes('state') || parsed.error.includes('type') ? 'organisation' : 'account');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.value.email }),
      });
      const data = await res.json().catch(() => ({})) as { configured?: boolean; token?: string; expiresAt?: number; error?: string };
      if (data.configured === false) {
        setError(INSTITUTION_ADMIN_CODE_UNAVAILABLE);
        return;
      }
      if (!res.ok || !data.token || !data.expiresAt) {
        setError(data.error || 'Could not send the email code.');
        return;
      }
      setToken(data.token);
      setExpiresAt(data.expiresAt);
      setStep('code');
    } catch {
      setError('Could not send the email code.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const parsed = validateInstitutionApplication(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/institutions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.value, code: code.trim(), token, expiresAt }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Could not open that academy.');
        return;
      }
      await signInWithEmailAndPassword(auth, parsed.value.email, parsed.value.password);
      router.push('/institutions/pending');
    } catch {
      setError('The academy was created. Sign in at the institution admin page to see the pending status.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <InstitutionJourneyFrame
      eyebrow="For Schools & Organisations"
      title="Register your academy"
      lede="Create the organisation and your admin account together. Poket School emails a one-time code, then reviews the academy before it opens."
    >
      <ol className="mb-6 flex gap-2 text-xs font-semibold uppercase tracking-wide text-[#1A3C34]/50">
        <li className={step === 'organisation' ? 'text-[#1A3C34]' : ''}>1. Organisation</li>
        <li className={step === 'account' ? 'text-[#1A3C34]' : ''}>2. Admin</li>
        <li className={step === 'code' ? 'text-[#1A3C34]' : ''}>3. Email code</li>
      </ol>
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#F8E7C4] px-4 py-3 text-sm">{error}</p>}

      {step === 'organisation' && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!organisation.trim() || !type || !country || !state) {
              setError('Enter the organisation, type, country, and state.');
              return;
            }
            setError('');
            setStep('account');
          }}
        >
          <label className="block text-sm font-medium">
            Organisation name
            <input className={journeyField} value={organisation} onChange={(event) => setOrganisation(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Type
            <select className={journeyField} value={type} onChange={(event) => setType(event.target.value as typeof type)} required>
              <option value="">Choose</option>
              {TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <CountrySelect locale={i18n.language || 'en'} value={country} onChange={(code) => { setCountry(code); setState(''); }} />
          <label className="block text-sm font-medium">
            State or region
            <select className={journeyField} value={state} onChange={(event) => setState(event.target.value)} required>
              <option value="">Choose</option>
              {states.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="submit" className={journeyButton}>Continue</button>
        </form>
      )}

      {step === 'account' && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <label className="block text-sm font-medium">
            Your name
            <input className={journeyField} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Work email
            <input type="email" autoComplete="email" className={journeyField} value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Phone
            <input type="tel" autoComplete="tel" className={journeyField} value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Role / title
            <input className={journeyField} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Principal" required />
          </label>
          <GenderSelect value={gender} onChange={setGender} />
          <label className="block text-sm font-medium">
            Password
            <input type="password" autoComplete="new-password" className={journeyField} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="h-11 rounded-full border border-[#1A3C34]/15 px-5 text-sm font-semibold" onClick={() => setStep('organisation')}>Back</button>
            <button type="submit" className={journeyButton} disabled={busy}>{busy ? 'Sending code…' : 'Email me a code'}</button>
          </div>
        </form>
      )}

      {step === 'code' && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="text-sm">Enter the 6-digit code sent to {email.trim()}.</p>
          <label className="block text-sm font-medium">
            Email code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={journeyField}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              required
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="h-11 rounded-full border border-[#1A3C34]/15 px-5 text-sm font-semibold" onClick={() => void sendCode()} disabled={busy}>Resend</button>
            <button type="submit" className={journeyButton} disabled={busy}>{busy ? 'Submitting…' : 'Submit for approval'}</button>
          </div>
        </form>
      )}

      <p className="mt-6 text-sm text-[#1A3C34]/70">
        Already registered? <Link href="/institutions/login" className="font-semibold underline">Institution admin sign-in</Link>
      </p>
    </InstitutionJourneyFrame>
  );
}
