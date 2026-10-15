import type { Metadata } from 'next';
import { TeacherStudioDemo } from '@/components/teacher-studio-demo';

export const metadata: Metadata = {
  title: 'Course studio preview',
  robots: { index: false, follow: false },
};

export default function TeacherStudioPage() {
  return <TeacherStudioDemo />;
}
