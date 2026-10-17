import type { Metadata } from 'next';
import { SchoolNoticeView } from '@/components/bullying/school-notice-view';
import { SAMPLE_BULLYING_CODE, bullyingJoinPath } from '@/lib/bullying/policy';
import { DESK_CONTACT } from '@/lib/bullying/school-notice';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { readPublicSchoolNotice } from '@/lib/server/school-notice';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'School notice',
  robots: { index: false, follow: false },
};

function joinUrl(): string {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://poketschool.ai').replace(/\/$/, '');
  return `${origin}${bullyingJoinPath(SAMPLE_BULLYING_CODE)}`;
}

export default async function SchoolNoticePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const join = joinUrl();
  if (token === 'sample') {
    return (
      <SchoolNoticeView
        state="open"
        token=""
        joinUrl={join}
        schoolName="Sample Off Platform School"
        incidentType="bullying"
        dates="12 October 2026"
        summary="A student was targeted online over several days."
        deskContact={DESK_CONTACT}
      />
    );
  }
  if (!isAdminConfigured() || !/^[a-f0-9]{48}$/.test(token)) {
    return <SchoolNoticeView state="missing" token="" joinUrl={join} />;
  }
  const notice = await readPublicSchoolNotice(token).catch(() => null);
  if (!notice) return <SchoolNoticeView state="missing" token="" joinUrl={join} />;
  if (notice.expired) return <SchoolNoticeView state="expired" token="" joinUrl={join} />;
  return (
    <SchoolNoticeView
      state="open"
      token={token}
      joinUrl={join}
      schoolName={notice.schoolName}
      incidentType={notice.incidentType}
      dates={notice.dates}
      summary={notice.summary}
      deskContact={notice.deskContact}
    />
  );
}
