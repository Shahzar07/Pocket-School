import type { Metadata } from 'next';
import { TeacherDeskPreview } from '@/components/school-desk/preview';

export const metadata: Metadata = {
  title: 'Teacher desk preview',
  robots: { index: false, follow: false },
};

export default async function TeacherDeskPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[#f4f7f8] px-4 py-6">
      <TeacherDeskPreview view={params.view ?? 'gradebook'} />
    </main>
  );
}
