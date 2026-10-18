import { ComingSoon } from '@/components/coming-soon';
import { NetworkPreview } from '@/components/network/surfaces';

export const dynamic = 'force-dynamic';

export default function NetworkHome() {
  return (
    <ComingSoon title="Network" detail="Profiles and posts will use the school network. This screen is a preview.">
      <NetworkPreview view="home" />
    </ComingSoon>
  );
}
