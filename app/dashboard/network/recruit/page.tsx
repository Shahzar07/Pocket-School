import { ComingSoon } from '@/components/coming-soon';
import { NetworkPreview } from '@/components/network/surfaces';

export const dynamic = 'force-dynamic';

export default function RecruitPage() {
  return (
    <ComingSoon title="Recruiter search" detail="Recruiter search is not open yet. Contact details stay hidden.">
      <NetworkPreview view="recruit" />
    </ComingSoon>
  );
}
