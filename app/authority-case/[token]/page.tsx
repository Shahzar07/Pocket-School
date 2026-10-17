import type { Metadata } from 'next';
import { AuthorityCaseView } from '@/components/bullying/authority-case-view';
import { DESK_CONTACT } from '@/lib/bullying/school-notice';
import { emergencyNumber } from '@/lib/emergency/policy';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { readPublicAuthorityCase } from '@/lib/server/authority-referral';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Authority case',
  robots: { index: false, follow: false },
};

export default async function AuthorityCasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token === 'sample') {
    return (
      <AuthorityCaseView
        state="open"
        agency="Royal Malaysia Police"
        country="Malaysia"
        incidentType="bullying"
        dates="12 October 2026"
        summary="A student was threatened. No names are included."
        reference="PS-SAMPLE"
        status="sent"
        deskContact={DESK_CONTACT}
        emergency={emergencyNumber('Malaysia')}
      />
    );
  }
  if (!isAdminConfigured() || !/^[a-f0-9]{48}$/.test(token)) {
    return <AuthorityCaseView state="missing" />;
  }
  const row = await readPublicAuthorityCase(token).catch(() => null);
  if (!row) return <AuthorityCaseView state="missing" />;
  if (row.expired) return <AuthorityCaseView state="expired" />;
  return (
    <AuthorityCaseView
      state="open"
      agency={row.agency}
      country={row.country}
      incidentType={row.incidentType}
      dates={row.dates}
      summary={row.summary}
      reference={row.reference}
      status={row.status}
      deskContact={row.deskContact}
      emergency={emergencyNumber(row.country)}
    />
  );
}
