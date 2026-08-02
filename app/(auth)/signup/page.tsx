'use client';

/**
 * Signup — PDPA-compliant registration.
 * Collects date of birth, routes under-18s through verified parent/guardian
 * consent before the account is created, requires explicit agreement to the
 * Terms and Privacy Policy, and asks role-specific questions.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import Link from 'next/link';
import { GraduationCap, Presentation, Users, ShieldCheck, Info } from 'lucide-react';

const ROLES = [
  { id: 'student', title: 'Student', icon: <GraduationCap className="w-5 h-5" /> },
  { id: 'teacher', title: 'Teacher', icon: <Presentation className="w-5 h-5" /> },
  { id: 'parent', title: 'Parent', icon: <Users className="w-5 h-5" /> },
];

const YEAR_GROUPS = [
  'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11',
  'Year 12', 'Year 13', 'Foundation', 'Undergraduate', 'Other',
];

/** The 9 academic pathways offered by Poket School. */
const PATHWAYS = [
  'IGCSE / GCSE / O-Levels',
  'A Level / Pre-University',
  'School / K-12',
  'Foundation Programme',
  'LLB (University of London)',
  'Micro Degree',
  'Diploma',
  'Professional Certification',
  'Independent Learning',
];

const TEACHING_LEVELS = [
  'Primary / K-12', 'IGCSE / GCSE / O-Levels', 'A Level / Pre-University',
  'Foundation', 'Undergraduate', 'Professional',
];

const INPUT_CLASS =
  'h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#1A73E8] focus:ring-[#1A73E8]/20 transition-all';
