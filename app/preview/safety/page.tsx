import { DashHeader, DashPage } from '@/components/dash-ui';
import { SafetyDesk } from '@/components/safety/desk';
import { SafetyPreview } from '@/components/safety/surfaces';

export const dynamic = 'force-dynamic';

export default async function PreviewSafety({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const view = params.view ?? 'tracker';
  if (view === 'danger' || view === 'tracker') {
    return (
      <DashPage>
        <DashHeader
          eyebrow="Safeguarding"
          title={view === 'danger' ? 'I need help now' : 'Report a safety concern'}
          description={view === 'danger'
            ? 'Call the emergency number first. Then tell the school. A place is typed once. There is no GPS.'
            : 'Tap the type that fits. You do not have to write anything else.'}
        />
        <SafetyDesk sample focus={view === 'danger' ? 'danger' : 'report'} />
      </DashPage>
    );
  }
  return <SafetyPreview view={view} />;
}
