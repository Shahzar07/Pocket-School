'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AllocationOption } from '@/components/allocation-picker';
import { InstitutionWorkspace, type WorkspaceAction } from '@/components/institutions/workspace';
import { useAuthSTORE } from '@/hooks/use-auth';
import { usePricing } from '@/hooks/use-pricing';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { formatMoney } from '@/lib/money';
import { ApiError, authedFetch } from '@/lib/api-client';
import {
  getAllCourses,
  getInstitution,
  getProgrammes,
  isSubdomainAvailable,
  normaliseSubdomain,
  saveJoinCode,
  saveOemLicence,
  type AcademyClass,
  type AcademyInvite,
  type AcademyMember,
  type Institution,
  type Programme,
} from '@/lib/db';
import {
  SKILL_FRAMEWORK,
  canHidePoweredBy,
  canUseCustomDomain,
  digestSecret,
  identityMode,
  makeSecretToken,
  parseMemberCsv,
  secretPrefix,
  type AuditEvent,
  type IdentityMode,
  type InstitutionProfile,
  type InstitutionStatus,
} from '@/lib/enterprise';
import {
  directoryRow,
  listApiKeys,
  listAudit,
  listCatalogue,
  listCompliance,
  listInvoices,
  listOemLicences,
  listPaths,
  listSkills,
  listWebhooks,
  loadAcademySettings,
  loadPeople,
  loadProfile,
  publishCatalogueSnapshot,
  recordAudit,
  recordSubdomainRename,
  redactInstitutionPersonalData,
  removeInstitution,
  saveApiKey,
  saveCatalogueItem,
  saveCompliance,
  saveGroup,
  saveAcademySettings,
  saveInstitutionProfile,
  saveInstitutionPublic,
  saveInvoice,
  savePath,
  savePeopleInvites,
  saveSkills,
  saveWebhook,
  scheduleInstitutionReport,
  setInstitutionStatus,
  type ApiKeyItem,
  type CatalogueItem,
  type ComplianceItem,
  type InvoiceItem,
  type LearningPathItem,
  type SkillItem,
  type WebhookItem,
} from '@/lib/institution-store';
import { brandedInvite, makeJoinCode, normaliseCustomDomain, type OemLicence } from '@/lib/oem';
import { blankAcademySettings, type AcademySettings } from '@/lib/academy-settings';
import {
  blankPriceOverride,
  type InstitutionPriceOverride,
  type InstitutionVolumeSchedule,
  seedInstitutionPricing,
} from '@/lib/institution-pricing';
import { loadPriceOverride, loadVolumeSchedule, savePriceOverride } from '@/lib/institution-pricing-store';
import { publishedBooks } from '@/lib/reads/seed';
import { canManageInstitution, isSuperAdmin } from '@/lib/roles';
import { institutionOrigin } from '@/lib/white-label';

function asStatus(value: string | undefined): InstitutionStatus {
  return value === 'suspended' || value === 'pending' ? value : 'active';
}

