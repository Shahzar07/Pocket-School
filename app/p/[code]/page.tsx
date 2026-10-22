import type { PublicAlumniView } from '@/lib/alumni';
import { FUNNEL_COPY as COPY } from '@/lib/funnels/copy';
import { publicFunnel } from '@/lib/funnels/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { readPublicAlumni } from '@/lib/server/alumni-store';
import { PublicFunnel } from '@/components/funnels/public-funnel';

export const dynamic = 'force-dynamic';

async function alumniProfile(code: string): Promise<PublicAlumniView | null | undefined> {
  if (!isAdminConfigured()) return null;
  try {
    return await readPublicAlumni(code);
  } catch {
    return null;
  }
}

export default async function PublicCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const found = await publicFunnel(code);
  if (found.state === 'published') return <PublicFunnel funnel={found.funnel} mode="public" />;
  if (found.state === 'draft') {
    return (
      <main className="min-h-screen bg-[#F4FBFA] px-5 py-16 text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2]">
        <article className="mx-auto max-w-xl rounded-[28px] border border-[#1E6A83]/15 bg-white p-8 dark:bg-[#1A1918]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.brand}</p>
          <h1 className="mt-2 font-heading text-3xl tracking-tight">{COPY.notPublished}</h1>
        </article>
      </main>
    );
  }
  const profile = await alumniProfile(code);
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-12 text-[#203337]">
      <article className="mx-auto max-w-xl rounded-[28px] border border-[#203337]/10 bg-white p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Poket School alumni</p>
        {profile === undefined ? <p className="mt-4 text-sm">Opening this record…</p> : null}
        {profile === null ? <p className="mt-4 text-sm leading-relaxed">This profile is private. Certificate pages stay available from each certificate QR.</p> : null}
        {profile ? (
          <>
            <h1 className="mt-2 font-heading text-4xl tracking-tight">{profile.name}</h1>
            <p className="mt-2 text-sm">{profile.institutionName}{profile.level ? ` · ${profile.level}` : ''}</p>
            <p className="mt-1 font-mono text-xs">{profile.studentNumber}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {profile.certificates.map((title) => <li key={title}>{title}</li>)}
            </ul>
            <p className="mt-4 text-sm">{profile.badges} badge{profile.badges === 1 ? '' : 's'} on this account.</p>
          </>
        ) : null}
      </article>
    </main>
  );
}
