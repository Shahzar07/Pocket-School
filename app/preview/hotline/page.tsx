import { EmergencyDesk, ParentHotline, StaffQueue } from '@/components/hotline/surfaces';

export const dynamic = 'force-dynamic';

export default async function PreviewHotline({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  if (params.view === 'queue') return <StaffQueue />;
  if (params.view === 'desk') return <EmergencyDesk />;
  return <ParentHotline />;
}
