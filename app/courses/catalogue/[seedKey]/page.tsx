import type { Metadata } from 'next';
import { CourseCatalogueDetail } from '@/components/shelf/course-detail';

export const metadata: Metadata = { title: 'Course · Poket School' };

export default async function CatalogueCoursePage({ params }: { params: Promise<{ seedKey: string }> }) {
  const { seedKey } = await params;
  return <CourseCatalogueDetail seedKey={seedKey} />;
}
