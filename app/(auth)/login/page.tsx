'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import Link from 'next/link';

const SUPER_ADMIN_EMAIL = 'harry.seggu@gmail.com';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'twofa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state — code is sent to the account's email address.
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);

  const routeUser = async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) { router.push('/onboarding'); return; }
    const role = snap.data().role;
    if (role === 'student') router.push('/dashboard/student');
    else if (role === 'teacher') router.push('/dashboard/teacher');
    else if (role === 'parent') router.push('/dashboard/parent');
    else if (role === 'admin') router.push('/dashboard/admin');
    else router.push('/onboarding');
  };

  // The super-admin account is provisioned in Firebase; this just keeps its
  // Firestore profile pinned to the admin role.
  const ensureAdminProfile = async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      await setDoc(doc(db, 'users', uid), {
        name: 'Harry Seggu',
        email: SUPER_ADMIN_EMAIL,
        avatarUrl: '',
        role: 'admin',
        xp: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data().role !== 'admin') {
      await setDoc(doc(db, 'users', uid), {
        ...snap.data(),
        role: 'admin',
        updatedAt: serverTimestamp(),
      });
    }
  };

  const sendOtp = async (targetEmail: string): Promise<'sent' | 'skip' | 'error'> => {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Failed to send verification code.');
      return 'error';
    }
    if (data.configured === false) return 'skip';
    setOtpToken(data.token);
    setOtpExpiresAt(data.expiresAt);
    setCode('');
    setCodeSent(true);
    return 'sent';
  };

  const afterCredentialSuccess = async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : null;

    // Super admin and unverified accounts go straight in; verified accounts
    // get an email 2FA code — unless the email service isn't configured, in
    // which case we never lock anyone out.
    const isSuperAdmin = email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
    const wants2fa = !isSuperAdmin && !!(data?.emailVerified || data?.phoneVerified);

    if (!wants2fa) {
      await routeUser(uid);
      return;
    }

    const result = await sendOtp(email.trim());
    if (result === 'sent') {
      setPendingUid(uid);
      setStep('twofa');
      toast.success('We emailed you a 6-digit code.');
    } else {
      // Service unavailable — don't strand the user at a dead 2FA screen.
      await routeUser(uid);
    }
  };

  const verifyTwoFa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length !== 6) {
      toast.error('Enter the 6-digit code.');
      return;
    }
    if (!pendingUid) {
      toast.error('Session expired. Please sign in again.');
      setStep('credentials');
      return;
    }
    try {
      setLoading(true);
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
      const data = await res.json();
      if (!res.ok || !data.valid) {
        toast.error(data.error || 'Invalid or expired code.');
        return;
      }
      await routeUser(pendingUid);
    } catch (e: any) {
      toast.error(e?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    try {
      setLoading(true);
      const result = await sendOtp(email.trim());
      if (result === 'sent') toast.success('New code sent.');
    } finally {
      setLoading(false);
    }
  };

  const cancelTwoFa = async () => {
    setStep('credentials');
    setCode('');
    setCodeSent(false);
    setPendingUid(null);
    setOtpToken('');
    try { await signOut(auth); } catch { /* noop */ }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
        await ensureAdminProfile(result.user.uid);
      }
      // Sync Google profile picture to Firestore if missing
      const snap = await getDoc(doc(db, 'users', result.user.uid));
      if (snap.exists() && !snap.data().avatarUrl && result.user.photoURL) {
        await setDoc(doc(db, 'users', result.user.uid), { ...snap.data(), avatarUrl: result.user.photoURL, updatedAt: serverTimestamp() });
      }
      // Google already verified this email — no extra 2FA hop needed.
      setEmail(result.user.email || '');
      await routeUser(result.user.uid);
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      if (code === 'auth/unauthorized-domain') {
        toast.error(
          'Google sign-in is blocked. Go to Firebase Console → Authentication → Settings → Authorized Domains and add your deployment URL.',
          { duration: 10000 }
        );
        return;
      }
      toast.error(e?.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (email.trim().toLowerCase() === SUPER_ADMIN_EMAIL) {
        await ensureAdminProfile(result.user.uid);
      }
      await afterCredentialSuccess(result.user.uid);
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/invalid-email') toast.error('Invalid email address.');
      else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') toast.error('Incorrect email or password.');
      else if (code === 'auth/too-many-requests') toast.error('Too many failed attempts. Try again later or reset your password.');
      else if (code === 'auth/operation-not-allowed') toast.error('Email/password sign-in is not enabled in Firebase.');
      else toast.error('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {step === 'credentials' && (
        <>
          <div className="mb-9">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-white/45 text-sm">Enter your details to access your account.</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-medium transition-all flex items-center justify-center gap-3 mb-6"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-white/8" />
            <span className="px-4 text-xs text-white/30 font-medium uppercase tracking-widest">or email</span>
            <div className="flex-1 border-t border-white/8" />
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/60 text-xs font-semibold uppercase tracking-wider">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#1A73E8] focus:ring-[#1A73E8]/20 transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-white/60 text-xs font-semibold uppercase tracking-wider">Password</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-[#60A5FA] hover:text-[#93C5FD] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#1A73E8] focus:ring-[#1A73E8]/20 transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-base shadow-lg shadow-blue-900/30 transition-all mt-2"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center mt-7 text-white/40 text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#60A5FA] font-semibold hover:text-[#93C5FD] transition-colors">
              Create one free
            </Link>
          </p>
        </>
      )}

      {step === 'twofa' && (
        <>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-white/45 text-sm">
              We sent a 6-digit code to <span className="text-white/70 font-semibold">{email}</span>.
            </p>
          </div>

          {codeSent && (
            <form onSubmit={verifyTwoFa} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="2fa-code" className="text-white/60 text-xs font-semibold uppercase tracking-wider">6-digit code</Label>
                <Input
                  id="2fa-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="h-14 rounded-2xl bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em] font-bold placeholder:text-white/20 focus:border-[#1A73E8]"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  disabled={loading}
                />
                <p className="text-xs text-white/30">It may take a minute to arrive. Check spam too.</p>
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold shadow-lg shadow-blue-900/30"
                disabled={loading}
              >
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </Button>
              <button
                type="button"
                onClick={resendCode}
                disabled={loading}
                className="w-full text-xs text-[#60A5FA] font-semibold hover:text-[#93C5FD] transition-colors"
              >
                Resend code
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={cancelTwoFa}
            disabled={loading}
            className="w-full mt-4 text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            ← Cancel and sign out
          </button>
        </>
      )}
    </motion.div>
  );
}
