'use client';

/**
 * Signup — PDPA-compliant registration.
 * Collects date of birth, routes under-18s through verified parent/guardian
 * consent before the account is created, requires explicit agreement to the
 * Terms and Privacy Policy, and asks role-specific questions.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import Link from 'next/link';
import { GraduationCap, Presentation, Users, ShieldCheck, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NOT_APPLICABLE, PROGRAMMES, assertPlacement, levelsForProgramme, suggestPlacementFromDob } from '@/lib/programmes';
import { authedFetch } from '@/lib/api-client';
import { publicDisplayName } from '@/lib/display-name';
import { CountrySelect, PhoneField } from '@/components/country-select';
import { readGeoCountry } from '@/lib/countries';
import { useWhiteLabel } from '@/components/white-label-provider';
import { passwordAccepts, signupDecision } from '@/lib/academy-settings';
import { SelfJoinPicker } from '@/components/institutions/self-join-picker';
import { listSelfJoinInstitutions, redeemInviteCode, submitSelfJoin } from '@/lib/institution-membership-store';
import type { JoinDirectoryRow, JoinRole } from '@/lib/institution-membership';
import { statesForCountry } from '@/lib/institution-states';

const ROLES = [
  { id: 'student', titleKey: 'signup.student', icon: <GraduationCap className="w-5 h-5" /> },
  { id: 'teacher', titleKey: 'signup.teacher', icon: <Presentation className="w-5 h-5" /> },
  { id: 'parent', titleKey: 'signup.parent', icon: <Users className="w-5 h-5" /> },
];

const INPUT_CLASS =
  'h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary focus:ring-primary/20 transition-all';
const SELECT_CLASS =
  'w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white px-4 text-sm outline-none focus:border-primary transition-all';
const LABEL_CLASS = 'text-white/60 text-xs font-semibold uppercase tracking-wider';

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function SignupPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { institution: academy } = useWhiteLabel();
  // 'form' → details, 'consent' → guardian consent code (minors), 'verify' → email code
  const [step, setStep] = useState<'form' | 'consent' | 'verify'>('form');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  useEffect(() => {
    setCountry((current) => current || readGeoCountry());
  }, []);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [joinPath, setJoinPath] = useState<'independent' | 'institution'>('independent');
  const [joinState, setJoinState] = useState('');
  const [joinInstitution, setJoinInstitution] = useState('');
  const [listed, setListed] = useState<JoinDirectoryRow[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  useEffect(() => {
    const states = statesForCountry(country);
    setJoinState((current) => (states as readonly string[]).includes(current) ? current : states[0] ?? '');
  }, [country]);
  useEffect(() => {
    if (joinPath !== 'institution' || !country || !joinState) {
      setListed([]);
      return;
    }
    listSelfJoinInstitutions(country, joinState).then(setListed).catch(() => setListed([]));
  }, [joinPath, country, joinState]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('role');
    if (requested === 'student' || requested === 'teacher' || requested === 'parent') setRole(requested);
  }, []);
  const [dob, setDob] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Role-specific
  const [pathway, setPathway] = useState('');
  const [yearGroup, setYearGroup] = useState('');
  const [placementEdited, setPlacementEdited] = useState(false);
  const [subject, setSubject] = useState('');
  const [teachingLevel, setTeachingLevel] = useState('');
  const [institution, setInstitution] = useState('');
  const [childEmail, setChildEmail] = useState('');

  // Parental consent (under-18 students)
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianToken, setGuardianToken] = useState('');
  const [guardianExpires, setGuardianExpires] = useState(0);
  const [guardianVerified, setGuardianVerified] = useState(false);

  // Email OTP for the account holder
  const [otpToken, setOtpToken] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);

  const age = useMemo(() => ageFromDob(dob), [dob]);
  const isMinor = role === 'student' && age !== null && age < 18;
  const tooYoung = age !== null && age < 13;
  const yearOptions = levelsForProgramme(pathway);
  const suggestedPlacement = useMemo(() => (role === 'student' ? suggestPlacementFromDob(dob) : null), [dob, role]);

  useEffect(() => {
    if (role !== 'student' || placementEdited || !suggestedPlacement) return;
    setPathway(suggestedPlacement.programme);
    setYearGroup(suggestedPlacement.year);
  }, [role, placementEdited, suggestedPlacement]);

  const finishJoin = async (uid: string, account?: { email?: string | null; name?: string | null }) => {
    if (joinPath !== 'institution') return;
    const joinRole: JoinRole = role === 'teacher' || role === 'parent' ? role : 'student';
    const address = (account?.email || email).trim();
    const person = (account?.name || name).trim();
    const childEmails = childEmail.trim() ? [childEmail.trim().toLowerCase()] : [];
    try {
      if (inviteCode.trim()) {
        const result = await redeemInviteCode({
          userId: uid, email: address, code: inviteCode, role: joinRole, name: person, childEmails,
        });
        toast.message(result === 'joined' ? 'Joined with the invite code.' : 'Request sent to the institution.');
        return;
      }
      if (!joinInstitution) {
        toast.message('No listed institution was selected, so this account stays independent.');
        return;
      }
      await submitSelfJoin({
        userId: uid, institutionId: joinInstitution, role: joinRole, name: person, email: address, childEmails,
      });
      toast.message('Request sent. The institution admin assigns the level, classes, and courses.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the join request.');
    }
  };

  const routeAfterSignup = (r: string) => {
    if (r === 'teacher') router.push('/dashboard/teacher');
    else router.push('/onboarding');
  };

  /** Fields written to the user profile, shared by both signup paths. */
  const roleProfileFields = () => {
    if (role === 'student') {
      const placement = assertPlacement(pathway, yearGroup);
      return {
        pathway: placement.pathway,
        level: placement.level,
        ...(placement.yearGroup ? { yearGroup: placement.yearGroup } : {}),
      };
    }
    if (role === 'teacher') {
      const subjects = subject.split(',').map(s => s.trim()).filter(Boolean);
      return {
        subjects,
        subject: subjects[0] ?? '',
        teachingLevel,
        level: teachingLevel,
        ...(institution.trim() ? { institutionName: institution.trim(), institution: institution.trim() } : {}),
      };
    }
    if (role === 'parent') return childEmail.trim() ? { pendingChildEmail: childEmail.trim().toLowerCase() } : {};
    return {};
  };

  const handleGoogleSignIn = async () => {
    if (!agreed) { toast.error(t('signup.acceptFirst')); return; }
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const docRef = doc(db, 'users', result.user.uid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, {
          email: result.user.email,
          name: result.user.displayName || 'New User',
          avatarUrl: result.user.photoURL || '',
          role,
          xp: 0,
          emailVerified: false,
          emailVerificationRequired: !result.user.emailVerified,
          consentAcceptedAt: serverTimestamp(),
          ...(dob ? { dateOfBirth: dob } : {}),
          ...(country ? { country } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...roleProfileFields(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (role === 'student') {
          await authedFetch('/api/account/placement', {
            method: 'POST',
            body: JSON.stringify({ programme: pathway, year: yearGroup }),
          }).catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : t('signup.placementFailed'));
          });
        }
        await finishJoin(result.user.uid, { email: result.user.email, name: result.user.displayName });
      }
      const existing = snap.exists() ? snap.data() : { role };
      routeAfterSignup(existing.role || role);
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      toast.error(e?.message || t('signup.googleFailed'));
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!name.trim() || !email.trim() || !password) {
      toast.error(t('signup.fillRequired'));
      return false;
    }
    const academySignup = signupDecision({
      policy: academy?.signupPolicy,
      domains: academy?.allowedEmailDomains,
      email,
    });
    if (academy && !academySignup.ok) {
      toast.error(academySignup.reason);
      return false;
    }
    const academyPassword = academy
      ? passwordAccepts(password, { minLength: academy.passwordMinLength, requireSymbol: academy.passwordRequireSymbol })
      : null;
    if (academyPassword) {
      toast.error(academyPassword);
      return false;
    }
    if (password.length < 6) {
      toast.error(t('signup.passwordShort'));
      return false;
    }
    if (!dob) {
      toast.error(t('signup.needDob'));
      return false;
    }
    if (age === null) {
      toast.error(t('signup.dobInvalid'));
      return false;
    }
    if (tooYoung) {
      toast.error(t('signup.tooYoungError'));
      return false;
    }
    if (phone.trim() && !/^\+[1-9]\d{6,14}$/.test(phone.trim())) {
      toast.error(t('signup.phoneFormat'));
      return false;
    }
    if (role === 'teacher' && !subject.trim()) {
      toast.error(t('signup.needSubjects'));
      return false;
    }
    if (role === 'student') {
      try {
        assertPlacement(pathway, yearGroup);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('signup.yearForProgramme'));
        return false;
      }
    }
    if (isMinor && (!guardianName.trim() || !guardianEmail.trim())) {
      toast.error(t('signup.needGuardian'));
      return false;
    }
    if (isMinor && guardianEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
      toast.error(t('signup.guardianSame'));
      return false;
    }
    if (!agreed) {
      toast.error(t('signup.acceptTerms'));
      return false;
    }
    return true;
  };

  const createAccount = async (verifiedByOtp: boolean) => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await setDoc(doc(db, 'users', result.user.uid), {
      email: result.user.email,
      name: name.trim(),
      avatarUrl: '',
      role,
      xp: 0,
      emailVerified: false,
      emailVerificationRequired: true,
      dateOfBirth: dob,
      consentAcceptedAt: serverTimestamp(),
      ...(isMinor ? {
        isMinor: true,
        guardianName: guardianName.trim(),
        guardianEmail: guardianEmail.trim().toLowerCase(),
        guardianConsentAt: serverTimestamp(),
      } : {}),
      ...(country ? { country } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...roleProfileFields(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'public_profiles', result.user.uid), {
      displayName: publicDisplayName(name.trim()),
      role,
    });
    if (verifiedByOtp) {
      await authedFetch('/api/platform/mark-verified', { method: 'POST', body: '{}' }).catch(() => {});
    } else {
      await sendEmailVerification(result.user).catch(() => {});
      toast.message(t('signup.confirmLink'));
    }
    if (role === 'student') {
      await authedFetch('/api/account/placement', {
        method: 'POST',
        body: JSON.stringify({ programme: pathway, year: yearGroup }),
      }).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('signup.placementFailed'));
      });
    }
    toast.success(t('signup.welcome'));
    await finishJoin(result.user.uid, { email: result.user.email, name });
    routeAfterSignup(role);
  };

  const handleAuthError = (e: any) => {
    if (e?.code === 'auth/operation-not-allowed') toast.error(t('signup.enableEmail'));
    else if (e?.code === 'auth/invalid-email') toast.error(t('signup.invalidEmail'));
    else if (e?.code === 'auth/email-already-in-use') toast.error(t('signup.emailInUse'));
    else toast.error(e?.message || t('signup.createFailed'));
  };

  /** Send a consent code to the guardian's inbox (minors only). */
  const sendGuardianConsent = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guardianEmail.trim(), institutionId: academy?.id || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t('signup.guardianUnreachable')); return; }
      if (data.configured === false) {
        toast.error(t('signup.guardianEmailMissing'));
        return;
      }
      setGuardianToken(data.token);
      setGuardianExpires(data.expiresAt);
      setCode('');
      setStep('consent');
      toast.success(t('signup.consentSentToast', { email: guardianEmail.trim() }));
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setLoading(false);
    }
  };

  const verifyGuardianConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) { toast.error(t('signup.enterConsentCode')); return; }
    try {
      setLoading(true);
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: guardianEmail.trim(), code: code.trim(),
          token: guardianToken, expiresAt: guardianExpires,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) { toast.error(data.error || t('signup.consentInvalid')); return; }
      setGuardianVerified(true);
      toast.success(t('signup.consentConfirmed'));
      await startAccountVerification(true);
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setLoading(false);
    }
  };

  /** Email verification for the account holder, then account creation. */
  const startAccountVerification = async (skipValidation = false) => {
    if (!skipValidation && !validateForm()) return;
    try {
      setLoading(true);
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), institutionId: academy?.id || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t('signup.verifySendFailed')); return; }
      if (data.configured === false) { await createAccount(false); return; }
      setOtpToken(data.token);
      setOtpExpiresAt(data.expiresAt);
      setCode('');
      toast.success(t('signup.verifySent'));
      setStep('verify');
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setLoading(false);
    }
  };

  const submitForm = async () => {
    if (!validateForm()) return;
    // Under-18 students must have verified guardian consent before we create anything.
    if (isMinor && !guardianVerified) { await sendGuardianConsent(); return; }
    await startAccountVerification(true);
  };

  const verifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) { toast.error(t('signup.enterCode')); return; }
    try {
      setLoading(true);
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(), code: code.trim(),
          token: otpToken, expiresAt: otpExpiresAt,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.valid) {
        toast.error(verifyData.error || t('signup.codeInvalid'));
        return;
      }
      await createAccount(true);
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setLoading(false);
    }
  };

  const heading =
    step === 'form' ? t('signup.createTitle')
    : step === 'consent' ? t('signup.consentTitle')
    : t('signup.verifyTitle');
  const subheading =
    step === 'form' ? t('signup.createSubtitle')
    : step === 'consent' ? t('signup.consentSubtitle', { email: guardianEmail })
    : t('signup.verifySubtitle', { email });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-7">
        <h2 className="text-3xl font-bold text-white mb-2">{heading}</h2>
        <p className="text-white/45 text-sm">{subheading}</p>
      </div>

      {step === 'form' && (
        <>
          {/* Role selector */}
          <div className="mb-6">
            <Label className={`${LABEL_CLASS} mb-3 block`}>{t('signup.iAm')}</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {ROLES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  disabled={loading}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all text-sm font-semibold ${
                    role === r.id
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 hover:border-white/20'
                  }`}
                >
                  {r.icon}
                  <span>{t(r.titleKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <SelfJoinPicker
              path={joinPath}
              country={country}
              state={joinState}
              institutionId={joinInstitution}
              institutions={listed}
              inviteCode={inviteCode}
              childEmails={childEmail}
              showChildren={false}
              onPath={setJoinPath}
              onCountry={setCountry}
              onState={setJoinState}
              onInstitution={setJoinInstitution}
              onInviteCode={setInviteCode}
              onChildEmails={setChildEmail}
            />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-medium transition-all flex items-center justify-center gap-3 mb-5"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('signup.google')}
          </button>

          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-white/8" />
            <span className="px-4 text-xs text-white/30 font-medium uppercase tracking-widest">{t('signup.orEmail')}</span>
            <div className="flex-1 border-t border-white/8" />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); submitForm(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className={LABEL_CLASS}>{t('signup.fullName')}</Label>
              <Input id="name" type="text" placeholder={t('signup.namePlaceholder')} className={INPUT_CLASS}
                value={name} onChange={e => setName(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className={LABEL_CLASS}>{t('signup.email')}</Label>
              <Input id="email" type="email" placeholder={t('signup.emailPlaceholder')} className={INPUT_CLASS}
                value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
              <p className="text-xs text-white/25">{t('signup.emailHint')}</p>
            </div>

            {/* Date of birth — drives the minor-consent flow */}
            <div className="space-y-1.5">
              <Label htmlFor="dob" className={LABEL_CLASS}>{t('signup.dob')}</Label>
              <Input id="dob" type="date" className={INPUT_CLASS} value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setDob(e.target.value)} disabled={loading} />
              {tooYoung && (
                <p className="text-xs text-red-300">{t('signup.tooYoung')}</p>
              )}
              {isMinor && !tooYoung && (
                <p className="text-xs text-[var(--ps-cyan-text)] flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {t('signup.minorHint')}
                </p>
              )}
            </div>

            {/* ── Role-specific fields ── */}
            {role === 'student' && (
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pathway" className={LABEL_CLASS}>{t('signup.programme')}</Label>
                  <select id="pathway" className={SELECT_CLASS} value={pathway}
                    onChange={e => {
                      const next = e.target.value;
                      setPlacementEdited(true);
                      setPathway(next);
                      setYearGroup(current => levelsForProgramme(next).includes(current) ? current : '');
                    }} disabled={loading}>
                    <option value="" className="bg-[#0B0F1A]">{t('signup.programme')}</option>
                    {PROGRAMMES.map(p => <option key={p.value} value={p.value} className="bg-[#0B0F1A]">{p.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="yearGroup" className={LABEL_CLASS}>{t('signup.yearLevel')}</Label>
                  <select id="yearGroup" className={SELECT_CLASS} value={yearGroup}
                    onChange={e => { setPlacementEdited(true); setYearGroup(e.target.value); }} disabled={loading}>
                    <option value="" className="bg-[#0B0F1A]">{t('signup.yearLevel')}</option>
                    {yearOptions.map(year => (
                      <option key={year} value={year} className="bg-[#0B0F1A]">
                        {year === NOT_APPLICABLE ? t('signup.notApplicable') : year}
                      </option>
                    ))}
                  </select>
                  {suggestedPlacement && !placementEdited && (
                    <p className="text-xs text-white/40">{t('signup.suggested')}</p>
                  )}
                </div>
              </div>
            )}

            {role === 'teacher' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className={LABEL_CLASS}>{t('signup.subjects')}</Label>
                  <Input id="subject" type="text" placeholder={t('signup.subjectsPlaceholder')} className={INPUT_CLASS}
                    value={subject} onChange={e => setSubject(e.target.value)} disabled={loading} />
                  <p className="text-xs text-white/25">{t('signup.subjectsHint')}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="teachingLevel" className={LABEL_CLASS}>{t('signup.levelTeach')}</Label>
                    <select id="teachingLevel" className={SELECT_CLASS} value={teachingLevel}
                      onChange={e => setTeachingLevel(e.target.value)} disabled={loading}>
                      <option value="" className="bg-[#0B0F1A]">{t('signup.levelTeach')}</option>
                      {PROGRAMMES.map(p => <option key={p.value} value={p.value} className="bg-[#0B0F1A]">{p.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="institution" className={LABEL_CLASS}>
                      {t('signup.institution')} <span className="text-white/30 normal-case font-normal">{t('signup.optional')}</span>
                    </Label>
                    <Input id="institution" type="text" placeholder={t('signup.institutionPlaceholder')} className={INPUT_CLASS}
                      value={institution} onChange={e => setInstitution(e.target.value)} disabled={loading} />
                  </div>
                </div>
              </>
            )}

            {role === 'parent' && (
              <div className="space-y-1.5">
                <Label htmlFor="childEmail" className={LABEL_CLASS}>
                  {t('signup.childLink')} <span className="text-white/30 normal-case font-normal">{t('signup.optional')}</span>
                </Label>
                <Input id="childEmail" type="email" placeholder={t('signup.childPlaceholder')} className={INPUT_CLASS}
                  value={childEmail} onChange={e => setChildEmail(e.target.value)} disabled={loading} />
                <p className="text-xs text-white/25">
                  {t('signup.childHint')}
                </p>
              </div>
            )}

            {/* ── Guardian consent block (under-18 students) ── */}
            {isMinor && !tooYoung && (
              <div className="rounded-2xl border border-[var(--ps-cyan-border)]/25 bg-[var(--ps-cyan-soft)] p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--ps-cyan-text)] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> {t('signup.guardianTitle')}
                </p>
                <p className="text-xs text-white/50 leading-relaxed">
                  {t('signup.guardianBody')}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="guardianName" className={LABEL_CLASS}>{t('signup.guardianName')}</Label>
                  <Input id="guardianName" type="text" placeholder={t('signup.guardianNamePlaceholder')} className={INPUT_CLASS}
                    value={guardianName} onChange={e => setGuardianName(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guardianEmail" className={LABEL_CLASS}>{t('signup.guardianEmail')}</Label>
                  <Input id="guardianEmail" type="email" placeholder={t('signup.guardianEmailPlaceholder')} className={INPUT_CLASS}
                    value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} disabled={loading} />
                </div>
              </div>
            )}

            <CountrySelect tone="inverse" label={t('signup.country', { defaultValue: 'Country' })} locale={i18n.language} value={country} onChange={setCountry} />
            <PhoneField
              tone="inverse"
              country={country}
              label={t('signup.phone')}
              value={phone}
              onChange={setPhone}
            />

            <div className="space-y-1.5">
              <Label htmlFor="password" className={LABEL_CLASS}>{t('signup.password')}</Label>
              <Input id="password" type="password" placeholder="••••••••" className={INPUT_CLASS}
                value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
              <p className="text-xs text-white/25">{t('signup.passwordHint')}</p>
            </div>

            {/* ── Consent checkbox (PDPA requirement) ── */}
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                disabled={loading}
                className="mt-0.5 w-4 h-4 shrink-0 accent-primary"
              />
              <span className="text-xs text-white/60 leading-relaxed">
                {t('signup.agree')}{' '}
                <Link href="/legal?doc=terms" target="_blank" className="text-[#6FBBCE] hover:underline font-medium">{t('signup.terms')}</Link>
                {' '}{t('signup.and')}{' '}
                <Link href="/legal?doc=privacy" target="_blank" className="text-[#6FBBCE] hover:underline font-medium">{t('signup.privacy')}</Link>
                {t('signup.consentData')}
                {isMinor && t('signup.minorConsent')}
              </span>
            </label>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-primary text-primary-foreground hover:brightness-110 font-semibold text-base shadow-lg shadow-blue-900/30 transition-all mt-1"
              disabled={loading || tooYoung}
            >
              {loading ? t('signup.working') : isMinor ? t('signup.requestGuardian') : t('signup.createAccount')}
            </Button>
          </form>
        </>
      )}

      {step === 'consent' && (
        <form onSubmit={verifyGuardianConsent} className="space-y-4">
          <div className="rounded-2xl border border-[var(--ps-cyan-border)]/25 bg-[var(--ps-cyan-soft)] p-4">
            <p className="text-xs text-white/60 leading-relaxed">
              {t('signup.consentSent', { name: guardianName, email: guardianEmail })}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consentCode" className={LABEL_CLASS}>{t('signup.consentCode')}</Label>
            <Input
              id="consentCode" type="text" inputMode="numeric" maxLength={6} placeholder="123456"
              className="h-14 rounded-2xl bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em] font-bold placeholder:text-white/20 focus:border-primary"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground hover:brightness-110 font-semibold text-base transition-all">
            {loading ? t('signup.verifying') : t('signup.confirmConsent')}
          </Button>
          <button type="button" onClick={() => setStep('form')} disabled={loading}
            className="w-full text-xs text-white/40 hover:text-white/70 transition-colors">
            ← {t('signup.back')}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={verifyAndCreate} className="space-y-4">
          {guardianVerified && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-200">{t('signup.guardianConfirmed')}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="code" className={LABEL_CLASS}>{t('signup.code')}</Label>
            <Input
              id="code" type="text" inputMode="numeric" maxLength={6} placeholder="123456"
              className="h-14 rounded-2xl bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em] font-bold placeholder:text-white/20 focus:border-primary"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground hover:brightness-110 font-semibold text-base transition-all">
            {loading ? t('signup.creating') : t('signup.verifyCreate')}
          </Button>
          <button type="button" onClick={() => setStep('form')} disabled={loading}
            className="w-full text-xs text-white/40 hover:text-white/70 transition-colors">
            ← {t('signup.back')}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-white/40 mt-6">
        {t('signup.haveAccount')}{' '}
        <Link href="/login" className="text-[#6FBBCE] hover:underline font-medium">{t('signup.signIn')}</Link>
      </p>
    </motion.div>
  );
}
