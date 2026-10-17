import { EmergencyLive, ParentHotlineLive, StaffHotlineLive } from '@/components/hotline/live';

export const dynamic = 'force-dynamic';

export default async function PreviewHotline({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  if (params.view === 'queue') return <StaffHotlineLive sample />;
  if (params.view === 'desk') return <EmergencyLive sample />;
  return <ParentHotlineLive sample />;
}
