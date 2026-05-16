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
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          {step === 'form' ? 'Create an account' : 'Verify it\'s you'}
        </h2>
        <p className="text-muted-foreground">
          {step === 'form'
            ? 'Join Pocket School to start your journey.'
            : `We sent a 6-digit code to your ${channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'email' : 'phone'}.`}
        </p>
      </div>

      {step === 'form' && (
        <>
          <div className="mb-6">
            <Label className="text-foreground font-medium mb-3 block">I am a...</Label>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  disabled={loading}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer text-sm font-semibold ${
                    role === r.id
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {r.icon}
                  <span>{r.title}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full h-11 rounded-full border-border text-foreground font-medium hover:bg-muted transition-colors mb-5"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>

          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-border" />
            <span className="px-4 text-xs text-muted-foreground uppercase tracking-wider">or email</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" type="text" placeholder="Jane Doe" className="h-11 rounded-xl" value={name} onChange={e => setName(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="name@example.com" className="h-11 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (with country code)</Label>
              <Input id="phone" type="tel" placeholder="+447123456789" className="h-11 rounded-xl" value={phone} onChange={e => setPhone(e.target.value)} disabled={loading} />
              <p className="text-xs text-muted-foreground">Used for 2-factor authentication. E.164 format, e.g. +447123456789.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" className="h-11 rounded-xl" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-medium">Receive code via</Label>
              <div className="grid grid-cols-3 gap-2">
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
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border-2 transition-all text-xs font-semibold ${
                      channel === c.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {c.icon}
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold" disabled={loading}>
              {loading ? 'Sending code…' : 'Send verification code'}
            </Button>
          </form>
        </>
      )}

      {step === 'verify' && (
        <form onSubmit={verifyAndCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="h-12 rounded-xl text-center text-2xl tracking-[0.5em] font-bold"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Sent to <span className="font-semibold text-foreground">{channel === 'email' ? email : phone}</span>
            </p>
          </div>
          <Button type="submit" className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold" disabled={loading}>
            {loading ? 'Verifying…' : 'Verify & Create Account'}
          </Button>
          <button
            type="button"
            onClick={() => { setStep('form'); setCode(''); }}
            disabled={loading}
            className="w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            ← Back to form
          </button>
          <button
            type="button"
            onClick={sendOtp}
            disabled={loading}
            className="w-full text-xs text-primary font-semibold hover:underline"
          >
            Resend code
          </button>
        </form>
      )}

      <p className="text-center mt-6 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-semibold hover:underline">Sign In</Link>
      </p>
    </motion.div>
  );
}
