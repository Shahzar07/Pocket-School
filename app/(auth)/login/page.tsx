'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  const writeAdminProfile = async (uid: string) => {
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

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
        await writeAdminProfile(result.user.uid);
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
      const isSuperAdmin = email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;

      if (isSuperAdmin) {
        try {
          const result = await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, password);
          await writeAdminProfile(result.user.uid);
          await routeUser(result.user.uid);
          return;
        } catch (signInErr: any) {
          const code = signInErr?.code ?? '';
          if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
            try {
              const result = await createUserWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, password);
              await writeAdminProfile(result.user.uid);
              await routeUser(result.user.uid);
              return;
            } catch (createErr: any) {
              if (createErr?.code === 'auth/email-already-in-use') {
                toast.error(
                  'This email is registered as a Google account in Firebase. Delete it first: Firebase Console → Authentication → Users → harry.seggu@gmail.com → Delete. Then log in again.',
                  { duration: 12000 }
                );
                return;
              }
              toast.error('Failed to create admin account. Please try again.');
              return;
            }
          }
          if (code === 'auth/wrong-password') { toast.error('Incorrect password.'); return; }
          toast.error(signInErr?.message || 'Admin sign-in failed. Please try again.');
          return;
        }
      }

      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await routeUser(result.user.uid);
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/invalid-email') toast.error('Invalid email address.');
      else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') toast.error('Incorrect email or password.');
      else if (code === 'auth/operation-not-allowed') toast.error('Email/password sign-in is not enabled in Firebase.');
      else toast.error('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-bold text-[#202124] mb-3">Welcome back</h2>
        <p className="text-[#5F6368]">Enter your details below to access your account.</p>
      </div>

      <Button
        variant="outline"
        className="w-full h-12 rounded-full border-[#DADCE0] text-[#5F6368] font-medium hover:bg-[#F8F9FA] transition-colors mb-6"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-3" />
        Continue with Google
      </Button>

      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-[#DADCE0]" />
        <span className="px-4 text-sm text-[#5F6368] font-medium uppercase tracking-wider">or sign in with email</span>
        <div className="flex-1 border-t border-[#DADCE0]" />
      </div>

      <form onSubmit={handleEmailSignIn} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[#202124] font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            className="h-12 rounded-xl border-[#DADCE0] focus:ring-google-blue focus:border-google-blue transition-all"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="password" className="text-[#202124] font-medium">Password</Label>
            <Link href="/forgot-password" className="text-sm font-medium text-google-blue hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="h-12 rounded-xl border-[#DADCE0] focus:ring-google-blue focus:border-google-blue transition-all"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          className="w-full h-12 rounded-full bg-google-blue hover:bg-[#1967D2] text-white font-medium text-base shadow-google-soft hover:shadow-google-hover transition-all"
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <p className="text-center mt-8 text-[#5F6368]">
        Don't have an account?{' '}
        <Link href="/signup" className="text-google-blue font-bold hover:underline">
          Create one now
        </Link>
      </p>
    </motion.div>
  );
}
