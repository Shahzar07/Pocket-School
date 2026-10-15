'use client';

import { useMemo, useState } from 'react';
import {
  PREVIEW_ROLES, previewViewer, productAccess,
  type AllocatableProduct, type Audience, type ViewerRole,
} from '@/lib/allocation';
import {
  POLICY_AUDIENCES, POLICY_AUDIENCE_LABELS, describeAccess, lessonWindow, normalisePolicy, parseAllocationCsv,
  type AccessPolicy, type PolicyAudience,
} from '@/lib/access-policy';
import { TIERS, PRICE_TYPE_LABELS, type PriceType } from '@/lib/entitlements';
import { listAccessAudit, saveAccessGrants, writeAccessAudit, type Institution } from '@/lib/db';
import { useAuthSTORE } from '@/hooks/use-auth';
import { toast } from 'sonner';

const CLASSIC: Audience[] = ['students', 'teachers', 'parents', 'institutions', 'all', 'marketplace'];
const YEARS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'];
const LEVELS = ['Primary', 'Secondary', 'GCSE', 'A-Level', 'University'];

type Patch = {
  audiences?: Audience[];
  allocatedInstitutionIds?: string[];
  accessPolicy?: AccessPolicy;
  minTier?: number | null;
  priceType?: PriceType | null;
  freePreviewCount?: number | null;
};

function blankPolicy(product: AllocatableProduct): AccessPolicy {
  const include = (product.accessPolicy?.include ?? product.audiences ?? []).filter(
    (item): item is PolicyAudience => (POLICY_AUDIENCES as readonly string[]).includes(item),
  );
  return {
    include,
    exclude: product.accessPolicy?.exclude ?? [],
    institutionMode: product.accessPolicy?.institutionMode ?? 'specific',
    institutionIds: product.accessPolicy?.institutionIds ?? product.allocatedInstitutionIds ?? [],
    excludeInstitutionIds: product.accessPolicy?.excludeInstitutionIds ?? [],
    userIds: product.accessPolicy?.userIds ?? [],
    excludeUserIds: product.accessPolicy?.excludeUserIds ?? [],
    cohortIds: product.accessPolicy?.cohortIds ?? [],
    excludeCohortIds: product.accessPolicy?.excludeCohortIds ?? [],
    programmeIds: product.accessPolicy?.programmeIds ?? [],
    yearGroups: product.accessPolicy?.yearGroups ?? [],
    levels: product.accessPolicy?.levels ?? [],
    countries: product.accessPolicy?.countries ?? [],
    regions: product.accessPolicy?.regions ?? [],
    languages: product.accessPolicy?.languages ?? [],
    releaseOn: product.accessPolicy?.releaseOn ?? '',
    expiresOn: product.accessPolicy?.expiresOn ?? '',
    accessDays: product.accessPolicy?.accessDays ?? 0,
    dripMode: product.accessPolicy?.dripMode ?? 'none',
    dripEveryDays: product.accessPolicy?.dripEveryDays ?? 7,
    seatLimit: product.accessPolicy?.seatLimit ?? 0,
    seatsUsed: product.accessPolicy?.seatsUsed ?? 0,
    sparksCost: product.accessPolicy?.sparksCost ?? 0,
    bundleIds: product.accessPolicy?.bundleIds ?? [],
    trialDays: product.accessPolicy?.trialDays ?? 0,
    freePreviewCount: product.accessPolicy?.freePreviewCount ?? 0,
  };
}

function Drawer({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-t border-border pt-2">
      <button type="button" onClick={() => setOpen(value => !value)} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}

function csv(values: string[] | undefined): string {
  return (values ?? []).join(', ');
}

function split(value: string): string[] {
  return value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean);
}

/**
 * Who can see one product. The first section is the audience. Schedule, quotas
 * and targeting stay closed until someone needs them. Preview uses the same
 * decision as POST /api/access/visible.
 */
