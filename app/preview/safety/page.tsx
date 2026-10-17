import { SafetyPreview } from '@/components/safety/surfaces';

export const dynamic = 'force-dynamic';

export default async function PreviewSafety({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  return <SafetyPreview view={params.view ?? 'tracker'} />;
}
