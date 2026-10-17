'use client';

import { useState } from 'react';
import { SelfJoinPicker } from '@/components/institutions/self-join-picker';
import { StudentPassCard } from '@/components/student-pass-card';
import { JoinByCode, type JoinStudentCard } from '@/components/join-by-code';
import type { JoinDirectoryRow } from '@/lib/institution-membership';

const SCHOOLS: JoinDirectoryRow[] = [
  { id: 'north', name: 'North Academy', country: 'MY', state: 'Selangor', status: 'active', listedForSelfJoin: true },
  { id: 'harbour', name: 'Harbour College', country: 'MY', state: 'Penang', status: 'active', listedForSelfJoin: true },
  { id: 'lakeside', name: 'Lakeside School', country: 'GB', state: 'England', status: 'active', listedForSelfJoin: true },
];

const SAMPLE: JoinStudentCard = {
  studentNumber: 'PS-K7NP-4R2C',
  name: 'Amina Yusuf',
  level: 'IGCSE & A-Level',
  photoUrl: '',
  membership: 'open',
};

export function StudentJoinPreview({ panel }: { panel: string }) {
  const [country, setCountry] = useState('MY');
  const [state, setState] = useState('Selangor');
  const [institutionId, setInstitutionId] = useState('north');
  const [path, setPath] = useState<'independent' | 'institution'>('institution');
  const listed = SCHOOLS.filter((row) => row.country === country && row.state === state);

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-4 py-8 text-[#1A3C34]">
      <div className="mx-auto max-w-3xl space-y-6">
        {panel === 'register' && (
          <section className="rounded-3xl bg-[#102820] p-5 sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C8922A]">Create your account</p>
            <h1 className="mt-2 font-heading text-3xl text-white">Join Poket School</h1>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {['Student', 'Teacher', 'Parent'].map((role) => (
                <div key={role} className={`rounded-2xl border px-3 py-4 text-center text-sm font-semibold ${role === 'Student' ? 'border-[#C8922A] bg-[#1A3C34] text-[#F8E7C4]' : 'border-white/10 text-white/50'}`}>{role}</div>
              ))}
            </div>
            <div className="mt-5">
              <SelfJoinPicker
                student
                path={path}
                country={country}
                state={state}
                institutionId={institutionId}
                institutions={listed}
                inviteCode=""
                childEmails=""
                showChildren={false}
                onPath={setPath}
                onCountry={(next) => { setCountry(next); setState(''); setInstitutionId(''); }}
                onState={(next) => { setState(next); setInstitutionId(''); }}
                onInstitution={setInstitutionId}
                onInviteCode={() => undefined}
                onChildEmails={() => undefined}
              />
            </div>
          </section>
        )}
        {panel === 'pass' && (
          <StudentPassCard name="Amina Yusuf" level="IGCSE & A-Level" code="PS-K7NP-4R2C" />
        )}
        {panel === 'parent' && (
          <JoinByCode
            title="Link your child"
            body="Scan the QR on their student pass or type the student number. They confirm, and you can see progress plus Parent Explainer."
            actionLabel="Request link"
            onResolve={() => undefined}
            card={SAMPLE}
            message="Request sent. The student confirms before you can see their progress and Parent Explainer."
            busy={false}
          />
        )}
        {panel === 'verify' && (
          <JoinByCode
            title="Verify a student"
            body="Name, level, and photo from the student number. Approve membership when they match."
            actionLabel="Look up"
            onResolve={() => undefined}
            card={SAMPLE}
            message="Check the name, level, and photo, then approve membership."
            busy={false}
            extra={<button type="button" className="h-11 rounded-full bg-[#C8922A] px-5 text-sm font-semibold text-[#1A3C34]">Approve membership</button>}
          />
        )}
      </div>
    </main>
  );
}
