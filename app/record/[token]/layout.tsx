import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://poketschool.ai').replace(/\/$/, '');
  return {
    title: 'Verified record',
    description: 'A Poket School record shared for one job application.',
    openGraph: {
      title: 'Verified Poket School record',
      description: 'A verified record shared for one job application.',
      url: `${origin}/record/${encodeURIComponent(token)}`,
      images: [{ url: `${origin}/api/share-image?kind=record` }],
    },
  };
}

export default function RecordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
