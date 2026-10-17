import { HelpNearMe } from '@/components/help/near-me';
import { SEEDED_EMERGENCY_NUMBERS } from '@/lib/emergency-numbers/catalog';

export const dynamic = 'force-dynamic';

export default function HelpNearMePage() {
  return <HelpNearMe rows={SEEDED_EMERGENCY_NUMBERS} />;
}
