'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Suspense } from 'react';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  FIRST_SUPER_ADMIN,
  loginBlocked,
  mfaRequired,
  resolveStaffRole,
} from '@/lib/admin-console';
import { syncStaffClaims } from '@/lib/admin-actions';
import { touchAdminActivity } from '@/lib/view-as';
import { ShieldCheck } from 'lucide-react';

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const timedOut = params.get('reason') === 'timeout';
  const [step, setStep] = useState<'credentials' | 'twofa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refuse = async (message: string) => {
    try { await signOut(auth); } catch { /* already signed out */ }
    toast.error(message);
  };

  const finish = async (uid: string, address: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : {};
    const lower = address.trim().toLowerCase();
    const profile = {
      id: uid,
      email: lower,
      role: typeof data.role === 'string' ? data.role : '',
      adminRole: typeof data.adminRole === 'string' ? data.adminRole : '',
      accountStatus: typeof data.accountStatus === 'string' ? data.accountStatus : 'active',
    };
    const staff = resolveStaffRole(profile);
    if (!staff) {
      await refuse('This page is for Poket School admins.');
      return;
    }
    if (loginBlocked(profile.accountStatus)) {
      await refuse('This account is closed. Contact support@poketschool.ai.');
      return;
    }
    if (lower === FIRST_SUPER_ADMIN.email) {
      try {
        await setDoc(doc(db, 'users', uid), {
          name: FIRST_SUPER_ADMIN.name,
          email: lower,
          role: 'admin',
          adminRole: 'super_admin',
          ...(snap.exists() ? {} : { xp: 0, createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch {
        // The service account path below still writes the claim when it is configured.
      }
    }
    await syncStaffClaims([profile]).catch(() => undefined);
    touchAdminActivity();
    router.push('/dashboard/admin');
  };

  const sendCode = async (address: string): Promise<'sent' | 'blocked' | 'error'> => {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Could not send the verification code.');
      return 'error';
    }
    if (data.configured === false) return 'blocked';
    setOtpToken(data.token);
    setOtpExpiresAt(data.expiresAt);
    setCode('');
    return 'sent';
  };

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const address = result.user.email || email.trim();
      const snap = await getDoc(doc(db, 'users', result.user.uid));
      const data = snap.exists() ? snap.data() : {};
      const staff = resolveStaffRole({
        id: result.user.uid,
        email: address,
        role: typeof data.role === 'string' ? data.role : '',
        adminRole: typeof data.adminRole === 'string' ? data.adminRole : '',
      });
      if (!staff) {
        await refuse('This page is for Poket School admins.');
        return;
      }
      if (loginBlocked(typeof data.accountStatus === 'string' ? data.accountStatus : 'active')) {
        await refuse('This account is closed. Contact support@poketschool.ai.');
        return;
      }
      if (mfaRequired(staff)) {
        const sent = await sendCode(address);
        await signOut(auth);
        if (sent === 'blocked') {
          toast.error('Admin sign-in needs the email verification service. Ask the owner to set SMTP.');
          return;
        }
        if (sent !== 'sent') return;
        setPendingUid(result.user.uid);
        setStep('twofa');
        toast.success('We emailed you a 6-digit code.');
        return;
      }
      await finish(result.user.uid, address);
    } catch (err) {
      const codeName = (err as { code?: string }).code ?? '';
      if (codeName === 'auth/invalid-credential' || codeName === 'auth/wrong-password' || codeName === 'auth/user-not-found') {
        toast.error('That email or password is not right.');
      } else if (codeName === 'auth/too-many-requests') {
        toast.error('Too many attempts. Wait a moment and try again.');
      } else {
        toast.error('Could not sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingUid || code.trim().length !== 6) {
      toast.error('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          token: otpToken,
          expiresAt: otpExpiresAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) {
        toast.error(data.error || 'That code is not valid.');
        return;
      }
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await finish(pendingUid, email.trim());
    } catch {
      toast.error('Could not finish signing in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f7f8] text-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-11 h-11 rounded-2xl bg-[#2786A4] text-white grid place-items-center">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2786A4]">Poket School</p>
            <h1 className="text-2xl font-semibold tracking-tight">Admin sign-in</h1>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          {timedOut && step === 'credentials' && (
            <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2">
              Your admin session closed after 30 minutes of inactivity.
            </p>
          )}
          {step === 'credentials' ? (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Email</Label>
                <Input id="admin-email" type="email" autoComplete="username" value={email}
                  onChange={event => setEmail(event.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Password</Label>
                <Input id="admin-password" type="password" autoComplete="current-password" value={password}
                  onChange={event => setPassword(event.target.value)} className="h-11 rounded-xl" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
                {loading ? 'Checking…' : 'Continue'}
              </Button>
              <p className="text-xs text-slate-500 leading-relaxed">
                Super admins and admins confirm a code by email. Sessions close after 30 minutes of inactivity.
              </p>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <p className="text-sm text-slate-600">Enter the 6-digit code sent to {email.trim()}.</p>
              <Input inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={event => setCode(event.target.value)} aria-label="Verification code"
                className="h-11 rounded-xl tracking-[0.3em] text-center" />
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
                {loading ? 'Checking…' : 'Sign in'}
              </Button>
              <button type="button" className="text-sm font-semibold text-[#2786A4]"
                onClick={async () => { await signOut(auth); setStep('credentials'); setPendingUid(null); }}>
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f4f7f8]" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
