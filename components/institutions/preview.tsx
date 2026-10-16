'use client';

import { useEffect, useState } from 'react';
import { DemoLeadForm } from '@/components/demo-lead-form';
import { InstitutionDirectory } from '@/components/institutions/directory';
import { InstitutionWorkspace, type WorkspaceAction } from '@/components/institutions/workspace';
import { blankProfile, identityMode, type DirectoryRow } from '@/lib/enterprise';
import type { Institution } from '@/lib/db';
import { AcademyWelcome } from '@/components/academy-welcome';
import { blankAcademySettings } from '@/lib/academy-settings';
import { brandingFor } from '@/lib/white-label';

const profile = blankProfile({
  type: 'university',
  country: 'MY',
  plan: 'enterprise',
  address: { line1: '12 Jalan Ampang', line2: '', city: 'Kuala Lumpur', region: 'Wilayah Persekutuan', postalCode: '50450' },
  contacts: [{ name: 'Amina Yusuf', email: 'amina@north.example', phone: '+60312345678', role: 'Registrar' }],
  billingEmail: 'billing@north.example',
  poNumber: 'PO-2041',
  seatCount: 400,
  seatsUsed: 260,
  licenceStartsOn: '2026-01-01',
  licenceEndsOn: '2026-12-31',
  renewalOn: '2026-11-15',
  amount: 18000,
  currency: 'USD',
  isolateData: true,
});

const rows: DirectoryRow[] = [
  {
    id: 'north',
    name: 'North Academy',
    status: 'active',
    domain: 'north.example',
    subdomain: 'north',
    customDomain: 'learn.north.example',
    profile,
  },
  {
    id: 'harbour',
    name: 'Harbour Civic',
    status: 'pending',
    domain: '',
    subdomain: '',
    customDomain: '',
    profile: blankProfile({ type: 'government', country: 'SG', plan: 'team', seatCount: 80, seatsUsed: 12, renewalOn: '2026-06-01' }),
  },
];

const branding: NonNullable<Institution['branding']> = {
  displayName: 'North Academy',
  tagline: 'A campus that learns together.',
  logoUrl: '',
  primaryColor: '#1E6A83',
  secondaryColor: '#E2AF4D',
  hidePoweredBy: false,
  emailFromName: 'North Academy',
  certificateIssuer: 'North Academy',
  certificateFooter: 'Awarded by North Academy',
  fontId: 'serif',
  loginHeadline: 'Welcome back to North Academy',
  loginBody: 'Sign in with the email your campus issued.',
  mobileAppName: 'North Academy',
  splashColor: '#1E6A83',
};

const academySettings = blankAcademySettings({
  legalName: 'North Academy Sdn Bhd',
  supportEmail: 'hello@north.example',
  signupPolicy: 'domain',
  allowedEmailDomains: ['north.example'],
  require2fa: true,
  passwordRequireSymbol: true,
  sessionTimeoutMinutes: 480,
  ipAllowlist: ['203.0.113.*'],
  taxMode: 'custom',
  taxRate: 0.08,
  taxLabel: 'SST',
  catalogueVisibility: 'curated',
  certificateSignatory: 'Amina Yusuf, Registrar',
  mobileAppName: 'North Academy',
  mobileSubtitle: 'Campus in your pocket',
  splashColor: '#1E6A83',
  iosBundleId: 'ai.poketschool.north',
  androidPackage: 'ai.poketschool.north',
  leaderboard: [{ name: 'Amina Yusuf', points: 120 }, { name: 'Mr Lee', points: 80 }],
  pages: [{ slug: 'about', title: 'About the academy', body: 'A campus that learns together.', published: true }],
});

const VIEWS = ['directory', 'profile', 'people', 'white-label', 'settings', 'content', 'analytics', 'integrations', 'billing', 'audit', 'academy', 'demo'] as const;
type View = (typeof VIEWS)[number];

