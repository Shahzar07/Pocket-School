'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { InstitutionLoginScreen } from '@/components/institution-login-screen';
import { auth, db } from '@/lib/firebase';
import { getInstitutionByDomain, getInstitutionBySubdomain, type Institution } from '@/lib/db';
import { brandingFor } from '@/lib/white-label';
import { loginBlocked, resolveStaffRole } from '@/lib/admin-console';
import { readActiveMode, writeActiveMode } from '@/lib/account-modes';
import {
  HOST_LOGIN_SLUG,
  INSTITUTION_ADMIN_CODE_UNAVAILABLE,
  decideInstitutionLogin,
  type InstitutionLoginActor,
  type InstitutionLoginDecision,
  type InstitutionLoginTab,
} from '@/lib/institution-login';
import { reportActivity, reportFailedLogin } from '@/lib/audit/report';

type Reauth = 'password' | 'google' | 'keep';

interface LoadedActor extends InstitutionLoginActor {
  status: string;
  adminRole: string;
  email: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function authCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code : '';
}

async function loadActor(uid: string, institutionId: string, fallbackEmail: string): Promise<LoadedActor | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  const institutionIdOnProfile = text(data.institutionId);
  const roles = Array.isArray(data.roles) ? data.roles.filter((item): item is string => typeof item === 'string') : [];
  let memberOf: string[] = [];
  if (institutionIdOnProfile !== institutionId) {
    try {
      const member = await getDoc(doc(db, 'institutions', institutionId, 'members', uid));
      if (member.exists()) memberOf = [institutionId];
    } catch {
      memberOf = [];
    }
  }
  return {
    institutionId: institutionIdOnProfile,
    role: text(data.role),
    roles,
    memberOf,
    status: text(data.accountStatus) || 'active',
    adminRole: text(data.adminRole),
    email: text(data.email) || fallbackEmail,
  };
}

