'use client';

import { AlumniOfferCard, CompletedShelf } from '@/components/alumni/record-panels';
import { completedShelf, recommendNext } from '@/lib/alumni';

const COURSES = [
  { courseId: 'igcse-maths', title: 'IGCSE Mathematics', level: 'IGCSE', programmeId: 'igcse', access: 'subscription' as const, progress: 100, passedFinal: false, institutionPaid: true },
  { courseId: 'science', title: 'Primary science pack', level: 'Primary', programmeId: 'primary', access: 'a_la_carte' as const, progress: 100, passedFinal: true, institutionPaid: false },
];

export default function AlumniShelfPreview() {
  const shelf = completedShelf(COURSES, { subscriptionActive: false, institutionAccess: 'grace' });
  const recommendations = recommendNext({
    level: 'IGCSE',
    finishedIds: ['igcse-maths'],
    atInstitution: true,
    options: [
      { id: 'alevel-maths', title: 'A-Level Mathematics', level: 'A-Level', programmeId: 'alevel', access: 'subscription' },
      { id: 'alevel-lab', title: 'A-Level lab pack', level: 'A-Level', programmeId: 'alevel', access: 'a_la_carte' },
    ],
  });
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-4 py-8">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <CompletedShelf completed={shelf.completed} recommendations={recommendations} onOpen={() => undefined} onEnrol={() => undefined} onAsk={() => undefined} />
        <AlumniOfferCard
          name="Ada Lovelace"
          graceEndsOn="16 November 2026"
          discount={0.15}
          studentNumber="PS-ABCD-2345"
          publicOn
          joinHref="/i/north/join"
        />
      </div>
    </main>
  );
}
