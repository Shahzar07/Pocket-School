import { ComingSoon } from '@/components/coming-soon';
import { NetworkPreview } from '@/components/network/surfaces';

export const dynamic = 'force-dynamic';

export default function InstitutionGroups() {
  return (
    <ComingSoon title="Groups" detail="Institution groups are not open yet. Class walls already live under Community.">
      <NetworkPreview view="group" />
    </ComingSoon>
  );
}
