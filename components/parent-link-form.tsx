'use client';

import { useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { linkChildToParent } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function ParentLinkForm() {
  const { user, profile } = useAuthSTORE();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  if (profile?.role !== 'parent') return null;
  return (
    <form
      className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!user || !email.trim()) return;
        setBusy(true);
        try {
          const result = await linkChildToParent(user.uid, email.trim());
          if (!result.success) {
            toast.error(result.error ?? 'Could not send that request.');
            return;
          }
          toast.success(result.childName ? `Asked ${result.childName} to approve the link.` : 'Request sent.');
          setEmail('');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not send that request.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your child's email"
        className="h-11 rounded-xl"
      />
      <Button type="submit" disabled={busy} className="rounded-xl h-11">Ask them to approve</Button>
    </form>
  );
}
