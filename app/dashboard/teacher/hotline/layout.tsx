import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Poket SafeLine',
};

export default function TeacherSafeLineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
