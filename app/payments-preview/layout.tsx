import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payments preview',
  robots: { index: false, follow: false },
};

export default function PaymentsPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