/** Fixture console for screenshots. It does not write to Firestore. */
export function InstitutionPreview({ initialView = 'directory' }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('view');
    if (requested && (VIEWS as readonly string[]).includes(requested)) setView(requested as View);
  }, []);
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex gap-2 overflow-x-auto">
        {VIEWS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setView(item)}
            className={`rounded-full px-3 py-1.5 text-sm capitalize ${view === item ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
          >
            {item}
          </button>
        ))}
      </div>
      {view === 'directory' && (
        <InstitutionDirectory
          rows={rows}
          leads={[{
            id: 'lead-1',
            name: 'Jonah Adeyemi',
            email: 'jonah@harbour.example',
            organisation: 'Harbour Civic',
            country: 'SG',
            type: 'government',
            seats: 80,
            message: 'We want a private academy for civic staff.',
            status: 'new',
          }]}
          superAdmin
          onOpen={() => setView('profile')}
          onCreate={async () => setView('profile')}
          onBulk={async () => undefined}
          onLead={async () => undefined}
        />
      )}
      {view === 'demo' && (
        <section className="rounded-3xl border border-border bg-card p-6">
          <h1 className="font-heading text-3xl">Request a demo</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tell Poket School about the academy. This preview does not send the form.</p>
          <div className="pointer-events-none mt-4 opacity-100">
            <DemoLeadForm />
          </div>
        </section>
      )}
      {view === 'academy' && (
        <AcademyWelcome
          branding={brandingFor({ name: 'North Academy', branding })}
          catalogueTitles={['Biology foundations']}
          pages={academySettings.pages}
          leaderboard={[{ rank: 1, name: 'Amina Yusuf', points: 120 }, { rank: 2, name: 'Mr Lee', points: 80 }]}
          signupNote="New accounts need an email on an allowed academy domain."
          loginHref="#login"
          coursesHref="#catalogue"
          leaderboardHref="#leaderboard"
          pageHref={() => '#about'}
          address="north.poketschool.ai · /a/north"
        />
      )}
      {view !== 'directory' && view !== 'demo' && view !== 'academy' && (
        <InstitutionWorkspace
          key={view}
          initialTab={view}
          name="North Academy"
          status="active"
          subdomain="north"
          customDomain="learn.north.example"
          domain="north.example"
          branding={branding}
          profile={profile}
          licences={[{
            id: 'lic-1',
            institutionId: 'north',
            programmeIds: ['secondary'],
            seats: 400,
            seatsUsed: 260,
            startsOn: '2026-01-01',
            endsOn: '2026-12-31',
            currency: 'USD',
            amount: 18000,
            allowOwnCourses: true,
            status: 'active',
          }]}
          programmes={[{ id: 'secondary', name: 'Secondary' }, { id: 'professional', name: 'Professional' }]}
          members={[{ id: 'm1', name: 'Amina Yusuf', email: 'amina@north.example', role: 'teacher', academyRole: 'institution_admin' }]}
          invites={[{ email: 'lee@north.example', name: 'Mr Lee', role: 'teacher', academyRole: 'teacher' }]}
          groups={[{ id: 'g1', name: 'City campus', programmeIds: ['secondary'], memberIds: [], kind: 'campus' }]}
          catalogue={[{ id: 'c1', kind: 'course', refId: 'biology', title: 'Biology foundations', visibility: 'private' }]}
          compliance={[{ id: 'k1', title: 'Campus safety', courseId: '', dueOn: '2026-11-01', remindDays: 14, status: 'open' }]}
          invoices={[{ id: 'i1', number: 'PS-2041', amount: 18000, currency: 'USD', seats: 400, status: 'po', poNumber: 'PO-2041', issuedOn: '2026-01-02' }]}
          webhooks={[]}
          apiKeys={[{ id: 'k', name: 'Campus SIS', prefix: 'pk_abcd1234' }]}
          paths={[{ id: 'p1', name: 'New teacher path', items: ['course:biology'] }]}
          skills={[{ id: 's1', domain: 'Communication', name: 'Explain a topic clearly', level: 'practised' }]}
          audit={[{ actorId: 'admin', actorName: 'Platform admin', action: 'save-brand', target: 'north', at: '2026-10-15T09:00:00.000Z' }]}
          contentOptions={[
            { token: 'course:biology', label: 'Biology foundations', group: 'Courses' },
            { token: 'book:monsoon', label: 'Monsoon Market', group: 'Books' },
          ]}
          identity={identityMode({})}
          settings={academySettings}
          domainStatus="manual"
          domainMessage="Add the CNAME, then check DNS. SSL attaches when the Vercel token is set."
          previousSubdomains={['old-north']}
          superAdmin
          currency="USD"
          onAction={async (action: WorkspaceAction) => {
            void action;
          }}
        />
      )}
    </div>
  );
}
