'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DashPage } from '@/components/dash-ui';
import { JoinVerificationSettings } from '@/components/institutions/join-settings';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { getInstitution } from '@/lib/db';
import { defaultJoinConfig, type JoinConfig, type RosterEntry } from '@/lib/institution-join';

export default function InstitutionJoinSettingsPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('Academy');
  const [initial, setInitial] = useState<JoinConfig>(defaultJoinConfig());
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;
    void (async () => {
      const academy = await getInstitution(institutionId).catch(() => null);
      if (cancelled) return;
      setName(academy?.name || 'Academy');
      setSlug(academy?.subdomain || '');
      try {
        const data = await authedFetch(`/api/institutions/join?institutionId=${institutionId}`);
        const config = data.config as JoinConfig | undefined;
        if (config) setInitial(config);
        if (Array.isArray(data.rows)) setRoster(data.rows as RosterEntry[]);
      } catch {
        toast.message('Join rules will save when the server account is connected.');
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [institutionId]);

  if (!institutionId) {
    return <DashPage><p className="text-sm text-muted-foreground">This account is not attached to an academy yet.</p></DashPage>;
  }
  if (!ready) return <DashPage><p className="text-sm text-muted-foreground">Loading join settings…</p></DashPage>;

  return (
    <DashPage>
      <JoinVerificationSettings
        institutionName={name}
        slug={slug || 'academy'}
        initial={initial}
        roster={roster}
        onSave={async (config) => {
          try {
            await authedFetch('/api/institutions/join', { method: 'POST', body: JSON.stringify({ action: 'save', institutionId, config }) });
            toast.success('Join rules saved.');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save join rules.');
          }
        }}
        onRoster={async (csv) => {
          try {
            const data = await authedFetch('/api/institutions/join', { method: 'POST', body: JSON.stringify({ action: 'roster', institutionId, slug, csv }) });
            if (Array.isArray(data.rows)) setRoster(data.rows as RosterEntry[]);
            const claims = Array.isArray(data.claims) ? data.claims.length : 0;
            toast.success(`${claims} claim messages are ready. Email sends when mail is configured.`);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not send claim links.');
          }
        }}
        onRollover={async () => {
          try {
            await authedFetch('/api/institutions/join', { method: 'POST', body: JSON.stringify({ action: 'rollover', institutionId }) });
            toast.success('Each class moved to the next level name.');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not move the classes.');
          }
        }}
        onBulk={async (studentIds, level, className) => {
          try {
            await authedFetch('/api/institutions/join', { method: 'POST', body: JSON.stringify({ action: 'bulkMove', institutionId, studentIds, level, className }) });
            toast.success('Those students moved.');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not move those students.');
          }
        }}
        onOffboard={async (studentIds) => {
          try {
            await authedFetch('/api/institutions/join', { method: 'POST', body: JSON.stringify({ action: 'offboard', institutionId, studentIds }) });
            toast.success('Academy access ended. Progress stays with each person.');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not offboard those people.');
          }
        }}
      />
    </DashPage>
  );
}
