'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { ModerationScreen, type QueueCard } from '@/components/scope-c/market-screens';
import { Panel } from '@/components/dash-ui';
import { moderationPrompt } from '@/lib/report-links';

export default function ModerationPage() {
  const [items, setItems] = useState<QueueCard[]>([]);
  const [picked, setPicked] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => {
    authedFetch('/api/moderation/queue').then((data) => {
      setItems(Array.isArray(data.items) ? data.items as QueueCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };
  useEffect(() => { load(); }, []);

  const draft = async () => {
    const item = items.find((row) => row.id === picked) ?? items[0];
    if (!item) return;
    setBusy(true);
    try {
      const data = await authedFetch('/api/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({ message: moderationPrompt(item.text || '', item.surface || 'community'), mode: 'college' }),
      });
      setNote(typeof data.reply === 'string' ? data.reply : '');
      setPicked(item.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ET AI could not draft a note.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FeatureGate flag="community">
      <Panel className="space-y-3">
        <h2 className="text-[15px] font-semibold">ET AI note</h2>
        <p className="text-sm text-muted-foreground">ET AI drafts a note. You still allow or reject the item.</p>
        <select aria-label="Item to review" value={picked} onChange={(event) => setPicked(event.target.value)} className="h-10 rounded-xl border border-border px-3 text-sm">
          <option value="">First item in the queue</option>
          {items.map((item) => <option key={item.id} value={item.id}>{item.text || item.id}</option>)}
        </select>
        <button type="button" className="h-10 px-4 rounded-full bg-foreground text-background text-sm font-bold" disabled={busy || items.length === 0} onClick={() => void draft()}>
          {busy ? 'Drafting…' : 'Draft a note'}
        </button>
        <textarea aria-label="Moderation note" value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="w-full rounded-xl border border-border p-3 text-sm" placeholder="The note stays here until you confirm it." />
      </Panel>
      <ModerationScreen
        items={items}
        onResolve={(id, approve) => {
          authedFetch('/api/moderation/resolve', { method: 'POST', body: JSON.stringify({ itemId: id, approve }) })
            .then(() => load())
            .catch((error: Error) => toast.error(error.message));
        }}
      />
    </FeatureGate>
  );
}
