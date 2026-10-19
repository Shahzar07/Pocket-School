import { notFound } from 'next/navigation';
import { PreviewBody } from './preview-body';

export const dynamic = 'force-dynamic';

/**
 * Fixture gallery for the new surfaces. Production builds do not serve it
 * unless SCOPE_PREVIEW=1 is set on that process. The live pages under
 * /dashboard call the same components.
 */
export default async function ScopePreview({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  if (process.env.NODE_ENV === 'production' && process.env.SCOPE_PREVIEW !== '1') notFound();
  const params = await searchParams;
  return <PreviewBody initial={params.screen} />;
}
