import { MemberCardFace } from '@/components/cards/member-card-face';
import { CardQr } from '@/components/student-id/card-qr';
import { MEMBER_CARD_TITLE, type PublicCard } from '@/lib/cards/model';

const sample: PublicCard = {
  title: MEMBER_CARD_TITLE,
  firstName: 'Amina',
  levelName: 'IGCSE',
  schoolName: null,
  showPhoto: false,
  avatarUrl: '',
  badges: ['Algebra'],
  streakDays: 4,
  referralCode: 'AMINA2K7',
  joinPath: '/signup?ref=AMINA2K7',
  indexable: false,
  visible: true,
};

export default function PreviewIdPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <MemberCardFace card={sample} />
        <CardQr path="https://poketschool.ai/verify/ps1.preview.signature" code="482913" codeValidUntil={1_700_000_120_000} />
      </div>
    </main>
  );
}
