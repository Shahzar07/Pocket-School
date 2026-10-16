'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AllocationPicker } from '@/components/allocation-picker';
import { CountrySelect, PhoneField } from '@/components/country-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildXlsx } from '@/lib/insights/xlsx';
import { certificateBrandLine, licencePhase, type OemLicence } from '@/lib/oem';
import { brandedInvite } from '@/lib/oem';
import { institutionOrigin } from '@/lib/white-label';
import {
  ACADEMY_ROLES, BRAND_FONTS, GROUP_KINDS, INSTITUTION_PLANS, INSTITUTION_TYPES, INTEGRATION_ENV,
  SKILL_FRAMEWORK, analyticsToCsv, blankProfile, canHidePoweredBy, canUseCustomDomain,
  complianceState, renewalState, rollupAnalytics, seatUtilisation,
  type AcademyRole, type AnalyticsRollup, type AuditEvent, type GroupKind, type IdentityMode,
  type InstitutionPlan, type InstitutionProfile, type InstitutionStatus, type InstitutionType,
} from '@/lib/enterprise';
import type { AllocationOption } from '@/components/allocation-picker';
import type { Institution } from '@/lib/db';
import type {
  ApiKeyItem, CatalogueItem, ComplianceItem, InvoiceItem, LearningPathItem, SkillItem, WebhookItem,
} from '@/lib/institution-store';
import type { AcademyClass, AcademyInvite, AcademyMember, Programme } from '@/lib/db';
import { InstitutionSettings } from '@/components/institutions/settings-panel';
import type { AcademySettings } from '@/lib/academy-settings';
import { blankAcademySettings } from '@/lib/academy-settings';

const TABS = ['profile', 'people', 'white-label', 'settings', 'content', 'analytics', 'integrations', 'billing', 'audit'] as const;
type Tab = (typeof TABS)[number];

export type WorkspaceAction =
  | { type: 'save-profile'; name: string; profile: InstitutionProfile }
  | { type: 'save-brand'; subdomain: string; customDomain: string; branding: NonNullable<Institution['branding']> }
  | { type: 'save-settings'; settings: AcademySettings }
  | { type: 'verify-domain' }
  | { type: 'privacy-erase' }
  | { type: 'status'; status: InstitutionStatus }
  | { type: 'delete' }
  | { type: 'invite'; csv: string }
  | { type: 'group'; name: string; kind: GroupKind; programmeIds: string[] }
  | { type: 'catalogue'; tokens: string[]; visibility: 'private' | 'public' }
  | { type: 'compliance'; title: string; dueOn: string; remindDays: number }
  | { type: 'invoice'; amount: number; seats: number; status: InvoiceItem['status']; poNumber: string }
  | { type: 'webhook'; url: string }
  | { type: 'api-key'; name: string }
  | { type: 'path'; name: string; tokens: string[] }
  | { type: 'skills' }
  | { type: 'schedule'; cadence: 'weekly' | 'daily' | 'term' }
  | { type: 'licence'; programmeIds: string[]; seats: number; startsOn: string; endsOn: string; amount: number; allowOwnCourses: boolean };

