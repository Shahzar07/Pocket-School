import type { Metadata } from 'next';
import { FUNNEL_COPY } from '@/lib/funnels/copy';
import { publicFunnel } from '@/lib/funnels/server';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://poketschool.ai').replace(/\/$/, '');
  const url = `${origin}/p/${encodeURIComponent(code)}`;
  const found = await publicFunnel(code).catch(() => ({ state: 'none' as const }));
  if (found.state === 'draft') {
    return { title: 'Poket School', robots: { index: false, follow: false } };
  }
  if (found.state === 'published') {
    const hero = found.funnel.sections.find((section) => section.kind === 'hero');
    const title = hero?.heading || found.funnel.title;
    const description = hero?.lede || FUNNEL_COPY.metaFallback;
    return { title, description, openGraph: { title, description, url } };
  }
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
