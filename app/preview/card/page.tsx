import { MemberCardFace } from '@/components/cards/member-card-face';
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

export default function PreviewCardPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <MemberCardFace card={sample} />
        <a href={sample.joinPath} className="inline-flex w-fit items-center rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-5 py-3 text-sm font-semibold text-[#203337]">
          Join Poket School
        </a>
      </div>
    </main>
  );
}
