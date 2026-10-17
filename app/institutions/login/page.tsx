'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { InstitutionJourneyFrame, journeyButton, journeyField } from '@/components/institutions/journey-frame';
import { auth, db } from '@/lib/firebase';
import { getInstitution } from '@/lib/db';
import { loginBlocked } from '@/lib/admin-console';
import { INSTITUTION_ADMIN_CODE_UNAVAILABLE } from '@/lib/institution-login';
import { institutionAdminDestination } from '@/lib/institution-journey';

export default function InstitutionAdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async (address: string): Promise<boolean> => {
    const current = auth.currentUser;
    const idToken = current ? await current.getIdToken().catch(() => '') : '';
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ email: address }),
    });
    const data = await res.json().catch(() => ({})) as { configured?: boolean; token?: string; expiresAt?: number; error?: string };
    if (data.configured === false) {
      setError(INSTITUTION_ADMIN_CODE_UNAVAILABLE);
      return false;
    }
    if (!res.ok || !data.token || !data.expiresAt) {
      setError(data.error || 'Could not send the email code.');
      return false;
    }
    setToken(data.token);
    setExpiresAt(data.expiresAt);
    return true;
  };

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, 'users', result.user.uid));
      const data = snap.exists() ? snap.data() : {};
      const role = typeof data.role === 'string' ? data.role : '';
      if (loginBlocked(typeof data.accountStatus === 'string' ? data.accountStatus : 'active')) {
        await signOut(auth);
        setError('This account is closed. Contact support@poketschool.ai.');
        return;
      }
      if (role !== 'institution_admin') {
        await signOut(auth);
        setError('This door is for institution admins. Students, teachers, and other accounts use the main Poket School login.');
        return;
      }
      const sent = await sendCode(email.trim());
      await signOut(auth);
      if (!sent) return;
      setStep('code');
    } catch {
      setError('That email or password was not recognised.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), token, expiresAt }),
      });
      const data = await res.json().catch(() => ({})) as { valid?: boolean; error?: string };
      if (!res.ok || !data.valid) {
        setError(data.error || 'That code is not valid.');
        return;
      }
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, 'users', result.user.uid));
      const profile = snap.exists() ? snap.data() : {};
      const institutionId = typeof profile.institutionId === 'string' ? profile.institutionId : '';
      const academy = institutionId ? await getInstitution(institutionId).catch(() => null) : null;
      router.push(institutionAdminDestination({
        status: academy?.status ?? 'pending',
        setupComplete: academy?.setupComplete,
      }));
    } catch {
      setError('The code was accepted. Sign in again to open the academy.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <InstitutionJourneyFrame
      eyebrow="Institution admin"
      title={step === 'code' ? 'Enter your email code' : 'Institution admin sign-in'}
      lede="This door is for the person who registered the academy. A code is sent to the work email before the academy opens."
    >
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#F8E7C4] px-4 py-3 text-sm">{error}</p>}
      {step === 'credentials' ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
        >
          <label className="block text-sm font-medium">
            Work email
            <input type="email" autoComplete="username" className={journeyField} value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input type="password" autoComplete="current-password" className={journeyField} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit" className={journeyButton} disabled={busy}>{busy ? 'Checking…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void finish();
          }}
        >
          <label className="block text-sm font-medium">
            Email code
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={journeyField} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required />
          </label>
          <button type="submit" className={journeyButton} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      )}
      <p className="mt-6 text-sm text-[#1A3C34]/70">
        Students and teachers use the <Link href="/login" className="font-semibold underline">main Poket School login</Link>.
        {' '}New academy? <Link href="/institutions/register" className="font-semibold underline">For Schools & Organisations</Link>.
      </p>
    </InstitutionJourneyFrame>
  );
}
