import { SafetyDisclaimerFooter } from '@/components/safety/disclaimer';
import { BRAND } from '@/lib/brand';
import { DESK_NOT_EMERGENCY } from '@/lib/bullying/authority-referral';

export function AuthorityCaseView({
  state,
  agency = '',
  country = '',
  incidentType = '',
  dates = '',
  summary = '',
  reference = '',
  status = '',
  deskContact = 'safety@poketschool.ai',
  emergency = '999',
}: {
  state: 'open' | 'expired' | 'missing';
  agency?: string;
  country?: string;
  incidentType?: string;
  dates?: string;
  summary?: string;
  reference?: string;
  status?: string;
  deskContact?: string;
  emergency?: string;
}) {
  return (
    <main className="min-h-screen" style={{ background: '#f4f7f8', color: BRAND.ink }}>
      <header className="px-6 py-10 text-white" style={{ background: BRAND.hero }}>
        <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>SAFETY DESK</p>
        <h1 className="mt-2 text-4xl font-semibold">Confidential case</h1>
        <p className="mt-2 text-lg">The reporter is not named.</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-4 p-6">
        <article className="rounded-3xl border bg-white p-5 grid gap-2">
          <p className="text-4xl font-extrabold">Call {emergency}</p>
          <p className="font-semibold">{DESK_NOT_EMERGENCY}</p>
        </article>
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
            <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>{agency || 'Agency'}</h2>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Country. </span>{country || 'Not stated'}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Incident type. </span>{incidentType || 'Not stated'}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Dates. </span>{dates || 'Not stated'}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Summary. </span>{summary}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Reference. </span>{reference || 'Not stated'}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Status. </span>{status || 'sent'}</p>
            <p><span className="font-semibold" style={{ color: BRAND.blueDeep }}>Safety Desk. </span>{deskContact}</p>
            <p>The reporter is not named in this message.</p>
          </article>
        ) : null}
        <SafetyDisclaimerFooter emergencyNumber={emergency || '999'} />
      </div>
    </main>
  );
}
