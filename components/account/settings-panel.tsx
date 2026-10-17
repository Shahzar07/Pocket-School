'use client';

import { useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from '@/lib/languages';
import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PRIVACY,
  formatDeletionDate,
  passwordAcceptable,
  passwordStrength,
  timezoneOptions,
  type DeletionRequest,
  type InstructorProfile,
  type NotificationPrefs,
  type PayoutDetails,
  type PrivacySettings,
  type ProfileDraft,
} from '@/lib/account-settings';
import { CountrySelect, PhoneField } from '@/components/country-select';
import { DemographicConsent, GenderSelect, LevelNameSelect } from '@/components/account/demographic-fields';
import { statesForCountry } from '@/lib/institution-states';
import { VerificationBadge } from '@/components/verification/badge';
import { readGeoCountry, resolveCountryCode } from '@/lib/countries';
import { ProfilePhoto } from '@/components/account/profile-photo';
import {
  FamilySettings,
  StudentFamily,
  type LinkRequestRow,
  type PurchaseRow,
  type ReceiptRow,
  type StudentLimits,
} from '@/components/account/family-settings';
import type { ChildControls, PaymentMethod } from '@/lib/parent-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PROGRAMMES, canonicalProgramme, levelsForProgramme, toNamedLevel } from '@/lib/programmes';

export interface SettingsSession {
  id: string;
  deviceInfo: string;
  lastSeenLabel: string;
  current: boolean;
}

export interface LinkedPerson {
  id: string;
  name: string;
  email: string;
  ageTier?: string;
  bio?: string;
  avatarUrl?: string;
  controls?: ChildControls;
}

export interface SettingsView {
  role: string;
  email: string;
  emailVerified: boolean;
  providers: { id: string; label: string }[];
  hasPassword: boolean;
  draft: ProfileDraft;
  sessions: SettingsSession[];
  deletion: DeletionRequest | null;
  children: LinkedPerson[];
  parents: LinkedPerson[];
  payout: PayoutDetails;
  institutionName: string;
  ageTier: string;
  hasDateOfBirth: boolean;
  inviteCode: string;
  linkRequests: LinkRequestRow[];
  payment: PaymentMethod;
  receipts: ReceiptRow[];
  purchases: PurchaseRow[];
  studentLimits: StudentLimits | null;
  verificationTier: number;
}

const EMPTY_PAYOUT: PayoutDetails = { method: 'none', email: '', accountName: '', bankName: '', accountLast4: '' };

