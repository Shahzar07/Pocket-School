import { VerifyFace } from '@/components/student-id/verify-face';
import type { PublicVerification } from '@/lib/student-id/model';

const face: PublicVerification = {
  firstName: 'Amina',
  label: 'Verified Poket School student',
  state: 'active',
  validUntil: 1_700_000_030_000,
  ageBand: '<18',
  showPhoto: false,
  avatarUrl: '',
  initial: 'A',
};

export default function PreviewVerifyPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-12">
      <VerifyFace face={face} />
    </main>
  );
}
