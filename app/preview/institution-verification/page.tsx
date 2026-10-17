'use client';

import { JoinVerificationSettings } from '@/components/institutions/join-settings';
import { claimTokenFor, defaultJoinConfig, type RosterEntry } from '@/lib/institution-join';

const roster: RosterEntry[] = [
  { email: 'ada@school.edu.my', name: 'Ada', role: 'student', studentId: 'S-14', dob: '2012-04-01', level: 'IGCSE', className: 'North', phone: '', childStudentId: '', programmeId: 'igcse', claimToken: claimTokenFor('north', 'ada@school.edu.my'), status: 'joined' },
  { email: 'bee@school.edu.my', name: 'Bee', role: 'student', studentId: 'S-15', dob: '2013-02-02', level: 'IGCSE', className: 'North', phone: '', childStudentId: '', programmeId: 'igcse', claimToken: claimTokenFor('north', 'bee@school.edu.my'), status: 'unclaimed' },
  { email: 'new@gmail.com', name: 'New', role: 'student', studentId: 'S-16', dob: '2011-03-03', level: 'IGCSE', className: '', phone: '', childStudentId: '', programmeId: 'igcse', claimToken: claimTokenFor('north', 'new@gmail.com'), status: 'pending' },
  { email: 'wait@gmail.com', name: 'Wai', role: 'student', studentId: 'S-17', dob: '2011-04-04', level: 'IGCSE', className: '', phone: '', childStudentId: '', programmeId: 'igcse', claimToken: claimTokenFor('north', 'wait@gmail.com'), status: 'waiting' },
];

export default function InstitutionVerificationPreview() {
  const initial = defaultJoinConfig();
  initial.policy.emailDomains = ['school.edu.my'];
  initial.codes = [{ code: 'IGCSE1', level: 'IGCSE', className: 'North', programmeId: 'igcse' }];
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-8">
      <JoinVerificationSettings institutionName="North Academy" slug="north" initial={initial} roster={roster} />
    </main>
  );
}
