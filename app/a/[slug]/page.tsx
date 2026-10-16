import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Academy',
  robots: { index: false, follow: false },
};

/** Public door for an academy. The shared module header supplies Home. */
export default async function AcademyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = slug
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Academy</p>
      <h1 className="mt-2 font-heading text-4xl tracking-[-0.04em] text-foreground">{name || 'Academy'}</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        This academy runs on Poket School. Home takes a visitor back to the public site, and a signed-in person back to the dashboard.
      </p>
    </main>
  );
}
