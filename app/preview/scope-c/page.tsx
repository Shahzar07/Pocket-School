import { notFound } from 'next/navigation';
import { PreviewBody } from './preview-body';

/**
 * Fixture gallery for the new surfaces. Production builds do not serve it.
 * The live pages under /dashboard call the same components.
 */
export default async function ScopePreview({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  return <PreviewBody initial={params.screen} />;
}
