import { ImageResponse } from 'next/og';
import { AmberShareCard, type ShareCardLines } from '@/lib/amber/card';
import { amberPage, type AmberPage } from '@/lib/amber/public';
import { typeLabel } from '@/lib/emergency/policy';
import { SAMPLE_ALERT } from '@/lib/emergency/sample';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { openAmberPage, peekPublicAlert } from '@/lib/server/emergency';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

async function load(id: string): Promise<{ view: AmberPage | null; lines: ShareCardLines | null }> {
  if (id === 'sample') return { view: amberPage(SAMPLE_ALERT), lines: null };
  if (id === 'sample-resolved') return { view: amberPage({ ...SAMPLE_ALERT, id, status: 'resolved', publicRedacted: true }), lines: null };
  if (!isAdminConfigured()) return { view: null, lines: null };
  const view = await openAmberPage(id, false);
  if (view) return { view, lines: null };
  const general = await peekPublicAlert(id);
  if (!general || general.type === 'missing_child') return { view: null, lines: null };
  return {
    view: null,
    lines: {
      title: typeLabel(general.type),
      place: [general.region.city, general.region.country].filter(Boolean).join(', '),
      detail: general.description.slice(0, 140),
    },
  };
}

export default async function AmberOpenGraph({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await load(id);
  return new ImageResponse(<AmberShareCard view={card.view} lines={card.lines} />, { ...size });
}
