'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { StoreScreen, type ResourceCard } from '@/components/scope-c/market-screens';
import { useAuthSTORE } from '@/hooks/use-auth';

export default function StorePage() {
  const { profile } = useAuthSTORE();
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const load = () => {
    authedFetch('/api/store/resources').then((data) => {
      setResources(Array.isArray(data.resources) ? data.resources as ResourceCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };
  useEffect(() => { load(); }, []);
  const admin = profile?.role === 'admin';

  return (
    <FeatureGate flag="creatorStore">
      <StoreScreen
        resources={resources}
        onCreate={(title, body, kind) => {
          authedFetch('/api/store/resources', { method: 'POST', body: JSON.stringify({ title, body, kind, priceCents: 0 }) })
            .then(() => { toast.success('Draft saved.'); load(); })
            .catch((error: Error) => toast.error(error.message));
        }}
        onSubmit={(id) => {
          authedFetch('/api/store/submit', { method: 'POST', body: JSON.stringify({ resourceId: id }) })
            .then(() => { toast.success('Sent for approval.'); load(); })
            .catch((error: Error) => toast.error(error.message));
        }}
        onApprove={admin ? (id) => {
          authedFetch('/api/store/moderate', { method: 'POST', body: JSON.stringify({ resourceId: id, approve: true }) })
            .then(() => load())
            .catch((error: Error) => toast.error(error.message));
        } : undefined}
      />
    </FeatureGate>
  );
}
