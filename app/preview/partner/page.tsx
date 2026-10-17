'use client';

import { PartnerDesk, type PartnerOfferRow } from '@/components/student-id/partner-desk';

const offers: PartnerOfferRow[] = [
  { id: 'lunch', title: 'Lunch set', discount: '15% off', status: 'live', redemptions: 42 },
  { id: 'late', title: 'Evening bun', discount: 'Free drink', status: 'review', redemptions: 0 },
];

export default function PreviewPartnerPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-8">
      <PartnerDesk name="Harbour Cafe" status="approved" offers={offers} onCreate={async () => undefined} />
    </main>
  );
}
