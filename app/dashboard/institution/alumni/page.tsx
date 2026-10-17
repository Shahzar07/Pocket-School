'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GraduationDesk } from '@/components/alumni/graduation-panels';
import { InstitutionNetworkDesk, type NetworkDeskData } from '@/components/alumni/network-panels';
import { InstitutionYearbookDesk } from '@/components/alumni/yearbook-panels';
import { AlumniBoard } from '@/components/alumni/record-panels';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { defaultAlumniPolicy, type AlumniPerson, type AlumniPolicy } from '@/lib/alumni';
import { emptyNetworkStats, SEAT_NOTE, type MessageKind } from '@/lib/alumni-network';
import type { GraduationBillPreview, ReadyGraduate } from '@/lib/graduation';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InstitutionAlumniPage() {
  const institutionId = useAuthSTORE((state) => state.profile?.institutionId ?? '');
  const [schoolName, setSchoolName] = useState('Your academy');
  const [people, setPeople] = useState<AlumniPerson[]>([]);
  const [policy, setPolicy] = useState<AlumniPolicy>(defaultAlumniPolicy());
  const [suggestions, setSuggestions] = useState<ReadyGraduate[]>([]);
  const [preview, setPreview] = useState<GraduationBillPreview | null>(null);
  const [today, setToday] = useState(todayIso());
  const [network, setNetwork] = useState<NetworkDeskData>({
    stats: emptyNetworkStats(),
    campaigns: [],
    groups: [],
    held: [],
    mentors: [],
    seatNote: SEAT_NOTE,
  });

  const load = useCallback(() => {
    if (!institutionId) return;
    authedFetch(`/api/institutions/alumni?institutionId=${institutionId}`)
      .then((data) => {
        if (Array.isArray(data.people)) setPeople(data.people as AlumniPerson[]);
        if (data.policy) setPolicy(data.policy as AlumniPolicy);
        if (typeof data.name === 'string' && data.name) setSchoolName(data.name);
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions as ReadyGraduate[]);
        if (data.network && typeof data.network === 'object') setNetwork(data.network as NetworkDeskData);
        setToday(todayIso());
      })
      .catch(() => toast.error('Could not open the alumni list.'));
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  if (!institutionId) return <p className="p-6 text-sm text-[#1A3C34]">This page opens once your account is tied to an academy.</p>;

  return (
    <div className="space-y-5">
      <a href="/dashboard/institution/destinations" className="inline-flex h-11 items-center rounded-full bg-[#3C8DFF] px-5 text-sm font-semibold text-white">
        Alumni destinations
      </a>
      <GraduationDesk
        suggestions={suggestions}
        preview={preview}
        onPreview={() => {
          void authedFetch('/api/institutions/alumni', {
            method: 'POST',
            body: JSON.stringify({ action: 'preview', institutionId, people: suggestions }),
          })
            .then((data) => {
              const next = data as unknown as GraduationBillPreview & { people?: ReadyGraduate[] };
              setPreview(next);
              if (Array.isArray(next.people)) setSuggestions(next.people);
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not preview graduation.'));
        }}
        onConfirm={() => {
          void authedFetch('/api/institutions/alumni', {
            method: 'POST',
            body: JSON.stringify({ action: 'confirm', institutionId, people: suggestions }),
          })
            .then((data) => {
              toast.success(typeof data.marked === 'number'
                ? `${data.marked} graduated. Seats are free and the bill was reviewed.`
                : 'Graduation confirmed.');
              setPreview(null);
              load();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not confirm graduation.'));
        }}
      />
      <AlumniBoard
        schoolName={schoolName}
        people={people}
        policy={policy}
        today={today}
        onSave={(next) => {
          void authedFetch('/api/institutions/alumni', { method: 'POST', body: JSON.stringify({ action: 'save', institutionId, policy: next }) })
            .then(() => { setPolicy(next); toast.success('Alumni settings saved.'); })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save alumni settings.'));
        }}
        onMark={(email) => {
          void authedFetch('/api/institutions/alumni', { method: 'POST', body: JSON.stringify({ action: 'mark', institutionId, people: [{ email }] }) })
            .then(() => {
              toast.success('The leaver is an alumnus on an individual account. The seat is free and the tier was reviewed.');
              load();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not mark that person.'));
        }}
        onUndo={(alumniId) => {
          void authedFetch('/api/institutions/alumni', { method: 'POST', body: JSON.stringify({ action: 'undo', institutionId, alumniId }) })
            .then(() => {
              toast.success('The seat and academy access are restored.');
              load();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not undo graduation.'));
        }}
        onNewsletter={(note) => {
          void authedFetch('/api/institutions/alumni', { method: 'POST', body: JSON.stringify({ action: 'newsletter', institutionId, note }) })
            .then((data) => toast.success(typeof data.sent === 'number' && data.sent > 0 ? 'The alumni note is on its way.' : 'The note is ready. Email sends when mail is configured and the newsletter is on.'))
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not send the note.'));
        }}
      />
      <InstitutionNetworkDesk
        desk={network}
        onCampaign={(input: { kind: MessageKind; note: string; sendOn: string; filter: Record<string, string> }) => {
          void authedFetch('/api/institutions/alumni', {
            method: 'POST',
            body: JSON.stringify({ action: 'campaign', institutionId, ...input }),
          })
            .then(() => {
              toast.success(input.sendOn ? 'The note is scheduled.' : 'The note is on its way to alumni who consented.');
              load();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not send the note.'));
        }}
        onEvent={(input) => {
          void authedFetch('/api/institutions/alumni', {
            method: 'POST',
            body: JSON.stringify({ action: 'event', institutionId, ...input }),
          })
            .then(() => {
              toast.success('The event is open for RSVPs.');
              load();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not publish the event.'));
        }}
        onModerate={(queueId, release) => {
          void authedFetch('/api/institutions/alumni', {
            method: 'POST',
            body: JSON.stringify({ action: 'moderate-post', institutionId, queueId, release }),
          })
            .then(() => {
              toast.success(release ? 'The post is visible to the class.' : 'The post stays hidden.');
              load();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not moderate that post.'));
        }}
        onApprove={(mentorshipId) => {
          void authedFetch('/api/institutions/alumni', {
            method: 'POST',
            body: JSON.stringify({ action: 'approve-mentor', institutionId, mentorshipId }),
          })
            .then(() => {
              toast.success('The mentorship is approved.');
              load();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not approve that match.'));
        }}
      />
      <InstitutionYearbookDesk institutionId={institutionId} />
    </div>
  );
}
