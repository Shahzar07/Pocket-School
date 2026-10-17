import { HelpSurface, DeskSurface } from '@/components/bullying/surfaces';

export const dynamic = 'force-dynamic';

export default async function PreviewBullying({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  if (params.view === 'desk') return <DeskSurface />;
  return <HelpSurface />;
}