function download(filename: string, bytes: BlobPart, mime: string) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function InstitutionWorkspace({
  initialTab = 'profile',
  name,
  status,
  subdomain,
  customDomain,
  domain,
  branding,
  profile,
  licences,
  programmes,
  members,
  invites,
  groups,
  catalogue,
  compliance,
  invoices,
  webhooks,
  apiKeys,
  paths,
  skills,
  audit,
  contentOptions,
  identity,
  settings,
  domainStatus = '',
  domainMessage = '',
  previousSubdomains = [],
  superAdmin,
  currency,
  busy,
  onAction,
}: {
  name: string;
  status: InstitutionStatus;
  subdomain: string;
  customDomain: string;
  domain: string;
  branding: NonNullable<Institution['branding']>;
  profile: InstitutionProfile;
  licences: OemLicence[];
  programmes: Pick<Programme, 'id' | 'name'>[];
  members: AcademyMember[];
  invites: AcademyInvite[];
  groups: AcademyClass[];
  catalogue: CatalogueItem[];
  compliance: ComplianceItem[];
  invoices: InvoiceItem[];
  webhooks: WebhookItem[];
  apiKeys: ApiKeyItem[];
  paths: LearningPathItem[];
  skills: SkillItem[];
  audit: AuditEvent[];
  contentOptions: AllocationOption[];
  identity: IdentityMode;
  settings?: AcademySettings;
  domainStatus?: string;
  domainMessage?: string;
  previousSubdomains?: string[];
  superAdmin: boolean;
  currency: string;
  busy?: boolean;
  initialTab?: Tab;
  onAction: (action: WorkspaceAction) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const today = new Date().toISOString().slice(0, 10);
  const rollup = useMemo(() => rollupAnalytics({
    seats: profile.seatCount,
    seatsUsed: profile.seatsUsed,
    members: members.length,
    activeMembers: members.filter((member) => member.role !== 'parent').length,
    completions: compliance.filter((item) => item.status === 'done').length,
    assigned: compliance.length,
    skills: Object.fromEntries(skills.map((skill) => [skill.name, 1])),
  }), [profile, members, compliance, skills]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/admin/institutions" className="text-xs font-semibold text-muted-foreground">Institutions</Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-4xl">{name}</h1>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{profile.type} · {profile.plan} · {status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {superAdmin && status !== 'suspended' && (
              <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'status', status: 'suspended' })}>Suspend</Button>
            )}
            {superAdmin && status !== 'active' && (
              <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'status', status: 'active' })}>Activate</Button>
            )}
            {superAdmin && (
              <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'delete' })}>Delete</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm capitalize ${tab === item ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
          >
            {item === 'white-label' ? 'White-label' : item}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <ProfileTab name={name} profile={profile} busy={busy} superAdmin={superAdmin} onAction={onAction} />
      )}
      {tab === 'people' && (
        <PeopleTab invites={invites} members={members} groups={groups} programmes={programmes} branding={branding} subdomain={subdomain} busy={busy} onAction={onAction} />
      )}
      {tab === 'white-label' && (
        <BrandTab name={name} plan={profile.plan} subdomain={subdomain} customDomain={customDomain} domain={domain} branding={branding} busy={busy} superAdmin={superAdmin} onAction={onAction} />
      )}
      {tab === 'settings' && (
        <InstitutionSettings
          name={name}
          profile={profile}
          branding={branding}
          subdomain={subdomain}
          customDomain={customDomain}
          domainStatus={domainStatus}
          domainMessage={domainMessage}
          previousSubdomains={previousSubdomains}
          settings={settings ?? blankAcademySettings()}
          identity={identity}
          audit={audit}
          paths={paths}
          skills={skills}
          webhooks={webhooks}
          apiKeys={apiKeys}
          superAdmin={superAdmin}
          busy={busy}
          onAction={onAction}
        />
      )}
      {tab === 'content' && (
        <ContentTab catalogue={catalogue} compliance={compliance} paths={paths} skills={skills} contentOptions={contentOptions} today={today} busy={busy} onAction={onAction} />
      )}
      {tab === 'analytics' && <AnalyticsTab name={name} rollup={rollup} onAction={onAction} busy={busy} />}
      {tab === 'integrations' && <IntegrationsTab identity={identity} webhooks={webhooks} apiKeys={apiKeys} busy={busy} onAction={onAction} />}
      {tab === 'billing' && (
        <BillingTab profile={profile} licences={licences} invoices={invoices} programmes={programmes} currency={currency} today={today} superAdmin={superAdmin} busy={busy} onAction={onAction} />
      )}
      {tab === 'audit' && <AuditTab audit={audit} />}
    </div>
  );
}

