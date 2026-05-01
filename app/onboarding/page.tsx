'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthSTORE } from '@/hooks/use-auth';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [step, setStep] = useState(2); // Start at level choice instead of role since role is chosen at signup
  const [level, setLevel] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [loading, setLoading] = useState(false);

  // If not authenticated, redirect to login
  if (!user || !profile) {
    if (typeof window !== 'undefined') router.push('/login');
    return null;
  }

  // Only students do the detailed onboarding
  if (profile?.role !== 'student') {
    if (typeof window !== 'undefined') router.push(`/dashboard/${profile.role}`);
    return null;
  }

  const completeOnboarding = async () => {
    try {
      setLoading(true);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        level: level || null,
        learningStyle: learningStyle || null,
        updatedAt: serverTimestamp(),
      });
      toast.success("Welcome aboard!");
      router.push(`/dashboard/student`);
    } catch (e: any) {
      toast.error("Failed to save profile");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <AnimatePresence mode="wait">
          {step === 2 && (
             <motion.div key="step2" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>
               <div className="text-center mb-10">
                 <h1 className="text-4xl font-extrabold text-[#202124] tracking-tight">Your education level?</h1>
                 <p className="text-[#5F6368] mt-3 text-lg">We use this to tailor the AI tutor's language and suggestions.</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {['K1-K5', 'Middle School (6-8)', 'High School (9-12)', 'Undergraduate', 'Postgraduate', 'Professional'].map(l => (
                   <div 
                     key={l}
                     className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${level === l ? 'border-google-teal bg-[#E0F2F1] text-google-teal shadow-sm' : 'border-[#DADCE0] hover:bg-[#F8F9FA] text-[#202124]'}`}
                     onClick={() => setLevel(l)}
                   >
                     <span className="font-bold text-lg">{l}</span>
                   </div>
                 ))}
               </div>
               <div className="mt-10 flex justify-end">
                 <Button size="lg" className="rounded-full px-8 h-12 bg-google-blue hover:bg-[#1967D2] shadow-google-hover text-white font-medium" disabled={!level} onClick={() => setStep(3)}>
                   Continue <ArrowRight className="ml-2 w-5 h-5" />
                 </Button>
               </div>
             </motion.div>
          )}

          {step === 3 && (
             <motion.div key="step3" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>
               <div className="text-center mb-10">
                 <h1 className="text-4xl font-extrabold text-[#202124] tracking-tight">How do you learn best?</h1>
                 <p className="text-[#5F6368] mt-3 text-lg">Pick your primary learning style so we can recommend the best formats.</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[
                   {id: 'visual', label: 'Visual (Images, Mind Maps)'},
                   {id: 'auditory', label: 'Auditory (Podcasts, Discussions)'},
                   {id: 'reading', label: 'Reading/Writing (Notes, Text)'},
                   {id: 'kinesthetic', label: 'Kinesthetic (Interactive, Flashcards)'}
                 ].map(ls => (
                   <div 
                     key={ls.id}
                     className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${learningStyle === ls.id ? 'border-google-amber bg-[#FFF8E1] text-[#F57F17] shadow-sm' : 'border-[#DADCE0] hover:bg-[#F8F9FA] text-[#202124]'}`}
                     onClick={() => setLearningStyle(ls.id)}
                   >
                     <span className="font-bold text-lg">{ls.label}</span>
                   </div>
                 ))}
               </div>
               <div className="mt-10 flex justify-between">
                 <Button variant="ghost" className="h-12 rounded-full px-6 font-medium text-[#5F6368]" onClick={() => setStep(2)}>Back</Button>
                 <Button size="lg" className="rounded-full px-8 h-12 bg-google-blue hover:bg-[#1967D2] shadow-google-hover text-white font-medium" disabled={!learningStyle || loading} onClick={completeOnboarding}>
                   Finish Setup <ArrowRight className="ml-2 w-5 h-5" />
                 </Button>
               </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
