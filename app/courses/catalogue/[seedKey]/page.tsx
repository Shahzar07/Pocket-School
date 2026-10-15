import type { Metadata } from 'next';
import { CourseCatalogueDetail } from '@/components/shelf/course-detail';
import { SEED_COURSES } from '@/lib/seed-courses';

export const metadata: Metadata = { title: 'Course · Poket School' };
export const revalidate = 86400;

export function generateStaticParams() {
  return SEED_COURSES.map(course => ({ seedKey: course.seedKey }));
}

export default async function CatalogueCoursePage({ params }: { params: Promise<{ seedKey: string }> }) {
  const { seedKey } = await params;
  return <CourseCatalogueDetail seedKey={seedKey} />;
}