function ProfileTab({
  name, profile, busy, superAdmin, onAction,
}: {
  name: string;
  profile: InstitutionProfile;
  busy?: boolean;
  superAdmin: boolean;
  onAction: (action: WorkspaceAction) => Promise<void>;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draft, setDraft] = useState(profile);
  const contact = draft.contacts[0] ?? { name: '', email: '', phone: '', role: 'Primary' };
  return (
    <form
      className="rounded-3xl border border-border p-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onAction({ type: 'save-profile', name: draftName, profile: draft });
      }}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Name<Input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-sm">Type
          <select aria-label="Institution type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as InstitutionType })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 capitalize">
            {INSTITUTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>
      <CountrySelect label="Country" value={draft.country} onChange={(country) => setDraft({ ...draft, country })} />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Address<Input value={draft.address.line1} onChange={(event) => setDraft({ ...draft, address: { ...draft.address, line1: event.target.value } })} className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-sm">City<Input value={draft.address.city} onChange={(event) => setDraft({ ...draft, address: { ...draft.address, city: event.target.value } })} className="mt-1 h-11 rounded-xl" /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Contact name<Input value={contact.name} onChange={(event) => setDraft({ ...draft, contacts: [{ ...contact, name: event.target.value }] })} className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-sm">Contact email<Input type="email" value={contact.email} onChange={(event) => setDraft({ ...draft, contacts: [{ ...contact, email: event.target.value }] })} className="mt-1 h-11 rounded-xl" /></label>
      </div>
      <PhoneField country={draft.country} label="Contact phone" value={contact.phone} onChange={(phone) => setDraft({ ...draft, contacts: [{ ...contact, phone }] })} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.isolateData} onChange={(event) => setDraft({ ...draft, isolateData: event.target.checked })} disabled={!superAdmin} />
        Sub-academy with its own data. Members of another academy cannot read it.
      </label>
      {superAdmin && (
        <label className="text-sm">Parent academy id
          <Input value={draft.parentInstitutionId} onChange={(event) => setDraft({ ...draft, parentInstitutionId: event.target.value })} className="mt-1 h-11 rounded-xl" />
        </label>
      )}
      <Button type="submit" className="rounded-full" disabled={busy}>Save profile</Button>
    </form>
  );
}

function SinglePerson({
  busy,
  onInvite,
}: {
  busy?: boolean;
  onInvite: (csv: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [person, setPerson] = useState('');
  const [role, setRole] = useState<AcademyRole>('learner');
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <Input aria-label="Person email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@school.example" className="h-11 rounded-xl" />
      <Input aria-label="Person name" value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Name" className="h-11 rounded-xl" />
      <select aria-label="Person role" value={role} onChange={(event) => setRole(event.target.value as AcademyRole)} className="h-11 rounded-xl border border-border bg-background px-3 capitalize">
        {ACADEMY_ROLES.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
      </select>
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        disabled={busy}
        onClick={() => onInvite(`${email},${person},${role}`)}
      >
        Add person
      </Button>
    </div>
  );
}

function PeopleTab({
  invites, members, groups, programmes, branding, subdomain, busy, onAction,
}: {
  invites: AcademyInvite[];
  members: AcademyMember[];
  groups: AcademyClass[];
  programmes: Pick<Programme, 'id' | 'name'>[];
  branding: NonNullable<Institution['branding']>;
  subdomain: string;
  busy?: boolean;
  onAction: (action: WorkspaceAction) => Promise<void>;
}) {
  const [csv, setCsv] = useState('email,name,role\n');
  const [groupName, setGroupName] = useState('');
  const [kind, setKind] = useState<GroupKind>('class');
  const [programmeIds, setProgrammeIds] = useState<string[]>([]);
  const origin = subdomain ? institutionOrigin(subdomain) : 'https://poketschool.ai';
  const preview = brandedInvite({
    displayName: branding.displayName || 'Academy',
    emailFromName: branding.emailFromName,
  }, 'JOINCODE', origin, { subject: branding.inviteSubject, text: branding.inviteBody });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Add people</h2>
        <p className="text-sm text-muted-foreground">Add one person, or paste a CSV. Roles: institution admin, manager, teacher, learner, parent. Email and join-link invites copy a message. SSO and SCIM stay on the integrations tab and stay off until the platform keys exist. HRIS and SIS lists use this same CSV.</p>
        <SinglePerson onInvite={(line) => void onAction({ type: 'invite', csv: line })} busy={busy} />
        <textarea aria-label="Invite CSV" className="min-h-28 w-full rounded-xl border border-border p-3 text-sm" value={csv} onChange={(event) => setCsv(event.target.value)} />
        <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'invite', csv })}>Save invites and copy the email</Button>
        <p className="text-xs text-muted-foreground">{invites.length} invites waiting · {members.length} members</p>
        <ul className="text-sm space-y-1">
          {members.slice(0, 8).map((member) => (
            <li key={member.id}>{member.name || member.email} · {member.academyRole || member.role}</li>
          ))}
        </ul>
        <p className="rounded-xl bg-muted/40 p-3 text-xs whitespace-pre-wrap">{preview.subject}{'\n'}{preview.text}</p>
      </section>
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Groups</h2>
        <p className="text-sm text-muted-foreground">Campuses, departments, classes, and groups. Allocate programmes with the same picker used everywhere else.</p>
        <Input aria-label="Group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} className="h-11 rounded-xl" placeholder="North campus" />
        <select aria-label="Group kind" value={kind} onChange={(event) => setKind(event.target.value as GroupKind)} className="h-11 w-full rounded-xl border border-border bg-background px-3 capitalize">
          {GROUP_KINDS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <AllocationPicker
          label="Programmes"
          chips={[]}
          allowCustom={false}
          value={programmeIds.map((id) => `programme:${id}`)}
          options={programmes.map((programme) => ({ token: `programme:${programme.id}`, label: programme.name, group: 'Programmes' }))}
          onChange={(tokens) => setProgrammeIds(tokens.filter((token) => token.startsWith('programme:')).map((token) => token.slice('programme:'.length)))}
        />
        <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'group', name: groupName, kind, programmeIds })}>Add group</Button>
        <ul className="text-sm space-y-1">
          {groups.map((group) => <li key={group.id}>{group.name} · {group.kind || 'class'}</li>)}
        </ul>
        <p className="text-xs text-muted-foreground">Accepted roles: {ACADEMY_ROLES.join(', ')}.</p>
      </section>
    </div>
  );
}

