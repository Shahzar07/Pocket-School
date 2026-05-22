'use client';

import { useState } from 'react';
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
import { GraduationCap, Presentation, Users, MessageSquare, Mail, Phone } from 'lucide-react';
import { enrollStudent, getAllPublishedCourses } from '@/lib/db';

const ROLES = [
  { id: 'student', title: 'Student', icon: <GraduationCap className="w-5 h-5" /> },
  { id: 'teacher', title: 'Teacher', icon: <Presentation className="w-5 h-5" /> },
  { id: 'parent', title: 'Parent', icon: <Users className="w-5 h-5" /> },
];

type Channel = 'sms' | 'whatsapp' | 'email';

async function autoEnrollInDemoCourses(uid: string) {
  try {
    const courses = await getAllPublishedCourses();
    await Promise.all(courses.map(c => enrollStudent(uid, c.id)));
  } catch {
    // Non-fatal — enrollment can happen later
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [channel, setChannel] = useState<Channel>('sms');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const routeAfterSignup = (r: string) => {
    if (r === 'student') router.push('/onboarding');
    else if (r === 'parent') router.push('/onboarding');
    else if (r === 'teacher') router.push('/dashboard/teacher');
    else router.push('/dashboard/admin');
  };

  const handleGoogleSignIn = async () => {
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (role === 'student') await autoEnrollInDemoCourses(result.user.uid);
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

  const sendOtp = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (channel !== 'email' && !/^\+[1-9]\d{6,14}$/.test(phone.trim())) {
      toast.error('Phone must be in E.164 format, e.g. +447123456789');
      return;
    }

    try {
      setLoading(true);
      const target = channel === 'email' ? email.trim() : phone.trim();
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: target, channel }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send verification code.');
        return;
      }
      toast.success(`Code sent via ${channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()}`);
      setStep('verify');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length !== 6) {
      toast.error('Enter the 6-digit code.');
      return;
    }

    try {
      setLoading(true);
      const target = channel === 'email' ? email.trim() : phone.trim();
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: target, code: code.trim() }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.valid) {
        toast.error(verifyData.error || 'Invalid or expired code.');
        return;
      }

      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        name: name.trim(),
        avatarUrl: '',
        role,
        xp: 0,
        phone: phone.trim(),
        phoneVerified: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (role === 'student') await autoEnrollInDemoCourses(result.user.uid);
      routeAfterSignup(role);
    } catch (e: any) {
      if (e?.code === 'auth/operation-not-allowed') toast.error('Enable Email/Password authentication in Firebase Console.');
      else if (e?.code === 'auth/invalid-email') toast.error('Invalid email address format.');
      else if (e?.code === 'auth/email-already-in-use') toast.error('An account with this email already exists.');
      else toast.error(e.message || 'Failed to create account');
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
      <div className="mb-7">
        <h2 className="text-3xl font-bold text-white mb-2">
          {step === 'form' ? 'Create your account' : "Verify it's you"}
        </h2>
        <p className="text-white/45 text-sm">
          {step === 'form'
            ? 'Join Pocket School and start learning smarter.'
            : `We sent a 6-digit code to your ${channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'email' : 'phone'}.`}
        </p>
      </div>

      {step === 'form' && (
        <>
          {/* Role selector */}
          <div className="mb-6">
            <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3 block">I am a...</Label>
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

          <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-white/60 text-xs font-semibold uppercase tracking-wider">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Doe"
                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#1A73E8] focus:ring-[#1A73E8]/20 transition-all"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/60 text-xs font-semibold uppercase tracking-wider">Email Address</Label>
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
              <Label htmlFor="phone" className="text-white/60 text-xs font-semibold uppercase tracking-wider">Phone (with country code)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+447123456789"
                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#1A73E8] focus:ring-[#1A73E8]/20 transition-all"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-white/25">For 2-factor authentication. E.164 format e.g. +447123456789</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/60 text-xs font-semibold uppercase tracking-wider">Password</Label>
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

            {/* Channel selector */}
            <div className="space-y-2">
              <Label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Receive verification via</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { id: 'sms' as const, label: 'SMS', icon: <Phone className="w-3.5 h-3.5" /> },
                  { id: 'whatsapp' as const, label: 'WhatsApp', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                  { id: 'email' as const, label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
                ].map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id)}
                    disabled={loading}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border-2 transition-all text-xs font-semibold ${
                      channel === c.id
                        ? 'border-[#1A73E8] bg-[#1A73E8]/15 text-[#60A5FA]'
                        : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                    }`}
                  >
                    {c.icon}
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-base shadow-lg shadow-blue-900/30 transition-all mt-1"
              disabled={loading}
            >
              {loading ? 'Sending code…' : 'Send Verification Code'}
            </Button>
          </form>
        </>
      )}

      {step === 'verify' && (
        <form onSubmit={verifyAndCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-white/60 text-xs font-semibold uppercase tracking-wider">6-Digit Code</Label>
            <Input
              id="code"
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
            <p className="text-xs text-white/30">
              Sent to <span className="font-semibold text-white/50">{channel === 'email' ? email : phone}</span>
            </p>
          </div>
          <Button
            type="submit"
            className="w-full h-12 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold shadow-lg shadow-blue-900/30"
            disabled={loading}
          >
            {loading ? 'Verifying…' : 'Verify & Create Account'}
          </Button>
          <button
            type="button"
            onClick={() => { setStep('form'); setCode(''); }}
            disabled={loading}
            className="w-full text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            ← Back to form
          </button>
          <button
            type="button"
            onClick={sendOtp}
            disabled={loading}
            className="w-full text-xs text-[#60A5FA] font-semibold hover:text-[#93C5FD] transition-colors"
          >
            Resend code
          </button>
        </form>
      )}

      <p className="text-center mt-7 text-white/40 text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-[#60A5FA] font-semibold hover:text-[#93C5FD] transition-colors">Sign In</Link>
      </p>
    </motion.div>
  );
}
