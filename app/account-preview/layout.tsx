import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile settings preview',
  robots: { index: false, follow: false },
};

export default function AccountPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
