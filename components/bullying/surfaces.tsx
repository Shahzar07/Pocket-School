import { InformSchool } from '@/components/bullying/inform-school';
import { BRAND } from '@/lib/brand';
import { DESK_SLA_MS, NOT_A_COUNSELLOR, evidenceHash, helpNearMe, helplinesForCountry } from '@/lib/bullying/policy';

const cyanButton = {
  background: BRAND.cyan,
  color: BRAND.ink,
  border: `1px solid ${BRAND.blueDeep}`,
} as const;

const slaRows = [
  ['Critical', '15 minutes'],
  ['High', '1 hour'],
  ['Medium', '24 hours'],
  ['Low', '72 hours'],
] as const;

export function HelpSurface() {
  const hash = evidenceHash('Sample note only', new Uint8Array([1, 2, 3]), 1);
  const lines = helplinesForCountry('Malaysia');
  const near = helpNearMe('Malaysia');
  return (
    <main className="min-h-screen" style={{ background: '#f4f7f8', color: BRAND.ink }}>
      <header className="px-6 py-10 text-white" style={{ background: BRAND.hero }}>
        <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>POKET SCHOOL</p>
        <h1 className="mt-2 text-4xl font-semibold">Anti-bullying help</h1>
        <p className="mt-2 text-lg">Free, including when you have no school.</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-4 p-6">
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>ET AI support</h2>
          <p className="mt-2 font-semibold" style={{ color: BRAND.ink }}>{NOT_A_COUNSELLOR}</p>
          <p className="mt-2" style={{ color: BRAND.ink }}>A message about wanting to die goes to the Safety Desk as critical and shows helplines at once.</p>
        </article>
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>Get help near me</h2>
          {near ? <p className="mt-2" style={{ color: BRAND.ink }}>Emergency {near.emergencyNumber}. {near.directoryName}</p> : null}
          <ul className="mt-3 grid gap-2">
            {lines.map(line => (
              <li key={line.name} style={{ color: BRAND.ink }}>{line.name} {line.number}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>Evidence locker</h2>
          <p className="mt-2" style={{ color: BRAND.ink }}>A screenshot and a note are hashed and time-stamped. Only you, a guardian who is allowed, and the Desk can open it.</p>
          <p className="mt-3 break-all text-sm" style={{ color: BRAND.blueDeep }}>SHA-256 {hash}</p>
          <p className="text-sm" style={{ color: BRAND.blueDeep }}>Sample only. This preview is not a report.</p>
          <button type="button" className="mt-4 inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton}>Export PDF</button>
        </article>
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>On Poket School</h2>
          <p className="mt-2" style={{ color: BRAND.ink }}>Restrict keeps a comment visible only to the person who wrote it. Repeated reports limit new messages and connection requests. Adults cannot message under-18s.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton}>Block</button>
            <button type="button" className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton}>Mute</button>
            <button type="button" className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton}>Restrict</button>
          </div>
        </article>
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>How are you doing?</h2>
          <p className="mt-2" style={{ color: BRAND.ink }}>You get this check-in 24 hours after a report, and again after 7 days.</p>
        </article>
      </div>
    </main>
  );
}

export function DeskSurface() {
  return (
    <main className="min-h-screen" style={{ background: '#f4f7f8', color: BRAND.ink }}>
      <header className="px-6 py-10 text-white" style={{ background: BRAND.hero }}>
        <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>SAFETY DESK</p>
        <h1 className="mt-2 text-4xl font-semibold">Bullying desk</h1>
        <p className="mt-2 text-lg">People with no school, and anonymous reports, stay with the on-call rota.</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-4 p-6">
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>Response times</h2>
          <table className="mt-3 w-full text-left">
            <tbody>
              {slaRows.map(([label, window]) => (
                <tr key={label} className="border-t">
                  <th className="py-2 font-semibold" style={{ color: BRAND.blueDeep }}>{label}</th>
                  <td className="py-2" style={{ color: BRAND.ink }}>{window}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm" style={{ color: BRAND.blueDeep }}>
            Critical is {Math.round(DESK_SLA_MS.critical / 60000)} minutes. An unacknowledged critical ticket goes to the backup and to super admins.
          </p>
        </article>
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>School referral</h2>
          <p className="mt-2" style={{ color: BRAND.ink }}>Send this only after the person who reported it agrees, and only if the other school is on Poket School.</p>
          <dl className="mt-3 grid gap-2">
            <div>
              <dt className="text-sm font-semibold" style={{ color: BRAND.blueDeep }}>Consent</dt>
              <dd style={{ color: BRAND.ink }}>Recorded</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold" style={{ color: BRAND.blueDeep }}>Shared</dt>
              <dd style={{ color: BRAND.ink }}>Online. Short account with no names.</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold" style={{ color: BRAND.blueDeep }}>Reporter</dt>
              <dd style={{ color: BRAND.ink }}>Hidden from the school and from the other student.</dd>
            </div>
          </dl>
          <button type="button" className="mt-4 inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton}>Send referral</button>
        </article>
        <InformSchool
          sample
          reportId="sample"
          victimSchoolName="Sample Off Platform School"
          bullySchoolName="Sample Academy"
          bullyOnPoket
        />
        <article className="rounded-3xl border bg-white p-5">
          <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>False reports</h2>
          <p className="mt-2" style={{ color: BRAND.ink }}>Repeated false reports are flagged for a person to review. The reporter is not muted or restricted for that flag.</p>
        </article>
      </div>
    </main>
  );
}
