'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { GenderSelect } from '@/components/account/demographic-fields';
import { CountrySelect } from '@/components/country-select';
import { InstitutionJourneyFrame, journeyButton, journeyField } from '@/components/institutions/journey-frame';
import { PlanCheckout, type CheckoutDraft } from '@/components/institutions/plan-checkout';
import { auth } from '@/lib/firebase';
import { authedFetch } from '@/lib/api-client';
import { INSTITUTION_TYPES } from '@/lib/enterprise';
import { INSTITUTION_ADMIN_CODE_UNAVAILABLE } from '@/lib/institution-login';
import { validateInstitutionApplication } from '@/lib/institution-journey';
import { statesForCountry } from '@/lib/institution-states';
import { ORGANISATION_SIZES, SANDBOX_BANNER, seatsForOrganisationSize, type OrganisationSize } from '@/lib/institution-self-serve';

const TYPES: { id: (typeof INSTITUTION_TYPES)[number]; label: string }[] = [
  { id: 'school', label: 'School' },
  { id: 'international_school', label: 'International school' },
  { id: 'tuition_centre', label: 'Tuition centre' },
  { id: 'homeschool_group', label: 'Homeschool group' },
  { id: 'college', label: 'College' },
  { id: 'university', label: 'University' },
  { id: 'corporate', label: 'Corporation' },
  { id: 'training_provider', label: 'Training provider' },
  { id: 'government', label: 'Government' },
];

type Step = 'account' | 'code' | 'organisation' | 'plan';

