'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { TutorsScreen, type TutorCard } from '@/components/scope-c/market-screens';

export default function TutorsPage() {
  const [tutors, setTutors] = useState<TutorCard[]>([]);
  const [note, setNote] = useState('');
  const load = () => {
    authedFetch('/api/tutors/list').then((data) => {
      setTutors(Array.isArray(data.tutors) ? data.tutors as TutorCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };
  useEffect(() => { load(); }, []);

  return (
    <FeatureGate flag="tutorMarketplace">
      <TutorsScreen
        tutors={tutors}
        note={note}
        onBook={(tutorId, kind) => {
          authedFetch('/api/tutors/book', {
            method: 'POST',
            body: JSON.stringify({ tutorId, kind, minutes: 60, seats: kind === 'group' ? 4 : 1, startAtMs: Date.now() + 86_400_000 }),
          }).then((data) => {
            setNote(`Booked. Payment ${String(data.paymentStatus)} via ${String(data.paymentId)}.${data.liveClassId ? ` Live class ${String(data.liveClassId)}.` : ''}`);
          }).catch((error: Error) => toast.error(error.message));
        }}
        onSaveProfile={(bio, subjects, hourlyCents) => {
          authedFetch('/api/tutors/profile', {
            method: 'POST',
            body: JSON.stringify({ bio, subjects: subjects.split(',').map((s) => s.trim()).filter(Boolean), hourlyCents }),
          }).then(() => toast.success('Profile submitted for verification.'))
            .catch((error: Error) => toast.error(error.message));
        }}
      />
    </FeatureGate>
  );
}