export function AllocationPanel({
  product,
  institutions,
  onChange,
}: {
  product: AllocatableProduct & { title?: string };
  institutions: Pick<Institution, 'id' | 'name'>[];
  onChange: (patch: Patch) => void;
}) {
  const { user } = useAuthSTORE();
  const policy = blankPolicy(product);
  const [role, setRole] = useState<ViewerRole>('student');
  const [tier, setTier] = useState(2);
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? '');
  const [userId, setUserId] = useState('');
  const [enrolled, setEnrolled] = useState(false);
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('en');
  const [csvText, setCsvText] = useState('email,action\n');
  const [audit, setAudit] = useState<string[]>([]);

  const previewViewerValue = previewViewer(role, {
    accessTier: tier as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    institutionId: institutionId || null,
    enrolled,
  });
  const preview = useMemo(() => productAccess(product, {
    ...previewViewerValue,
    userId: userId || null,
    country: country || null,
    language,
    now: new Date().toISOString().slice(0, 10),
  }), [product, previewViewerValue, userId, country, language]);
  const firstLesson = lessonWindow(product.accessPolicy, { ...previewViewerValue, enrolled, language }, 0, 0);

  const commit = (next: AccessPolicy, extra: Partial<Patch> = {}) => {
    const saved = normalisePolicy(next);
    const audiences = saved.include.filter((item): item is Audience => (CLASSIC as readonly string[]).includes(item));
    onChange({
      accessPolicy: saved,
      audiences,
      allocatedInstitutionIds: saved.institutionIds ?? [],
      freePreviewCount: saved.freePreviewCount ?? 0,
      ...extra,
    });
  };

  const toggle = (list: 'include' | 'exclude', audience: PolicyAudience) => {
    const current = policy[list];
    const next = current.includes(audience) ? current.filter(item => item !== audience) : [...current, audience];
    commit({ ...policy, [list]: next });
  };

  const applyCsv = async () => {
    const parsed = parseAllocationCsv(csvText);
    if (parsed.errors.length) { toast.error(parsed.errors[0]); return; }
    if (!parsed.rows.length || !product.id) return;
    try {
      await saveAccessGrants(product.id, parsed.rows.map(row => ({ id: row.id, active: row.action === 'grant' })));
      const detail = `${parsed.rows.length} people`;
      if (user) await writeAccessAudit(product.id, { actorId: user.uid, action: 'bulk', detail });
      toast.success(`Updated ${detail}.`);
      setAudit(prev => [`${detail} updated`, ...prev].slice(0, 8));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update access.');
    }
  };

  const loadAudit = async () => {
    if (!product.id) return;
    const rows = await listAccessAudit(product.id).catch(() => []);
    setAudit(rows.map(row => `${row.action}: ${row.detail}`));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-foreground" data-access-summary>{describeAccess({ ...product, accessPolicy: policy.include.length || policy.exclude.length ? policy : product.accessPolicy })}</p>

      <section className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Include</p>
        {POLICY_AUDIENCES.map(audience => (
          <label key={audience} className="flex items-center justify-between gap-2 text-xs py-0.5 cursor-pointer">
            <span className="font-semibold">{POLICY_AUDIENCE_LABELS[audience]}</span>
            <input type="checkbox" checked={policy.include.includes(audience)} onChange={() => toggle('include', audience)} />
          </label>
        ))}
      </section>

      <section className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Exclude</p>
        {POLICY_AUDIENCES.map(audience => (
          <label key={audience} className="flex items-center justify-between gap-2 text-xs py-0.5 cursor-pointer">
            <span>{POLICY_AUDIENCE_LABELS[audience]}</span>
            <input type="checkbox" checked={policy.exclude.includes(audience)} onChange={() => toggle('exclude', audience)} />
          </label>
        ))}
      </section>

      {policy.include.includes('institutions') && (
        <section className="space-y-1">
          <label className="flex items-center justify-between text-xs font-semibold">
            Every institution
            <input
              type="checkbox"
              checked={policy.institutionMode === 'all'}
              onChange={event => commit({ ...policy, institutionMode: event.target.checked ? 'all' : 'specific' })}
            />
          </label>
          {policy.institutionMode !== 'all' && institutions.map(inst => (
            <label key={inst.id} className="flex items-center justify-between gap-2 text-xs py-0.5">
              <span className="truncate">{inst.name}</span>
              <input
                type="checkbox"
                checked={(policy.institutionIds ?? []).includes(inst.id)}
                onChange={() => {
                  const ids = policy.institutionIds ?? [];
                  const next = ids.includes(inst.id) ? ids.filter(id => id !== inst.id) : [...ids, inst.id];
                  commit({ ...policy, institutionIds: next });
                }}
              />
            </label>
          ))}
        </section>
      )}

      <Drawer title="People and classes">
        <label className="block text-xs font-semibold">User ids or emails to include
          <textarea className="mt-1 w-full min-h-16 rounded-xl border border-border p-2 font-normal" value={csv(policy.userIds)} onChange={event => commit({ ...policy, userIds: split(event.target.value) })} />
        </label>
        <label className="block text-xs font-semibold">User ids or emails to exclude
          <textarea className="mt-1 w-full min-h-16 rounded-xl border border-border p-2 font-normal" value={csv(policy.excludeUserIds)} onChange={event => commit({ ...policy, excludeUserIds: split(event.target.value) })} />
        </label>
        <label className="block text-xs font-semibold">Cohort or class ids
          <input className="mt-1 w-full h-9 rounded-xl border border-border px-2 font-normal" value={csv(policy.cohortIds)} onChange={event => commit({ ...policy, cohortIds: split(event.target.value) })} />
        </label>
        <label className="block text-xs font-semibold">CSV grant or revoke
          <textarea className="mt-1 w-full min-h-20 rounded-xl border border-border p-2 font-normal" value={csvText} onChange={event => setCsvText(event.target.value)} />
        </label>
        <button type="button" className="text-xs font-semibold underline" onClick={() => { void applyCsv(); }}>Apply CSV</button>
        <button type="button" className="text-xs font-semibold underline ms-3" onClick={() => { void loadAudit(); }}>Audit log</button>
        {audit.length > 0 && <ul className="text-[11px] text-muted-foreground space-y-1">{audit.map(line => <li key={line}>{line}</li>)}</ul>}
      </Drawer>

      <Drawer title="Plan and price">
        <label className="block text-xs font-semibold">Minimum plan
          <select className="mt-1 w-full h-9 rounded-xl border border-border bg-card px-2" value={product.minTier ?? ''} onChange={event => onChange({ minTier: event.target.value === '' ? null : Number(event.target.value) })}>
            <option value="">Derive from the level</option>
            {TIERS.map(item => <option key={item.tier} value={item.tier}>{item.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold">Price type
          <select className="mt-1 w-full h-9 rounded-xl border border-border bg-card px-2" value={product.priceType ?? ''} onChange={event => onChange({ priceType: event.target.value ? event.target.value as PriceType : null })}>
            <option value="">Derive from the price</option>
            {Object.entries(PRICE_TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold">Free preview lessons
          <input type="number" min={0} max={20} className="mt-1 w-full h-9 rounded-xl border border-border px-2" value={policy.freePreviewCount ?? 0} onChange={event => commit({ ...policy, freePreviewCount: Number(event.target.value) })} />
        </label>
        <label className="block text-xs font-semibold">Sparks to unlock
          <input type="number" min={0} className="mt-1 w-full h-9 rounded-xl border border-border px-2" value={policy.sparksCost ?? 0} onChange={event => commit({ ...policy, sparksCost: Number(event.target.value) })} />
        </label>
      </Drawer>

      <Drawer title="Programme, place and language">
        <label className="block text-xs font-semibold">Programme ids
          <input className="mt-1 w-full h-9 rounded-xl border border-border px-2 font-normal" value={csv(policy.programmeIds)} onChange={event => commit({ ...policy, programmeIds: split(event.target.value) })} />
        </label>
        <div className="flex flex-wrap gap-1">
          {YEARS.map(year => (
            <button key={year} type="button" className={`px-2 py-1 rounded-full text-[11px] ${(policy.yearGroups ?? []).includes(year) ? 'bg-foreground text-background' : 'bg-muted'}`} onClick={() => {
              const years = policy.yearGroups ?? [];
              commit({ ...policy, yearGroups: years.includes(year) ? years.filter(item => item !== year) : [...years, year] });
            }}>{year}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {LEVELS.map(level => (
            <button key={level} type="button" className={`px-2 py-1 rounded-full text-[11px] ${(policy.levels ?? []).includes(level) ? 'bg-foreground text-background' : 'bg-muted'}`} onClick={() => {
              const levels = policy.levels ?? [];
              commit({ ...policy, levels: levels.includes(level) ? levels.filter(item => item !== level) : [...levels, level] });
            }}>{level}</button>
          ))}
        </div>
        <label className="block text-xs font-semibold">Country codes
          <input className="mt-1 w-full h-9 rounded-xl border border-border px-2 font-normal" placeholder="MY, GB" value={csv(policy.countries)} onChange={event => commit({ ...policy, countries: split(event.target.value) })} />
        </label>
        <label className="block text-xs font-semibold">Regions
          <input className="mt-1 w-full h-9 rounded-xl border border-border px-2 font-normal" value={csv(policy.regions)} onChange={event => commit({ ...policy, regions: split(event.target.value) })} />
        </label>
        <label className="block text-xs font-semibold">Languages
          <input className="mt-1 w-full h-9 rounded-xl border border-border px-2 font-normal" placeholder="en, ms" value={csv(policy.languages)} onChange={event => commit({ ...policy, languages: split(event.target.value) })} />
        </label>
      </Drawer>

      <Drawer title="Schedule">
        <label className="block text-xs font-semibold">Release date
          <input type="date" className="mt-1 w-full h-9 rounded-xl border border-border px-2" value={policy.releaseOn ?? ''} onChange={event => commit({ ...policy, releaseOn: event.target.value })} />
        </label>
        <label className="block text-xs font-semibold">Expiry date
          <input type="date" className="mt-1 w-full h-9 rounded-xl border border-border px-2" value={policy.expiresOn ?? ''} onChange={event => commit({ ...policy, expiresOn: event.target.value })} />
        </label>
        <label className="block text-xs font-semibold">Days of access after enrol
          <input type="number" min={0} className="mt-1 w-full h-9 rounded-xl border border-border px-2" value={policy.accessDays ?? 0} onChange={event => commit({ ...policy, accessDays: Number(event.target.value) })} />
        </label>
        <label className="block text-xs font-semibold">Drip
          <select className="mt-1 w-full h-9 rounded-xl border border-border bg-card px-2" value={policy.dripMode ?? 'none'} onChange={event => commit({ ...policy, dripMode: event.target.value as AccessPolicy['dripMode'] })}>
            <option value="none">All lessons at once</option>
            <option value="lesson">One step per lesson</option>
            <option value="unit">One step per unit</option>
          </select>
        </label>
        <label className="block text-xs font-semibold">Days between drip steps
          <input type="number" min={1} className="mt-1 w-full h-9 rounded-xl border border-border px-2" value={policy.dripEveryDays ?? 7} onChange={event => commit({ ...policy, dripEveryDays: Number(event.target.value) })} />
        </label>
      </Drawer>

      <Drawer title="Seats, coupons, bundles and trial">
        <label className="block text-xs font-semibold">Seat limit (0 means no limit)
          <input type="number" min={0} className="mt-1 w-full h-9 rounded-xl border border-border px-2" value={policy.seatLimit ?? 0} onChange={event => commit({ ...policy, seatLimit: Number(event.target.value) })} />
        </label>
        <p className="text-[11px] text-muted-foreground">{policy.seatsUsed ?? 0} seats used on this product. A school&apos;s licence quota is set on the institution licence, separately from this limit. A 100% coupon opens the product. Smaller discount codes stay in the coupon list.</p>
        <label className="block text-xs font-semibold">Bundle product ids that include this
          <input className="mt-1 w-full h-9 rounded-xl border border-border px-2 font-normal" value={csv(policy.bundleIds)} onChange={event => commit({ ...policy, bundleIds: split(event.target.value) })} />
        </label>
        <label className="block text-xs font-semibold">Trial days
          <input type="number" min={0} className="mt-1 w-full h-9 rounded-xl border border-border px-2" value={policy.trialDays ?? 0} onChange={event => commit({ ...policy, trialDays: Number(event.target.value) })} />
        </label>
      </Drawer>

      <section className="rounded-xl border border-border p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Preview as</p>
        <div className="flex flex-wrap gap-1">
          {PREVIEW_ROLES.map(item => (
            <button key={item.id} type="button" onClick={() => setRole(item.id)} className={`px-2 py-1 rounded-full text-[11px] font-semibold ${role === item.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="block text-[11px] font-semibold">Plan
          <select className="mt-1 w-full h-8 rounded-lg border border-border bg-card px-2" value={tier} onChange={event => setTier(Number(event.target.value))}>
            {TIERS.map(item => <option key={item.tier} value={item.tier}>{item.name}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-semibold">Institution
          <select className="mt-1 w-full h-8 rounded-lg border border-border bg-card px-2" value={institutionId} onChange={event => setInstitutionId(event.target.value)}>
            <option value="">None</option>
            {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-semibold">User id
          <input className="mt-1 w-full h-8 rounded-lg border border-border px-2" value={userId} onChange={event => setUserId(event.target.value)} />
        </label>
        <label className="block text-[11px] font-semibold">Country and language
          <span className="mt-1 flex gap-1">
            <input className="w-16 h-8 rounded-lg border border-border px-2" placeholder="MY" value={country} onChange={event => setCountry(event.target.value)} />
            <input className="flex-1 h-8 rounded-lg border border-border px-2" value={language} onChange={event => setLanguage(event.target.value)} />
          </span>
        </label>
        <label className="flex items-center gap-2 text-[11px] font-semibold">
          <input type="checkbox" checked={enrolled} onChange={event => setEnrolled(event.target.checked)} />
          Already enrolled
        </label>
        <p className="text-xs" data-allocation-preview={preview.listed ? 'listed' : 'hidden'}>
          <span className="font-semibold">{preview.listed ? 'Listed' : 'Hidden'}</span>
          {' · '}
          <span className="font-semibold">{preview.open ? 'Lessons open' : 'Lessons closed'}</span>
          <span className="block text-muted-foreground mt-1">{preview.reason}. First lesson: {firstLesson.reason}.</span>
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 text-xs">
        <p className="rounded-xl border border-border p-2"><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Views</span>{product.viewCount ?? 0}</p>
        <p className="rounded-xl border border-border p-2"><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Enrolments</span>{product.enrollmentCount ?? 0}</p>
        <p className="rounded-xl border border-border p-2"><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Completions</span>{product.completionCount ?? 0}</p>
        <p className="rounded-xl border border-border p-2"><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Revenue</span>{product.revenueTotal ?? 0}</p>
      </section>
    </div>
  );
}
