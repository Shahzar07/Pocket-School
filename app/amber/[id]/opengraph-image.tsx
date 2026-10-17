import { ImageResponse } from 'next/og';
import { AmberShareCard } from '@/lib/amber/card';
import { amberPage } from '@/lib/amber/public';
import { SAMPLE_ALERT } from '@/lib/emergency/sample';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { openAmberPage } from '@/lib/server/emergency';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

async function load(id: string) {
  if (id === 'sample') return amberPage(SAMPLE_ALERT);
  if (id === 'sample-resolved') return amberPage({ ...SAMPLE_ALERT, id, status: 'resolved', publicRedacted: true });
  if (!isAdminConfigured()) return null;
  return openAmberPage(id, false);
}

export default async function AmberOpenGraph({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await load(id);
  return new ImageResponse(<AmberShareCard view={view} />, { ...size });
}
