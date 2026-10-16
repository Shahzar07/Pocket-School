'use client';

import { useState } from 'react';
import { DashHeader, DashPage, Panel, StatCard } from '@/components/dash-ui';
import { AccessBadge, CheckoutChoice, FeeSummary, OnboardingList } from '@/components/institutions/commerce-panels';
import { SelfJoinPicker } from '@/components/institutions/self-join-picker';
import { onboardingChecklist } from '@/lib/institution-membership';
import { accessBadge, usageRoi, type CourseAccessMode } from '@/lib/institution-commerce';
import { Award, GraduationCap, Sparkles } from 'lucide-react';

const SAMPLE = [
  { id: 'north', name: 'North Academy', country: 'MY', state: 'Selangor', status: 'active', listedForSelfJoin: true },
];

export default function InstitutionFlowPreview() {
  const [path, setPath] = useState<'independent' | 'institution'>('institution');
  const [mode, setMode] = useState<CourseAccessMode>('both');
  const [choice, setChoice] = useState<'subscription' | 'a_la_carte'>('subscription');
  const roi = usageRoi({
    currency: 'USD', invoiceUsd: 580.99, activeStudents: 40, lessonsCompleted: 800,
    certificatesIssued: 12, attendanceRate: 0.92, sparksSpent: 9000, sparksAllowance: 32000,
  });
  return (
    <DashPage>
      <DashHeader eyebrow="Poket School" title="Institution flow" accent="preview" description="Independent or from an institution. Listed academies only. ET AI levels, with no year numbers on this screen." />
      <Panel>
        <SelfJoinPicker
          tone="default"
          path={path}
          country="MY"
          state="Selangor"
          institutionId="north"
          institutions={SAMPLE}
          inviteCode=""
          childEmails=""
          showChildren={false}
          onPath={setPath}
          onCountry={() => undefined}
          onState={() => undefined}
          onInstitution={() => undefined}
          onInviteCode={() => undefined}
          onChildEmails={() => undefined}
        />
      </Panel>
      <FeeSummary />
      <Panel>
        <h2 className="font-semibold mb-3">Course access</h2>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="group" aria-label="Access mode">
          {(['subscription', 'a_la_carte', 'both'] as const).map((item) => (
            <button key={item} type="button" aria-pressed={mode === item} className="min-h-11 rounded-full border border-border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setMode(item)}>
              {accessBadge(item).title}
            </button>
          ))}
        </div>
        <AccessBadge mode={mode} />
        <div className="mt-3">
          <CheckoutChoice mode={mode} value={choice} onChange={setChoice} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">A subscription ends when the person or the institution lapses. A la carte stays. Sparks cannot buy this course.</p>
      </Panel>
      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard icon={GraduationCap} label="Per student" value={`USD ${roi.costPerStudent.toFixed(2)}`} index={0} />
        <StatCard icon={Award} label="Per certificate" value={`USD ${roi.costPerCertificate.toFixed(2)}`} index={1} />
        <StatCard icon={Sparkles} label="Sparks used" value={`${roi.sparksUsedPercent}%`} index={2} />
      </div>
      <Panel>
        <h2 className="font-semibold mb-3">New institution checklist</h2>
        <OnboardingList steps={onboardingChecklist({ profile: true, billing: true, admin: true })} />
      </Panel>
    </DashPage>
  );
}
