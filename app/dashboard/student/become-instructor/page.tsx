'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { updateUser } from '@/lib/db';
import { instructorOnboarding, writeActiveMode } from '@/lib/account-modes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function BecomeInstructorPage() {
  const router = useRouter();
  const { user, profile, fetchProfile } = useAuthSTORE();
  const [headline, setHeadline] = useState('');
  const [subject, setSubject] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user || !profile) return;
    const patch = instructorOnboarding(profile, { headline, subject, acceptedReview: accepted });
    if (!patch) {
      toast.error('Add a headline, a subject, and confirm that marketplace courses stay in review.');
      return;
    }
    setSaving(true);
    try {
      await updateUser(user.uid, { instructor: patch.instructor });
      await updateUser(user.uid, { roles: patch.roles });
      writeActiveMode('teacher');
      await fetchProfile(user.uid);
      toast.success('Teaching is on. Marketplace courses still wait for review.');
      router.push('/dashboard/teacher');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not turn on teaching.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-12" data-become-flow>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Teaching</p>
      <h1 className="font-heading text-4xl text-foreground">Become an instructor</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This adds teaching to the same login. Your courses, progress, certificates, and Sparks stay in Learning.
        Marketplace publishing stays in review until Poket School publishes the course.
      </p>
      <div className="space-y-4 rounded-3xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" value={headline} onChange={event => setHeadline(event.target.value)} placeholder="e.g. Lower Secondary science" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={event => setSubject(event.target.value)} placeholder="Biology" />
        </div>
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1"
            checked={accepted}
            data-marketplace-gate
            onChange={event => setAccepted(event.target.checked)}
          />
          <span>I understand a marketplace course stays in review until Poket School publishes it. This step does not list a course for sale.</span>
        </label>
        <Button type="button" className="rounded-full" disabled={saving} onClick={() => void submit()}>
          {saving ? 'Saving…' : 'Become an instructor'}
        </Button>
      </div>
    </div>
  );
}
