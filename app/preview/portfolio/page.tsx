'use client';

import { useMemo } from 'react';
import { CvStudio } from '@/components/portfolio/cv-builder';
import { DestinationBoardView, RecordPanels } from '@/components/portfolio/record-panels';
import { LinkedInCopy } from '@/components/portfolio/linkedin-panels';
import { defaultCvDesign, readCvDesign } from '@/lib/cv-builder';
import { destinationBoard, type DestinationRow } from '@/lib/destinations';
import { canPublishPortfolio, defaultConsent, etSummary, portfolioNudges, selfItem, verifiedItems } from '@/lib/portfolio';
import { linkedInCertificationUrl, shareLinks } from '@/lib/credentials/badge-model';
import { readApplication, reminderDue, shareTokenFrom, tailorBullets, viewTracker } from '@/lib/linkedin';
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

const cvItems = [
  ...verifiedItems({
    education: history,
    courses: [{ title: 'IGCSE Mathematics', when: '2024-06-01' }],
    scores: [{ title: 'IGCSE Mathematics', score: '86/100' }],
    certificates: [{ id: 'cert-ada', title: 'IGCSE Mathematics', when: '2024-06-01' }],
    badges: [{ title: 'Graduate' }],
    projects: [{ title: 'Bridge model', detail: 'Studio project' }],
    endorsements: [{ title: 'Lab report', detail: 'Teacher-endorsed' }],
    includeScores: true,
  }),
  ...('error' in volunteering ? [] : [volunteering]),
];
const cvShare = shareTokenFrom(new Uint8Array(24).fill(7));
const cvDesign = readCvDesign({
  ...defaultCvDesign(),
  template: 'deep',
  font: 'serif',
  layout: 'two',
  photo: true,
  pageSize: 'A4',
  summary: 'Mathematics and a library club.',
  showScores: true,
  hiddenItems: ['score-IGCSE Mathematics'],
  wording: 'error' in volunteering ? {} : {
    [volunteering.id]: { title: 'Saturday library club', detail: 'Tuesday shelving' },
  },
  customSections: [{ id: 'custom-availability', title: 'Availability', body: 'Ready for a 2027 start.' }],
});
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
    ...Array.from({ length: 5 }, () => row({ name: 'North Clinic', kind: 'work', course: 'Analyst', country: 'Malaysia' })),
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
  const certificate = items.find((item) => item.kind === 'certificate');
  const addToLinkedIn = certificate ? linkedInCertificationUrl({
    name: certificate.title,
    issuedAt: '2024-06-01T00:00:00.000Z',
    certUrl: certificate.verifyUrl || 'https://poketschool.ai/verify/cert-ada',
    certId: 'cert-ada',
  }) : '';
  const application = readApplication({
    company: 'Company X',
    role: 'Analyst',
    link: 'https://example.com/jobs/analyst',
    status: 'applied',
    date: '2026-10-01',
    shareToken: shareTokenFrom(new Uint8Array(24).fill(4)),
    reminderOn: '2026-10-10',
  });
  const tailored = tailorBullets({
    jobText: 'Mathematics analyst. Python is listed on the posting.',
    items: items.map((item) => ({ title: item.title, detail: item.detail, source: item.source })),
  });
  const tracker = viewTracker([
    { at: '2026-10-16T09:00:00.000Z', itemTitle: 'IGCSE Mathematics', visitorLabel: 'Company X' },
    { at: '2026-10-17T09:00:00.000Z', itemTitle: 'Verified record', visitorLabel: '' },
  ]);

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-4 py-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <CvStudio
          localPreview
          name="Ada Lovelace"
          items={cvItems}
          summary="Mathematics and a library club."
          versions={[{ id: 'cv-company-x', name: 'Company X - Analyst', shareToken: cvShare, updatedAt: '2026-10-17T00:00:00.000Z', design: cvDesign }]}
          links={[{ token: cvShare, label: 'Company X - Analyst' }]}
          seed={{ design: cvDesign, name: 'Company X - Analyst', shareToken: cvShare }}
        />
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
        <LinkedInCopy name="Ada L." studentNumber="PS-ABCD-2345" items={items} />
        <section className="rounded-[28px] border border-[#1A3C34]/10 bg-white p-6 text-[#1A3C34]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C8922A]">Job application</p>
          <h2 className="mt-1 font-heading text-3xl tracking-tight">Company X - Analyst</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            <a className="rounded-full bg-[#1A3C34] px-4 py-2 text-white" href={addToLinkedIn}>Add to LinkedIn</a>
            <a className="rounded-full border border-[#1A3C34] px-4 py-2" href={shareLinks('https://poketschool.ai/verify/cert-ada', 'IGCSE Mathematics').linkedin}>Share to LinkedIn</a>
          </div>
          {'error' in application ? null : (
            <p className="mt-4 text-sm">{application.company} · {application.role} · {application.status} · {application.date}</p>
          )}
          {'error' in application || !reminderDue({ status: application.status, reminderOn: application.reminderOn, today: '2026-10-17' }) ? null : (
            <p className="mt-2 rounded-2xl bg-[#F8E7C4] px-3 py-2 text-sm">Reminder: Company X · Analyst · {application.reminderOn}</p>
          )}
          <p className="mt-4 text-sm">Share link Company X - Analyst · {tracker.total} views · latest {tracker.latest.slice(0, 10)}</p>
          <ul className="mt-1 text-sm">
            {tracker.items.map((item) => <li key={item.title}>{item.title} · {item.count}</li>)}
          </ul>
          <p className="mt-4 text-sm font-semibold">ET AI bullets from verified achievements</p>
          <ul className="mt-1 text-sm">
            {tailored.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
          <p className="mt-2 text-xs">The posting mentions Python. That word stays off these bullets because it is not in a verified achievement.</p>
        </section>
        <DestinationBoardView board={{ ...board, note: 'Groups under five stay hidden. Hired and studying are counted only when an alumnus opts in.' }} />
      </div>
    </main>
  );
}
