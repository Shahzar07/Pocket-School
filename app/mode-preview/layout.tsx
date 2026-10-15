import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mode switch preview',
  robots: { index: false, follow: false },
};

export default function ModePreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
