import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/brand';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { publicView, typeLabel } from '@/lib/emergency/policy';
import { SAMPLE_ALERT } from '@/lib/emergency/sample';
import { peekPublicAlert } from '@/lib/server/emergency';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

export default async function AlertOpenGraph({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = id === 'sample'
    ? publicView(SAMPLE_ALERT)
    : isAdminConfigured()
      ? await peekPublicAlert(id)
      : null;
  const title = view ? typeLabel(view.type) : 'Alert';
  const place = view ? `${view.region.city}, ${view.region.country}` : 'Poket School';
  const when = view?.publishedAt ? new Date(view.publishedAt).toUTCString() : '';
  const photo = view && view.photoUrl && !view.noindex ? 'Photo shared with consent' : '';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: BRAND.hero, color: '#fff', padding: '72px' }}>
        <div style={{ fontSize: 28, letterSpacing: 4 }}>POKET SCHOOL</div>
        <div style={{ fontSize: 72, marginTop: 16 }}>{title}</div>
        <div style={{ fontSize: 32, marginTop: 18 }}>{place}</div>
        <div style={{ fontSize: 24, marginTop: 12 }}>{when}</div>
        {photo ? <div style={{ fontSize: 24, marginTop: 18 }}>{photo}</div> : null}
      </div>
    ),
    { ...size },
  );
}
