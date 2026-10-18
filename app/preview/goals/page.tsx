import type { Metadata } from 'next';
import { GoalsPreview } from '@/components/goals/goals-preview';

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Goals preview' };

export default async function GoalsPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view ?? 'week';
  return <GoalsPreview view={view} />;
}