export default function InstitutionRegisterPage() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [step, setStep] = useState<Step>('account');
  const [organisation, setOrganisation] = useState('');
  const [type, setType] = useState<(typeof INSTITUTION_TYPES)[number] | ''>('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [size, setSize] = useState<OrganisationSize | ''>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [institutionId, setInstitutionId] = useState('');
  const [banner, setBanner] = useState('');
  const [trialDays, setTrialDays] = useState(14);
  const [trialSeatCap, setTrialSeatCap] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const states = useMemo(() => statesForCountry(country), [country]);

  useEffect(() => {
    fetch('/api/institutions/signup-config')
      .then((res) => res.json())
      .then((data: { sandbox?: boolean; banner?: string; trialDays?: number; trialSeatCap?: number }) => {
        if (data.sandbox && data.banner) setBanner(data.banner);
        if (typeof data.trialDays === 'number') setTrialDays(data.trialDays);
        if (typeof data.trialSeatCap === 'number') setTrialSeatCap(data.trialSeatCap);
      })
      .catch(() => setBanner(SANDBOX_BANNER));
  }, []);

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

  const accountReady = () => {
    if (name.trim().length < 2) return 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a work email address.';
    if (phone.replace(/\D/g, '').length < 7) return 'Enter a work phone number.';
    if (title.trim().length < 2) return 'Enter your role or title.';
    if (gender !== 'male' && gender !== 'female') return 'Choose Male or Female.';
    if (password.length < 8) return 'Use at least 8 characters for the password.';
    return '';
  };

  const sendCode = async () => {
    const problem = accountReady();
    if (problem) {
      setError(problem);
      setStep('account');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
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

  const openAcademy = async () => {
    const parsed = validateInstitutionApplication(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!size) {
      setError('Choose an organisation size.');
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      setStep('code');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/institutions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.value, organisationSize: size, code: code.trim(), token, expiresAt }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; institutionId?: string };
      if (!res.ok || !data.institutionId) {
        setError(data.error || 'Could not open that academy.');
        return;
      }
      await signInWithEmailAndPassword(auth, parsed.value.email, parsed.value.password);
      setInstitutionId(data.institutionId);
      setStep('plan');
    } catch {
      setError('The academy was created. Sign in to continue to checkout.');
    } finally {
      setBusy(false);
    }
  };

  const finish = (destination: string) => {
    router.push(destination);
  };

  const pay = async (order: CheckoutDraft) => {
    if (!institutionId) return;
    setBusy(true);
    setError('');
    try {
      const data = await authedFetch('/api/institutions/checkout', {
        method: 'POST',
        body: JSON.stringify({ institutionId, ...order }),
      });
      if (typeof data.url === 'string' && data.url) {
        window.location.href = data.url;
        return;
      }
      if (typeof data.postUrl === 'string' && data.fields && typeof data.fields === 'object') {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.postUrl;
        for (const [key, value] of Object.entries(data.fields as Record<string, string>)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
      if (data.sandbox === true) {
        const settled = await authedFetch('/api/institutions/checkout/sandbox', {
          method: 'POST',
          body: JSON.stringify({ institutionId }),
        });
        finish(typeof settled.destination === 'string' ? settled.destination : '/dashboard/institution/onboarding');
        return;
      }
      finish(typeof data.destination === 'string' ? data.destination : '/dashboard/institution/onboarding');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not complete checkout.');
    } finally {
      setBusy(false);
    }
  };

  const trial = async (order: Pick<CheckoutDraft, 'planId' | 'seats' | 'programmeIds'>) => {
    if (!institutionId) return;
    setBusy(true);
    setError('');
    try {
      const data = await authedFetch('/api/institutions/checkout/trial', {
        method: 'POST',
        body: JSON.stringify({ institutionId, ...order }),
      });
      finish(typeof data.destination === 'string' ? data.destination : '/dashboard/institution/onboarding');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the trial.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <InstitutionJourneyFrame
      eyebrow="For Schools & Organisations"
      title={step === 'plan' ? 'Plan and checkout' : 'Register your academy'}
      lede={step === 'plan'
        ? 'Choose a level, the programmes on that level, and how many student seats. Payment opens the academy and the setup checklist.'
        : 'Start with your admin account and an email code. Then add the organisation, pick a plan, and pay. Poket School opens the academy when payment succeeds.'}
    >
      <ol className="mb-6 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-wide text-[#203337]/50">
        <li className={step === 'account' ? 'text-[#203337]' : ''}>1. Admin</li>
        <li className={step === 'code' ? 'text-[#203337]' : ''}>2. Email code</li>
        <li className={step === 'organisation' ? 'text-[#203337]' : ''}>3. Organisation</li>
        <li className={step === 'plan' ? 'text-[#203337]' : ''}>4. Plan</li>
      </ol>
      {error && step !== 'plan' && <p role="alert" className="mb-4 rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm">{error}</p>}

      {step === 'account' && (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void sendCode(); }}>
          <label className="block text-sm font-medium">Your name
            <input className={journeyField} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">Work email
            <input type="email" autoComplete="email" className={journeyField} value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">Phone
            <input type="tel" autoComplete="tel" className={journeyField} value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">Role / title
            <input className={journeyField} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Principal" required />
          </label>
          <GenderSelect value={gender} onChange={setGender} />
          <label className="block text-sm font-medium">Password
            <input type="password" autoComplete="new-password" className={journeyField} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>
          <button type="submit" className={journeyButton} disabled={busy}>{busy ? 'Sending code…' : 'Email me a code'}</button>
        </form>
      )}

      {step === 'code' && (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from your email.'); return; } setError(''); setStep('organisation'); }}>
          <p className="text-sm">Enter the 6-digit code sent to {email.trim()}.</p>
          <label className="block text-sm font-medium">Email code
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={journeyField} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="h-11 rounded-full border border-[#203337]/15 px-5 text-sm font-semibold" onClick={() => void sendCode()} disabled={busy}>Resend</button>
            <button type="submit" className={journeyButton}>Continue</button>
          </div>
        </form>
      )}

      {step === 'organisation' && (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void openAcademy(); }}>
          <label className="block text-sm font-medium">Organisation name
            <input className={journeyField} value={organisation} onChange={(event) => setOrganisation(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">Type
            <select className={journeyField} value={type} onChange={(event) => setType(event.target.value as typeof type)} required>
              <option value="">Choose</option>
              {TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <CountrySelect locale={i18n.language || 'en'} value={country} onChange={(code) => { setCountry(code); setState(''); }} />
          <label className="block text-sm font-medium">State or region
            <select className={journeyField} value={state} onChange={(event) => setState(event.target.value)} required>
              <option value="">Choose</option>
              {states.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Organisation size
            <select className={journeyField} value={size} onChange={(event) => setSize(event.target.value as OrganisationSize)} required>
              <option value="">Choose</option>
              {ORGANISATION_SIZES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="h-11 rounded-full border border-[#203337]/15 px-5 text-sm font-semibold" onClick={() => setStep('code')}>Back</button>
            <button type="submit" className={journeyButton} disabled={busy}>{busy ? 'Creating…' : 'Continue to plans'}</button>
          </div>
        </form>
      )}

      {step === 'plan' && (
        <PlanCheckout
          country={country}
          email={email}
          initialSeats={seatsForOrganisationSize(size)}
          banner={banner}
          trialDays={trialDays}
          trialSeatCap={trialSeatCap}
          busy={busy}
          error={error}
          onCheckout={(order) => void pay(order)}
          onTrial={(order) => void trial(order)}
        />
      )}

      <p className="mt-6 text-sm text-[#203337]/70">
        Already registered? <Link href="/institutions/login" className="font-semibold underline">Institution admin sign-in</Link>
      </p>
    </InstitutionJourneyFrame>
  );
}
