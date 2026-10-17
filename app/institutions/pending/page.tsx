'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { PendingApproval, type ApprovalStatus } from '@/components/institutions/pending-approval';
import { auth, db } from '@/lib/firebase';
import { getInstitution } from '@/lib/db';
import { institutionAdminDestination } from '@/lib/institution-journey';

export default function InstitutionPendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ApprovalStatus>('unknown');
  const [organisation, setOrganisation] = useState('');
  const [email, setEmail] = useState('');
  const [continueHref, setContinueHref] = useState('/dashboard/institution/onboarding');
  const [reasons, setReasons] = useState<string[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setStatus('unknown');
        setOrganisation('');
        setEmail('');
        return;
      }
      void (async () => {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const profile = snap.exists() ? snap.data() : {};
        const institutionId = typeof profile.institutionId === 'string' ? profile.institutionId : '';
        setEmail(typeof profile.email === 'string' ? profile.email : user.email || '');
        if (!institutionId) {
          setStatus('unknown');
          return;
        }
        const academy = await getInstitution(institutionId).catch(() => null);
        const next = academy?.status === 'active' || academy?.status === 'pending' || academy?.status === 'suspended'
          ? academy.status
          : 'unknown';
        setStatus(next);
        setOrganisation(academy?.name || '');
        const destination = institutionAdminDestination({
          status: academy?.status,
          setupComplete: academy?.setupComplete,
          billingPhase: academy?.billingPhase,
          reviewHold: academy?.reviewHold,
        });
        if (destination === '/institutions/checkout') {
          router.replace(destination);
          return;
        }
        setReasons(Array.isArray(academy?.reviewReasons) ? academy.reviewReasons : []);
        setContinueHref(destination);
      })();
    });
  }, [router]);

  return (
    <PendingApproval
      status={status}
      organisation={organisation}
      email={email}
      continueHref={continueHref}
      reasons={reasons}
    />
  );
}
