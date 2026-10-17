import type { Metadata } from 'next';
import { PublicAlert } from '@/components/hotline/surfaces';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { publicView } from '@/lib/emergency/policy';
import { SAMPLE_ALERT } from '@/lib/emergency/sample';
import { peekPublicAlert, readPublicAlert } from '@/lib/server/emergency';

export const dynamic = 'force-dynamic';

async function load(id: string, countView: boolean) {
  if (id === 'sample') return publicView(SAMPLE_ALERT);
  if (!isAdminConfigured()) return null;
  return countView ? readPublicAlert(id) : peekPublicAlert(id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const view = await load(id, false);
  return {
    title: view ? `${view.title} · Poket School` : 'Alert · Poket School',
    robots: view?.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function AlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicAlert view={await load(id, true)} />;
}
