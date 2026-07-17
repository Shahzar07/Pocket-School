'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Search, Sparkles, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { getUserByEmail, setUserSubscription, UserProfile } from '@/lib/db';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function AdminAccessConfig() {
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<{ id: string; data: UserProfile } | null>(null);
  const [searched, setSearched] = useState(false);
  const [updatingTier, setUpdatingTier] = useState(false);

  const handleSearch = async () => {
    const email = searchEmail.trim();
    if (!email) return;
    setSearching(true);
    setSearched(false);
    try {
      const result = await getUserByEmail(email);
      setFoundUser(result);
      setSearched(true);
      if (!result) toast.error('No user found with that email');
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSetTier = async (tier: 'free' | 'academic') => {
    if (!foundUser) return;
    setUpdatingTier(true);
    try {
      await setUserSubscription(foundUser.id, tier);
      const refreshed = await getUserByEmail(foundUser.data.email);
      setFoundUser(refreshed);
      toast.success(
        tier === 'academic'
          ? 'Academic subscription activated — +400 Sparks granted'
          : 'Subscription set to Free'
      );
    } catch {
      toast.error('Failed to update subscription');
    } finally {
      setUpdatingTier(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0} className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600 flex items-center gap-2">
          <span className="w-5 h-px bg-violet-600 inline-block" /> Security & access
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
          Access <span className="gradient-text italic">configuration</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">Manage role-based access control and security policies.</p>
      </motion.header>

      {/* Role capabilities overview */}
      <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={1}>
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 relative overflow-hidden card-glow">
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-violet-500 opacity-80" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-heading text-xl text-foreground">Role Permissions</h2>
              <p className="text-sm text-muted-foreground">Enforced by Firestore security rules on every read and write.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: 'Super Admin', color: 'text-violet-600', items: ['Full curriculum CMS & Content Builder', 'Approve / publish all content', 'Manage users, tiers & Sparks', 'Institutions & allocations'] },
              { role: 'Teacher', color: 'text-blue-600', items: ['Create & upload courses', 'Grade submissions & exams', 'Attendance, behaviour, billing', 'Live classes & report cards'] },
              { role: 'Student', color: 'text-emerald-600', items: ['Enrol & learn', 'Take quizzes, exams, assignments', 'Earn & spend Sparks', 'AI Studio & AI tutor'] },
              { role: 'Parent', color: 'text-amber-600', items: ['View linked children', 'Progress & report cards', 'Due dates & reminders', 'Message teachers'] },
            ].map(r => (
              <div key={r.role} className="rounded-2xl border border-border bg-muted/20 p-4">
                <p className={`text-sm font-bold mb-2 ${r.color}`}>{r.role}</p>
                <ul className="space-y-1.5">
                  {r.items.map(item => (
                    <li key={item} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-current mt-1.5 shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Authentication uses Firebase Auth (email + password with optional email 2FA, and Google sign-in). Security rules live in <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">firestore.rules</code> and are deployed via the Firebase console.
          </p>
        </div>
      </motion.section>

      {/* Subscription & Sparks */}
      <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={5}>
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600">User management</p>
          <h2 className="font-heading text-3xl text-foreground mt-1.5">Subscription & Sparks</h2>
        </div>
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 relative overflow-hidden card-glow">
          <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-amber-500 opacity-80" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-heading text-xl text-foreground">Manage Subscriptions</p>
              <p className="text-sm text-muted-foreground">Look up a user by email and manage their Academic tier.</p>
            </div>
          </div>

          <div className="flex gap-2 mb-5 max-w-md">
            <Input
              type="email"
              placeholder="student@example.com"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="rounded-xl h-11 bg-muted/50"
            />
            <Button onClick={handleSearch} disabled={searching || !searchEmail.trim()} className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white shrink-0">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {foundUser && (
            <div className="rounded-2xl border border-border bg-muted/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-foreground">{foundUser.data.name}</p>
                  <Badge variant="outline" className="capitalize rounded-full text-[10px]">{foundUser.data.role}</Badge>
                  {foundUser.data.yearGroup && (
                    <Badge variant="outline" className="gap-1 rounded-full text-[10px]"><GraduationCap className="w-3 h-3" />{foundUser.data.yearGroup}</Badge>
                  )}
                  <Badge className={`rounded-full text-[10px] ${foundUser.data.subscriptionTier === 'academic' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-muted text-muted-foreground'}`}>
                    {foundUser.data.subscriptionTier === 'academic' ? 'Academic' : 'Free'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{foundUser.data.email}</p>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {foundUser.data.sparksBalance ?? 0} Sparks
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={updatingTier || foundUser.data.subscriptionTier !== 'academic'}
                  onClick={() => handleSetTier('free')}
                  className="rounded-full h-10 px-4 font-semibold"
                >
                  Set to Free
                </Button>
                <Button
                  disabled={updatingTier || foundUser.data.subscriptionTier === 'academic'}
                  onClick={() => handleSetTier('academic')}
                  className="rounded-full h-10 px-4 font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                >
                  {updatingTier ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Grant Academic (+400 Sparks)
                </Button>
              </div>
            </div>
          )}

          {searched && !foundUser && (
            <p className="text-sm text-muted-foreground">No user found with that email address.</p>
          )}
        </div>
      </motion.section>
    </div>
  );
}
