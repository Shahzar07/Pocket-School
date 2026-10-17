'use client';

import { useMemo } from 'react';
import { DestinationBoardView, RecordPanels } from '@/components/portfolio/record-panels';
import { destinationBoard, type DestinationRow } from '@/lib/destinations';
import { canPublishPortfolio, defaultConsent, etSummary, portfolioNudges, selfItem, verifiedItems } from '@/lib/portfolio';
import { openEducation } from '@/lib/lifelong';

const history = openEducation(
  openEducation([], {
    institutionId: 'north',
    institutionName: 'North Academy',
    level: 'IGCSE',
    studentNumber: 'ps-abcd-2345',
  }, '2022-09-01'),
  {
    institutionId: 'harbour',
    institutionName: 'Harbour College',
    level: 'A-Level',
    studentNumber: 'PS-OTHER-9999',
  },
  '2024-09-01',
);

const volunteering = selfItem({
  kind: 'volunteering',
  title: 'Library club',
  detail: 'Tuesday shelving',
  evidenceLink: 'https://example.com/library',
});

const items = [
  ...verifiedItems({
    education: history,
    courses: [{ title: 'IGCSE Mathematics', when: '2024-06-01' }],
    scores: [{ title: 'IGCSE Mathematics', score: '86/100' }],
    certificates: [{ id: 'cert-ada', title: 'IGCSE Mathematics', when: '2024-06-01' }],
    badges: [{ title: 'Graduate' }],
    projects: [{ title: 'Bridge model', detail: 'Studio project' }],
    endorsements: [{ title: 'Lab report', detail: 'Teacher-endorsed' }],
    includeScores: false,
  }),
  ...('error' in volunteering ? [] : [volunteering]),
];

const draft = etSummary({ name: 'Ada Lovelace', items });
const consent = {
  ...defaultConsent(),
  publicPortfolio: true,
  sections: { ...defaultConsent().sections, education: 'public' as const },
};
const gate = canPublishPortfolio({ ageTier: 'teen', wantsPublic: true, parentApproved: false });

function row(patch: Partial<DestinationRow> & Pick<DestinationRow, 'name'>): DestinationRow {
  return {
    kind: 'university',
    course: 'Medicine',
    country: 'Malaysia',
    source: 'stated',
    shareWithSchools: true,
    shareName: false,
    testimonial: '',
    shareTestimonial: false,
    fromInstitutionId: 'north',
    learnerName: '',
    ...patch,
  };
}

export default function PortfolioPreview() {
  const board = useMemo(() => destinationBoard([
    ...Array.from({ length: 5 }, () => row({ name: 'University of Malaya' })),
    row({ name: 'Small College', country: 'Singapore', course: 'Design' }),
    row({ name: 'Small College', country: 'Singapore', course: 'Design' }),
    row({
      name: 'Studio School',
      course: 'Design',
      country: 'Singapore',
      shareName: true,
      learnerName: 'Ada L.',
      testimonial: 'The science course carried me to the next step.',
      shareTestimonial: true,
    }),
  ]), []);

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-4 py-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <RecordPanels
          name="Ada L."
          studentNumber="PS-ABCD-2345"
          items={items}
          summary={draft.summary}
          bullets={draft.bullets}
          nudges={portfolioNudges([{ title: 'Graduate' }])}
          reason={gate.reason}
          consent={consent}
        />
        <DestinationBoardView board={{ ...board, note: 'Groups under five stay hidden.' }} />
      </div>
    </main>
  );
}