export default function InstitutionConsolePage() {
  const { institutionId } = useParams<{ institutionId: string }>();
  const router = useRouter();
  const { user, profile: account, loading } = useAuthSTORE();
  const { currency } = usePricing();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [profile, setProfile] = useState<InstitutionProfile | null>(null);
  const [licences, setLicences] = useState<OemLicence[]>([]);
  const [programmes, setProgrammes] = useState<Pick<Programme, 'id' | 'name'>[]>([]);
  const [members, setMembers] = useState<AcademyMember[]>([]);
  const [invites, setInvites] = useState<AcademyInvite[]>([]);
  const [groups, setGroups] = useState<AcademyClass[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [paths, setPaths] = useState<LearningPathItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [contentOptions, setContentOptions] = useState<AllocationOption[]>([]);
  const [identity, setIdentity] = useState<IdentityMode>(identityMode({}));
  const [settings, setSettings] = useState<AcademySettings>(blankAcademySettings());
  const [volumeSchedule, setVolumeSchedule] = useState<InstitutionVolumeSchedule>(seedInstitutionPricing());
  const [priceOverride, setPriceOverride] = useState<InstitutionPriceOverride>(blankPriceOverride());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const allowed = canManageInstitution(account, institutionId);

  const reload = useCallback(async () => {
    if (!institutionId || !allowed) {
      setReady(true);
      return;
    }
    const found = await getInstitution(institutionId);
    if (!found) {
      setInstitution(null);
      setReady(true);
      return;
    }
    const stored = await loadProfile(institutionId);
    const row = directoryRow(found, stored);
    const [licenceRows, programmeRows, people, catalogueRows, complianceRows, invoiceRows, webhookRows, keyRows, pathRows, skillRows, auditRows, courses, academySettings, schedule, override] = await Promise.all([
      listOemLicences(institutionId),
      getProgrammes().catch(() => []),
      loadPeople(institutionId),
      listCatalogue(institutionId).catch(() => []),
      listCompliance(institutionId).catch(() => []),
      listInvoices(institutionId).catch(() => []),
      listWebhooks(institutionId).catch(() => []),
      listApiKeys(institutionId).catch(() => []),
      listPaths(institutionId).catch(() => []),
      listSkills(institutionId).catch(() => []),
      listAudit(institutionId).catch(() => []),
      getAllCourses().catch(() => []),
      loadAcademySettings(institutionId).catch(() => blankAcademySettings()),
      loadVolumeSchedule(),
      loadPriceOverride(institutionId),
    ]);
    setInstitution(found);
    setProfile(row.profile);
    setLicences(licenceRows);
    setProgrammes(programmeRows.map((item) => ({ id: item.id, name: item.name })));
    setMembers(people.members);
    setInvites(people.invites);
    setGroups(people.groups);
    setCatalogue(catalogueRows);
    setCompliance(complianceRows);
    setInvoices(invoiceRows);
    setWebhooks(webhookRows);
    setApiKeys(keyRows);
    setPaths(pathRows);
    setSkills(skillRows);
    setAudit(auditRows);
    setSettings(academySettings);
    setVolumeSchedule(schedule);
    setPriceOverride(override);
    setContentOptions([
      ...courses.map((course) => ({ token: `course:${course.id}`, label: course.title, group: 'Courses' })),
      ...publishedBooks().map((book) => ({ token: `book:${book.id}`, label: book.title, group: 'Books' })),
      ...pathRows.map((path) => ({ token: `path:${path.id}`, label: path.name, group: 'Paths' })),
    ]);
    setReady(true);
  }, [allowed, institutionId]);

  useEffect(() => {
    if (loading) return;
    reload().catch(() => {
      toast.error('Could not load this institution.');
      setReady(true);
    });
  }, [loading, reload]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    authedFetch('/api/institutions/identity')
      .then((data) => {
        if (!cancelled && data && typeof data === 'object') {
          setIdentity({
            saml: data.saml === true,
            oidc: data.oidc === true,
            scim: data.scim === true,
            lti: data.lti === true,
            zoom: data.zoom === true,
            teams: data.teams === true,
            mode: data.mode === 'sso' ? 'sso' : 'invite-only',
          });
        }
      })
      .catch(() => {
        if (!cancelled) setIdentity(identityMode({}));
      });
    return () => { cancelled = true; };
  }, [user]);

  const note = async (action: string, detail?: string) => {
    if (!institutionId || !user) return;
    await recordAudit(institutionId, {
      actorId: user.uid,
      actorName: account?.name || user.email || 'Admin',
      action,
      target: institutionId,
      detail,
    });
  };

  const onAction = async (action: WorkspaceAction) => {
    if (!institutionId || !user || !profile || !institution || !allowed) return;
    const platform = isSuperAdmin(account);
    setBusy(true);
    try {
      if (action.type === 'save-profile') {
        const next = platform ? action.profile : {
          ...action.profile,
          plan: profile.plan,
          seatCount: profile.seatCount,
          seatsUsed: profile.seatsUsed,
          amount: profile.amount,
          currency: profile.currency,
          licenceStartsOn: profile.licenceStartsOn,
          licenceEndsOn: profile.licenceEndsOn,
          renewalOn: profile.renewalOn,
          poNumber: profile.poNumber,
          parentInstitutionId: profile.parentInstitutionId,
          isolateData: profile.isolateData,
          state: profile.state,
          listedForSelfJoin: profile.listedForSelfJoin,
        };
        await saveInstitutionPublic(institutionId, { name: action.name.trim() });
        await saveInstitutionProfile(institutionId, next);
        await note('save-profile', action.name);
        toast.success('Profile saved.');
      } else if (action.type === 'save-brand') {
        let subdomain = '';
        if (action.subdomain.trim()) {
          const normalised = normaliseSubdomain(action.subdomain);
          if (!normalised) throw new Error('That subdomain is reserved or invalid. Use 3–63 letters, numbers or hyphens.');
          const free = await isSubdomainAvailable(normalised, institutionId).catch(() => false);
          if (!free) throw new Error(`“${normalised}” is already taken by another institution.`);
          subdomain = normalised;
        }
        let customDomain = action.customDomain.trim() ? (normaliseCustomDomain(action.customDomain) ?? '') : '';
        if (action.customDomain.trim() && !customDomain) throw new Error('Use a hostname the academy owns, such as learn.school.example.');
        if (customDomain && customDomain !== (institution.customDomain ?? '') && !canUseCustomDomain(profile.plan)) {
          throw new Error('A custom domain is available on Enterprise and OEM plans.');
        }
        const branding = { ...action.branding };
        if (branding.hidePoweredBy && !canHidePoweredBy(profile.plan)) {
          throw new Error('Hiding “Powered by Poket School” is available on Enterprise and OEM plans.');
        }
        let previousSubdomains = institution.previousSubdomains ?? [];
        if (subdomain && institution.subdomain && subdomain !== institution.subdomain) {
          previousSubdomains = await recordSubdomainRename(institutionId, previousSubdomains, institution.subdomain, subdomain);
        }
        await saveInstitutionPublic(institutionId, {
          subdomain,
          customDomain,
          branding,
          previousSubdomains,
          ...(customDomain !== (institution.customDomain ?? '') ? { customDomainStatus: 'pending', customDomainMessage: '' } : {}),
        });
        await note('save-brand', subdomain || customDomain || branding.displayName);
        toast.success(subdomain ? `Live at ${institutionOrigin(subdomain)} and /a/${subdomain}` : 'Branding saved.');
      } else if (action.type === 'status' || action.type === 'delete') {
        if (!platform) throw new Error('Only a platform administrator can change academy status.');
        if (action.type === 'delete') {
          await removeInstitution(institutionId);
          await note('delete');
          toast.success('Institution deleted.');
          router.push('/dashboard/admin/institutions');
          return;
        }
        await setInstitutionStatus(institutionId, action.status);
        await note('status', action.status);
        toast.success('Status updated.');
      } else if (action.type === 'invite') {
        const parsed = parseMemberCsv(action.csv);
        if (parsed.errors[0]) throw new Error(parsed.errors[0]);
        if (!parsed.rows.length) throw new Error('Add at least one email.');
        await savePeopleInvites(institutionId, parsed.rows);
        const code = makeJoinCode();
        await saveJoinCode(institutionId, code);
        const origin = institution.subdomain ? institutionOrigin(institution.subdomain) : 'https://poketschool.ai';
        const message = brandedInvite({
          displayName: institution.branding?.displayName || institution.name,
          emailFromName: institution.branding?.emailFromName,
        }, code, origin, { subject: institution.branding?.inviteSubject, text: institution.branding?.inviteBody });
        await navigator.clipboard.writeText(`${message.subject}\n${message.text}`).catch(() => undefined);
        await note('invite', String(parsed.rows.length));
        toast.success(`Invited ${parsed.rows.length}. The message is on the clipboard.`);
      } else if (action.type === 'group') {
        if (!action.name.trim()) throw new Error('Name the group.');
        await saveGroup(institutionId, action);
        await note('group', action.name);
        toast.success('Group saved.');
      } else if (action.type === 'catalogue') {
        for (const token of action.tokens) {
          const [kind = 'course', ...rest] = token.split(':');
          const refId = rest.join(':');
          const title = contentOptions.find((option) => option.token === token)?.label ?? refId;
          const storedKind = kind === 'book' || kind === 'path' ? kind : 'course';
          await saveCatalogueItem(institutionId, { kind: storedKind, refId, title, visibility: action.visibility });
        }
        await publishCatalogueSnapshot(institutionId);
        await note('catalogue', action.visibility);
        toast.success('Catalogue updated.');
      } else if (action.type === 'compliance') {
        if (!action.title.trim()) throw new Error('Name the training.');
        await saveCompliance(institutionId, { title: action.title.trim(), courseId: '', dueOn: action.dueOn, remindDays: action.remindDays, status: 'open' });
        await note('compliance', action.title);
        toast.success('Requirement added.');
      } else if (action.type === 'path') {
        if (!action.name.trim()) throw new Error('Name the path.');
        await savePath(institutionId, { name: action.name.trim(), items: action.tokens });
        await note('path', action.name);
        toast.success('Path saved.');
      } else if (action.type === 'skills') {
        if (skills.length) throw new Error('The skills framework is already on this academy.');
        await saveSkills(institutionId, SKILL_FRAMEWORK.map((skill) => ({ ...skill })));
        await note('skills');
        toast.success('Skills framework added.');
      } else if (action.type === 'schedule') {
        const next = new Date();
        next.setUTCDate(next.getUTCDate() + 1);
        await scheduleInstitutionReport({
          ownerId: user.uid,
          institutionId,
          scopeLabel: institution.name,
          cadence: action.cadence,
          nextRun: next.toISOString().slice(0, 10),
        });
        await note('schedule', action.cadence);
        toast.success('Weekly report scheduled.');
      } else if (action.type === 'webhook') {
        if (!/^https:\/\//.test(action.url.trim())) throw new Error('Webhook URLs use https.');
        const secret = makeSecretToken('wh');
        await saveWebhook(institutionId, {
          url: action.url.trim(),
          events: ['learner.completed', 'compliance.due'],
          active: true,
          secretPrefix: secretPrefix(secret),
          secretHash: await digestSecret(secret),
        });
        await note('webhook', action.url);
        toast.success(`Webhook added. Copy the secret now: ${secret}`);
      } else if (action.type === 'api-key') {
        const secret = makeSecretToken('pk');
        await saveApiKey(institutionId, { name: action.name.trim() || 'Academy key', prefix: secretPrefix(secret), hash: await digestSecret(secret) });
        await note('api-key', action.name);
        toast.success(`Key created. Copy it now: ${secret}`);
      } else if (action.type === 'invoice') {
        const status = platform ? action.status : 'requested';
        await saveInvoice(institutionId, {
          number: `PS-${Date.now().toString().slice(-6)}`,
          amount: action.amount,
          currency: action.currency || profile.currency || currency,
          seats: action.seats,
          status,
          poNumber: action.poNumber,
          issuedOn: new Date().toISOString().slice(0, 10),
          description: action.description ?? '',
        });
        await note('invoice', status);
        toast.success(status === 'requested' ? 'Upgrade requested.' : 'Invoice recorded.');
      } else if (action.type === 'pricing-override') {
        if (!platform) throw new Error('Only a platform administrator can change an academy price.');
        await savePriceOverride(institutionId, action.override);
        await note('pricing-override', action.override.planId);
        toast.success('Academy price saved.');
      } else if (action.type === 'licence') {
        if (!platform) throw new Error('Only a platform administrator can write a licence.');
        if (!action.programmeIds.length) throw new Error('Choose at least one programme.');
        await saveOemLicence(institutionId, {
          institutionId,
          programmeIds: action.programmeIds,
          seats: Math.max(1, action.seats),
          seatsUsed: profile.seatsUsed,
          startsOn: action.startsOn,
          endsOn: action.endsOn,
          currency: profile.currency || currency,
          amount: action.amount,
          allowOwnCourses: action.allowOwnCourses,
          status: 'active',
        });
        await saveInstitutionProfile(institutionId, {
          ...profile,
          seatCount: Math.max(1, action.seats),
          amount: action.amount,
          licenceStartsOn: action.startsOn,
          licenceEndsOn: action.endsOn,
          renewalOn: action.endsOn,
          currency: profile.currency || currency,
        });
        await note('licence', String(action.seats));
        toast.success('Licence saved.');
      } else if (action.type === 'save-settings') {
        const saved = await saveAcademySettings(institutionId, action.settings);
        await saveInstitutionPublic(institutionId, {
          branding: {
            ...institution.branding,
            mobileAppName: saved.mobileAppName || institution.branding?.mobileAppName,
            mobileIconUrl: saved.mobileIconUrl || institution.branding?.mobileIconUrl,
            splashColor: saved.splashColor || institution.branding?.splashColor,
          },
        });
        await note('save-settings', saved.signupPolicy);
        toast.success('Academy settings saved.');
      } else if (action.type === 'verify-domain') {
        const host = normaliseCustomDomain(institution.customDomain ?? '');
        if (!host) throw new Error('Save a custom domain first.');
        if (!canUseCustomDomain(profile.plan)) throw new Error('A custom domain is available on Enterprise and OEM plans.');
        try {
          const result = await authedFetch('/api/institutions/domain', {
            method: 'POST',
            body: JSON.stringify({ institutionId, domain: host }),
          });
          const status = result && typeof result === 'object' && typeof result.status === 'string' ? result.status : 'manual';
          const message = result && typeof result === 'object' && typeof result.message === 'string' ? result.message : '';
          await saveInstitutionPublic(institutionId, {
            customDomainStatus: status === 'manual' || status === 'pending' || status === 'verified' || status === 'active' || status === 'error' ? status : 'manual',
            customDomainMessage: message,
          });
          await note('verify-domain', status);
          toast.success(message || 'Domain check finished.');
        } catch (error) {
          if (error instanceof ApiError && (error.status === 400 || error.status === 403)) throw error;
          await saveInstitutionPublic(institutionId, {
            customDomainStatus: 'manual',
            customDomainMessage: 'Automatic SSL is waiting for VERCEL_TOKEN and VERCEL_PROJECT_ID. Use the DNS instructions.',
          });
          await note('verify-domain', 'manual');
          toast.message('Automatic SSL is waiting for the Vercel token. The DNS instructions on this page still apply.');
        }
      } else if (action.type === 'privacy-erase') {
        await redactInstitutionPersonalData(institutionId);
        await note('privacy-erase');
        toast.success('Personal data for this academy was erased.');
      }
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save that change.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !ready) {
    return <div className="h-40 animate-pulse rounded-3xl bg-muted" />;
  }
  if (!allowed) {
    return <p className="text-sm text-muted-foreground">This academy is outside your account.</p>;
  }
  if (!institution || !profile) {
    return <p className="text-sm text-muted-foreground">That institution was not found.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6">
      <DocumentDelivery
        documents={[textDocument({
          id: `institution-${institutionId}`,
          title: `${institution.name} documents`,
          lines: [
            institution.name,
            ...licences.map((licence) => `${licence.seatsUsed}/${licence.seats} seats · ${formatMoney(licence.amount, licence.currency)} · ${licence.startsOn} to ${licence.endsOn}`),
            ...invoices.map((invoice) => `${invoice.number} · ${invoice.status} · ${formatMoney(invoice.amount, invoice.currency)}`),
          ],
        })]}
        studentIds={[]}
        institutionId={institutionId}
      />
      <InstitutionWorkspace
        name={institution.name}
        status={asStatus(institution.status)}
        subdomain={institution.subdomain ?? ''}
        customDomain={institution.customDomain ?? ''}
        domain={institution.domain ?? ''}
        branding={institution.branding ?? {}}
        profile={profile}
        licences={licences}
        programmes={programmes}
        members={members}
        invites={invites}
        groups={groups}
        catalogue={catalogue}
        compliance={compliance}
        invoices={invoices}
        webhooks={webhooks}
        apiKeys={apiKeys}
        paths={paths}
        skills={skills}
        audit={audit}
        contentOptions={contentOptions}
        identity={identity}
        settings={settings}
        domainStatus={institution.customDomainStatus ?? ''}
        domainMessage={institution.customDomainMessage ?? ''}
        previousSubdomains={institution.previousSubdomains ?? []}
        superAdmin={isSuperAdmin(account)}
        currency={profile.currency || currency}
        volumeSchedule={volumeSchedule}
        priceOverride={priceOverride}
        busy={busy}
        onAction={onAction}
      />
    </div>
  );
}
