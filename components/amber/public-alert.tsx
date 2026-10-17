import { AmberJoin } from '@/components/amber/join';
import { BRAND } from '@/lib/brand';
import { AMBER_JOIN_CTA, type AmberPage } from '@/lib/amber/public';

export function PublicAmber({ view }: { view: AmberPage | null }) {
  if (!view) {
    return (
      <main className="min-h-screen" style={{ background: '#f4f7f8' }}>
        <header className="px-6 py-10 text-white" style={{ background: BRAND.hero }}>
          <p className="text-sm tracking-[0.2em]">POKET SCHOOL</p>
          <h1 className="mt-2 text-4xl font-semibold">Amber alert</h1>
        </header>
        <div className="mx-auto grid max-w-xl gap-4 p-6">
          <p>This alert is not available.</p>
          <AmberJoin code="" country="" />
        </div>
      </main>
    );
  }
  const when = view.publishedAt ? new Date(view.publishedAt).toUTCString() : '';
  const place = [view.city, view.state, view.country].filter(Boolean).join(', ');
  return (
    <main className="min-h-screen" style={{ background: '#f4f7f8' }}>
      <header className="px-6 py-10 text-white" style={{ background: BRAND.hero }}>
        <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>POKET SCHOOL</p>
        <h1 className="mt-2 text-4xl font-semibold">{view.resolved ? 'resolved' : view.title}</h1>
        {place ? <p className="mt-2 text-lg">{place}</p> : null}
      </header>
      <div className="mx-auto grid max-w-xl gap-4 p-6">
        {view.resolved ? (
          <article className="rounded-3xl border bg-white p-5">
            <h2 className="text-2xl font-semibold">resolved</h2>
          </article>
        ) : (
          <article className="grid gap-3 rounded-3xl border bg-white p-5">
            {view.description ? <p>{view.description}</p> : null}
            {when ? <p>{when}</p> : null}
            {view.subjectName ? <p>{view.subjectName}</p> : null}
            {view.photoUrl.startsWith('attachment:') ? (
              <img src={`/api/emergency/public-file?id=${view.id}&attachmentId=${view.photoUrl.slice('attachment:'.length)}`} alt="Photo shared with consent" />
            ) : null}
            {view.agency ? (
              <p><strong>If you have information, contact {view.agency} {view.referenceNumber}</strong></p>
            ) : null}
            <p>Call {view.emergencyNumber}. This page does not show school staff numbers.</p>
          </article>
        )}
        {view.shareEnabled ? (
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex min-h-12 items-center rounded-xl bg-[#1E6A83] px-4 font-semibold text-white" href={`/api/emergency/share?id=${view.id}&channel=whatsapp&surface=amber`}>WhatsApp</a>
            <a className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" href={`/api/emergency/share?id=${view.id}&channel=facebook&surface=amber`}>Facebook</a>
            <a className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" href={`/api/emergency/share?id=${view.id}&channel=x&surface=amber`}>X</a>
            <a className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" href={`/api/emergency/share?id=${view.id}&channel=copy&surface=amber`}>Copy link</a>
          </div>
        ) : null}
        <a className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-bold" style={{ background: BRAND.cyan, color: BRAND.blueDeep }} href={view.joinPath}>
          {AMBER_JOIN_CTA}
        </a>
        <AmberJoin code={view.referralCode} country={view.country} />
        {!view.resolved ? <p className="text-sm text-slate-600">{view.disclaimer}</p> : null}
      </div>
    </main>
  );
}
