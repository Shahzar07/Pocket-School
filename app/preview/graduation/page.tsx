'use client';

import { GraduationCelebration, GraduationDesk } from '@/components/alumni/graduation-panels';
import { graduationCard, previewGraduationBill } from '@/lib/graduation';

const preview = previewGraduationBill({
  graduating: 2,
  currentStudents: 52,
  currentSeats: 52,
  currentTotal: 520,
  currentTierId: 'growth',
  itemIds: ['igcse'],
  interval: 'monthly',
  country: 'US',
  periodStart: '2026-10-01',
  periodEnd: '2026-11-01',
  today: '2026-10-17',
  billingActive: true,
});

export default function GraduationPreview() {
  return (
    <main className="min-h-screen bg-brand-mist px-4 py-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <GraduationCelebration
          card={graduationCard({
            name: 'Ada Lovelace',
            institutionName: 'North Academy',
            level: 'Professional',
            studentNumber: 'PS-ABCD-2345',
            graduatedOn: '2026-10-17',
          })}
        />
        <GraduationDesk
          suggestions={[
            { studentId: 'ada', schoolStudentId: 'S-14', name: 'Ada Lovelace', email: 'ada@school.edu.my', studentNumber: 'PS-ABCD-2345', level: 'Professional' },
            { studentId: 'grace', schoolStudentId: 'S-15', name: 'Grace Hopper', email: 'grace@school.edu.my', studentNumber: 'PS-EFGH-6789', level: 'Law' },
          ]}
          preview={preview}
        />
      </div>
    </main>
  );
}