function BrandTab({
  name, plan, subdomain, customDomain, domain, branding, busy, superAdmin, onAction,
}: {
  name: string;
  plan: InstitutionPlan;
  subdomain: string;
  customDomain: string;
  domain: string;
  branding: NonNullable<Institution['branding']>;
  busy?: boolean;
  superAdmin: boolean;
  onAction: (action: WorkspaceAction) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    subdomain,
    customDomain,
    displayName: branding.displayName ?? name,
    tagline: branding.tagline ?? '',
    logoUrl: branding.logoUrl ?? '',
    primaryColor: branding.primaryColor ?? '#1E6A83',
    secondaryColor: branding.secondaryColor ?? '#E2AF4D',
    fontId: branding.fontId ?? 'system',
    faviconUrl: branding.faviconUrl ?? '',
    loginHeadline: branding.loginHeadline ?? '',
    loginBody: branding.loginBody ?? '',
    emailFromName: branding.emailFromName ?? '',
    inviteSubject: branding.inviteSubject ?? '',
    inviteBody: branding.inviteBody ?? '',
    certificateIssuer: branding.certificateIssuer ?? '',
    certificateFooter: branding.certificateFooter ?? '',
    mobileAppName: branding.mobileAppName ?? '',
    mobileIconUrl: branding.mobileIconUrl ?? '',
    splashColor: branding.splashColor ?? '#1E6A83',
    hidePoweredBy: branding.hidePoweredBy === true,
  });
  const hideAllowed = canHidePoweredBy(plan);
  const domainAllowed = canUseCustomDomain(plan);
  const brandLine = certificateBrandLine({ displayName: draft.displayName, certificateIssuer: draft.certificateIssuer });
  const color = /^#[0-9a-fA-F]{6}$/.test(draft.primaryColor) ? draft.primaryColor : '#1E6A83';
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <form
        className="rounded-3xl border border-border p-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onAction({
            type: 'save-brand',
            subdomain: draft.subdomain,
            customDomain: domainAllowed ? draft.customDomain : customDomain,
            branding: {
              displayName: draft.displayName,
              tagline: draft.tagline,
              logoUrl: draft.logoUrl,
              primaryColor: draft.primaryColor,
              secondaryColor: draft.secondaryColor,
              fontId: draft.fontId,
              faviconUrl: draft.faviconUrl,
              loginHeadline: draft.loginHeadline,
              loginBody: draft.loginBody,
              emailFromName: draft.emailFromName,
              inviteSubject: draft.inviteSubject,
              inviteBody: draft.inviteBody,
              certificateIssuer: draft.certificateIssuer,
              certificateFooter: draft.certificateFooter,
              mobileAppName: draft.mobileAppName,
              mobileIconUrl: draft.mobileIconUrl,
              splashColor: draft.splashColor,
              hidePoweredBy: hideAllowed ? draft.hidePoweredBy : false,
            },
          });
        }}
      >
        <h2 className="font-semibold">Brand</h2>
        <label className="text-sm">Subdomain
          <span className="mt-1 flex items-center gap-2">
            <Input value={draft.subdomain} onChange={(event) => setDraft({ ...draft, subdomain: event.target.value })} className="h-11 rounded-xl" />
            <span className="text-xs text-muted-foreground">.poketschool.ai</span>
          </span>
        </label>
        <p className="text-xs text-muted-foreground">Until poketschool.ai wildcard DNS is live, this academy is also at /a/{draft.subdomain || 'slug'}. Renaming keeps the previous address as a redirect.</p>
        <label className="text-sm">Custom domain
          <Input value={draft.customDomain} disabled={!domainAllowed && !superAdmin} onChange={(event) => setDraft({ ...draft, customDomain: event.target.value })} className="mt-1 h-11 rounded-xl" placeholder="learn.school.example" />
        </label>
        {!domainAllowed && <p className="text-xs text-muted-foreground">Custom domains open on the enterprise and OEM plans. This academy keeps its Poket School subdomain.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">Display name<Input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">Logo URL<Input value={draft.logoUrl} onChange={(event) => setDraft({ ...draft, logoUrl: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">Accent
            <Input aria-label="Accent colour" value={draft.primaryColor} onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })} className="mt-1 h-11 rounded-xl" />
          </label>
          <label className="text-sm">Second colour
            <Input aria-label="Second colour" value={draft.secondaryColor} onChange={(event) => setDraft({ ...draft, secondaryColor: event.target.value })} className="mt-1 h-11 rounded-xl" />
          </label>
        </div>
        <label className="text-sm">Font
          <select aria-label="Brand font" value={draft.fontId} onChange={(event) => setDraft({ ...draft, fontId: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
            {BRAND_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Favicon URL<Input value={draft.faviconUrl} onChange={(event) => setDraft({ ...draft, faviconUrl: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-sm">Login headline<Input value={draft.loginHeadline} onChange={(event) => setDraft({ ...draft, loginHeadline: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-sm">Login note<Input value={draft.loginBody} onChange={(event) => setDraft({ ...draft, loginBody: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-sm">Email from name<Input value={draft.emailFromName} onChange={(event) => setDraft({ ...draft, emailFromName: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-sm">Invite subject<Input value={draft.inviteSubject} onChange={(event) => setDraft({ ...draft, inviteSubject: event.target.value })} placeholder="{{school}} invited you" className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-sm">Invite body
          <textarea aria-label="Invite body" value={draft.inviteBody} onChange={(event) => setDraft({ ...draft, inviteBody: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-border p-3 text-sm" placeholder="Join {{school}} at {{origin}} with {{code}}." />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">Certificate name<Input value={draft.certificateIssuer} onChange={(event) => setDraft({ ...draft, certificateIssuer: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">Certificate footer<Input value={draft.certificateFooter} onChange={(event) => setDraft({ ...draft, certificateFooter: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        </div>
        <p className="text-xs text-muted-foreground">Mobile app name, icon, and splash are stored for the branded app build. The store listing is not published from this screen.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">App name<Input value={draft.mobileAppName} onChange={(event) => setDraft({ ...draft, mobileAppName: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">App icon URL<Input value={draft.mobileIconUrl} onChange={(event) => setDraft({ ...draft, mobileIconUrl: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.hidePoweredBy}
            disabled={!hideAllowed}
            onChange={(event) => setDraft({ ...draft, hidePoweredBy: event.target.checked })}
          />
          Hide “Powered by Poket School”
        </label>
        {!hideAllowed && <p className="text-xs text-muted-foreground">This plan keeps “Powered by Poket School”. Enterprise and OEM can turn it off.</p>}
        <Button type="submit" className="rounded-full" disabled={busy}>Save white-label</Button>
        {domain && <p className="text-xs text-muted-foreground">Email domain on file: {domain}</p>}
      </form>
      <div className="space-y-4">
        <article className="rounded-3xl border border-border p-5" style={{ borderColor: color }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color }}>Login</p>
          <h3 className="font-heading text-3xl mt-2">{draft.loginHeadline || draft.displayName}</h3>
          <p className="text-sm text-muted-foreground mt-2">{draft.loginBody || draft.tagline || 'Sign in to your academy.'}</p>
          {!draft.hidePoweredBy && <p className="mt-4 text-xs">Powered by Poket School</p>}
        </article>
        <article className="rounded-3xl border p-5 text-center" style={{ borderColor: color }}>
          <p className="text-[11px] tracking-[0.28em]" style={{ color }}>{brandLine.toUpperCase()}</p>
          <h3 className="font-heading text-2xl mt-3">Certificate of Achievement</h3>
          <p className="mt-2 text-sm">Issued by {brandLine}</p>
          {draft.certificateFooter && <p className="mt-2 text-xs text-muted-foreground">{draft.certificateFooter}</p>}
          {!draft.hidePoweredBy && <p className="mt-3 text-xs">Powered by Poket School</p>}
        </article>
        <article className="mx-auto w-[220px] rounded-[2rem] border border-border p-3" style={{ background: /^#[0-9a-fA-F]{6}$/.test(draft.splashColor) ? draft.splashColor : color }}>
          <div className="rounded-[1.4rem] bg-white p-4 text-center text-slate-900">
            <p className="text-xs uppercase tracking-wider">App</p>
            <p className="font-semibold mt-2">{draft.mobileAppName || draft.displayName}</p>
            {!draft.hidePoweredBy && <p className="text-[10px] mt-3">Powered by Poket School</p>}
          </div>
        </article>
      </div>
    </div>
  );
}

function ContentTab({
  catalogue, compliance, paths, skills, contentOptions, today, busy, onAction,
}: {
  catalogue: CatalogueItem[];
  compliance: ComplianceItem[];
  paths: LearningPathItem[];
  skills: SkillItem[];
  contentOptions: AllocationOption[];
  today: string;
  busy?: boolean;
  onAction: (action: WorkspaceAction) => Promise<void>;
}) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [title, setTitle] = useState('');
  const [dueOn, setDueOn] = useState(today);
  const [remindDays, setRemindDays] = useState(7);
  const [pathName, setPathName] = useState('');
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Catalogue</h2>
        <p className="text-sm text-muted-foreground">Private items stay inside this academy. Public items are the curated catalogue.</p>
        <Link href="/dashboard/teacher/upload" className="text-sm font-semibold text-primary">Upload the academy’s own content</Link>
        <select aria-label="Catalogue visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'public')} className="h-11 rounded-xl border border-border bg-background px-3">
          <option value="private">Private catalogue</option>
          <option value="public">Curated public catalogue</option>
        </select>
        <AllocationPicker label="Courses, books, and paths" chips={[]} allowCustom={false} value={tokens} options={contentOptions} onChange={setTokens} />
        <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'catalogue', tokens, visibility })}>Allocate</Button>
        <ul className="text-sm space-y-1">
          {catalogue.map((item) => <li key={item.id}>{item.title} · {item.visibility}</li>)}
        </ul>
      </section>
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Mandatory training</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input aria-label="Training title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Safety induction" className="h-11 rounded-xl" />
          <Input aria-label="Due date" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} className="h-11 rounded-xl" />
          <Input aria-label="Remind days before" type="number" min={0} value={remindDays} onChange={(event) => setRemindDays(Number(event.target.value))} className="h-11 rounded-xl" />
        </div>
        <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'compliance', title, dueOn, remindDays })}>Add requirement</Button>
        <ul className="text-sm space-y-1">
          {compliance.map((item) => (
            <li key={item.id}>{item.title} · {complianceState(item.dueOn, item.remindDays, today)} · due {item.dueOn}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Learning paths and skills</h2>
        <Input aria-label="Path name" value={pathName} onChange={(event) => setPathName(event.target.value)} placeholder="New teacher path" className="h-11 rounded-xl" />
        <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'path', name: pathName, tokens })}>Save path from the selection above</Button>
        <ul className="text-sm">{paths.map((path) => <li key={path.id}>{path.name} · {path.items.length} items</li>)}</ul>
        <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'skills' })}>Add the Poket skills framework</Button>
        <ul className="text-sm">{skills.map((skill) => <li key={skill.id}>{skill.domain}: {skill.name}</li>)}</ul>
        {skills.length === 0 && <p className="text-xs text-muted-foreground">{SKILL_FRAMEWORK.length} skills are ready to add.</p>}
      </section>
    </div>
  );
}

function AnalyticsTab({
  name, rollup, onAction, busy,
}: {
  name: string;
  rollup: AnalyticsRollup;
  busy?: boolean;
  onAction: (action: WorkspaceAction) => Promise<void>;
}) {
  const exportXlsx = () => {
    const bytes = buildXlsx(
      ['Metric', 'Value'],
      [
        ['Seat utilisation', rollup.seatUtilisation],
        ['Engagement', rollup.engagement],
        ['Completion rate', rollup.completionRate],
        ...rollup.skills.map((skill) => [skill.name, skill.count] as [string, number]),
      ],
      new Date().getFullYear(),
    );
    download(`${name}-analytics.xlsx`, new Uint8Array(bytes), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };
  return (
    <section className="rounded-3xl border border-border p-5 space-y-4">
      <h2 className="font-semibold">Academy analytics</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          ['Seat utilisation', `${Math.round(rollup.seatUtilisation * 100)}%`],
          ['Engagement', `${Math.round(rollup.engagement * 100)}%`],
          ['Completions', `${Math.round(rollup.completionRate * 100)}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-heading text-3xl">{value}</p>
          </div>
        ))}
      </div>
      <ul className="text-sm">{rollup.skills.map((skill) => <li key={skill.name}>{skill.name}: {skill.count}</li>)}</ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={() => download(`${name}-analytics.csv`, analyticsToCsv(rollup), 'text/csv')}>Export CSV</Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={exportXlsx}>Export XLSX</Button>
        <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'schedule', cadence: 'weekly' })}>Schedule weekly report</Button>
      </div>
    </section>
  );
}

function IntegrationsTab({
  identity, webhooks, apiKeys, busy, onAction,
}: {
  identity: IdentityMode;
  webhooks: WebhookItem[];
  apiKeys: ApiKeyItem[];
  busy?: boolean;
  onAction: (action: WorkspaceAction) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [keyName, setKeyName] = useState('Academy key');
  const cards = [
    ['SSO SAML', identity.saml, INTEGRATION_ENV.saml],
    ['SSO OIDC', identity.oidc, INTEGRATION_ENV.oidc],
    ['SCIM', identity.scim, INTEGRATION_ENV.scim],
    ['LTI', identity.lti, INTEGRATION_ENV.lti],
    ['Zoom', identity.zoom, INTEGRATION_ENV.zoom],
    ['Teams', identity.teams, INTEGRATION_ENV.teams],
  ] as const;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sign-in mode: {identity.mode === 'sso' ? 'SSO' : 'email and join links'}. Connectors without keys stay off. HRIS and SIS sync uses the people CSV.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(([label, on, keys]) => (
          <article key={label} className="rounded-2xl border border-border p-4">
            <p className="font-semibold">{label}</p>
            <p className="text-sm mt-1">{on ? 'Ready' : 'Waiting for keys'}</p>
            <p className="text-xs text-muted-foreground mt-2">{keys.join(', ')}</p>
          </article>
        ))}
      </div>
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">API keys and webhooks</h2>
        <p className="text-sm text-muted-foreground">The full key is shown once and only its hash is stored.</p>
        <div className="flex gap-2">
          <Input aria-label="API key name" value={keyName} onChange={(event) => setKeyName(event.target.value)} className="h-11 rounded-xl" />
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'api-key', name: keyName })}>Create key</Button>
        </div>
        <ul className="text-sm">{apiKeys.map((key) => <li key={key.id}>{key.name} · {key.prefix}…</li>)}</ul>
        <div className="flex gap-2">
          <Input aria-label="Webhook URL" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.edu/hooks/poket" className="h-11 rounded-xl" />
          <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'webhook', url })}>Add webhook</Button>
        </div>
        <ul className="text-sm">{webhooks.map((hook) => <li key={hook.id}>{hook.url}</li>)}</ul>
      </section>
    </div>
  );
}

function BillingTab({
  profile, licences, invoices, programmes, currency, today, superAdmin, busy, onAction,
}: {
  profile: InstitutionProfile;
  licences: OemLicence[];
  invoices: InvoiceItem[];
  programmes: Pick<Programme, 'id' | 'name'>[];
  currency: string;
  today: string;
  superAdmin: boolean;
  busy?: boolean;
  onAction: (action: WorkspaceAction) => Promise<void>;
}) {
  const [seats, setSeats] = useState(String(profile.seatCount || 30));
  const [amount, setAmount] = useState(String(profile.amount || ''));
  const [startsOn, setStartsOn] = useState(profile.licenceStartsOn || today);
  const [endsOn, setEndsOn] = useState(profile.licenceEndsOn || `${today.slice(0, 4)}-12-31`);
  const [programmeIds, setProgrammeIds] = useState<string[]>([]);
  const [allowOwnCourses, setAllowOwnCourses] = useState(true);
  const [poNumber, setPoNumber] = useState(profile.poNumber);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceItem['status']>(superAdmin ? 'quote' : 'requested');
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Seats and term</h2>
        <p className="text-sm text-muted-foreground">
          {profile.seatsUsed}/{profile.seatCount} seats · renewal {renewalState(profile.renewalOn, today)} · {Math.round(seatUtilisation(profile.seatsUsed, profile.seatCount) * 100)}% used
        </p>
        <label className="text-sm">Plan
          <select aria-label="Plan" value={profile.plan} disabled className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 capitalize">
            {INSTITUTION_PLANS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </select>
        </label>
        <AllocationPicker
          label="Programmes on this licence"
          chips={[]}
          allowCustom={false}
          value={programmeIds.map((id) => `programme:${id}`)}
          options={programmes.map((programme) => ({ token: `programme:${programme.id}`, label: programme.name, group: 'Programmes' }))}
          onChange={(tokens) => setProgrammeIds(tokens.filter((token) => token.startsWith('programme:')).map((token) => token.slice('programme:'.length)))}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">Seats<Input value={seats} onChange={(event) => setSeats(event.target.value)} type="number" min={1} className="mt-1 h-11 rounded-xl" disabled={!superAdmin} /></label>
          <label className="text-sm">Price ({currency})<Input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min={0} className="mt-1 h-11 rounded-xl" disabled={!superAdmin} /></label>
          <label className="text-sm">Starts<Input value={startsOn} onChange={(event) => setStartsOn(event.target.value)} type="date" className="mt-1 h-11 rounded-xl" disabled={!superAdmin} /></label>
          <label className="text-sm">Ends<Input value={endsOn} onChange={(event) => setEndsOn(event.target.value)} type="date" className="mt-1 h-11 rounded-xl" disabled={!superAdmin} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowOwnCourses} onChange={(event) => setAllowOwnCourses(event.target.checked)} disabled={!superAdmin} />
          The academy may upload its own courses
        </label>
        {superAdmin && (
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({
            type: 'licence',
            programmeIds,
            seats: Number(seats),
            startsOn,
            endsOn,
            amount: Number(amount),
            allowOwnCourses,
          })}>Save licence</Button>
        )}
        <ul className="text-sm space-y-1">
          {licences.map((licence) => (
            <li key={licence.id}>{licencePhase(licence, today)} · {licence.seatsUsed}/{licence.seats} · {licence.startsOn} to {licence.endsOn}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-semibold">Invoices, quotes, and purchase orders</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">PO or quote reference<Input value={poNumber} onChange={(event) => setPoNumber(event.target.value)} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">Kind
            <select aria-label="Invoice kind" value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value as InvoiceItem['status'])} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
              {(superAdmin ? ['quote', 'po', 'open', 'paid'] : ['requested']).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onAction({
          type: 'invoice',
          amount: Number(amount) || profile.amount,
          seats: Number(seats) || profile.seatCount,
          status: invoiceStatus,
          poNumber,
        })}>{superAdmin ? 'Record invoice' : 'Request an upgrade'}</Button>
        <ul className="text-sm">{invoices.map((invoice) => <li key={invoice.id}>{invoice.number} · {invoice.status} · {invoice.amount} {invoice.currency}</li>)}</ul>
      </section>
    </div>
  );
}

function AuditTab({ audit }: { audit: AuditEvent[] }) {
  return (
    <section className="rounded-3xl border border-border p-5">
      <h2 className="font-semibold">Audit</h2>
      {audit.length === 0 && <p className="text-sm text-muted-foreground mt-2">No admin actions recorded yet.</p>}
      <ul className="mt-3 space-y-2 text-sm">
        {audit.map((event, index) => (
          <li key={`${event.at}-${index}`} className="border-t border-border pt-2">
            <span className="font-semibold">{event.action}</span> · {event.target}
            <span className="block text-xs text-muted-foreground">{event.actorName} · {event.at}{event.detail ? ` · ${event.detail}` : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { blankProfile };