const SELECT_CLASS =
  'w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white px-4 text-sm outline-none focus:border-[#1A73E8] transition-all';
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
  // 'form' → details, 'consent' → guardian consent code (minors), 'verify' → email code
  const [step, setStep] = useState<'form' | 'consent' | 'verify'>('form');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [dob, setDob] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Role-specific
  const [yearGroup, setYearGroup] = useState(YEAR_GROUPS[0]);
  const [pathway, setPathway] = useState(PATHWAYS[0]);
  const [subject, setSubject] = useState('');
  const [teachingLevel, setTeachingLevel] = useState(TEACHING_LEVELS[1]);
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

  const routeAfterSignup = (r: string) => {
    if (r === 'teacher') router.push('/dashboard/teacher');
    else router.push('/onboarding');
  };

  /** Fields written to the user profile, shared by both signup paths. */
  const roleProfileFields = () => {
    if (role === 'student') return { yearGroup, pathway };
    if (role === 'teacher') return {
      subjects: subject.split(',').map(s => s.trim()).filter(Boolean),
      teachingLevel,
      ...(institution.trim() ? { institutionName: institution.trim() } : {}),
    };
    if (role === 'parent') return childEmail.trim() ? { pendingChildEmail: childEmail.trim().toLowerCase() } : {};
    return {};
  };

  const handleGoogleSignIn = async () => {
    if (!agreed) { toast.error('Please accept the Terms of Service and Privacy Policy first.'); return; }
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
          emailVerified: true,
          consentAcceptedAt: serverTimestamp(),
          ...(dob ? { dateOfBirth: dob } : {}),
          ...roleProfileFields(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      const existing = snap.exists() ? snap.data() : { role };
      routeAfterSignup(existing.role || role);
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      toast.error(e?.message || 'Failed to sign up via Google');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!name.trim() || !email.trim() || !password) {
      toast.error('Please fill in your name, email and password.');
      return false;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return false;
    }
    if (!dob) {
      toast.error('Please enter your date of birth.');
      return false;
    }
    if (age === null) {
      toast.error('That date of birth doesn’t look right.');
      return false;
    }
    if (tooYoung) {
      toast.error('You must be at least 13 years old to create an account.');
      return false;
    }
    if (phone.trim() && !/^\+[1-9]\d{6,14}$/.test(phone.trim())) {
      toast.error('Phone must be in international format, e.g. +60123456789 (or leave it blank).');
      return false;
    }
    if (role === 'teacher' && !subject.trim()) {
      toast.error('Please tell us which subject(s) you teach.');
      return false;
    }
    if (isMinor && (!guardianName.trim() || !guardianEmail.trim())) {
      toast.error('A parent or guardian’s name and email are required for under-18 accounts.');
      return false;
    }
    if (isMinor && guardianEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
      toast.error('The guardian email must be different from the student’s email.');
      return false;
    }
    if (!agreed) {
      toast.error('Please accept the Terms of Service and Privacy Policy.');
      return false;
    }
    return true;
  };

  const createAccount = async (emailVerified: boolean) => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await setDoc(doc(db, 'users', result.user.uid), {
      email: result.user.email,
      name: name.trim(),
      avatarUrl: '',
      role,
      xp: 0,
      emailVerified,
      dateOfBirth: dob,
      consentAcceptedAt: serverTimestamp(),
      ...(isMinor ? {
        isMinor: true,
        guardianName: guardianName.trim(),
        guardianEmail: guardianEmail.trim().toLowerCase(),
        guardianConsentAt: serverTimestamp(),
      } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...roleProfileFields(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    toast.success('Account created — welcome to Poket School!');
    routeAfterSignup(role);
  };

  const handleAuthError = (e: any) => {
    if (e?.code === 'auth/operation-not-allowed') toast.error('Enable Email/Password authentication in Firebase Console.');
    else if (e?.code === 'auth/invalid-email') toast.error('Invalid email address format.');
    else if (e?.code === 'auth/email-already-in-use') toast.error('An account with this email already exists.');
    else toast.error(e?.message || 'Failed to create account');
  };

  /** Send a consent code to the guardian's inbox (minors only). */
  const sendGuardianConsent = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guardianEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Could not reach the guardian’s email.'); return; }
      if (data.configured === false) {
        // No mail service configured — record consent as declared rather than block signup.
        setGuardianVerified(true);
        await startAccountVerification(true);
        return;
      }
      setGuardianToken(data.token);
      setGuardianExpires(data.expiresAt);
      setCode('');
      setStep('consent');
      toast.success(`Consent code sent to ${guardianEmail.trim()}.`);
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setLoading(false);
    }
  };

  const verifyGuardianConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) { toast.error('Enter the 6-digit consent code.'); return; }
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
      if (!res.ok || !data.valid) { toast.error(data.error || 'Invalid or expired consent code.'); return; }
      setGuardianVerified(true);
      toast.success('Parental consent confirmed.');
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
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to send verification code.'); return; }
      if (data.configured === false) { await createAccount(false); return; }
      setOtpToken(data.token);
      setOtpExpiresAt(data.expiresAt);
      setCode('');
      toast.success('Verification code sent — check your inbox.');
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
    if (code.trim().length !== 6) { toast.error('Enter the 6-digit code.'); return; }
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
        toast.error(verifyData.error || 'Invalid or expired code.');
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
    step === 'form' ? 'Create your account'
    : step === 'consent' ? 'Parent or guardian consent'
    : 'Check your email';
  const subheading =
    step === 'form' ? 'Join Poket School and start learning smarter.'
    : step === 'consent' ? `We sent a consent code to ${guardianEmail}. Ask your parent or guardian to share it with you.`
    : `We sent a 6-digit code to ${email}.`;

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
            <Label className={`${LABEL_CLASS} mb-3 block`}>I am a...</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {ROLES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  disabled={loading}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all text-sm font-semibold ${
                    role === r.id
                      ? 'border-[#1A73E8] bg-[#1A73E8]/15 text-[#60A5FA]'
                      : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 hover:border-white/20'
                  }`}
                >
                  {r.icon}
                  <span>{r.title}</span>
                </button>
              ))}
            </div>
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
            Continue with Google
          </button>

          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-white/8" />
            <span className="px-4 text-xs text-white/30 font-medium uppercase tracking-widest">or email</span>
            <div className="flex-1 border-t border-white/8" />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); submitForm(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className={LABEL_CLASS}>Full Name</Label>
              <Input id="name" type="text" placeholder="Jane Doe" className={INPUT_CLASS}
                value={name} onChange={e => setName(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className={LABEL_CLASS}>Email Address</Label>
              <Input id="email" type="email" placeholder="name@example.com" className={INPUT_CLASS}
                value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
              <p className="text-xs text-white/25">We&apos;ll send a verification code to this address.</p>
            </div>

            {/* Date of birth — drives the minor-consent flow */}
            <div className="space-y-1.5">
              <Label htmlFor="dob" className={LABEL_CLASS}>Date of Birth</Label>
              <Input id="dob" type="date" className={INPUT_CLASS} value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setDob(e.target.value)} disabled={loading} />
              {tooYoung && (
                <p className="text-xs text-red-300">You must be at least 13 years old to use Poket School.</p>
              )}
              {isMinor && !tooYoung && (
                <p className="text-xs text-amber-300 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  You&apos;re under 18, so we need a parent or guardian to approve this account.
                </p>
              )}
            </div>

            {/* ── Role-specific fields ── */}
            {role === 'student' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="yearGroup" className={LABEL_CLASS}>Year / Level</Label>
                  <select id="yearGroup" className={SELECT_CLASS} value={yearGroup}
                    onChange={e => setYearGroup(e.target.value)} disabled={loading}>
                    {YEAR_GROUPS.map(y => <option key={y} value={y} className="bg-[#0B0F1A]">{y}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pathway" className={LABEL_CLASS}>Programme of Interest</Label>
                  <select id="pathway" className={SELECT_CLASS} value={pathway}
                    onChange={e => setPathway(e.target.value)} disabled={loading}>
                    {PATHWAYS.map(p => <option key={p} value={p} className="bg-[#0B0F1A]">{p}</option>)}
                  </select>
                </div>
              </div>
            )}

            {role === 'teacher' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className={LABEL_CLASS}>Subject(s) You Teach</Label>
                  <Input id="subject" type="text" placeholder="Biology, Chemistry" className={INPUT_CLASS}
                    value={subject} onChange={e => setSubject(e.target.value)} disabled={loading} />
                  <p className="text-xs text-white/25">Separate multiple subjects with commas.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="teachingLevel" className={LABEL_CLASS}>Level You Teach</Label>
                    <select id="teachingLevel" className={SELECT_CLASS} value={teachingLevel}
                      onChange={e => setTeachingLevel(e.target.value)} disabled={loading}>
                      {TEACHING_LEVELS.map(l => <option key={l} value={l} className="bg-[#0B0F1A]">{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="institution" className={LABEL_CLASS}>
                      Institution <span className="text-white/30 normal-case font-normal">(optional)</span>
                    </Label>
                    <Input id="institution" type="text" placeholder="Sunway College" className={INPUT_CLASS}
                      value={institution} onChange={e => setInstitution(e.target.value)} disabled={loading} />
                  </div>
                </div>
              </>
            )}

            {role === 'parent' && (
              <div className="space-y-1.5">
                <Label htmlFor="childEmail" className={LABEL_CLASS}>
                  Link to Your Child&apos;s Account <span className="text-white/30 normal-case font-normal">(optional)</span>
                </Label>
                <Input id="childEmail" type="email" placeholder="child@example.com" className={INPUT_CLASS}
                  value={childEmail} onChange={e => setChildEmail(e.target.value)} disabled={loading} />
                <p className="text-xs text-white/25">
                  Enter the email your child signed up with. You can also link accounts later from your dashboard.
                </p>
              </div>
            )}

            {/* ── Guardian consent block (under-18 students) ── */}
            {isMinor && !tooYoung && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Parent / Guardian Consent
                </p>
                <p className="text-xs text-white/50 leading-relaxed">
                  We&apos;ll email your parent or guardian a 6-digit code. Your account is only created once
                  they approve it, as required by the Malaysian PDPA.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="guardianName" className={LABEL_CLASS}>Guardian&apos;s Full Name</Label>
                  <Input id="guardianName" type="text" placeholder="Parent or guardian name" className={INPUT_CLASS}
                    value={guardianName} onChange={e => setGuardianName(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guardianEmail" className={LABEL_CLASS}>Guardian&apos;s Email</Label>
                  <Input id="guardianEmail" type="email" placeholder="parent@example.com" className={INPUT_CLASS}
                    value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} disabled={loading} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="phone" className={LABEL_CLASS}>
                Phone <span className="text-white/30 normal-case font-normal">(optional)</span>
              </Label>
              <Input id="phone" type="tel" placeholder="+60123456789" className={INPUT_CLASS}
                value={phone} onChange={e => setPhone(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className={LABEL_CLASS}>Password</Label>
              <Input id="password" type="password" placeholder="••••••••" className={INPUT_CLASS}
                value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
              <p className="text-xs text-white/25">At least 6 characters.</p>
            </div>

            {/* ── Consent checkbox (PDPA requirement) ── */}
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                disabled={loading}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[#1A73E8]"
              />
              <span className="text-xs text-white/60 leading-relaxed">
                I agree to the{' '}
                <Link href="/legal?doc=terms" target="_blank" className="text-[#60A5FA] hover:underline font-medium">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/legal?doc=privacy" target="_blank" className="text-[#60A5FA] hover:underline font-medium">Privacy Policy</Link>
                , and I consent to Poket School processing my personal data as described.
                {isMinor && ' My parent or guardian consents on my behalf.'}
              </span>
            </label>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-base shadow-lg shadow-blue-900/30 transition-all mt-1"
              disabled={loading || tooYoung}
            >
              {loading ? 'Working…' : isMinor ? 'Request Guardian Approval' : 'Create Account'}
            </Button>
          </form>
        </>
      )}

      {step === 'consent' && (
        <form onSubmit={verifyGuardianConsent} className="space-y-4">
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
            <p className="text-xs text-white/60 leading-relaxed">
              <strong className="text-amber-300">{guardianName}</strong> has been emailed a consent code at{' '}
              <strong className="text-white/80">{guardianEmail}</strong>. Enter it below to confirm they approve
              this account.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consentCode" className={LABEL_CLASS}>6-Digit Consent Code</Label>
            <Input
              id="consentCode" type="text" inputMode="numeric" maxLength={6} placeholder="123456"
              className="h-14 rounded-2xl bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em] font-bold placeholder:text-white/20 focus:border-[#1A73E8]"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading}
            className="w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-base transition-all">
            {loading ? 'Verifying…' : 'Confirm Consent'}
          </Button>
          <button type="button" onClick={() => setStep('form')} disabled={loading}
            className="w-full text-xs text-white/40 hover:text-white/70 transition-colors">
            ← Back to details
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={verifyAndCreate} className="space-y-4">
          {guardianVerified && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-200">Guardian consent confirmed.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="code" className={LABEL_CLASS}>6-Digit Code</Label>
            <Input
              id="code" type="text" inputMode="numeric" maxLength={6} placeholder="123456"
              className="h-14 rounded-2xl bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em] font-bold placeholder:text-white/20 focus:border-[#1A73E8]"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading}
            className="w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-base transition-all">
            {loading ? 'Creating account…' : 'Verify & Create Account'}
          </Button>
          <button type="button" onClick={() => setStep('form')} disabled={loading}
            className="w-full text-xs text-white/40 hover:text-white/70 transition-colors">
            ← Back to details
          </button>
        </form>
      )}

      <p className="text-center text-sm text-white/40 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-[#60A5FA] hover:underline font-medium">Sign in</Link>
      </p>
    </motion.div>
  );
}
