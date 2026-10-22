import { MarketingHero } from '@/components/marketing/illustrations';
import { GetInvolvedLink, SafetyDisclaimerFooter } from '@/components/safety/disclaimer';
import { BRAND } from '@/lib/brand';
import {
  BULLYING_JOIN_CTA,
  NOT_A_COUNSELLOR,
  OFFICIAL_HELPLINES,
  OFF_PLATFORM_STEPS,
  PLATFORM_REPORT_LINKS,
  SAMPLE_BULLYING_CODE,
  bullyingJoinPath,
} from '@/lib/bullying/policy';

const cyanButton = {
  background: BRAND.cyan,
  color: BRAND.ink,
  border: `1px solid ${BRAND.blueDeep}`,
} as const;

const freeActions = [
  'Safety Report',
  'I am in danger',
  'Block',
  'Mute',
  'Restrict',
  'Evidence locker',
  'Get help near me',
  'Report tracker',
];

export function StandUp() {
  const join = bullyingJoinPath(SAMPLE_BULLYING_CODE);
  return (
    <main className="min-h-screen bg-background text-foreground" data-theme-surface="page">
      <header className="overflow-x-clip px-6 py-12 text-white" style={{ background: BRAND.hero }}>
        <MarketingHero slug="stand-up">
          <div className="min-w-0">
            <p className="text-sm tracking-[0.2em]" style={{ color: BRAND.cyan }}>POKET SCHOOL</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold">Stand up to bullying</h1>
            <p className="mt-3 max-w-2xl text-lg">Free anti-bullying help for every person, including someone with no school.</p>
          </div>
        </MarketingHero>
      </header>
      <div className="mx-auto grid max-w-3xl gap-4 p-6">
        <article className="rounded-3xl border border-border bg-card p-5 text-card-foreground">
          <h2 className="text-2xl font-semibold text-primary">Free for everyone</h2>
          <p className="mt-2">No school and no subscription are required. A report still reaches the Poket School Safety Desk.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {freeActions.map(action => (
              <li key={action} className="rounded-full px-3 py-1 text-sm font-semibold" style={cyanButton}>{action}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-3xl border border-border bg-card p-5 text-card-foreground">
          <h2 className="text-2xl font-semibold text-primary">If it happened somewhere else</h2>
          <ol className="mt-3 grid list-decimal gap-2 pl-5">
            {OFF_PLATFORM_STEPS.map(step => <li key={step}>{step}</li>)}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {PLATFORM_REPORT_LINKS.map(link => (
              <a key={link.id} className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={cyanButton} href={link.href}>{link.name}</a>
            ))}
          </div>
        </article>
        <article className="rounded-3xl border border-border bg-card p-5 text-card-foreground">
          <h2 className="text-2xl font-semibold text-primary">Official helplines</h2>
          <p className="mt-2">{NOT_A_COUNSELLOR}</p>
          <ul className="mt-3 grid gap-3">
            {OFFICIAL_HELPLINES.map(line => (
              <li key={line.name} className="rounded-2xl border border-border p-3">
                <p className="font-semibold text-primary">{line.name}</p>
                <p>{line.number}</p>
                <p>{line.note}</p>
                <a className="text-primary" href={line.sourceUrl}>Official source</a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-primary">Other countries stay blank until an official page is checked. This page does not invent a number.</p>
        </article>
        <a className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-bold" style={cyanButton} href={join}>{BULLYING_JOIN_CTA}</a>
        <GetInvolvedLink />
        <p>Referral code {SAMPLE_BULLYING_CODE}</p>
        <p className="text-sm text-primary">This page shows no reports, names, or evidence.</p>
        <SafetyDisclaimerFooter emergencyNumber="999" />
      </div>
    </main>
  );
}
