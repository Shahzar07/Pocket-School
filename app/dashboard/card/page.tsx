import { CardDesk } from '@/components/cards/card-desk';

export default function MemberCardPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 font-heading text-3xl text-[#203337]">Member card</h1>
      <p className="mb-6 text-sm text-[#5F7074]">Free for every account. Share a first name and a level. The number stays here.</p>
      <CardDesk />
    </div>
  );
}
