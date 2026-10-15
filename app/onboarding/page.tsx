'use client';

import { useEffect, useState } from 'react';
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
import { linkChildToParent, enrollInProgrammeModules, getUser, updateUser, UserProfile } from '@/lib/db';
import { authedFetch } from '@/lib/api-client';
import { levelForYear } from '@/lib/year-groups';
import { PROGRAMMES, yearsForProgramme } from '@/lib/programmes';
import { Timestamp } from 'firebase/firestore';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, fetchProfile } = useAuthSTORE();
  const [step, setStep] = useState(1);
  const [pathway, setPathway] = useState(PROGRAMMES[0]?.value ?? 'Primary');
  const [yearGroup, setYearGroup] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [studentIdField, setStudentIdField] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const pending = (profile as (UserProfile & { pendingChildEmail?: string; pathway?: string }) | null)?.pendingChildEmail;
    if (pending) setChildEmail(pending);
    const storedPathway = (profile as (UserProfile & { pathway?: string }) | null)?.pathway;
    if (storedPathway && PROGRAMMES.some((programme) => programme.value === storedPathway)) {
      setPathway(storedPathway);
    }
    if (profile?.yearGroup) setYearGroup(profile.yearGroup);
  }, [profile]);

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

  const placementYears = yearsForProgramme(pathway);
  const isYearGroup = placementYears.includes(yearGroup);

  const completeStudentOnboarding = async () => {
    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', user.uid), {
        level: pathway || levelForYear(yearGroup) || null,
        pathway,
        learningStyle: learningStyle || null,
        ...(isYearGroup ? { yearGroup } : { yearGroup: null }),
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
        }
        // Every student gets the welcome grant. This used to sit inside the
        // year-group branch, so anyone on GCSE, A-Level or any other pathway
        // started with a zero balance and could not open a single paid format.
        await authedFetch('/api/platform/sparks-welcome', { method: 'POST', body: '{}' });
        const onboardedStamp: Partial<UserProfile> & { onboardedAt: Timestamp } = { onboardedAt: Timestamp.now() };
        await updateUser(user.uid, onboardedStamp);
      }
      await fetchProfile(user.uid);
      toast.success('Welcome to Poket School! 🎉');
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
      const result = await linkChildToParent(user.uid, childEmail.trim().toLowerCase(), profile.name ?? 'A parent');
      toast.success(result.message);
      setChildEmail('');
    } catch {
      toast.error('Could not link account — please try again');
    } finally {
      setLinkLoading(false);
    }
  };

  const completeParentOnboarding = () => {
    toast.success('Welcome to Poket School!');
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
            <p className="text-muted-foreground mt-2 text-base">Link your child's Poket School account to monitor their progress.</p>
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
            <Button onClick={handleLinkChild} disabled={linkLoading} className="rounded-xl h-11 px-5">
              {linkLoading ? 'Sending…' : 'Ask my child to approve'}
            </Button>
            <p className="text-xs text-muted-foreground">Your child approves the link from their own dashboard. Their name stays hidden until they say yes.</p>
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
                <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Which programme are you in?</h1>
                <p className="text-muted-foreground mt-2 text-base">We&apos;ll match lessons, quizzes and ET to that programme.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PROGRAMMES.map(programme => (
                  <button
                    key={programme.value}
                    onClick={() => {
                      setPathway(programme.value);
                      const years = yearsForProgramme(programme.value);
                      setYearGroup(years.includes(yearGroup) ? yearGroup : (years[0] ?? ''));
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all text-left font-semibold ${
                      pathway === programme.value
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {programme.label}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <Button
                  size="lg"
                  className="rounded-full px-8 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                  disabled={!pathway}
                  onClick={() => setStep(yearsForProgramme(pathway).length > 0 ? 2 : 3)}
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
                <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Which year are you in?</h1>
                <p className="text-muted-foreground mt-2 text-base">This places you in the right lessons for {pathway}. It stays on your profile.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {placementYears.map(year => (
                  <button
                    key={year}
                    onClick={() => setYearGroup(year)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all text-left font-semibold ${
                      yearGroup === year
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" className="h-11 rounded-full px-6" onClick={() => setStep(1)}>Back</Button>
                <Button size="lg" className="rounded-full px-8 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white" disabled={!yearGroup} onClick={() => setStep(3)}>
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
                <Button variant="ghost" className="h-11 rounded-full px-6" onClick={() => setStep(placementYears.length > 0 ? 2 : 1)}>Back</Button>
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
