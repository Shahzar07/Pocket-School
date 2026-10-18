import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Poket SafeLine',
};

export default function AdminSafeLineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