export default function InstitutionLoginPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const router = useRouter();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [status, setStatus] = useState<'loading' | 'missing' | 'paused' | 'ready'>('loading');
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refused, setRefused] = useState(false);
  const [emailForCode, setEmailForCode] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [reauth, setReauth] = useState<Reauth>('password');
  const [pending, setPending] = useState<Extract<InstitutionLoginDecision, { allowed: true }> | null>(null);
  const [pendingTab, setPendingTab] = useState<InstitutionLoginTab>('student');

  useEffect(() => {
    let cancelled = false;
    const lookup = slug === HOST_LOGIN_SLUG
      ? getInstitutionByDomain(window.location.hostname)
      : getInstitutionBySubdomain(slug);
    lookup
      .then((found) => {
        if (cancelled) return;
        setInstitution(found);
        if (!found) setStatus('missing');
        else if (found.status === 'suspended') setStatus('paused');
        else setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('missing');
      });
    return () => { cancelled = true; };
  }, [slug]);

  const branding = brandingFor(institution);
  const schoolName = institution ? branding.displayName : 'Academy';

  const finish = async (decision: Extract<InstitutionLoginDecision, { allowed: true }>, uid: string) => {
    if (decision.mode) writeActiveMode(decision.mode);
    void reportActivity({ action: 'auth.login', targetType: 'session', targetId: uid });
    router.push(decision.destination);
  };

  const refuse = async () => {
    try { await signOut(auth); } catch { /* already signed out */ }
    setRefused(true);
    setStep('credentials');
    setPending(null);
  };

  const sendCode = async (address: string, idToken: string): Promise<'sent' | 'blocked' | 'error'> => {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ email: address, institutionId: institution?.id }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string; token?: string; expiresAt?: number; configured?: boolean };
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Could not send the verification code.');
      return 'error';
    }
    if (data.configured === false) return 'blocked';
    if (!data.token || !data.expiresAt) {
      setError('The verification service answered without a code. Sign-in has not finished.');
      return 'error';
    }
    setOtpToken(data.token);
    setOtpExpiresAt(data.expiresAt);
    return 'sent';
  };

  const afterSignIn = async (
    uid: string,
    address: string,
    secret: string,
    method: 'password' | 'google',
    tab: InstitutionLoginTab,
  ) => {
    if (!institution) return;
    setPendingTab(tab);
    const actor = await loadActor(uid, institution.id, address);
    if (!actor) {
      await refuse();
      return;
    }
    if (loginBlocked(actor.status)) {
      try { await signOut(auth); } catch { /* already signed out */ }
      setError('This account is closed. Contact support@poketschool.ai.');
      return;
    }
    const decision = decideInstitutionLogin(actor, institution.id, {
      storedMode: readActiveMode(),
      tab,
      platformStaff: resolveStaffRole({ email: address, role: actor.role, adminRole: actor.adminRole }) != null,
    });
    if (!decision.allowed) {
      await refuse();
      return;
    }
    const requireCode = decision.needsEmailCode || institution.require2fa === true;
    if (!requireCode) {
      await finish(decision, uid);
      return;
    }
    let idToken = '';
    try { idToken = await auth.currentUser?.getIdToken() ?? ''; } catch { idToken = ''; }
    const sent = await sendCode(address, idToken);
    if (decision.needsEmailCode) {
      try { await signOut(auth); } catch { /* the code step continues signed out */ }
      if (sent === 'sent') {
        setPassword(secret);
        setReauth(method);
        setEmailForCode(address);
        setPending(decision);
        setStep('code');
        setError('');
        void reportActivity({ action: 'auth.two_factor_challenge', targetType: 'session', targetId: uid });
      } else if (sent === 'blocked') {
        setError(INSTITUTION_ADMIN_CODE_UNAVAILABLE);
      }
      return;
    }
    if (sent === 'sent') {
      setReauth('keep');
      setEmailForCode(address);
      setPending(decision);
      setStep('code');
      setError('');
      return;
    }
    await finish(decision, uid);
  };

  const onCredentials = async (input: { email: string; password: string; tab: InstitutionLoginTab }) => {
    setError('');
    setRefused(false);
    if (!input.email || !input.password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setPendingTab(input.tab);
    try {
      const result = await signInWithEmailAndPassword(auth, input.email, input.password);
      await afterSignIn(result.user.uid, result.user.email || input.email, input.password, 'password', input.tab);
    } catch (err) {
      const code = authCode(err);
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        void reportFailedLogin(input.email);
        setError('That email or password is not right.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Wait a moment and try again.');
      } else {
        setError('Could not sign in.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (tab: InstitutionLoginTab) => {
    setError('');
    setRefused(false);
    setBusy(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await afterSignIn(result.user.uid, result.user.email || '', '', 'google', tab);
    } catch (err) {
      const code = authCode(err);
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setError('Could not sign in with Google.');
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async (code: string) => {
    if (!pending || !institution) return;
    if (code.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForCode.trim(),
          code,
          token: otpToken,
          expiresAt: otpExpiresAt,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; valid?: boolean };
      if (!res.ok || !data.valid) {
        void reportFailedLogin(emailForCode, 'auth.two_factor_failed');
        setError(typeof data.error === 'string' ? data.error : 'That code is not valid.');
        return;
      }
      if (reauth === 'password') {
        await signInWithEmailAndPassword(auth, emailForCode.trim(), password);
      } else if (reauth === 'google') {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
      const uid = auth.currentUser?.uid ?? '';
      const actor = uid ? await loadActor(uid, institution.id, emailForCode) : null;
      const decision = actor
        ? decideInstitutionLogin(actor, institution.id, {
          storedMode: readActiveMode(),
          tab: pendingTab,
          platformStaff: resolveStaffRole({ email: emailForCode, role: actor.role, adminRole: actor.adminRole }) != null,
        })
        : { allowed: false as const, reason: 'not_member' as const };
      if (!decision.allowed) {
        await refuse();
        return;
      }
      void reportActivity({ action: 'auth.two_factor_success', targetType: 'session', targetId: uid });
      await finish(decision, uid);
    } catch {
      setError('Could not finish signing in.');
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setBusy(true);
    setError('');
    try {
      const idToken = reauth === 'keep' ? await auth.currentUser?.getIdToken().catch(() => '') ?? '' : '';
      const sent = await sendCode(emailForCode, idToken);
      if (sent === 'blocked' && pending?.needsEmailCode) setError(INSTITUTION_ADMIN_CODE_UNAVAILABLE);
      else if (sent === 'sent') setError('');
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    setStep('credentials');
    setPending(null);
    setPassword('');
    setError('');
    try { await signOut(auth); } catch { /* already signed out */ }
  };

  return (
    <InstitutionLoginScreen
      schoolName={schoolName}
      logoUrl={branding.logoUrl}
      primaryColor={branding.primaryColor}
      secondaryColor={branding.secondaryColor}
      headline={branding.loginHeadline || `Sign in to ${schoolName}`}
      body={branding.loginBody || 'Students, teachers, and institution admins.'}
      showPoweredBy={!branding.hidePoweredBy}
      status={status}
      busy={busy}
      step={step}
      error={error}
      refused={refused}
      emailForCode={emailForCode}
      signupPolicy={institution?.signupPolicy}
      onCredentials={(input) => { void onCredentials(input); }}
      onGoogle={(tab) => { void onGoogle(tab); }}
      onVerify={(code) => { void onVerify(code); }}
      onResend={() => { void onResend(); }}
      onCancel={() => { void onCancel(); }}
    />
  );
}
