'use client';

import { AlumniBoard } from '@/components/alumni/record-panels';
import { defaultAlumniPolicy, type AlumniPerson } from '@/lib/alumni';

const PEOPLE: AlumniPerson[] = [
  { id: 'ada', studentId: 'ada', schoolStudentId: 'S-14', name: 'Ada Lovelace', studentNumber: 'PS-ABCD-2345', email: 'ada@school.edu.my', institutionId: 'north', institutionName: 'North Academy', level: 'Professional', leftOn: '2026-10-17', graceEndsOn: '2026-10-17', reason: 'final_level', certificates: 2, seatFreed: true, publicProfile: true },
  { id: 'grace', studentId: 'grace', schoolStudentId: 'S-15', name: 'Grace Hopper', studentNumber: 'PS-EFGH-6789', email: 'grace@school.edu.my', institutionId: 'north', institutionName: 'North Academy', level: 'Law', leftOn: '2025-06-01', graceEndsOn: '2025-07-01', reason: 'marked', certificates: 3, seatFreed: true, publicProfile: false },
];

export default function AlumniBoardPreview() {
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <AlumniBoard schoolName="North Academy" people={PEOPLE} policy={defaultAlumniPolicy()} />
      </div>
    </main>
  );
}
