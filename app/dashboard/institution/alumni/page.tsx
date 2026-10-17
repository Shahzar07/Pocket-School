'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlumniBoard } from '@/components/alumni/record-panels';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { defaultAlumniPolicy, type AlumniPerson, type AlumniPolicy } from '@/lib/alumni';

export default function InstitutionAlumniPage() {
  const institutionId = useAuthSTORE((state) => state.profile?.institutionId ?? '');
  const [schoolName, setSchoolName] = useState('Your academy');
  const [people, setPeople] = useState<AlumniPerson[]>([]);
  const [policy, setPolicy] = useState<AlumniPolicy>(defaultAlumniPolicy());

  useEffect(() => {
    if (!institutionId) return;
    authedFetch(`/api/institutions/alumni?institutionId=${institutionId}`)
      .then((data) => {
        if (Array.isArray(data.people)) setPeople(data.people as AlumniPerson[]);
        if (data.policy) setPolicy(data.policy as AlumniPolicy);
        if (typeof data.name === 'string' && data.name) setSchoolName(data.name);
      })
      .catch(() => toast.error('Could not open the alumni list.'));
  }, [institutionId]);

  if (!institutionId) return <p className="p-6 text-sm text-[#1A3C34]">This page opens once your account is tied to an academy.</p>;

  return (
    <AlumniBoard
      schoolName={schoolName}
      people={people}
      policy={policy}
      onSave={(next) => {
        void authedFetch('/api/institutions/alumni', { method: 'POST', body: JSON.stringify({ action: 'save', institutionId, policy: next }) })
          .then(() => { setPolicy(next); toast.success('Alumni settings saved.'); })
          .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save alumni settings.'));
      }}
      onMark={(email) => {
        void authedFetch('/api/institutions/alumni', { method: 'POST', body: JSON.stringify({ action: 'mark', institutionId, people: [{ email }] }) })
          .then(() => toast.success('The leaver is on the alumni record. Academy access stays for the grace period.'))
          .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not mark that person.'));
      }}
      onNewsletter={(note) => {
        void authedFetch('/api/institutions/alumni', { method: 'POST', body: JSON.stringify({ action: 'newsletter', institutionId, note }) })
          .then((data) => toast.success(typeof data.sent === 'number' && data.sent > 0 ? 'The alumni note is on its way.' : 'The note is ready. Email sends when mail is configured and the newsletter is on.'))
          .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not send the note.'));
      }}
    />
  );
}
