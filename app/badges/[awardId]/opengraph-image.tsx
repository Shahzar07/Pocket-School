import { ImageResponse } from 'next/og';
import { loadPublicBadge } from '@/lib/server/public-badge';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

export default async function BadgeOpenGraphImage({
  params,
}: {
  params: Promise<{ awardId: string }>;
}) {
  const { awardId } = await params;
  const badge = await loadPublicBadge(awardId);
  const name = badge?.name ?? 'Badge';
  const who = [badge?.earner, badge?.school].filter(Boolean).join(' · ');
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#1A3C34',
          color: '#ffffff',
          padding: '72px',
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, color: '#C8922A' }}>POKET SCHOOL</div>
        <div style={{ fontSize: 84, marginTop: 24 }}>{name}</div>
        <div style={{ fontSize: 32, marginTop: 28, opacity: 0.9 }}>{who || 'Poket School'}</div>
      </div>
    ),
    { ...size },
  );
}
