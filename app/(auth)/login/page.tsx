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
import { useTranslation } from 'react-i18next';
import { loginBlocked, requiresAdminLogin } from '@/lib/admin-console';
import { getInstitution } from '@/lib/db';
import { landingPath, readActiveMode } from '@/lib/account-modes';
import { INSTITUTION_ADMIN_CODE_UNAVAILABLE } from '@/lib/institution-login';
import { institutionAdminDestination } from '@/lib/institution-journey';
import { friendlyError } from '@/lib/design/system';
import { useWhiteLabel } from '@/components/white-label-provider';
import { accentInk } from '@/lib/white-label';
import { reportActivity, reportFailedLogin } from '@/lib/audit/report';

export default function LoginPage() {
  const { t } = useTranslation();
  const { branding, institution } = useWhiteLabel();
  const accent = branding.isWhiteLabel && /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor ?? '') ? branding.primaryColor ?? '' : '';
  const linkColor = branding.isWhiteLabel && /^#[0-9a-fA-F]{6}$/.test(branding.secondaryColor ?? '') ? branding.secondaryColor ?? accent : accent;
  const buttonStyle = accent ? { background: accent, color: accentInk(accent) } : undefined;
  const buttonClass = accent
    ? 'w-full h-12 rounded-2xl font-semibold text-base transition-all mt-2'
    : 'w-full h-12 rounded-2xl bg-[#2786A4] hover:bg-[#1E6A83] text-white font-semibold text-base shadow-lg shadow-blue-900/30 transition-all mt-2';
  const linkClass = linkColor ? 'font-semibold' : 'text-[#6FBBCE] font-semibold hover:text-[#93C5FD] transition-colors';
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
    const data = snap.data();
    if (loginBlocked(typeof data.accountStatus === 'string' ? data.accountStatus : 'active')) {
      await signOut(auth);
      toast.error('This account is closed. Contact support@poketschool.ai.');
      return;
    }
    const role = typeof data.role === 'string' ? data.role : '';
    if (role !== 'student' && role !== 'teacher' && role !== 'parent' && role !== 'institution_admin' && role !== 'admin') {
      router.push('/onboarding');
      return;
    }
    const roles = Array.isArray(data.roles) ? data.roles.filter((item): item is string => typeof item === 'string') : [];
    void reportActivity({ action: 'auth.login', targetType: 'session', targetId: uid });
    if (role === 'institution_admin') {
      const institutionId = typeof data.institutionId === 'string' ? data.institutionId : '';
      const academy = institutionId ? await getInstitution(institutionId).catch(() => null) : null;
      router.push(institutionAdminDestination({
        status: academy?.status ?? 'pending',
        setupComplete: academy?.setupComplete,
        billingPhase: academy?.billingPhase,
        reviewHold: academy?.reviewHold,
      }));
      return;
    }
    router.push(landingPath({ role, roles }, readActiveMode()));
  };

  const sendToAdminLogin = async (uid: string, address: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : {};
    if (!requiresAdminLogin({
      email: address,
      role: typeof data.role === 'string' ? data.role : '',
      adminRole: typeof data.adminRole === 'string' ? data.adminRole : '',
    })) return false;
    await signOut(auth);
    toast.error('Admin accounts sign in at the admin page, with a verification code.');
    router.push('/admin/login');
    return true;
  };

  const sendOtp = async (targetEmail: string): Promise<'sent' | 'skip' | 'error'> => {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, institutionId: institution?.id || undefined }),
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
    let academyRequires = institution?.require2fa === true;
    if (!academyRequires && typeof data?.institutionId === 'string') {
      const academy = await getInstitution(data.institutionId).catch(() => null);
      academyRequires = academy?.require2fa === true;
    }
    const institutionAdmin = data?.role === 'institution_admin';
    const wants2fa = institutionAdmin || data?.twoFactorEnabled === true || academyRequires || !!(data?.emailVerified || data?.phoneVerified);

    if (!wants2fa) {
      await routeUser(uid);
      return;
    }

    const result = await sendOtp(email.trim());
    if (result === 'sent') {
      setPendingUid(uid);
      setStep('twofa');
      void reportActivity({ action: 'auth.two_factor_challenge', targetType: 'session', targetId: uid });
      toast.success('We emailed you a 6-digit code.');
      return;
    }
    if (institutionAdmin) {
      await signOut(auth);
      if (result === 'skip') toast.error(INSTITUTION_ADMIN_CODE_UNAVAILABLE);
      return;
    }
    // Service unavailable — don't strand other accounts at a dead 2FA screen.
    await routeUser(uid);
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
        void reportActivity({ action: 'auth.two_factor_failed', targetType: 'session', targetId: pendingUid });
        toast.error(data.error || 'Invalid or expired code.');
        return;
      }
      void reportActivity({ action: 'auth.two_factor_success', targetType: 'session', targetId: pendingUid });
      await routeUser(pendingUid);
    } catch (e: any) {
      toast.error(friendlyError(e) || 'Verification failed.');
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
      if (await sendToAdminLogin(result.user.uid, result.user.email || '')) return;
      // Sync Google profile picture to Firestore if missing
      const snap = await getDoc(doc(db, 'users', result.user.uid));
      if (snap.exists() && !snap.data().avatarUrl && result.user.photoURL) {
        await setDoc(doc(db, 'users', result.user.uid), { ...snap.data(), avatarUrl: result.user.photoURL, updatedAt: serverTimestamp() });
      }
      setEmail(result.user.email || '');
      if (snap.exists() && snap.data().twoFactorEnabled === true && result.user.email) {
        const otp = await sendOtp(result.user.email);
        if (otp === 'sent') {
          setPendingUid(result.user.uid);
          setStep('twofa');
          toast.success('We emailed you a 6-digit code.');
          return;
        }
      }
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
      toast.error(e?.code ? friendlyError(e) : (e?.message || t('authForm.googleFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error(t('authForm.needCredentials'));
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (await sendToAdminLogin(result.user.uid, result.user.email || email)) return;
      await afterCredentialSuccess(result.user.uid);
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-email') {
        void reportFailedLogin(email);
      }
      if (code === 'auth/invalid-email') toast.error(t('authForm.invalidEmail'));
      else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') toast.error(t('authForm.badPassword'));
      else if (code === 'auth/too-many-requests') toast.error(t('authForm.tooMany'));
      else if (code === 'auth/operation-not-allowed') toast.error(t('authForm.notEnabled'));
      else toast.error(t('authForm.failed'));
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
            <h2 className="text-3xl font-bold text-white mb-2">{branding.loginHeadline || t('authForm.welcome')}</h2>
            <p className="text-white/45 text-sm">{branding.loginBody || branding.tagline || t('authForm.details')}</p>
            {institution?.signupPolicy === 'invite' && (
              <p className="mt-3 text-sm text-white/60">This academy adds people by invitation.</p>
            )}
            {institution?.signupPolicy === 'domain' && (
              <p className="mt-3 text-sm text-white/60">New accounts use an email on an allowed academy domain.</p>
            )}
            {institution?.require2fa && (
              <p className="mt-3 text-sm text-white/60">This academy requires an email code at sign-in.</p>
            )}
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
            {t('authForm.google')}
          </button>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-white/8" />
            <span className="px-4 text-xs text-white/30 font-medium uppercase tracking-widest">{t('authForm.orEmail')}</span>
            <div className="flex-1 border-t border-white/8" />
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/60 text-xs font-semibold uppercase tracking-wider">{t('authForm.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 transition-all"
                style={accent ? { outlineColor: accent } : undefined}
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-white/60 text-xs font-semibold uppercase tracking-wider">{t('authForm.password')}</Label>
                <Link href="/forgot-password" className={`text-xs font-medium ${linkClass}`} style={linkColor ? { color: linkColor } : undefined}>
                  {t('authForm.forgot')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className={buttonClass}
              style={buttonStyle}
              disabled={loading}
            >
              {loading ? t('authForm.signingIn') : t('authForm.signIn')}
            </Button>
          </form>

          <p className="text-center mt-7 text-white/40 text-sm">
            {t('authForm.noAccount')}{' '}
            <Link href="/signup" className={linkClass} style={linkColor ? { color: linkColor } : undefined}>
              {t('authForm.createFree')}
            </Link>
          </p>
          {!branding.isWhiteLabel && (
            <p className="mt-4 text-center text-sm text-white/50">
              <Link href="/institutions/login" className={linkClass} style={linkColor ? { color: linkColor } : undefined}>Institution admin sign-in</Link>
              {' · '}
              <Link href="/institutions/register" className={linkClass} style={linkColor ? { color: linkColor } : undefined}>For Schools & Organisations</Link>
            </p>
          )}
        </>
      )}

      {step === 'twofa' && (
        <>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">{t('authForm.checkEmail')}</h2>
            <p className="text-white/45 text-sm">
              {t('authForm.codeSent')} <span className="text-white/70 font-semibold">{email}</span>.
            </p>
          </div>

          {codeSent && (
            <form onSubmit={verifyTwoFa} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="2fa-code" className="text-white/60 text-xs font-semibold uppercase tracking-wider">{t('authForm.codeLabel')}</Label>
                <Input
                  id="2fa-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="h-14 rounded-2xl bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em] font-bold placeholder:text-white/20"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  disabled={loading}
                />
                <p className="text-xs text-white/30">{t('authForm.codeHint')}</p>
              </div>
              <Button
                type="submit"
                className={buttonClass}
                style={buttonStyle}
                disabled={loading}
              >
                {loading ? t('authForm.verifying') : t('authForm.verify')}
              </Button>
              <button
                type="button"
                onClick={resendCode}
                disabled={loading}
                className={`w-full text-xs ${linkClass}`}
                style={linkColor ? { color: linkColor } : undefined}
              >
                {t('authForm.resend')}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={cancelTwoFa}
            disabled={loading}
            className="w-full mt-4 text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            ← {t('authForm.cancelSignOut')}
          </button>
        </>
      )}
    </motion.div>
  );
}