function StudentPlacement({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
}) {
  const programme = canonicalProgramme(draft.level);
  const years = levelsForProgramme(programme);
  const named = toNamedLevel(draft.yearGroup);
  const year = years.includes(named) ? named : '';

  useEffect(() => {
    if (!programme) return;
    if (draft.level === programme && draft.yearGroup === year) return;
    onChange({ ...draft, level: programme, yearGroup: year });
  }, [programme, year, draft, onChange]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Programme">
        <select
          aria-label="Programme"
          value={programme}
          onChange={event => {
            const next = event.target.value;
            const nextYears = levelsForProgramme(next);
            const kept = toNamedLevel(draft.yearGroup);
            onChange({ ...draft, level: next, yearGroup: nextYears.includes(kept) ? kept : '' });
          }}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Not set</option>
          {PROGRAMMES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Field>
      <Field label="Level">
        <select
          aria-label="Level"
          value={year}
          disabled={!programme}
          onChange={event => onChange({ ...draft, level: programme, yearGroup: event.target.value })}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Choose a level</option>
          {years.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </Field>
    </div>
  );
}

export function blankDraft(partial: Partial<ProfileDraft> = {}): ProfileDraft {
  const draft: ProfileDraft = {
    name: '',
    displayName: '',
    bio: '',
    country: '',
    timezone: 'Asia/Kuala_Lumpur',
    phone: '',
    language: 'en',
    currency: 'USD',
    avatarUrl: '',
    photoStoragePath: '',
    level: '',
    learningStyle: '',
    yearGroup: '',
    region: '',
    gender: '',
    demographicConsent: false,
    notificationPrefs: { ...DEFAULT_NOTIFICATIONS, ...partial.notificationPrefs },
    privacy: { ...DEFAULT_PRIVACY, ...partial.privacy },
    twoFactorEnabled: false,
    instructor: { headline: '', bio: '', public: false, ...partial.instructor },
  };
  const defined = Object.fromEntries(Object.entries(partial).filter(([, value]) => value !== undefined));
  const next = { ...draft, ...defined, notificationPrefs: draft.notificationPrefs, privacy: draft.privacy, instructor: draft.instructor };
  const country = resolveCountryCode(next.country) || next.country;
  return { ...next, country };
}

export function SettingsPanel({
  view,
  currencies,
  preview,
  scopeId,
  onSaveProfile,
  onPhoto,
  onChangeEmail,
  onResendVerification,
  onChangePassword,
  onSetPassword,
  onLinkGoogle,
  onUnlink,
  onToggleTwoFactor,
  onSignOutSession,
  onSignOutEverywhere,
  onSaveNotifications,
  onSavePrivacy,
  onExport,
  onRequestDeletion,
  onCancelDeletion,
  onSavePayout,
  onLinkChild,
  onUnlinkChild,
  onSaveDob,
  onCreateInvite,
  onRevokeInvite,
  onSaveChild,
  onSaveControls,
  onSavePayment,
  onDecidePurchase,
  onAcceptInvite,
  onRespondLink,
  loginActivity,
}: {
  view: SettingsView;
  currencies: string[];
  preview?: boolean;
  scopeId: string;
  onSaveProfile: (draft: ProfileDraft) => Promise<void> | void;
  onPhoto: (next: { avatarUrl: string; photoStoragePath: string }) => Promise<void> | void;
  onChangeEmail: (email: string, password: string) => Promise<void> | void;
  onResendVerification: () => Promise<void> | void;
  onChangePassword: (current: string, next: string) => Promise<void> | void;
  onSetPassword: (next: string) => Promise<void> | void;
  onLinkGoogle: () => Promise<void> | void;
  onUnlink: (providerId: string) => Promise<void> | void;
  onToggleTwoFactor: (enabled: boolean) => Promise<void> | void;
  onSignOutSession: (sessionId: string) => Promise<void> | void;
  onSignOutEverywhere: () => Promise<void> | void;
  onSaveNotifications: (prefs: NotificationPrefs) => Promise<void> | void;
  onSavePrivacy: (privacy: PrivacySettings) => Promise<void> | void;
  onExport: () => Promise<void> | void;
  onRequestDeletion: () => Promise<void> | void;
  onCancelDeletion: () => Promise<void> | void;
  onSavePayout: (payout: PayoutDetails) => Promise<void> | void;
  onLinkChild: (email: string) => Promise<void> | void;
  onUnlinkChild: (childId: string) => Promise<void> | void;
  onSaveDob?: (date: string) => Promise<void> | void;
  onCreateInvite: () => Promise<void> | void;
  onRevokeInvite: () => Promise<void> | void;
  onSaveChild: (childId: string, next: { name: string; displayName: string; bio: string; avatarUrl: string; photoStoragePath: string }) => Promise<void> | void;
  onSaveControls: (controls: ChildControls) => Promise<void> | void;
  onSavePayment: (method: PaymentMethod) => Promise<void> | void;
  onDecidePurchase: (requestId: string, approve: boolean) => Promise<void> | void;
  onAcceptInvite: (code: string) => Promise<void> | void;
  onRespondLink: (linkId: string, approve: boolean) => Promise<void> | void;
  loginActivity?: { id: string; at: number; action: string; ip: string; device: string }[];
}) {
  const [draft, setDraft] = useState(view.draft);
  useEffect(() => {
    const geo = readGeoCountry();
    if (!geo) return;
    setDraft((current) => (current.country ? current : { ...current, country: geo }));
  }, []);
  const [zoneQuery, setZoneQuery] = useState('');
  const [emailNext, setEmailNext] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [payout, setPayout] = useState(view.payout);
  const [notes, setNotes] = useState(view.draft.notificationPrefs);
  const [privacy, setPrivacy] = useState(view.draft.privacy);
  const zones = useMemo(() => {
    const all = timezoneOptions();
    const query = zoneQuery.trim().toLowerCase();
    const filtered = query ? all.filter(zone => zone.toLowerCase().includes(query)) : all;
    return filtered.slice(0, 40);
  }, [zoneQuery]);
  const strength = passwordStrength(nextPassword);
  const googleLinked = view.providers.some(provider => provider.id === 'google.com');

  const setInstructor = (patch: Partial<InstructorProfile>) => {
    setDraft(current => ({ ...current, instructor: { ...current.instructor, ...patch } }));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12" data-account-settings data-settings-role={view.role}>
      <header className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Account</p>
        <h1 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">My profile & settings</h1>
        <VerificationBadge tier={view.verificationTier} />
        <p className="mt-2 text-[15px] text-muted-foreground">
          {view.role === 'teacher' && 'Your account, your public instructor profile, and payout details.'}
          {view.role === 'parent' && 'Your account, your linked children, and the limits you set for them.'}
          {view.role === 'student' && 'Your account, your grade, and your linked parent.'}
          {view.role === 'institution_admin' && 'Your account. Academy branding stays on the academy page.'}
          {view.role === 'admin' && 'Your personal account. Platform settings stay in System settings.'}
          {!['teacher', 'parent', 'student', 'institution_admin', 'admin'].includes(view.role) && 'Your personal account.'}
        </p>
      </header>

      {view.deletion && (
        <section className="rounded-3xl border border-[var(--ps-cyan-border)]/40 bg-[var(--ps-cyan-soft)] p-5">
          <h2 className="font-heading text-xl">Deletion scheduled</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This account closes on {formatDeletionDate(view.deletion)} unless you cancel. You can keep using Poket School until then.
          </p>
          <Button type="button" className="mt-3 rounded-full" onClick={() => void onCancelDeletion()}>Cancel deletion</Button>
        </section>
      )}

      <Section title="Profile photo">
        <ProfilePhoto
          src={draft.avatarUrl}
          name={draft.displayName || draft.name}
          scopeId={scopeId}
          preview={preview}
          onChange={next => {
            setDraft(current => ({ ...current, ...next }));
            void onPhoto(next);
          }}
        />
      </Section>

      <Section title="Personal information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="h-11 rounded-xl" />
          </Field>
          <Field label="Display name">
            <Input value={draft.displayName} onChange={event => setDraft({ ...draft, displayName: event.target.value })} className="h-11 rounded-xl" />
          </Field>
        </div>
        <Field label="Bio">
          <textarea value={draft.bio} onChange={event => setDraft({ ...draft, bio: event.target.value })} rows={3} className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <CountrySelect
            label="Country"
            value={draft.country}
            onChange={country => setDraft({ ...draft, country })}
          />
          <PhoneField
            label="Phone"
            country={draft.country}
            value={draft.phone}
            onChange={phone => setDraft({ ...draft, phone })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State / region">
            <select
              aria-label="State or region"
              value={draft.region ?? ''}
              onChange={event => setDraft({ ...draft, region: event.target.value })}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">Choose a state / region</option>
              {statesForCountry(draft.country).map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <GenderSelect value={draft.gender ?? ''} onChange={gender => setDraft({ ...draft, gender })} />
        </div>
        {view.role === 'teacher' && (
          <LevelNameSelect value={draft.level} onChange={level => setDraft({ ...draft, level })} />
        )}
        <DemographicConsent checked={draft.demographicConsent === true} onChange={checked => setDraft({ ...draft, demographicConsent: checked })} />
        <Field label="Timezone">
          <Input value={zoneQuery} onChange={event => setZoneQuery(event.target.value)} placeholder="Search timezones" aria-label="Search timezones" className="mb-2 h-10 rounded-xl" />
          <select
            aria-label="Timezone"
            value={draft.timezone}
            onChange={event => setDraft({ ...draft, timezone: event.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {!zones.includes(draft.timezone) && <option value={draft.timezone}>{draft.timezone}</option>}
            {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </Field>
        <p className="text-xs text-muted-foreground">Age tier: {view.ageTier || 'not set'}. The server sets this from your date of birth.</p>
        {!view.hasDateOfBirth && onSaveDob && (
          <form className="flex flex-wrap gap-2" onSubmit={event => {
            event.preventDefault();
            const value = String(new FormData(event.currentTarget).get('dob') ?? '');
            void onSaveDob(value);
          }}>
            <Input name="dob" type="date" required aria-label="Date of birth" className="h-11 max-w-[200px] rounded-xl" />
            <Button type="submit" className="rounded-full">Save date of birth</Button>
          </form>
        )}
        <Button type="button" className="rounded-full" onClick={() => void onSaveProfile(draft)}>Save profile</Button>
      </Section>

      <Section title="Language and currency">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Language">
            <select aria-label="Language" value={draft.language} onChange={event => setDraft({ ...draft, language: event.target.value })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
              {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select aria-label="Currency preference" value={draft.currency} onChange={event => setDraft({ ...draft, currency: event.target.value })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
              {currencies.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">Language uses the same choice as the header. Currency uses the admin pricing table.</p>
        <Button type="button" className="rounded-full" onClick={() => void onSaveProfile(draft)}>Save preferences</Button>
      </Section>

      <Section title="Email">
        <p className="text-sm">{view.email} {view.emailVerified ? '· verified' : '· not verified'}</p>
        {!view.emailVerified && (
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void onResendVerification()}>Resend verification</Button>
        )}
        <Field label="New email">
          <Input type="email" value={emailNext} onChange={event => setEmailNext(event.target.value)} className="h-11 rounded-xl" />
        </Field>
        {view.hasPassword && (
          <Field label="Current password">
            <Input type="password" value={emailPassword} onChange={event => setEmailPassword(event.target.value)} autoComplete="current-password" className="h-11 rounded-xl" />
          </Field>
        )}
        <Button type="button" className="rounded-full" onClick={() => void onChangeEmail(emailNext.trim(), emailPassword)}>
          Send verification to the new email
        </Button>
        <p className="text-xs text-muted-foreground">The sign-in email changes after you open the link. Google-only accounts confirm with Google first.</p>
      </Section>

      <Section title={view.hasPassword ? 'Password' : 'Password and linked sign-in'}>
        {view.hasPassword ? (
          <>
            <Field label="Current password">
              <Input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" className="h-11 rounded-xl" />
            </Field>
            <Field label="New password">
              <Input type="password" value={nextPassword} onChange={event => setNextPassword(event.target.value)} autoComplete="new-password" className="h-11 rounded-xl" />
            </Field>
            <Strength score={strength.score} label={strength.label} />
            <Field label="Confirm new password">
              <Input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" className="h-11 rounded-xl" />
            </Field>
            <Button
              type="button"
              className="rounded-full"
              disabled={!passwordAcceptable(nextPassword) || nextPassword !== confirmPassword}
              onClick={() => void onChangePassword(currentPassword, nextPassword)}
            >
              Change password
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">This account has no password yet. Set one to also sign in with email, or link another provider.</p>
            <Field label="New password">
              <Input type="password" value={nextPassword} onChange={event => setNextPassword(event.target.value)} autoComplete="new-password" className="h-11 rounded-xl" />
            </Field>
            <Strength score={strength.score} label={strength.label} />
            <Button type="button" className="rounded-full" disabled={!passwordAcceptable(nextPassword)} onClick={() => void onSetPassword(nextPassword)}>
              Set a password
            </Button>
          </>
        )}
      </Section>

      <Section title="Linked sign-in providers">
        <ul className="space-y-2">
          {view.providers.map(provider => (
            <li key={provider.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
              <span className="text-sm font-semibold">{provider.label}</span>
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-full"
                disabled={view.providers.length < 2}
                onClick={() => void onUnlink(provider.id)}
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
        {!googleLinked && (
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void onLinkGoogle()}>Link Google</Button>
        )}
      </Section>

      <Section title="Two-factor authentication">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.twoFactorEnabled}
            onChange={event => {
              const enabled = event.target.checked;
              setDraft({ ...draft, twoFactorEnabled: enabled });
              void onToggleTwoFactor(enabled);
            }}
          />
          Email me a code when I sign in with a password
        </label>
        <p className="text-xs text-muted-foreground">
          Admin accounts still use the admin sign-in code. If mail is not configured, sign-in continues without a code so you are not locked out.
        </p>
      </Section>

      <Section title="My login activity">
        <ul className="space-y-2">
          {(loginActivity ?? []).length === 0 && <li className="text-sm text-muted-foreground">Sign-ins recorded by the server will show here.</li>}
          {(loginActivity ?? []).map(row => (
            <li key={row.id} className="rounded-xl border border-border px-3 py-2">
              <span className="block text-sm font-semibold">{row.action}</span>
              <span className="block text-xs text-muted-foreground">
                {new Date(row.at).toLocaleString('en-GB')} · {row.ip || 'IP unavailable'} · {row.device || 'Device unavailable'}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Active sessions">
        <ul className="space-y-2">
          {view.sessions.length === 0 && <li className="text-sm text-muted-foreground">No other sessions are recorded yet.</li>}
          {view.sessions.map(session => (
            <li key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{session.current ? 'This device' : session.deviceInfo}</span>
                <span className="block text-xs text-muted-foreground">{session.lastSeenLabel}</span>
              </span>
              <Button type="button" variant="outline" className="h-8 rounded-full" onClick={() => void onSignOutSession(session.id)}>Sign out</Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => void onSignOutEverywhere()}>Sign out everywhere</Button>
      </Section>

      <Section title="Notifications">
        <Checks
          items={[
            ['email', 'Email'],
            ['push', 'Push'],
            ['messages', 'Messages'],
            ['announcements', 'Announcements'],
            ['product', 'Product updates'],
            ['alumni', 'Alumni'],
            ['institution', 'Institution'],
            ['achievements', 'Achievements'],
            ['network', 'Network'],
            ['safety', 'Safety'],
            ['hotline', 'Hotline'],
            ['networkDigest', 'Network email digest'],
          ]}
          value={notes}
          onChange={key => setNotes({ ...notes, [key]: !notes[key] })}
        />
        <Button type="button" className="rounded-full" onClick={() => void onSaveNotifications(notes)}>Save notifications</Button>
      </Section>

      <Section title="Privacy and your data">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={privacy.shareBoard} onChange={event => setPrivacy({ ...privacy, shareBoard: event.target.checked })} />
          Show me on the leaderboard
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={privacy.profilePublic} onChange={event => setPrivacy({ ...privacy, profilePublic: event.target.checked })} />
          Public profile
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={privacy.showEmail} onChange={event => setPrivacy({ ...privacy, showEmail: event.target.checked })} />
          Show my email on that profile
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="rounded-full" onClick={() => void onSavePrivacy(privacy)}>Save privacy</Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void onExport()}>Download my data</Button>
          <p className="text-xs text-muted-foreground">Your copy under the Malaysian PDPA and the GDPR. Deletion is scheduled from this page and can be cancelled for 14 days.</p>
        </div>
      </Section>

      {view.role === 'teacher' && (
        <Section title="Instructor profile and payouts">
          <Field label="Headline">
            <Input value={draft.instructor.headline} onChange={event => setInstructor({ headline: event.target.value })} className="h-11 rounded-xl" />
          </Field>
          <Field label="Public bio">
            <textarea value={draft.instructor.bio} onChange={event => setInstructor({ bio: event.target.value })} rows={3} className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.instructor.public} onChange={event => setInstructor({ public: event.target.checked })} />
            Show this instructor profile
          </label>
          <Button type="button" className="rounded-full" onClick={() => void onSaveProfile(draft)}>Save instructor profile</Button>
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="Payout method">
              <select aria-label="Payout method" value={payout.method} onChange={event => setPayout({ ...payout, method: event.target.value as PayoutDetails['method'] })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                <option value="none">Not set</option>
                <option value="paypal">PayPal</option>
                <option value="bank">Bank</option>
              </select>
            </Field>
            <Field label="Payout email">
              <Input value={payout.email} onChange={event => setPayout({ ...payout, email: event.target.value })} className="h-11 rounded-xl" />
            </Field>
            <Field label="Account name">
              <Input value={payout.accountName} onChange={event => setPayout({ ...payout, accountName: event.target.value })} className="h-11 rounded-xl" />
            </Field>
            <Field label="Bank">
              <Input value={payout.bankName} onChange={event => setPayout({ ...payout, bankName: event.target.value })} className="h-11 rounded-xl" />
            </Field>
            <Field label="Account last 4 digits">
              <Input value={payout.accountLast4} onChange={event => setPayout({ ...payout, accountLast4: event.target.value })} className="h-11 rounded-xl" inputMode="numeric" />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Payout details are stored privately. Only the last four digits of an account number are kept.</p>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void onSavePayout(payout)}>Save payout details</Button>
        </Section>
      )}

      {view.role === 'parent' && (
        <FamilySettings
          children={view.children}
          inviteCode={view.inviteCode}
          linkRequests={view.linkRequests}
          payment={view.payment}
          receipts={view.receipts}
          purchases={view.purchases}
          scopeId={scopeId}
          preview={preview}
          onAskChild={onLinkChild}
          onUnlinkChild={onUnlinkChild}
          onCreateInvite={onCreateInvite}
          onRevokeInvite={onRevokeInvite}
          onSaveChild={onSaveChild}
          onSaveControls={onSaveControls}
          onSavePayment={onSavePayment}
          onDecidePurchase={onDecidePurchase}
        />
      )}

      {view.role === 'student' && (
        <Section title="Programme and linked parent">
          <StudentPlacement draft={draft} onChange={setDraft} />
          <p className="text-sm font-semibold">Linked parent</p>
          <ul className="space-y-2">
            {view.parents.length === 0 && <li className="text-sm text-muted-foreground">No parent is linked yet. Accept an invite code or a request below.</li>}
            {view.parents.map(parent => (
              <li key={parent.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                <span className="font-semibold">{parent.name}</span> · {parent.email}
              </li>
            ))}
          </ul>
          <StudentFamily
            pending={view.linkRequests}
            limits={view.studentLimits}
            onAcceptInvite={onAcceptInvite}
            onRespond={onRespondLink}
          />
          <Button type="button" className="rounded-full" onClick={() => void onSaveProfile(draft)}>Save programme</Button>
        </Section>
      )}

      {view.role === 'institution_admin' && (
        <Section title="Your academy">
          <p className="text-sm">{view.institutionName || 'No academy is linked to this account yet.'}</p>
          <p className="text-xs text-muted-foreground">Class and branding changes stay on the academy dashboard.</p>
        </Section>
      )}

      {view.role === 'admin' && (
        <Section title="Platform administration">
          <p className="text-sm text-muted-foreground">User management, pricing, and system mail stay in System settings. This page changes only your own account.</p>
        </Section>
      )}

      <Section title="Delete account">
        <p className="text-sm text-muted-foreground">
          Type your email to schedule deletion. Poket School waits 14 days. During that time you can cancel from this page. The account is closed after the grace period.
        </p>
        <Field label="Type your email to confirm">
          <Input value={deleteConfirm} onChange={event => setDeleteConfirm(event.target.value)} className="h-11 rounded-xl" aria-label="Confirm email to delete account" />
        </Field>
        <Button
          type="button"
          variant="outline"
          className="rounded-full text-destructive"
          disabled={deleteConfirm.trim().toLowerCase() !== view.email.trim().toLowerCase()}
          onClick={() => void onRequestDeletion()}
        >
          Schedule deletion
        </Button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return (
    <section id={id} className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-7">
      <h2 className="font-heading text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function Strength({ score, label }: { score: number; label: string }) {
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary" style={{ width: `${(score / 4) * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Password strength: {label}</p>
    </div>
  );
}

function Checks({
  items,
  value,
  onChange,
}: {
  items: [keyof NotificationPrefs, string][];
  value: NotificationPrefs;
  onChange: (key: keyof NotificationPrefs) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value[key]} onChange={() => onChange(key)} />
          {label}
        </label>
      ))}
    </div>
  );
}

export { EMPTY_PAYOUT };
