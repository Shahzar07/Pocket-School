'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { TutorsScreen, type BookingCard, type PendingTutor, type TutorCard, type TutorSlotCard } from '@/components/scope-c/market-screens';
import { useAuthSTORE } from '@/hooks/use-auth';

export default function TutorsPage() {
  const { profile } = useAuthSTORE();
  const [tutors, setTutors] = useState<TutorCard[]>([]);
  const [bookings, setBookings] = useState<BookingCard[]>([]);
  const [pending, setPending] = useState<PendingTutor[]>([]);
  const [note, setNote] = useState('');
  const admin = profile?.role === 'admin';

  const load = () => {
    authedFetch('/api/tutors/list').then((data) => {
      setTutors(Array.isArray(data.tutors) ? data.tutors as TutorCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
    authedFetch('/api/tutors/mine').then((data) => {
      setBookings(Array.isArray(data.bookings) ? data.bookings as BookingCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
    if (admin) {
      authedFetch('/api/tutors/pending').then((data) => {
        setPending(Array.isArray(data.tutors) ? data.tutors as PendingTutor[] : []);
      }).catch((error: Error) => toast.error(error.message));
    }
  };
  useEffect(() => { load(); }, [admin]);

  return (
    <FeatureGate flag="tutorMarketplace">
      <TutorsScreen
        tutors={tutors}
        bookings={bookings}
        pending={admin ? pending : undefined}
        note={note}
        onBook={(tutorId, kind, startAtMs) => {
          authedFetch('/api/tutors/book', {
            method: 'POST',
            body: JSON.stringify({ tutorId, kind, minutes: 60, seats: kind === 'group' ? 4 : 1, startAtMs }),
          }).then((data) => {
            setNote(`Booked. Payment ${String(data.paymentStatus)} via ${String(data.paymentId)}.${data.liveClassId ? ` Live class ${String(data.liveClassId)}.` : ''}`);
            load();
          }).catch((error: Error) => toast.error(error.message));
        }}
        onSaveProfile={(bio, subjects, hourlyCents, slots: TutorSlotCard[]) => {
          authedFetch('/api/tutors/profile', {
            method: 'POST',
            body: JSON.stringify({ bio, subjects: subjects.split(',').map((s) => s.trim()).filter(Boolean), hourlyCents, slots }),
          }).then((data) => toast.success(data.verificationStatus === 'verified' ? 'Profile saved.' : 'Profile submitted for verification.'))
            .catch((error: Error) => toast.error(error.message));
        }}
        onReview={(bookingId, rating, body) => {
          authedFetch('/api/tutors/review', {
            method: 'POST',
            body: JSON.stringify({ bookingId, rating, body }),
          }).then(() => { toast.success('Review saved.'); load(); })
            .catch((error: Error) => toast.error(error.message));
        }}
        onVerify={admin ? (tutorId, approve) => {
          authedFetch('/api/tutors/verify', {
            method: 'POST',
            body: JSON.stringify({ tutorId, approve }),
          }).then(() => load()).catch((error: Error) => toast.error(error.message));
        } : undefined}
      />
    </FeatureGate>
  );
}
