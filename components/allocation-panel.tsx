'use client';

import { useMemo, useState } from 'react';
import {
  AUDIENCES, AUDIENCE_LABELS, PREVIEW_ROLES, previewViewer, productAccess,
  type Audience, type AllocatableProduct, type ViewerRole,
} from '@/lib/allocation';
import { TIERS, PRICE_TYPE_LABELS, type PriceType } from '@/lib/entitlements';
import type { Institution } from '@/lib/db';

/**
 * Audience, tier and price for one product, with a preview of what each
 * role would see. The preview calls the same function as POST /api/access/visible.
 */
export function AllocationPanel({
  product,
  institutions,
  onChange,
}: {
  product: AllocatableProduct & { title?: string };
  institutions: Pick<Institution, 'id' | 'name'>[];
  onChange: (patch: Partial<AllocatableProduct>) => void;
}) {
  const audiences = (product.audiences ?? []) as Audience[];
  const schools = product.allocatedInstitutionIds ?? [];
  const [role, setRole] = useState<ViewerRole>('student');
  const [tier, setTier] = useState(2);
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? '');
  const [enrolled, setEnrolled] = useState(false);

  const preview = useMemo(() => productAccess(product, previewViewer(role, {
    accessTier: tier as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    institutionId: institutionId || null,
    enrolled,
  })), [product, role, tier, institutionId, enrolled]);

  const toggleAudience = (audience: Audience) => {
    const next = audiences.includes(audience)
      ? audiences.filter(item => item !== audience)
      : [...audiences, audience];
    onChange({ audiences: next });
  };

  return (
    <div className="space-y-4">
      <section className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Who can see it</p>
        {AUDIENCES.map(audience => (
          <label key={audience} className="flex items-center justify-between gap-2 text-xs py-1 cursor-pointer">
            <span className="font-semibold text-foreground">{AUDIENCE_LABELS[audience]}</span>
            <input
              type="checkbox"
              checked={audiences.includes(audience)}
              onChange={() => toggleAudience(audience)}
            />
          </label>
        ))}
        {audiences.length === 0 && (
          <p className="text-[10px] text-muted-foreground">No audience selected, so the older public rules still apply.</p>
        )}
      </section>

      {audiences.includes('institutions') && (
        <section className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Institutions</p>
          {institutions.length === 0 && <p className="text-[11px] text-muted-foreground">Add an institution first.</p>}
          {institutions.map(inst => (
            <label key={inst.id} className="flex items-center justify-between gap-2 text-xs py-1 cursor-pointer">
              <span className="font-semibold truncate">{inst.name}</span>
              <input
                type="checkbox"
                checked={schools.includes(inst.id)}
                onChange={() => {
                  const next = schools.includes(inst.id) ? schools.filter(id => id !== inst.id) : [...schools, inst.id];
                  onChange({ allocatedInstitutionIds: next });
                }}
              />
            </label>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <label className="block text-xs font-semibold">
          Minimum plan
          <select
            className="mt-1 w-full h-9 rounded-xl border border-border bg-card px-2"
            value={product.minTier ?? ''}
            onChange={event => onChange({ minTier: event.target.value === '' ? null : Number(event.target.value) })}
          >
            <option value="">Derive from the level</option>
            {TIERS.map(item => <option key={item.tier} value={item.tier}>{item.tier} · {item.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold">
          Price type
          <select
            className="mt-1 w-full h-9 rounded-xl border border-border bg-card px-2"
            value={product.priceType ?? ''}
            onChange={event => onChange({ priceType: event.target.value ? event.target.value as PriceType : null })}
          >
            <option value="">Derive from the price</option>
            {Object.entries(PRICE_TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </section>

      <section className="rounded-xl border border-border p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Preview as</p>
        <div className="flex flex-wrap gap-1">
          {PREVIEW_ROLES.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              className={`px-2 py-1 rounded-full text-[11px] font-semibold ${role === item.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="block text-[11px] font-semibold">
          Plan tier
          <select className="mt-1 w-full h-8 rounded-lg border border-border bg-card px-2" value={tier} onChange={event => setTier(Number(event.target.value))}>
            {TIERS.map(item => <option key={item.tier} value={item.tier}>{item.name}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-semibold">
          Their institution
          <select className="mt-1 w-full h-8 rounded-lg border border-border bg-card px-2" value={institutionId} onChange={event => setInstitutionId(event.target.value)}>
            <option value="">None</option>
            {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] font-semibold">
          <input type="checkbox" checked={enrolled} onChange={event => setEnrolled(event.target.checked)} />
          Already enrolled
        </label>
        <p className="text-xs" data-allocation-preview={preview.listed ? 'listed' : 'hidden'}>
          <span className="font-semibold">{preview.listed ? 'Listed' : 'Hidden'}</span>
          {' · '}
          <span className="font-semibold">{preview.open ? 'Lessons open' : 'Lessons closed'}</span>
          <span className="block text-muted-foreground mt-1">{preview.reason}</span>
        </p>
      </section>
    </div>
  );
}
