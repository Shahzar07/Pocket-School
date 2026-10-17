import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://poketschool.ai').replace(/\/$/, '');
  const url = `${origin}/portfolio/${encodeURIComponent(code)}`;
  return {
    title: 'Poket School portfolio',
    description: 'A Poket School portfolio for LinkedIn Featured and Contact info.',
    openGraph: {
      title: 'Poket School portfolio',
      description: 'A Poket School portfolio.',
      url,
      images: [{ url: `${origin}/api/share-image?kind=portfolio` }],
    },
  };
}

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
