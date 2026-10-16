import { notFound } from 'next/navigation';
import { InstitutionPreview } from '@/components/institutions/preview';

export const dynamic = 'force-dynamic';

/** Screenshot route. Stays closed unless INSTITUTION_PREVIEW=1 is set for this process. */
export default function InstitutionConsolePreviewPage() {
  if (process.env.INSTITUTION_PREVIEW !== '1') notFound();
  return <InstitutionPreview />;
}
