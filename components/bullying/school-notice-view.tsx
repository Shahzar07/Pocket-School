import { SafetyDisclaimerFooter } from '@/components/safety/disclaimer';
import { BRAND } from '@/lib/brand';
import { AckForm } from './ack-form';

export function SchoolNoticeView({
  state,
  token,
  joinUrl,
  schoolName = '',
  incidentType = '',
  dates = '',
  summary = '',
  deskContact = 'safety@poketschool.ai',
}: {
  state: 'open' | 'expired' | 'missing';
  token: string;
  joinUrl: string;
  schoolName?: string;
  incidentType?: string;
  dates?: string;
  summary?: string;
  deskContact?: string;
}) {
  return (
    <main className="min-h-screen" style={{ background: '#f4f7f8', color: BRAND.ink }}>
      <header className="px-6 py-10 text-white" style={{ background: BRAND.hero }}>
        <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>SAFETY DESK</p>
        <h1 className="mt-2 text-4xl font-semibold">Confidential notice</h1>
        <p className="mt-2 text-lg">The reporter is not named in this notice.</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-4 p-6">
        {state === 'missing' ? (
          <article className="rounded-3xl border bg-white p-5">
            <p className="text-lg font-semibold">This link is not available.</p>
          </article>
        ) : null}
        {state === 'expired' ? (
          <article className="rounded-3xl border bg-white p-5">
            <p className="text-lg font-semibold">This link has expired.</p>
          </article>
        ) : null}
        {state === 'open' ? (
          <article className="rounded-3xl border bg-white p-5 grid gap-3">
            <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>{schoolName || 'School'}</h2>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Incident type. </span>{incidentType || 'Not stated'}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Dates. </span>{dates || 'Not stated'}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Summary. </span>{summary}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Safety Desk. </span>{deskContact}</p>
            <AckForm token={token} />
            <a href={joinUrl} className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold" style={{ background: BRAND.cyan, color: BRAND.ink, border: `1px solid ${BRAND.blueDeep}` }}>Join Poket School for free safeguarding tools</a>
          </article>
        ) : null}
        <SafetyDisclaimerFooter emergencyNumber="999" />
      </div>
    </main>
  );
}
