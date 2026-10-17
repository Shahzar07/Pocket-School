import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ uuid: string }> }): Promise<Metadata> {
  const { uuid } = await params;
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://poketschool.ai').replace(/\/$/, '');
  const url = `${origin}/verify/${encodeURIComponent(uuid)}`;
  const image = `${origin}/api/credentials/${encodeURIComponent(uuid)}/image?download=0`;
  return {
    title: 'Poket School certificate',
    description: 'Confirm this Poket School certificate. The page shows the student number, name, course, and issue date.',
    openGraph: {
      title: 'Poket School certificate',
      description: 'Confirm this Poket School certificate.',
      url,
      images: [{ url: image }],
    },
  };
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
