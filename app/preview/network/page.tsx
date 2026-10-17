import { NetworkPreview, type NetworkView } from '@/components/network/surfaces';

export const dynamic = 'force-dynamic';

const VIEWS: NetworkView[] = ['home', 'profile', 'feed', 'org', 'recruit', 'founders', 'group', 'safety'];

export default async function PreviewNetwork({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; theme?: string }>;
}) {
  const params = await searchParams;
  const view = VIEWS.includes(params.view as NetworkView) ? params.view as NetworkView : 'home';
  const theme = params.theme === 'dark' ? 'dark' : 'light';
  return <NetworkPreview view={view} theme={theme} />;
}
