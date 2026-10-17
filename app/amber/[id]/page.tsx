import type { Metadata } from 'next';
import { PublicAmber } from '@/components/amber/public-alert';
import { PublicAlert } from '@/components/hotline/surfaces';
import { amberPage, amberReceiveAllowed, type AmberPage } from '@/lib/amber/public';
import { type PublicEmergency } from '@/lib/emergency/policy';
import { SAMPLE_ALERT } from '@/lib/emergency/sample';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { openAmberPage, peekPublicAlert, readPublicAlert } from '@/lib/server/emergency';

export const dynamic = 'force-dynamic';

function sample(id: string) {
  if (id === 'sample') return amberPage(SAMPLE_ALERT);
  if (id === 'sample-resolved') {
    return amberPage({ ...SAMPLE_ALERT, id, status: 'resolved', publicRedacted: true });
  }
  return undefined;
}

type Loaded =
  | { kind: 'amber'; view: AmberPage }
  | { kind: 'public'; view: PublicEmergency }
  | { kind: 'missing' };

async function load(id: string, countView: boolean): Promise<Loaded> {
  amberReceiveAllowed();
  const fixed = sample(id);
  if (fixed) return { kind: 'amber', view: fixed };
  if (fixed === null) return { kind: 'missing' };
  if (!isAdminConfigured()) return { kind: 'missing' };
  const amber = await openAmberPage(id, countView);
  if (amber) return { kind: 'amber', view: amber };
  const general = countView ? await readPublicAlert(id) : await peekPublicAlert(id);
  if (general && general.type !== 'missing_child') return { kind: 'public', view: general };
  return { kind: 'missing' };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const loaded = await load(id, false);
  const view = loaded.kind === 'amber' ? loaded.view : loaded.kind === 'public' ? loaded.view : null;
  const title = loaded.kind === 'amber' && loaded.view.resolved
    ? 'resolved · Poket School'
    : view ? `${view.title} · Poket School` : 'Amber alert · Poket School';
  const canonical = `/amber/${id}`;
  return {
    title,
    description: loaded.kind === 'amber' && loaded.view.resolved ? 'resolved' : view?.description || 'Get free Amber alerts on Poket School',
    alternates: { canonical },
    openGraph: { url: canonical },
    robots: view?.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function AmberAlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await load(id, true);
  if (loaded.kind === 'public') return <PublicAlert view={loaded.view} />;
  return <PublicAmber view={loaded.kind === 'amber' ? loaded.view : null} />;
}
