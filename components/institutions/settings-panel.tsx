'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ACADEMY_PERMISSIONS, ROLE_DEFAULTS, TENANT_FEATURES, academyTaxRate, blankAcademySettings,
  fillCertificateTemplate, privacyExport, rankLeaderboard, type AcademyPermission, type AcademySettings,
} from '@/lib/academy-settings';
import { ACADEMY_ROLES, BRAND_FONTS, INTEGRATION_ENV, canHidePoweredBy, canUseCustomDomain, type AuditEvent, type IdentityMode, type InstitutionProfile } from '@/lib/enterprise';
import { LANGUAGES } from '@/lib/languages';
import type { Institution } from '@/lib/db';
import { cnameInstructions, slugBlockReason } from '@/lib/tenant-host';

type SettingsAction =
  | { type: 'save-settings'; settings: AcademySettings }
  | { type: 'save-brand'; subdomain: string; customDomain: string; branding: NonNullable<Institution['branding']> }
  | { type: 'verify-domain' }
  | { type: 'privacy-erase' };

const SECTIONS = [
  ['general', 'General'],
  ['branding', 'Branding'],
  ['domain', 'Domain'],
  ['login', 'Login and SSO'],
  ['signup', 'Signup'],
  ['roles', 'Roles'],
  ['languages', 'Languages'],
  ['currency', 'Currency and tax'],
  ['notifications', 'Notifications'],
  ['certificates', 'Certificates'],
  ['content', 'Content'],
  ['features', 'Features'],
  ['integrations', 'Integrations'],
  ['webhooks', 'Webhooks'],
  ['privacy', 'Privacy'],
  ['security', 'Security'],
  ['billing', 'Billing and seats'],
  ['audit', 'Audit'],
  ['leaderboard', 'Leaderboard'],
  ['pages', 'Pages'],
  ['mobile', 'Mobile app'],
] as const;

function institutionPath(slug: string): string {
  return slug ? `/a/${slug}` : '/a/{slug}';
}

