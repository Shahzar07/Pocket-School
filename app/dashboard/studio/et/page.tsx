'use client';

import { EtCanvas } from '@/components/studio/et-canvas';
import { useAuthSTORE } from '@/hooks/use-auth';

/** ET AI, inside the dashboard shell. The sidebar stays. There is no nested frame. */
export default function StudioEt() {
  const { profile, user } = useAuthSTORE();
  const name = profile?.displayName || profile?.name || user?.displayName || '';
  return <EtCanvas name={name} />;
}
