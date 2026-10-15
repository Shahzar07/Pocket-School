'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { ModerationScreen, type QueueCard } from '@/components/scope-c/market-screens';

export default function ModerationPage() {
  const [items, setItems] = useState<QueueCard[]>([]);
  const load = () => {
    authedFetch('/api/moderation/queue').then((data) => {
      setItems(Array.isArray(data.items) ? data.items as QueueCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };
  useEffect(() => { load(); }, []);

  return (
    <FeatureGate flag="community">
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
