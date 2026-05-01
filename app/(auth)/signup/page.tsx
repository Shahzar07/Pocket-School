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
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { GraduationCap, Presentation, ShieldCheck, Users } from 'lucide-react';

const ROLES = [
  { id: 'student', title: 'Student', icon: <GraduationCap className="w-5 h-5" /> },
  { id: 'teacher', title: 'Teacher', icon: <Presentation className="w-5 h-5" /> },
  { id: 'parent', title: 'Parent', icon: <Users className="w-5 h-5" /> },
];

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);

  const routeUser = async (uid: string) => {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      router.push('/onboarding');
      return;
    }
    const data = snap.data();
    switch (data.role) {
      case 'student': router.push('/dashboard/student'); break;
      case 'teacher': router.push('/dashboard/teacher'); break;
      case 'parent': router.push('/dashboard/parent'); break;
      case 'admin': router.push('/dashboard/admin'); break;
      default: router.push('/onboarding');
    }
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
          role: role,
          xp: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await routeUser(result.user.uid);
    } catch (e: any) {
      console.error(e);
      const errorMessage = e?.message || e?.toString() || '';
      if (e?.code === 'auth/popup-closed-by-user' || errorMessage.includes('The user aborted a request') || e?.code === 'auth/cancelled-popup-request') {
        return;
      }
      toast.error(errorMessage || "Failed to sign up via Google");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      const docRef = doc(db, 'users', result.user.uid);
      await setDoc(docRef, {
        email: result.user.email,
        name: name,
        avatarUrl: '',
        role: role,
        xp: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // If student, go to onboarding to pick level/learning style, else dashboard
      if (role === 'student') {
         router.push('/onboarding');
      } else {
         await routeUser(result.user.uid);
      }
    } catch (e: any) {
      console.error(e);
      if (e?.code === 'auth/operation-not-allowed') {
        toast.error("Please enable Email/Password authentication in your Firebase Console (Authentication > Sign-in method).");
      } else if (e?.code === 'auth/invalid-email') {
        toast.error("Invalid email address format.");
      } else {
        toast.error(e.message || "Failed to create account");
      }
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
        <h2 className="text-3xl font-bold text-[#202124] mb-3">Create an account</h2>
        <p className="text-[#5F6368]">Join Pocket School to start your journey.</p>
      </div>

      <div className="mb-6">
        <Label className="text-[#202124] font-medium mb-3 block">I am a...</Label>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map(r => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              disabled={loading}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                role === r.id 
                  ? 'border-google-blue bg-[#E8F0FE] text-google-blue font-bold shadow-sm' 
                  : 'border-[#DADCE0] bg-white text-[#5F6368] font-medium focus:outline-none hover:bg-[#F8F9FA]'
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
        className="w-full h-12 rounded-full border-[#DADCE0] text-[#5F6368] font-medium hover:bg-[#F8F9FA] transition-colors mb-6" 
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-3" />
        Sign up with Google
      </Button>

      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-[#DADCE0]"></div>
        <span className="px-4 text-sm text-[#5F6368] font-medium uppercase tracking-wider">or register with email</span>
        <div className="flex-1 border-t border-[#DADCE0]"></div>
      </div>

      <form onSubmit={handleEmailSignUp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[#202124] font-medium">Full Name</Label>
          <Input 
            id="name" 
            type="text" 
            placeholder="John Doe" 
            className="h-12 rounded-xl border-[#DADCE0] focus:ring-google-blue focus:border-google-blue transition-all" 
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[#202124] font-medium">Email address</Label>
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
          <Label htmlFor="password" className="text-[#202124] font-medium">Password</Label>
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
          className="w-full h-12 mt-2 rounded-full bg-google-blue hover:bg-[#1967D2] text-white font-medium text-base shadow-google-soft hover:shadow-google-hover transition-all" 
          disabled={loading}
        >
          Create Account
        </Button>
      </form>

      <p className="text-center mt-8 text-[#5F6368]">
        Already have an account?{' '}
        <Link href="/login" className="text-google-blue font-bold hover:underline">
          Sign In
        </Link>
      </p>
    </motion.div>
  );
}
