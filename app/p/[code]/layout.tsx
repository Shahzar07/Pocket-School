import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://poketschool.ai').replace(/\/$/, '');
  const url = `${origin}/p/${encodeURIComponent(code)}`;
  return {
    title: 'Poket School graduation',
    description: 'A Poket School graduation card.',
    openGraph: {
      title: 'Poket School graduation',
      description: 'A Poket School graduation card.',
      url,
      images: [{ url: `${origin}/api/share-image?kind=graduation` }],
    },
  };
}

export default function AlumniLayout({ children }: { children: React.ReactNode }) {
  return children;
}
