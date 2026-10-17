import type { Metadata } from 'next';
import { PublicAmber } from '@/components/amber/public-alert';
import { amberPage, amberReceiveAllowed } from '@/lib/amber/public';
import { SAMPLE_ALERT } from '@/lib/emergency/sample';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { openAmberPage } from '@/lib/server/emergency';

export const dynamic = 'force-dynamic';

function sample(id: string) {
  if (id === 'sample') return amberPage(SAMPLE_ALERT);
  if (id === 'sample-resolved') {
    return amberPage({ ...SAMPLE_ALERT, id, status: 'resolved', publicRedacted: true });
  }
  return undefined;
}

async function load(id: string, countView: boolean) {
  amberReceiveAllowed();
  const fixed = sample(id);
  if (fixed !== undefined) return fixed;
  if (!isAdminConfigured()) return null;
  return openAmberPage(id, countView);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const view = await load(id, false);
  const title = view?.resolved ? 'resolved · Poket School' : view ? `${view.title} · Poket School` : 'Amber alert · Poket School';
  return {
    title,
    description: view?.resolved ? 'resolved' : view?.description || 'Get free Amber alerts on Poket School',
    robots: view?.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function AmberAlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicAmber view={await load(id, true)} />;
}
