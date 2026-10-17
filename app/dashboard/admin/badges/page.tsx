'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isSuperAdmin } from '@/lib/roles';
import { authedFetch } from '@/lib/api-client';
import { isLearningEvent } from '@/lib/events';
import { DEFAULT_SPARKS, STARTER_BADGES, type BadgeAudience, type BadgeDefinition, type BadgeTier, type SparksRewardConfig } from '@/lib/gamification/catalog';
import { friendlyError } from '@/lib/design/system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function criterionText(badge: BadgeDefinition): string {
  const rule = badge.criteria;
  if (rule.type === 'once') return `once ${rule.event}`;
  if (rule.type === 'count') return `count ${rule.event} ${rule.atLeast}`;
  if (rule.type === 'streak') return `streak ${rule.days}`;
  if (rule.type === 'hour') return `hour ${rule.event} ${rule.from} ${rule.to}`;
  if (rule.type === 'metric') return `metric ${rule.event} ${rule.field} ${rule.atLeast}`;
  return `xp ${rule.atLeast}`;
}

function criterionFromText(badge: BadgeDefinition, value: string): BadgeDefinition['criteria'] | null {
  const parts = value.trim().split(/\s+/);
  const [kind, event, a, b] = parts;
  const named = event && isLearningEvent(event) ? event : null;
  if (kind === 'once' && named) return { type: 'once', event: named };
  if (kind === 'streak') {
    const days = Number(event);
    return days > 0 ? { type: 'streak', days } : null;
  }
  if (kind === 'count' && named) {
    const atLeast = Number(a);
    return atLeast > 0 ? { type: 'count', event: named, atLeast } : null;
  }
  if (kind === 'xp') {
    const atLeast = Number(event);
    return atLeast > 0 ? { type: 'xp', atLeast } : null;
  }
  if (kind === 'hour' && named) {
    const from = Number(a);
    const to = Number(b);
    return from >= 0 && to <= 24 && from < to ? { type: 'hour', event: named, from, to } : null;
  }
  if (kind === 'metric' && named && a) {
    const atLeast = Number(b);
    return atLeast > 0 ? { type: 'metric', event: named, field: a, atLeast } : null;
  }
  return null;
}

const TIERS: BadgeTier[] = ['bronze', 'silver', 'gold'];
const AUDIENCES: BadgeAudience[] = ['student', 'parent', 'teacher', 'institution'];

export default function BadgeAdminPage() {
  const { profile } = useAuthSTORE();
  const [badges, setBadges] = useState<BadgeDefinition[]>(STARTER_BADGES);
  const [sparks, setSparks] = useState<SparksRewardConfig>(DEFAULT_SPARKS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin(profile)) return;
    authedFetch('/api/admin/gamification').then(data => {
      if (Array.isArray(data.badges)) setBadges(data.badges as BadgeDefinition[]);
      if (data.sparks && typeof data.sparks === 'object') setSparks(data.sparks as SparksRewardConfig);
    }).catch(() => undefined);
  }, [profile]);

  if (!isSuperAdmin(profile)) {
    return <p className="p-8 text-sm text-muted-foreground">Super admin access required.</p>;
  }

  const patch = (id: string, next: Partial<BadgeDefinition>) => {
    setBadges(current => current.map(badge => badge.id === id ? { ...badge, ...next } : badge));
  };

  const save = async () => {
    setSaving(true);
    try {
      await authedFetch('/api/admin/gamification', {
        method: 'PUT',
        body: JSON.stringify({ badges, sparks }),
      });
      toast.success('Badge settings saved.');
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 pb-16 space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#C8922A]">Poket School</p>
        <h1 className="font-heading text-4xl mt-1">Badges</h1>
        <p className="text-sm text-muted-foreground mt-2">Names, art, criteria, tier, and who the badge is for. Sparks for a milestone stay off until you set a small amount.</p>
      </header>
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <h2 className="font-heading text-2xl">Sparks rewards</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sparks.enabled} onChange={event => setSparks({ ...sparks, enabled: event.target.checked })} />
          Grant Sparks when a chosen badge is earned
        </label>
        <label className="block text-sm">
          Amount (0 to 5)
          <Input
            type="number"
            min={0}
            max={5}
            value={sparks.amount}
            onChange={event => setSparks({ ...sparks, amount: Math.max(0, Math.min(5, Number(event.target.value) || 0)) })}
            className="mt-1 max-w-[8rem]"
          />
        </label>
      </section>
      <ul className="space-y-3">
        {badges.map(badge => (
          <li key={badge.id} className="rounded-2xl border border-border p-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              Name
              <Input value={badge.name} onChange={event => patch(badge.id, { name: event.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Art
              <Input value={badge.art} onChange={event => patch(badge.id, { art: event.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Tier
              <select className="mt-1 w-full h-10 rounded-md border border-border bg-background px-2" value={badge.tier} onChange={event => patch(badge.id, { tier: event.target.value as BadgeTier })}>
                {TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Audience
              <select className="mt-1 w-full h-10 rounded-md border border-border bg-background px-2" value={badge.audience} onChange={event => patch(badge.id, { audience: event.target.value as BadgeAudience })}>
                {AUDIENCES.map(audience => <option key={audience} value={audience}>{audience}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={badge.enabled} onChange={event => patch(badge.id, { enabled: event.target.checked })} />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={sparks.badgeIds.includes(badge.id)}
                onChange={event => setSparks({
                  ...sparks,
                  badgeIds: event.target.checked ? [...sparks.badgeIds, badge.id] : sparks.badgeIds.filter(id => id !== badge.id),
                })}
              />
              This badge can grant Sparks
            </label>
            <label className="text-sm sm:col-span-2">
              Criteria
              <Input
                className="mt-1"
                value={criterionText(badge)}
                onChange={event => {
                  const next = criterionFromText(badge, event.target.value);
                  if (next) patch(badge.id, { criteria: next });
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">{badge.description}</p>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={() => void save()} disabled={saving} className="rounded-full">
        {saving ? 'Saving' : 'Save badges'}
      </Button>
    </div>
  );
}
