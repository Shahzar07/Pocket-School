'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Brain, GraduationCap, Users } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthSTORE } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { linkChildToParent, createParentVerification, enrollInProgrammeModules, awardSparks, getUser, updateUser, UserProfile } from '@/lib/db';
import { SIGNUP_GRANT } from '@/lib/sparks';
import { Timestamp } from 'firebase/firestore';

const YEAR_GROUPS = ['Year 7', 'Year 8', 'Year 9'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [step, setStep] = useState(1);
  const [yearGroup, setYearGroup] = useState('');
  const [level, setLevel] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [studentIdField, setStudentIdField] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || !profile) {
    if (typeof window !== 'undefined') router.push('/login');
    return null;
  }

  const isParent = profile.role === 'parent';
  const isStudent = profile.role === 'student';

  if (!isStudent && !isParent) {
    if (typeof window !== 'undefined') router.push(`/dashboard/${profile.role}`);
    return null;
  }

  const isYearGroup = (YEAR_GROUPS as readonly string[]).includes(yearGroup);

  const completeStudentOnboarding = async () => {
    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', user.uid), {
        level: level || null,
        learningStyle: learningStyle || null,
        ...(isYearGroup ? { yearGroup } : {}),
        updatedAt: serverTimestamp(),
      });
      // The welcome Sparks grant and module enrolment are one-time only:
      // guard on the user doc's onboardedAt so re-running onboarding can't
      // farm the signup grant.
      const freshProfile = await getUser(user.uid);
      const alreadyOnboarded = !!(freshProfile as (UserProfile & { onboardedAt?: unknown }) | null)?.onboardedAt;
      if (!alreadyOnboarded) {
        if (isYearGroup) {
          await enrollInProgrammeModules(user.uid, yearGroup);
          await awardSparks(user.uid, SIGNUP_GRANT, 'admin_grant', 'Welcome bonus');
        }
        const onboardedStamp: Partial<UserProfile> & { onboardedAt: Timestamp } = { onboardedAt: Timestamp.now() };
        await updateUser(user.uid, onboardedStamp);
      }
      toast.success('Welcome to Pocket School! 🎉');
      router.push('/dashboard/student');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkChild = async () => {
    if (!childEmail.trim()) { toast.error("Enter your child's email address"); return; }
    setLinkLoading(true);
    try {
      const result = await linkChildToParent(user.uid, childEmail.trim().toLowerCase());
      if (result.success) {
        // Also create a verification request for admin approval
        try {
          await createParentVerification({
            parentId: user.uid,
            parentName: profile.name ?? 'Parent',
            parentEmail: user.email ?? '',
            studentEmail: childEmail.trim().toLowerCase(),
            studentId: studentIdField.trim(),
            status: 'pending',
            createdAt: Timestamp.now(),
          });
          toast.success(`Linked to ${result.childName}'s account! Verification request sent.`);
          setChildEmail('');
          setStudentIdField('');
        } catch {
          toast.error('Verification request could not be submitted — please try again');
        }
      } else {
        toast.error(result.error || 'Could not link account');
      }
    } catch {
      toast.error('Could not link account — please try again');
    } finally {
      setLinkLoading(false);
    }
  };

  const completeParentOnboarding = () => {
    toast.success('Welcome to Pocket School!');
    router.push('/dashboard/parent');
  };

  // ── Parent onboarding ──────────────────────────────────────
  if (isParent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Welcome, {profile.name}!</h1>
            <p className="text-muted-foreground mt-2 text-base">Link your child's Pocket School account to monitor their progress.</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 mb-4">
            <Label className="font-semibold text-foreground">Child's email address</Label>
            <Input
              type="email"
              placeholder="child@example.com"
              value={childEmail}
              onChange={e => setChildEmail(e.target.value)}
              className="h-11 rounded-xl"
              disabled={linkLoading}
            />
            <Label className="font-semibold text-foreground">Child's Student ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g. STU-2024-001"
                value={studentIdField}
                onChange={e => setStudentIdField(e.target.value)}
                className="h-11 rounded-xl flex-1"
                disabled={linkLoading}
                onKeyDown={e => e.key === 'Enter' && handleLinkChild()}
              />
              <Button onClick={handleLinkChild} disabled={linkLoading} className="rounded-xl h-11 px-5">
                {linkLoading ? '…' : 'Link'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Your child must already have a student account. You can link multiple children. A verification request will be sent to the admin.</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-full h-11"
              onClick={completeParentOnboarding}
            >
              Skip for now
            </Button>
            <Button
              className="flex-1 rounded-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              onClick={completeParentOnboarding}
            >
              Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Student onboarding ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${s <= step ? 'bg-primary w-16' : 'bg-muted w-8'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="text-center mb-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Which year are you in?</h1>
                <p className="text-muted-foreground mt-2 text-base">We'll set up your curriculum modules and unit quizzes for the right year group.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...YEAR_GROUPS, 'Something else'].map(yg => (
                  <button
                    key={yg}
                    onClick={() => setYearGroup(yg === 'Something else' ? 'other' : yg)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all text-left font-semibold ${
                      yearGroup === (yg === 'Something else' ? 'other' : yg)
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {yg}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <Button
                  size="lg"
                  className="rounded-full px-8 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                  disabled={!yearGroup}
                  onClick={() => setStep(yearGroup === 'other' ? 2 : 3)}
                >
                  Continue <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="text-center mb-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Your education level?</h1>
                <p className="text-muted-foreground mt-2 text-base">We use this to tailor AI explanations and study materials to your level.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['K1–K5', 'Middle School (6–8)', 'High School (9–12)', 'Undergraduate', 'Postgraduate', 'Professional'].map(l => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all text-left font-semibold ${
                      level === l
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" className="h-11 rounded-full px-6" onClick={() => setStep(1)}>Back</Button>
                <Button size="lg" className="rounded-full px-8 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white" disabled={!level} onClick={() => setStep(3)}>
                  Continue <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="text-center mb-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">How do you learn best?</h1>
                <p className="text-muted-foreground mt-2 text-base">We'll prioritise the formats that suit your style — you can always change this later.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'visual', label: 'Visual', desc: 'Mind maps, infographics, slides', emoji: '👁️' },
                  { id: 'auditory', label: 'Auditory', desc: 'Podcasts, audio summaries, discussions', emoji: '🎧' },
                  { id: 'reading', label: 'Reading / Writing', desc: 'Detailed notes, text summaries, glossaries', emoji: '📖' },
                  { id: 'kinesthetic', label: 'Kinesthetic', desc: 'Flashcards, quizzes, practice problems', emoji: '✋' },
                ].map(ls => (
                  <button
                    key={ls.id}
                    onClick={() => setLearningStyle(ls.id)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all text-left ${
                      learningStyle === ls.id
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="text-2xl mb-2">{ls.emoji}</div>
                    <div className="font-bold text-foreground">{ls.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{ls.desc}</div>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" className="h-11 rounded-full px-6" onClick={() => setStep(yearGroup === 'other' ? 2 : 1)}>Back</Button>
                <Button
                  size="lg"
                  className="rounded-full px-8 h-12 bg-gradient-to-r from-teal-500 to-emerald-600 text-white"
                  disabled={!learningStyle || loading}
                  onClick={completeStudentOnboarding}
                >
                  {loading ? 'Setting up…' : 'Start Learning'} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
