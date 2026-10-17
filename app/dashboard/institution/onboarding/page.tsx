'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { OnboardingList } from '@/components/institutions/commerce-panels';
import { BrandedLoginStep } from '@/components/institutions/branded-login-step';
import { useAuthSTORE } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { getInstitution, listAcademyMembers, updateInstitution, type Institution } from '@/lib/db';
import { journeyChecklist, journeyDone } from '@/lib/institution-journey';
import { loadProfile } from '@/lib/institution-store';

export default function InstitutionOnboardingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuthSTORE();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [steps, setSteps] = useState(journeyChecklist({}));
  const [note, setNote] = useState('');

  const refresh = async (academy: Institution) => {
    const [members, profileDoc, invites, courses, sparks] = await Promise.all([
      listAcademyMembers(academy.id).catch(() => []),
      loadProfile(academy.id).catch(() => null),
      getDocs(query(collection(db, 'institutions', academy.id, 'invites'), limit(20))).catch(() => null),
      getDocs(query(collection(db, 'institutions', academy.id, 'catalogue'), limit(20))).catch(() => null),
      getDocs(query(collection(db, 'institutions', academy.id, 'sparks_guard'), limit(1))).catch(() => null),
    ]);
    const done = journeyDone({
      name: academy.name,
      country: academy.country,
      state: academy.state,
      subdomain: academy.subdomain,
      loginPublished: academy.branding?.loginPublished,
      coAdminCount: members.filter((member) => member.role === 'institution_admin').length,
      teacherCount: academy.teacherCount,
      studentCount: academy.studentCount,
      inviteCount: invites?.size ?? 0,
      courseCount: Math.max(academy.publicCatalogueIds?.length ?? 0, courses?.size ?? 0),
      billingReady: (profileDoc?.seatCount ?? 0) > 0 || (profileDoc?.amount ?? 0) > 0,
      sparksReady: (sparks?.size ?? 0) > 0,
    });
    setSteps(journeyChecklist(done));
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('step') !== 'login') return;
    document.getElementById('branded-login')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [institution]);

  useEffect(() => {
    if (loading) return;
    const institutionId = profile?.institutionId;
    if (!user || profile?.role !== 'institution_admin' || !institutionId) return;
    let cancelled = false;
    void getInstitution(institutionId).then((academy) => {
      if (cancelled || !academy) return;
      setInstitution(academy);
      void refresh(academy);
    });
    return () => { cancelled = true; };
  }, [loading, user, profile?.institutionId, profile?.role]);

  const openAcademy = async () => {
    if (!institution) return;
    setNote('');
    try {
      await updateInstitution(institution.id, { setupComplete: true });
      router.push('/dashboard/institution');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not open the academy yet.');
    }
  };

  return (
    <DashPage className="max-w-3xl">
      <DashHeader
        eyebrow="Institution"
        title="Onboarding"
        description="Finish the academy in this order. The branded login page is the public door for students, teachers, and admins. Co-admins sign in with an email code."
      />
      <Panel>
        <OnboardingList steps={steps} />
      </Panel>
      <Panel>
        <h2 id="branded-login" className="font-heading text-2xl">Branded login page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a logo, pick colours, and claim an address such as poketschool.ai/i/rochfords. A custom domain is optional. Publish when the preview looks right.
        </p>
        <div className="mt-5">
          {institution ? (
            <BrandedLoginStep
              institution={institution}
              onSaved={(patch) => {
                const next = {
                  ...institution,
                  ...patch,
                  branding: { ...institution.branding, ...patch.branding },
                };
                setInstitution(next);
                void refresh(next);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sign in as the institution admin to edit this login page.</p>
          )}
        </div>
      </Panel>
      {note && <p role="alert" className="text-sm">{note}</p>}
      <button type="button" onClick={() => void openAcademy()} className="h-11 rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white">
        Open the academy
      </button>
    </DashPage>
  );
}
