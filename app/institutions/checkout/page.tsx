'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { InstitutionJourneyFrame } from '@/components/institutions/journey-frame';
import { PlanCheckout, type CheckoutDraft } from '@/components/institutions/plan-checkout';
import { auth, db } from '@/lib/firebase';
import { authedFetch } from '@/lib/api-client';
import { getInstitution } from '@/lib/db';
import { institutionAdminDestination } from '@/lib/institution-journey';
import { SANDBOX_BANNER, seatsForOrganisationSize } from '@/lib/institution-self-serve';
import { Suspense } from 'react';

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [institutionId, setInstitutionId] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [seats, setSeats] = useState(25);
  const [banner, setBanner] = useState('');
  const [trialDays, setTrialDays] = useState(14);
  const [trialSeatCap, setTrialSeatCap] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const paid = params.get('paid') === '1';

  useEffect(() => {
    fetch('/api/institutions/signup-config')
      .then((res) => res.json())
      .then((data: { sandbox?: boolean; banner?: string; trialDays?: number; trialSeatCap?: number }) => {
        if (data.sandbox && data.banner) setBanner(data.banner);
        if (typeof data.trialDays === 'number') setTrialDays(data.trialDays);
        if (typeof data.trialSeatCap === 'number') setTrialSeatCap(data.trialSeatCap);
      })
      .catch(() => setBanner(SANDBOX_BANNER));
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setReady(true);
        return;
      }
      void (async () => {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const profile = snap.exists() ? snap.data() : {};
        const id = typeof profile.institutionId === 'string' ? profile.institutionId : '';
        setEmail(typeof profile.email === 'string' ? profile.email : user.email || '');
        if (!id) {
          setReady(true);
          return;
        }
        const academy = await getInstitution(id).catch(() => null);
        const destination = institutionAdminDestination({
          status: academy?.status,
          setupComplete: academy?.setupComplete,
          billingPhase: academy?.billingPhase,
          reviewHold: academy?.reviewHold,
        });
        if (destination !== '/institutions/checkout') {
          router.replace(destination);
          return;
        }
        setInstitutionId(id);
        setCountry(academy?.country || '');
        setSeats(seatsForOrganisationSize(academy?.organisationSize || ''));
        setReady(true);
      })();
    });
  }, [router]);

  const pay = async (order: CheckoutDraft) => {
    setBusy(true);
    setError('');
    try {
      const data = await authedFetch('/api/institutions/checkout', {
        method: 'POST',
        body: JSON.stringify({ institutionId, ...order }),
      });
      if (typeof data.url === 'string' && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.postUrl && data.fields && typeof data.postUrl === 'string' && typeof data.fields === 'object') {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.postUrl;
        for (const [key, value] of Object.entries(data.fields as Record<string, string>)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
      if (data.sandbox === true) {
        const settled = await authedFetch('/api/institutions/checkout/sandbox', {
          method: 'POST',
          body: JSON.stringify({ institutionId }),
        });
        router.push(typeof settled.destination === 'string' ? settled.destination : '/dashboard/institution/onboarding');
        return;
      }
      router.push(typeof data.destination === 'string' ? data.destination : '/dashboard/institution/onboarding');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not complete checkout.');
    } finally {
      setBusy(false);
    }
  };

  const trial = async (order: Pick<CheckoutDraft, 'planId' | 'seats' | 'programmeIds'>) => {
    setBusy(true);
    setError('');
    try {
      const data = await authedFetch('/api/institutions/checkout/trial', {
        method: 'POST',
        body: JSON.stringify({ institutionId, ...order }),
      });
      router.push(typeof data.destination === 'string' ? data.destination : '/dashboard/institution/onboarding');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the trial.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <InstitutionJourneyFrame
      eyebrow="For Schools & Organisations"
      title="Plan and checkout"
      lede="Choose a level, the programmes on that level, and how many student seats. Payment opens the academy and the setup checklist."
    >
      {!ready && <p className="text-sm">Loading checkout…</p>}
      {ready && !institutionId && <p className="text-sm">Sign in with the institution admin account to finish checkout.</p>}
      {ready && institutionId && (
        <PlanCheckout
          country={country}
          email={email}
          initialSeats={seats}
          banner={banner}
          trialDays={trialDays}
          trialSeatCap={trialSeatCap}
          busy={busy}
          error={error}
          paidNotice={paid ? 'Payment received. If this page is still open, refresh it. The academy opens as soon as the payment is confirmed.' : ''}
          onCheckout={(order) => void pay(order)}
          onTrial={(order) => void trial(order)}
        />
      )}
    </InstitutionJourneyFrame>
  );
}

export default function InstitutionCheckoutPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading checkout…</p>}>
      <CheckoutInner />
    </Suspense>
  );
}
