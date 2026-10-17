'use client';

import { PerksBoard, type PerkOffer } from '@/components/student-id/perks-board';

const offers: PerkOffer[] = [
  { id: 'cafe', partnerName: 'Harbour Cafe', title: 'Lunch set', discount: '15% off', terms: 'Show your Poket School card. One set per visit.', category: 'food', codeType: 'scan' },
  { id: 'books', partnerName: 'Page & Co', title: 'Revision guides', discount: '10% off', terms: 'In store, with a student ID scan.', category: 'books', codeType: 'scan' },
  { id: 'bus', partnerName: 'City Line', title: 'Off-peak rides', discount: 'Student fare', terms: 'Weekdays after 9:00.', category: 'transport', codeType: 'static', staticCode: 'POKET' },
];

export default function PreviewPerksPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-8">
      <PerksBoard offers={offers} />
    </main>
  );
}