export function InstitutionSettings({
  name,
  profile,
  branding,
  subdomain,
  customDomain,
  domainStatus,
  domainMessage,
  previousSubdomains,
  settings,
  identity,
  audit,
  paths,
  skills,
  webhooks,
  apiKeys,
  superAdmin,
  busy,
  onAction,
}: {
  name: string;
  profile: InstitutionProfile;
  branding: NonNullable<Institution['branding']>;
  subdomain: string;
  customDomain: string;
  domainStatus: string;
  domainMessage: string;
  previousSubdomains: string[];
  settings: AcademySettings;
  identity: IdentityMode;
  audit: AuditEvent[];
  paths: { name: string }[];
  skills: { name: string }[];
  webhooks: { url: string }[];
  apiKeys: { name: string; prefix: string }[];
  superAdmin: boolean;
  busy?: boolean;
  onAction: (action: SettingsAction) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [brand, setBrand] = useState(branding);
  const [slug, setSlug] = useState(subdomain);
  const [domain, setDomain] = useState(customDomain);
  const [pageTitle, setPageTitle] = useState('');
  const [pageBody, setPageBody] = useState('');
  const [boardName, setBoardName] = useState('');
  const [boardPoints, setBoardPoints] = useState(10);
  const [allowlist, setAllowlist] = useState(settings.ipAllowlist.join('\n'));
  const [domains, setDomains] = useState(settings.allowedEmailDomains.join(', '));
  const cname = domain.trim() ? cnameInstructions(domain.trim().toLowerCase()) : null;
  const slugNote = slugBlockReason(slug);
  const tax = academyTaxRate({ mode: draft.taxMode, customRate: draft.taxRate, country: profile.country, currency: profile.currency });
  const ranked = useMemo(() => rankLeaderboard(draft.leaderboard), [draft.leaderboard]);
  const domainAllowed = canUseCustomDomain(profile.plan) || superAdmin;
  const hideAllowed = canHidePoweredBy(profile.plan);

  const savePolicy = () => {
    const next = blankAcademySettings({
      ...draft,
      allowedEmailDomains: domains.split(',').map((item) => item.trim()).filter(Boolean),
      ipAllowlist: allowlist.split('\n').map((item) => item.trim()).filter(Boolean),
    });
    void onAction({ type: 'save-settings', settings: next });
  };

  const saveBrand = () => {
    void onAction({
      type: 'save-brand',
      subdomain: slug,
      customDomain: domainAllowed ? domain : customDomain,
      branding: { ...brand, hidePoweredBy: hideAllowed ? brand.hidePoweredBy === true : false },
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
      <nav className="flex gap-2 overflow-x-auto lg:flex-col">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#settings-${id}`} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm">{label}</a>
        ))}
      </nav>
      <div className="space-y-4">
        <section id="settings-general" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">General</h2>
          <p className="text-sm text-muted-foreground">{name} · {profile.type} · {profile.country || 'Country not set'}</p>
          <label className="text-sm">Legal name<Input value={draft.legalName} onChange={(event) => setDraft({ ...draft, legalName: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Time zone<Input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">Support email<Input type="email" value={draft.supportEmail} onChange={(event) => setDraft({ ...draft, supportEmail: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          </div>
        </section>

        <section id="settings-branding" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Branding</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Display name<Input value={brand.displayName ?? ''} onChange={(event) => setBrand({ ...brand, displayName: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">Logo URL<Input value={brand.logoUrl ?? ''} onChange={(event) => setBrand({ ...brand, logoUrl: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">Accent<Input aria-label="Settings accent" value={brand.primaryColor ?? ''} onChange={(event) => setBrand({ ...brand, primaryColor: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">Second colour<Input aria-label="Settings second colour" value={brand.secondaryColor ?? ''} onChange={(event) => setBrand({ ...brand, secondaryColor: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          </div>
          <label className="text-sm">Font
            <select aria-label="Settings font" value={brand.fontId ?? 'system'} onChange={(event) => setBrand({ ...brand, fontId: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
              {BRAND_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Favicon URL<Input value={brand.faviconUrl ?? ''} onChange={(event) => setBrand({ ...brand, faviconUrl: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={brand.hidePoweredBy === true} disabled={!hideAllowed} onChange={(event) => setBrand({ ...brand, hidePoweredBy: event.target.checked })} />
            Hide “Powered by Poket School”
          </label>
          <Button type="button" className="rounded-full" disabled={busy} onClick={saveBrand}>Save branding and domain</Button>
        </section>

        <section id="settings-domain" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Domain</h2>
          <p className="text-sm text-muted-foreground">Each academy has {'{slug}'}.poketschool.ai. Until wildcard DNS is live, the same academy is at {institutionPath(slug || 'slug')}.</p>
          <label className="text-sm">Subdomain
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} className="mt-1 h-11 rounded-xl" />
          </label>
          {slugNote && <p className="text-xs text-destructive">{slugNote}</p>}
          <p className="text-xs text-muted-foreground">Reserved names such as www, api, login, and courses stay with Poket School. Renaming keeps the previous address as a redirect, so the old slug stays taken.</p>
          {previousSubdomains.length > 0 && <p className="text-xs">Redirects: {previousSubdomains.join(', ')}</p>}
          <label className="text-sm">Custom domain
            <Input value={domain} disabled={!domainAllowed} onChange={(event) => setDomain(event.target.value)} placeholder="learn.school.example" className="mt-1 h-11 rounded-xl" />
          </label>
          {!domainAllowed && <p className="text-xs text-muted-foreground">Custom domains open on the enterprise and OEM plans.</p>}
          <p className="text-sm">Status: {domainStatus || 'not checked'}{domainMessage ? ` — ${domainMessage}` : ''}</p>
          {cname && (
            <div className="rounded-2xl bg-muted p-3 text-sm">
              <p className="font-semibold">DNS</p>
              <p>Type {cname.type} · Host {cname.host} · Target {cname.value}</p>
              <p className="mt-1 text-muted-foreground">{cname.note}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="rounded-full" disabled={busy} onClick={saveBrand}>Save address</Button>
            <Button type="button" variant="outline" className="rounded-full" disabled={busy || !domain.trim()} onClick={() => void onAction({ type: 'verify-domain' })}>Check DNS and SSL</Button>
          </div>
        </section>

        <section id="settings-login" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Login and SSO</h2>
          <label className="text-sm">Login headline<Input value={brand.loginHeadline ?? ''} onChange={(event) => setBrand({ ...brand, loginHeadline: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">Login note<Input value={brand.loginBody ?? ''} onChange={(event) => setBrand({ ...brand, loginBody: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <p className="text-sm">Identity mode: {identity.mode}. SAML {identity.saml ? 'ready' : 'waiting'} · OIDC {identity.oidc ? 'ready' : 'waiting'} · SCIM {identity.scim ? 'ready' : 'waiting'}.</p>
          <p className="text-xs text-muted-foreground">Without {INTEGRATION_ENV.saml.join(', ')} or {INTEGRATION_ENV.oidc.join(', ')}, sign-in stays on email and join links.</p>
          <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={saveBrand}>Save login</Button>
        </section>

        <section id="settings-signup" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">User signup</h2>
          <select aria-label="Signup policy" value={draft.signupPolicy} onChange={(event) => setDraft({ ...draft, signupPolicy: event.target.value as AcademySettings['signupPolicy'] })} className="h-11 rounded-xl border border-border bg-background px-3">
            <option value="open">Open signup</option>
            <option value="invite">Invite only</option>
            <option value="domain">Academy email domain</option>
          </select>
          <label className="text-sm">Allowed email domains
            <Input value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="school.example, campus.edu" className="mt-1 h-11 rounded-xl" />
          </label>
        </section>

        <section id="settings-roles" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Roles and permissions</h2>
          <p className="text-sm text-muted-foreground">Institution admins keep every capability. Other roles use the grants below.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Role</th>
                  {ACADEMY_PERMISSIONS.map((permission) => <th key={permission} className="p-2 text-left font-medium">{permission.replace('manage_', '').replace('_', ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {ACADEMY_ROLES.map((role) => (
                  <tr key={role} className="border-t border-border">
                    <td className="p-2 capitalize">{role.replace('_', ' ')}</td>
                    {ACADEMY_PERMISSIONS.map((permission) => {
                      const locked = role === 'institution_admin';
                      const checked = locked || draft.roleGrants[role].includes(permission);
                      return (
                        <td key={permission} className="p-2">
                          <input
                            aria-label={`${role} ${permission}`}
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={(event) => {
                              const current = new Set(draft.roleGrants[role]);
                              if (event.target.checked) current.add(permission);
                              else current.delete(permission);
                              setDraft({ ...draft, roleGrants: { ...draft.roleGrants, [role]: [...current] as AcademyPermission[] } });
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Defaults: {ROLE_DEFAULTS.manager.join(', ')} for managers.</p>
        </section>

        <section id="settings-languages" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Languages</h2>
          <label className="text-sm">Default locale
            <select aria-label="Default locale" value={draft.defaultLocale} onChange={(event) => setDraft({ ...draft, defaultLocale: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
              {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.slice(0, 12).map((language) => {
              const on = draft.locales.includes(language.code);
              return (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => setDraft({
                    ...draft,
                    locales: on ? draft.locales.filter((code) => code !== language.code) : [...draft.locales, language.code],
                  })}
                  className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
                >
                  {language.label}
                </button>
              );
            })}
          </div>
        </section>

        <section id="settings-currency" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Currency and tax</h2>
          <p className="text-sm">Billing currency {profile.currency || 'USD'} · country {profile.country || '—'}</p>
          <select aria-label="Tax mode" value={draft.taxMode} onChange={(event) => setDraft({ ...draft, taxMode: event.target.value as AcademySettings['taxMode'] })} className="h-11 rounded-xl border border-border bg-background px-3">
            <option value="platform">Platform tax for this country</option>
            <option value="exempt">Tax exempt</option>
            <option value="custom">Custom rate</option>
          </select>
          <label className="text-sm">Custom rate (0–0.30)
            <Input type="number" min={0} max={0.3} step={0.01} value={draft.taxRate} onChange={(event) => setDraft({ ...draft, taxRate: Number(event.target.value) })} className="mt-1 h-11 rounded-xl" />
          </label>
          <label className="text-sm">Tax label<Input value={draft.taxLabel} onChange={(event) => setDraft({ ...draft, taxLabel: event.target.value })} placeholder="SST" className="mt-1 h-11 rounded-xl" /></label>
          <p className="text-sm">Rate used on academy course checkout: {(tax * 100).toFixed(1)}%</p>
        </section>

        <section id="settings-notifications" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Notifications and email</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.notifyEnrolment} onChange={(event) => setDraft({ ...draft, notifyEnrolment: event.target.checked })} /> Enrolment</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.notifyCompletion} onChange={(event) => setDraft({ ...draft, notifyCompletion: event.target.checked })} /> Completion</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.notifyCompliance} onChange={(event) => setDraft({ ...draft, notifyCompliance: event.target.checked })} /> Compliance reminders</label>
          <select aria-label="Digest" value={draft.notifyDigest} onChange={(event) => setDraft({ ...draft, notifyDigest: event.target.value as AcademySettings['notifyDigest'] })} className="h-11 rounded-xl border border-border bg-background px-3">
            <option value="off">No digest</option>
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly digest</option>
          </select>
          <label className="text-sm">Welcome subject<Input value={draft.emailWelcomeSubject} onChange={(event) => setDraft({ ...draft, emailWelcomeSubject: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">Welcome body<textarea aria-label="Welcome body" value={draft.emailWelcomeBody} onChange={(event) => setDraft({ ...draft, emailWelcomeBody: event.target.value })} className="mt-1 min-h-16 w-full rounded-xl border border-border p-3 text-sm" /></label>
          <label className="text-sm">Reminder subject<Input value={draft.emailReminderSubject} onChange={(event) => setDraft({ ...draft, emailReminderSubject: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">Certificate email subject<Input value={draft.emailCertificateSubject} onChange={(event) => setDraft({ ...draft, emailCertificateSubject: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        </section>

        <section id="settings-certificates" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Certificate template</h2>
          <label className="text-sm">Title<Input value={draft.certificateTitle} onChange={(event) => setDraft({ ...draft, certificateTitle: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm">Body<textarea aria-label="Certificate body" value={draft.certificateBody} onChange={(event) => setDraft({ ...draft, certificateBody: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-border p-3 text-sm" /></label>
          <p className="text-xs text-muted-foreground">Tokens: {'{{name}} {{course}} {{issuer}}'}</p>
          <label className="text-sm">Signatory<Input value={draft.certificateSignatory} onChange={(event) => setDraft({ ...draft, certificateSignatory: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <article className="rounded-2xl border border-border p-4 text-sm">
            <p className="font-semibold">{draft.certificateTitle}</p>
            <p className="mt-2">{fillCertificateTemplate(draft.certificateBody, { name: 'Amina Yusuf', course: 'Biology foundations', issuer: brand.certificateIssuer || name })}</p>
            {draft.certificateSignatory && <p className="mt-2 text-xs">{draft.certificateSignatory}</p>}
          </article>
        </section>

        <section id="settings-content" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Content and catalogue</h2>
          <select aria-label="Catalogue visibility mode" value={draft.catalogueVisibility} onChange={(event) => setDraft({ ...draft, catalogueVisibility: event.target.value as AcademySettings['catalogueVisibility'] })} className="h-11 rounded-xl border border-border bg-background px-3">
            <option value="private">Private — members only</option>
            <option value="curated">Curated public catalogue</option>
            <option value="public">Whole Poket School catalogue</option>
          </select>
          <p className="text-sm">Learning paths: {paths.length ? paths.map((path) => path.name).join(', ') : 'none yet'}.</p>
          <p className="text-sm">Skills: {skills.length ? skills.map((skill) => skill.name).join(', ') : 'framework not added'}.</p>
          <p className="text-xs text-muted-foreground">Allocate courses, books, and paths from the Content tab. Visitors on this academy only see the visibility you choose here.</p>
        </section>

        <section id="settings-features" className="rounded-3xl border border-border p-5 space-y-2">
          <h2 className="font-semibold">Feature toggles</h2>
          {TENANT_FEATURES.map((feature) => (
            <label key={feature} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.features[feature]}
                onChange={(event) => setDraft({ ...draft, features: { ...draft.features, [feature]: event.target.checked } })}
              />
              {feature}
            </label>
          ))}
        </section>

        <section id="settings-integrations" className="rounded-3xl border border-border p-5 space-y-2">
          <h2 className="font-semibold">Integrations and API keys</h2>
          <p className="text-sm">LTI {identity.lti ? 'ready' : 'waiting for keys'} · Zoom {identity.zoom ? 'ready' : 'waiting'} · Teams {identity.teams ? 'ready' : 'waiting'}.</p>
          <ul className="text-sm">{apiKeys.map((key) => <li key={key.prefix}>{key.name} · {key.prefix}</li>)}</ul>
          {apiKeys.length === 0 && <p className="text-sm text-muted-foreground">Create a key from the Integrations tab. Only the prefix is stored.</p>}
        </section>

        <section id="settings-webhooks" className="rounded-3xl border border-border p-5 space-y-2">
          <h2 className="font-semibold">Webhooks</h2>
          <ul className="text-sm">{webhooks.map((hook) => <li key={hook.url}>{hook.url}</li>)}</ul>
          {webhooks.length === 0 && <p className="text-sm text-muted-foreground">Add endpoints from the Integrations tab. The signing secret is shown once.</p>}
        </section>

        <section id="settings-privacy" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Data retention and privacy</h2>
          <p className="text-sm text-muted-foreground">Export or erase personal data held for this academy under PDPA and GDPR.</p>
          <label className="text-sm">Keep learner records (months)
            <Input type="number" min={6} max={84} value={draft.retentionMonths} onChange={(event) => setDraft({ ...draft, retentionMonths: Number(event.target.value) })} className="mt-1 h-11 rounded-xl" />
          </label>
          <label className="text-sm">Privacy contact<Input value={draft.privacyContact} onChange={(event) => setDraft({ ...draft, privacyContact: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                const blob = new Blob([JSON.stringify(privacyExport({
                  exportedAt: new Date().toISOString(),
                  institutionName: name,
                  profile,
                  members: 'Included when the people list is open on this academy.',
                  catalogue: 'Included from the content catalogue.',
                  audit,
                  settings: draft,
                }), null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `${slug || 'academy'}-privacy.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export data
            </Button>
            <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => void onAction({ type: 'privacy-erase' })}>Erase personal data</Button>
          </div>
        </section>

        <section id="settings-security" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Security</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.require2fa} onChange={(event) => setDraft({ ...draft, require2fa: event.target.checked })} /> Require email 2FA for academy sign-in</label>
          <label className="text-sm">Minimum password length
            <Input type="number" min={8} max={64} value={draft.passwordMinLength} onChange={(event) => setDraft({ ...draft, passwordMinLength: Number(event.target.value) })} className="mt-1 h-11 rounded-xl" />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.passwordRequireSymbol} onChange={(event) => setDraft({ ...draft, passwordRequireSymbol: event.target.checked })} /> Require a symbol</label>
          <label className="text-sm">Session timeout (minutes, 0 leaves the platform default)
            <Input type="number" min={0} max={720} value={draft.sessionTimeoutMinutes} onChange={(event) => setDraft({ ...draft, sessionTimeoutMinutes: Number(event.target.value) })} className="mt-1 h-11 rounded-xl" />
          </label>
          <label className="text-sm">IP allowlist
            <textarea aria-label="IP allowlist" value={allowlist} onChange={(event) => setAllowlist(event.target.value)} placeholder={'10.1.0.0\n203.0.113.*'} className="mt-1 min-h-20 w-full rounded-xl border border-border p-3 text-sm" />
          </label>
          <p className="text-xs text-muted-foreground">An empty list allows every network. A trailing * matches a prefix.</p>
        </section>

        <section id="settings-billing" className="rounded-3xl border border-border p-5 space-y-2">
          <h2 className="font-semibold">Billing and seats</h2>
          <p className="text-sm">{profile.seatsUsed} of {profile.seatCount} seats · {profile.currency} {profile.amount} · plan {profile.plan}</p>
          <p className="text-sm">Term {profile.licenceStartsOn || '—'} to {profile.licenceEndsOn || '—'} · renewal {profile.renewalOn || '—'} · PO {profile.poNumber || '—'}</p>
          <p className="text-xs text-muted-foreground">{superAdmin ? 'Seat count picks a volume tier. The live quote, discount, and quote PDF are on the Billing tab. Tier prices are edited in System settings.' : 'Seat count and price are managed by Poket School. Request a change from Billing.'}</p>
        </section>

        <section id="settings-audit" className="rounded-3xl border border-border p-5 space-y-2">
          <h2 className="font-semibold">Audit log</h2>
          <ul className="space-y-1 text-sm">
            {audit.slice(0, 12).map((event) => <li key={`${event.at}-${event.action}`}>{event.at} · {event.actorName} · {event.action}</li>)}
          </ul>
          {audit.length === 0 && <p className="text-sm text-muted-foreground">Admin actions on this academy will appear here.</p>}
        </section>

        <section id="settings-leaderboard" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Leaderboard</h2>
          <select aria-label="Leaderboard visibility" value={draft.leaderboardVisible} onChange={(event) => setDraft({ ...draft, leaderboardVisible: event.target.value as AcademySettings['leaderboardVisible'] })} className="h-11 rounded-xl border border-border bg-background px-3">
            <option value="academy">Visible to the academy</option>
            <option value="group">Visible inside groups</option>
            <option value="off">Hidden</option>
          </select>
          <div className="flex flex-wrap gap-2">
            <Input aria-label="Learner name" value={boardName} onChange={(event) => setBoardName(event.target.value)} placeholder="Learner" className="h-11 max-w-xs rounded-xl" />
            <Input aria-label="Points" type="number" value={boardPoints} onChange={(event) => setBoardPoints(Number(event.target.value))} className="h-11 w-28 rounded-xl" />
            <Button type="button" variant="outline" className="rounded-full" onClick={() => {
              if (!boardName.trim()) return;
              setDraft({ ...draft, leaderboard: [...draft.leaderboard, { name: boardName.trim(), points: boardPoints }] });
              setBoardName('');
            }}>Add score</Button>
          </div>
          <ol className="text-sm">{ranked.map((row) => <li key={`${row.rank}-${row.name}`}>{row.rank}. {row.name} · {row.points}</li>)}</ol>
        </section>

        <section id="settings-pages" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Custom pages</h2>
          <Input aria-label="Page title" value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} placeholder="About the academy" className="h-11 rounded-xl" />
          <textarea aria-label="Page body" value={pageBody} onChange={(event) => setPageBody(event.target.value)} className="min-h-24 w-full rounded-xl border border-border p-3 text-sm" placeholder="Write the page. It is published on the academy site." />
          <Button type="button" variant="outline" className="rounded-full" onClick={() => {
            if (!pageTitle.trim()) return;
            setDraft({
              ...draft,
              pages: [...draft.pages, { slug: pageTitle, title: pageTitle.trim(), body: pageBody, published: true }],
            });
            setPageTitle('');
            setPageBody('');
          }}>Add page</Button>
          <ul className="text-sm">
            {draft.pages.map((page) => <li key={page.slug}>{page.title} · /{page.slug} · {page.published ? 'published' : 'draft'}</li>)}
          </ul>
        </section>

        <section id="settings-mobile" className="rounded-3xl border border-border p-5 space-y-3">
          <h2 className="font-semibold">Mobile app branding</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">App name<Input value={draft.mobileAppName} onChange={(event) => setDraft({ ...draft, mobileAppName: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">Subtitle<Input value={draft.mobileSubtitle} onChange={(event) => setDraft({ ...draft, mobileSubtitle: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">Icon URL<Input value={draft.mobileIconUrl} onChange={(event) => setDraft({ ...draft, mobileIconUrl: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">Splash colour<Input aria-label="Splash colour" value={draft.splashColor} onChange={(event) => setDraft({ ...draft, splashColor: event.target.value })} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">iOS bundle id<Input value={draft.iosBundleId} onChange={(event) => setDraft({ ...draft, iosBundleId: event.target.value })} placeholder="ai.poketschool.north" className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-sm">Android package<Input value={draft.androidPackage} onChange={(event) => setDraft({ ...draft, androidPackage: event.target.value })} placeholder="ai.poketschool.north" className="mt-1 h-11 rounded-xl" /></label>
          </div>
          <article className="mx-auto w-[220px] rounded-[2rem] border border-border p-3" style={{ background: draft.splashColor || '#1E6A83' }}>
            <div className="rounded-[1.4rem] bg-white p-4 text-center text-slate-900">
              <p className="text-xs uppercase tracking-wider">App</p>
              <p className="mt-2 font-semibold">{draft.mobileAppName || name}</p>
              {draft.mobileSubtitle && <p className="text-xs">{draft.mobileSubtitle}</p>}
              {!brand.hidePoweredBy && <p className="mt-3 text-[10px]">Powered by Poket School</p>}
            </div>
          </article>
        </section>

        <Button type="button" className="rounded-full" disabled={busy} onClick={savePolicy}>Save academy settings</Button>
      </div>
    </div>
  );
}
