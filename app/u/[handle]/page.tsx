import { NetworkPreview } from '@/components/network/surfaces';

export const dynamic = 'force-dynamic';

export default async function PublicProfile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return (
    <div>
      <NetworkPreview view="profile" />
      <p style={{ textAlign: 'center', color: '#5C7276' }}>{`/u/${handle}`}</p>
    </div>
  );
}
