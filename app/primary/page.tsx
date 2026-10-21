import type { Metadata } from 'next';
import { PathwayView } from '@/components/marketing/pathway-view';
import { loadPathway } from '@/lib/pathways/load';

export async function generateMetadata(): Promise<Metadata> {
  const pathway = await loadPathway('primary');
  return { title: pathway.metaTitle, description: pathway.overview };
}

export default async function Page() {
  const pathway = await loadPathway('primary');
  return <PathwayView pathway={pathway} />;
}
