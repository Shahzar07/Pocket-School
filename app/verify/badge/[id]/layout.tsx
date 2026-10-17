import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://poketschool.ai').replace(/\/$/, '');
  const url = `${origin}/verify/badge/${encodeURIComponent(id)}`;
  const image = `${origin}/api/verify/badge/${encodeURIComponent(id)}/image`;
  return {
    title: 'Poket School badge',
    description: 'A Poket School badge. Open the page to confirm it.',
    openGraph: {
      title: 'Poket School badge',
      description: 'Confirm this Poket School badge.',
      url,
      images: [{ url: image }],
    },
  };
}

export default function BadgeVerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
