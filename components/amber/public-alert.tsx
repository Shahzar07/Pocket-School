import { AmberJoin } from '@/components/amber/join';
import { GetInvolvedLink, SafetyDisclaimerFooter } from '@/components/safety/disclaimer';
import { BRAND } from '@/lib/brand';
import { AMBER_JOIN_CTA, type AmberPage } from '@/lib/amber/public';

const cyanButton = {
  background: BRAND.cyan,
  color: BRAND.ink,
  border: `1px solid ${BRAND.blueDeep}`,
} as const;

export function PublicAmber({ view }: { view: AmberPage | null }) {
  if (!view) {
    return (
      <main className="min-h-screen" style={{ background: '#f4f7f8', color: BRAND.ink }}>
        <header className="px-6 py-10 text-white" style={{ background: BRAND.hero }}>
          <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>POKET SCHOOL</p>
          <h1 className="mt-2 text-4xl font-semibold">Amber alert</h1>
        </header>
        <div className="mx-auto grid max-w-xl gap-4 p-6">
          <p>This alert is not available.</p>
          <AmberJoin code="" country="" />
          <GetInvolvedLink />
          <SafetyDisclaimerFooter emergencyNumber="999" />
        </div>
      </main>
    );
  }
  const when = view.publishedAt ? new Date(view.publishedAt).toUTCString() : '';
  const place = [view.city, view.state, view.country].filter(Boolean).join(', ');
  return (
    <main className="min-h-screen" style={{ background: '#f4f7f8', color: BRAND.ink }}>
      <header className="px-6 py-10 text-white" style={{ background: BRAND.hero }}>
        <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>POKET SCHOOL</p>
        <h1 className="mt-2 text-4xl font-semibold">{view.resolved ? 'resolved' : view.title}</h1>
        {place ? <p className="mt-2 text-lg">{place}</p> : null}
      </header>
      <div className="mx-auto grid max-w-xl gap-4 p-6">
        {view.resolved ? (
          <article className="rounded-3xl border bg-white p-5" style={{ color: BRAND.ink }}>
            <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>resolved</h2>
          </article>
        ) : (
          <article className="grid gap-3 rounded-3xl border bg-white p-5" style={{ color: BRAND.ink }}>
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
            <a className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton} href={`/api/emergency/share?id=${view.id}&channel=whatsapp&surface=amber`}>WhatsApp</a>
            <a className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton} href={`/api/emergency/share?id=${view.id}&channel=facebook&surface=amber`}>Facebook</a>
            <a className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton} href={`/api/emergency/share?id=${view.id}&channel=x&surface=amber`}>X</a>
            <a className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton} href={`/api/emergency/share?id=${view.id}&channel=copy&surface=amber`}>Copy link</a>
          </div>
        ) : null}
        <a className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-bold" style={cyanButton} href={view.joinPath}>
          {AMBER_JOIN_CTA}
        </a>
        <AmberJoin code={view.referralCode} country={view.country} />
        {!view.resolved ? <p className="text-sm" style={{ color: BRAND.blueDeep }}>{view.disclaimer}</p> : null}
        <GetInvolvedLink />
        <SafetyDisclaimerFooter emergencyNumber={view.emergencyNumber || '999'} />
      </div>
    </main>
  );
}
