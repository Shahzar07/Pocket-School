'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  TotpMultiFactorGenerator,
  getMultiFactorResolver,
  linkWithCredential,
  multiFactor,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Suspense } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  initialSuperAdmin,
  loginBlocked,
  mfaRequired,
  resolveStaffRole,
} from '@/lib/admin-console';
import { parseFallbackFactors, type MfaFallback } from '@/lib/admin-mfa';
import { clearAdminMfaPending, markAdminMfaPending } from '@/lib/admin-mfa-pending';
import { clearFallbackSession, readFallbackSession, saveFallbackSession } from '@/lib/admin-mfa-fallback-session';
import { syncStaffClaims } from '@/lib/admin-actions';
import { touchAdminActivity } from '@/lib/view-as';
import { ShieldCheck } from 'lucide-react';

type Step = 'credentials' | 'twofa' | 'fallback' | 'totp-enroll' | 'totp-challenge';
type SendResult = 'sent' | 'blocked' | 'fallback' | 'error';

const SMTP_BLOCKED = 'Email codes are unavailable because SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and OTP_SECRET on the server. Sign-in stops here. A super admin listed in SUPER_ADMIN_EMAILS can confirm with Google or an authenticator; this account cannot.';

function authCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code : '';
}

function isMultiFactorError(err: unknown): err is MultiFactorError {
  return authCode(err) === 'auth/multi-factor-auth-required';
}

