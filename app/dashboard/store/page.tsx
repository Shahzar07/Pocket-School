'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { StudioFrame } from '@/components/studio/studio-nav';
import Link from 'next/link';
import { StoreScreen, type ResourceCard } from '@/components/scope-c/market-screens';
import { Panel } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { filterResources } from '@/lib/market-filters';

export default function StorePage() {
  const { profile } = useAuthSTORE();
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const load = () => {
    authedFetch('/api/store/resources').then((data) => {
      setResources(Array.isArray(data.resources) ? data.resources as ResourceCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };
  useEffect(() => { load(); }, []);
  const admin = profile?.role === 'admin';
  const visible = filterResources(resources, query, kind);

  return (
    <StudioFrame>
    <FeatureGate flag="creatorStore">
      <Panel className="space-y-2">
        <p className="text-sm text-muted-foreground">The store is creator notes, worksheets, and templates. Courses stay on the marketplace.</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/courses" className="underline">Course marketplace</Link>
          <Link href="/dashboard/tutors" className="underline">People tutors</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title" className="h-10 w-full max-w-sm rounded-xl border border-border px-3 text-sm" />
          <select aria-label="Resource kind" value={kind} onChange={(event) => setKind(event.target.value)} className="h-10 rounded-xl border border-border px-3 text-sm">
            <option value="all">All kinds</option>
            <option value="note">Note</option>
            <option value="worksheet">Worksheet</option>
            <option value="template">Template</option>
          </select>
        </div>
      </Panel>
      <StoreScreen
        resources={visible}
        onCreate={(title, body, kind, audiences) => {
          authedFetch('/api/store/resources', { method: 'POST', body: JSON.stringify({ title, body, kind, priceCents: 0, audiences }) })
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
        onAllocate={admin ? (id, studentId) => {
          authedFetch('/api/store/allocate', { method: 'POST', body: JSON.stringify({ resourceId: id, studentId }) })
            .then(() => toast.success('Resource allocated.'))
            .catch((error: Error) => toast.error(error.message));
        } : undefined}
      />
    </FeatureGate>
    </StudioFrame>
  );
}
