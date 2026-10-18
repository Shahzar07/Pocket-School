import { CardDesk } from '@/components/cards/card-desk';

export default function MemberCardPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 font-heading text-3xl text-[#203337]">Student ID</h1>
      <p className="mb-6 text-sm text-[#5F7074]">Free for every account. Your number stays on this card. A shared link does not print it.</p>
      <CardDesk />
    </div>
  );
}