function googleProblem(codeName: string): string {
  if (codeName === 'auth/popup-closed-by-user' || codeName === 'auth/cancelled-popup-request') {
    return 'Google sign-in was cancelled. The second factor is still required.';
  }
  if (codeName === 'auth/popup-blocked') {
    return 'The browser blocked the Google window. Allow popups for this site and try again.';
  }
  if (codeName === 'auth/unauthorized-domain') {
    return 'Google sign-in is blocked for this domain. In Firebase Console → Authentication → Settings → Authorized domains, add this site, then try again.';
  }
  if (codeName === 'auth/operation-not-allowed') {
    return 'The Google provider is not enabled. In Firebase Console → Authentication → Sign-in method, enable Google, or enrol an authenticator instead.';
  }
  if (codeName === 'auth/account-exists-with-different-credential' || codeName === 'auth/credential-already-in-use' || codeName === 'auth/email-already-in-use') {
    return 'That Google account belongs to a different Poket School login. Choose the Google account for this admin email.';
  }
  return 'Could not confirm with Google. Try again, or enrol an authenticator.';
}

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const timedOut = params.get('reason') === 'timeout';
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [totpUrl, setTotpUrl] = useState('');
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = readFallbackSession();
    if (!saved) return;
    setPendingUid(saved.uid);
    setEmail(saved.email);
    setStep('fallback');
  }, []);

  const refuse = async (message: string) => {
    try { await signOut(auth); } catch { /* already signed out */ }
    clearAdminMfaPending();
    clearFallbackSession();
    setFormError(message);
  };

  const finish = async (uid: string, address: string) => {
    clearAdminMfaPending();
    clearFallbackSession();
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
    const seeded = initialSuperAdmin(lower);
    if (seeded) {
      try {
        await setDoc(doc(db, 'users', uid), {
          name: seeded.name,
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

  const sendCode = useCallback(async (address: string, idToken: string): Promise<SendResult> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ email: address }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({})) as { error?: string; token?: string; expiresAt?: number; configured?: boolean; fallback?: unknown };
      if (!res.ok) {
        setFormError(typeof data.error === 'string' ? data.error : 'Could not send the verification code.');
        return 'error';
      }
      if (data.configured === false) {
        const fromServer = parseFallbackFactors(data.fallback);
        // Seeded owners still get the second factor when the server cannot
        // verify the ID token. Regular admins stay blocked.
        const factors: MfaFallback[] = fromServer.length
          ? fromServer
          : (initialSuperAdmin(address) ? ['google', 'totp'] : []);
        if (factors.length) {
          setFormError('');
          return 'fallback';
        }
        setFormError(SMTP_BLOCKED);
        return 'blocked';
      }
      if (!data.token || !data.expiresAt) {
        setFormError('The verification service answered without a code. Sign-in has not finished.');
        return 'error';
      }
      setOtpToken(data.token);
      setOtpExpiresAt(data.expiresAt);
      setCode('');
      setFormError('');
      return 'sent';
    } catch {
      setFormError('The verification service did not answer. Sign-in has not finished. Try again in a moment.');
      return 'error';
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!email.trim() || !password) {
      setFormError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      markAdminMfaPending(result.user.uid);
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
        const idToken = await result.user.getIdToken();
        const sent = await sendCode(address, idToken);
        if (sent === 'fallback') {
          setPendingUid(result.user.uid);
          setEmail(address);
          saveFallbackSession({ uid: result.user.uid, email: address });
          setStep('fallback');
          await signOut(auth);
          clearAdminMfaPending();
          return;
        }
        await signOut(auth);
        clearAdminMfaPending();
        if (sent === 'sent') {
          setPendingUid(result.user.uid);
          setEmail(address);
          setStep('twofa');
          toast.success('We emailed you a 6-digit code.');
        }
        return;
      }
      clearAdminMfaPending();
      await finish(result.user.uid, address);
    } catch (err) {
      if (isMultiFactorError(err)) {
        clearAdminMfaPending();
        const next = getMultiFactorResolver(auth, err);
        const hint = next.hints.find(item => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!hint) {
          setFormError('This account has a second factor this page cannot ask for. Enrol an authenticator, or ask the owner to set SMTP for email codes.');
          return;
        }
        setResolver(next);
        setEnrollmentId(hint.uid);
        setCode('');
        setStep('totp-challenge');
        setFormError('');
        return;
      }
      try { await signOut(auth); } catch { /* already signed out */ }
      clearAdminMfaPending();
      const codeName = authCode(err);
      if (codeName === 'auth/invalid-credential' || codeName === 'auth/wrong-password' || codeName === 'auth/user-not-found' || codeName === 'auth/invalid-email') {
        setFormError('That email or password is not right.');
      } else if (codeName === 'auth/too-many-requests') {
        setFormError('Too many attempts. Wait a moment and try again.');
      } else if (codeName === 'auth/network-request-failed') {
        setFormError('The sign-in service did not answer. Check the connection and try again.');
      } else {
        setFormError('Could not sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!pendingUid || code.trim().length !== 6) {
      setFormError('Enter the 6-digit code.');
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
      const data = await res.json().catch(() => ({})) as { error?: string; valid?: boolean };
      if (!res.ok || !data.valid) {
        setFormError(typeof data.error === 'string' ? data.error : 'That code is not valid.');
        return;
      }
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await finish(pendingUid, email.trim());
    } catch {
      setFormError('Could not finish signing in.');
    } finally {
      setLoading(false);
    }
  };

  const sameAccount = (user: User, expected: string): boolean => {
    const googleEmail = user.providerData.find(item => item.providerId === 'google.com')?.email?.trim().toLowerCase() ?? '';
    return googleEmail === expected && user.uid === pendingUid;
  };

  const confirmWithGoogle = async () => {
    setFormError('');
    const expected = email.trim().toLowerCase();
    if (!pendingUid || !expected) {
      setFormError('Sign in with your password again, then confirm with Google.');
      setStep('credentials');
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: expected, prompt: 'select_account' });
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      if (!sameAccount(result.user, expected)) {
        await signOut(auth);
        setFormError('Google must be the same email as this admin account. The second factor is still required.');
        return;
      }
      await finish(result.user.uid, expected);
    } catch (err) {
      if (authCode(err) === 'auth/account-exists-with-different-credential' && err instanceof FirebaseError) {
        const cred = GoogleAuthProvider.credentialFromError(err);
        const googleEmail = (err.customData as { email?: string } | undefined)?.email?.trim().toLowerCase() ?? '';
        if (!cred || googleEmail !== expected) {
          setFormError('Google must be the same email as this admin account. The second factor is still required.');
          return;
        }
        if (!password) {
          setFormError('Sign in with your password again so Google can be linked to this admin account.');
          setStep('credentials');
          return;
        }
        try {
          const signed = await signInWithEmailAndPassword(auth, expected, password);
          if (signed.user.uid !== pendingUid) {
            await signOut(auth);
            setFormError('Google must be the same email as this admin account. The second factor is still required.');
            return;
          }
          await linkWithCredential(signed.user, cred);
          await finish(signed.user.uid, expected);
        } catch {
          try { await signOut(auth); } catch { /* already signed out */ }
          setFormError('Could not link Google to this admin account. The second factor is still required.');
        }
        return;
      }
      try { await signOut(auth); } catch { /* already signed out */ }
      setFormError(googleProblem(authCode(err)));
    } finally {
      setLoading(false);
    }
  };

  const startTotp = async () => {
    setFormError('');
    if (!pendingUid || !password || !email.trim()) {
      setFormError('Sign in with your password again before enrolling an authenticator.');
      setStep('credentials');
      return;
    }
    setLoading(true);
    try {
      const signed = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (signed.user.uid !== pendingUid) {
        await signOut(auth);
        setFormError('Sign in with your password again before enrolling an authenticator.');
        return;
      }
      markAdminMfaPending(signed.user.uid);
      const session = await multiFactor(signed.user).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      setTotpSecret(secret);
      setTotpUrl(secret.generateQrCodeUrl(signed.user.email || email.trim(), 'Poket School'));
      setCode('');
      setStep('totp-enroll');
    } catch (err) {
      try { await signOut(auth); } catch { /* already signed out */ }
      clearAdminMfaPending();
      const codeName = authCode(err);
      if (codeName === 'auth/operation-not-allowed') {
        setFormError('Authenticator enrolment is not enabled on this Firebase project. In Firebase Console → Authentication → Sign-in method, turn on TOTP multi-factor authentication. Until then, confirm with Google.');
      } else if (codeName === 'auth/unverified-email') {
        setFormError('Firebase requires a verified email before an authenticator can be enrolled. Verify this user in Authentication → Users, or confirm with Google instead.');
      } else if (codeName === 'auth/requires-recent-login') {
        setFormError('Sign in with the password again, then enrol the authenticator.');
        setStep('credentials');
      } else {
        setFormError('Could not start authenticator enrolment. Confirm with Google, or try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const enrollTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    const user = auth.currentUser;
    if (!user || !totpSecret || code.trim().length < 6) {
      setFormError('Enter the 6-digit code from the authenticator app.');
      return;
    }
    setLoading(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code.trim());
      await multiFactor(user).enroll(assertion, 'Authenticator');
      await finish(user.uid, user.email || email.trim());
    } catch (err) {
      const codeName = authCode(err);
      if (codeName === 'auth/invalid-verification-code' || codeName === 'auth/invalid-verification-id') {
        setFormError('That authenticator code is not valid. Wait for the next code and try again.');
      } else if (codeName === 'auth/operation-not-allowed') {
        setFormError('Authenticator enrolment is not enabled on this Firebase project. Confirm with Google instead.');
      } else {
        setFormError('Could not enrol the authenticator. The second factor is still required.');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!resolver || !enrollmentId || code.trim().length < 6) {
      setFormError('Enter the 6-digit code from the authenticator app.');
      return;
    }
    setLoading(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(enrollmentId, code.trim());
      const credential = await resolver.resolveSignIn(assertion);
      const address = credential.user.email || email.trim();
      setEmail(address);
      await finish(credential.user.uid, address);
    } catch (err) {
      const codeName = authCode(err);
      if (codeName === 'auth/invalid-verification-code' || codeName === 'auth/invalid-verification-id') {
        setFormError('That authenticator code is not valid.');
      } else if (codeName === 'auth/code-expired') {
        setFormError('That code expired. Enter the next code from the authenticator app.');
      } else {
        setFormError('Could not finish signing in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetToCredentials = async () => {
    try { await signOut(auth); } catch { /* already signed out */ }
    clearAdminMfaPending();
    clearFallbackSession();
    setStep('credentials');
    setPendingUid(null);
    setResolver(null);
    setTotpSecret(null);
    setCode('');
    setFormError('');
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
          {formError && (
            <p role="alert" className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-2xl px-3 py-2">
              {formError}
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
                Super admins and admins confirm a second factor. When email codes are unavailable, an allowlisted super admin confirms with Google or an authenticator. Sessions close after 30 minutes of inactivity.
              </p>
            </form>
          ) : null}
          {step === 'twofa' ? (
            <form onSubmit={verifyCode} className="space-y-4">
              <p className="text-sm text-slate-600">Enter the 6-digit code sent to {email.trim()}.</p>
              <Input inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={event => setCode(event.target.value)} aria-label="Verification code"
                className="h-11 rounded-xl tracking-[0.3em] text-center" />
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
                {loading ? 'Checking…' : 'Sign in'}
              </Button>
              <button type="button" className="text-sm font-semibold text-[#2786A4]" onClick={() => void resetToCredentials()}>
                Sign out
              </button>
            </form>
          ) : null}
          {step === 'fallback' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Password accepted for {email.trim()}. Email codes are unavailable because SMTP is not configured. Confirm with Google or an authenticator. This step is not skipped.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => void confirmWithGoogle()}
                className="w-full h-11 rounded-xl font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#2786A4' }}
              >
                {loading ? 'Checking…' : 'Confirm with Google'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void startTotp()}
                className="w-full h-11 rounded-xl font-semibold disabled:opacity-60"
                style={{ backgroundColor: '#ffffff', color: '#2786A4', border: '2px solid #2786A4' }}
              >
                Enrol an authenticator app
              </button>
              <button type="button" className="text-sm font-semibold text-[#2786A4]" onClick={() => void resetToCredentials()}>
                Sign out
              </button>
            </div>
          ) : null}
          {step === 'totp-enroll' ? (
            <form onSubmit={enrollTotp} className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Scan this with Google Authenticator, 1Password, or another TOTP app, then enter the 6-digit code.
              </p>
              {totpUrl ? (
                <div className="flex justify-center rounded-2xl bg-white p-3 border border-slate-200">
                  <QRCodeSVG value={totpUrl} size={168} />
                </div>
              ) : null}
              {totpSecret ? (
                <p className="text-xs text-slate-500 break-all">
                  Or enter this key manually: <span className="font-mono text-slate-800">{totpSecret.secretKey}</span>
                </p>
              ) : null}
              <Input inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={event => setCode(event.target.value)} aria-label="Authenticator code"
                className="h-11 rounded-xl tracking-[0.3em] text-center" />
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
                {loading ? 'Checking…' : 'Confirm authenticator'}
              </Button>
              <button type="button" className="text-sm font-semibold text-[#2786A4]" onClick={() => {
                void (async () => {
                  try { await signOut(auth); } catch { /* already signed out */ }
                  clearAdminMfaPending();
                  setStep('fallback');
                  setFormError('');
                })();
              }}>
                Back
              </button>
            </form>
          ) : null}
          {step === 'totp-challenge' ? (
            <form onSubmit={verifyTotp} className="space-y-4">
              <p className="text-sm text-slate-600">Enter the 6-digit code from the authenticator app for {email.trim() || 'this account'}.</p>
              <Input inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={event => setCode(event.target.value)} aria-label="Authenticator code"
                className="h-11 rounded-xl tracking-[0.3em] text-center" />
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
                {loading ? 'Checking…' : 'Sign in'}
              </Button>
              <button type="button" className="text-sm font-semibold text-[#2786A4]" onClick={() => void resetToCredentials()}>
                Sign out
              </button>
            </form>
          ) : null}
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
