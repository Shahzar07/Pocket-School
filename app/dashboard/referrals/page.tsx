'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { authedFetch } from '@/lib/api-client';
import { useAuthSTORE } from '@/hooks/use-auth';
import { formatMoney } from '@/lib/money';
import { isSuperAdmin } from '@/lib/roles';
import { conversionRate, shortLink } from '@/lib/promos';

export default function ReferralsPage() {
  const { profile } = useAuthSTORE();
  const [code, setCode] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [total, setTotal] = useState(0);
  const [awaiting, setAwaiting] = useState(0);
  const [share, setShare] = useState(10);
  const [clicks, setClicks] = useState(0);
  const [conversions, setConversions] = useState(0);
  const [notice, setNotice] = useState('');
  const [origin, setOrigin] = useState('');
  const [commission, setCommission] = useState('10');
  const [teacherBps, setTeacherBps] = useState(0);
  const [item, setItem] = useState('');
  const [kind, setKind] = useState('course');
  const [percentOff, setPercentOff] = useState('15');
  const [quantityLimit, setQuantityLimit] = useState('50');
  const [expiresAt, setExpiresAt] = useState('');

  const load = () => {
    authedFetch('/api/payments/referral').then((data) => {
      setEnabled(data.enabled !== false);
      setCode(typeof data.code === 'string' ? data.code : null);
      setTotal(Number(data.total ?? 0));
      setAwaiting(Number(data.awaiting ?? 0));
      setShare(Number(data.shareBps ?? 1000) / 100);
      setClicks(Number(data.clicks ?? 0));
      setConversions(Number(data.conversions ?? 0));
      if (typeof data.item === 'string') setItem(data.item);
      if (typeof data.kind === 'string' && data.kind) setKind(data.kind);
      if (data.percentOff) setPercentOff(String(data.percentOff));
      if (data.quantityLimit) setQuantityLimit(String(data.quantityLimit));
      if (typeof data.expiresAt === 'string') setExpiresAt(data.expiresAt);
    }).catch(() => setNotice('Referrals could not be loaded.'));
  };

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, []);

  useEffect(() => {
    if (!isSuperAdmin(profile)) return;
    authedFetch('/api/payments/admin-payments').then((data) => {
      const commissionRow = data.commission as { affiliateShareBps?: number; teacherShareBps?: number } | undefined;
      if (commissionRow?.affiliateShareBps) setCommission(String(commissionRow.affiliateShareBps / 100));
      setTeacherBps(Number(commissionRow?.teacherShareBps ?? 0));
    }).catch(() => undefined);
  }, [profile]);

  const create = async () => {
    const data = await authedFetch('/api/payments/referral', {
      method: 'POST',
      body: JSON.stringify({ create: true, name: profile?.name ?? 'Poket' }),
    });
    setCode(typeof data.code === 'string' ? data.code : null);
    setNotice(typeof data.code === 'string' ? 'Your short link is ready.' : 'Referrals are switched off.');
  };

  const saveCommission = async () => {
    const affiliateShareBps = Math.round(Number(commission) * 100);
    await authedFetch('/api/payments/admin-payments', {
      method: 'POST',
      body: JSON.stringify({ action: 'commission', affiliateShareBps, teacherShareBps: teacherBps }),
    });
    setShare(Number(commission));
    setNotice('Affiliate commission saved.');
  };

  const savePromo = async () => {
    if (!code) {
      setNotice('Create your link before adding a promo.');
      return;
    }
    const data = await authedFetch('/api/payments/referral', {
      method: 'POST',
      body: JSON.stringify({
        create: false,
        item,
        kind,
        percentOff: Number(percentOff),
        quantityLimit: Number(quantityLimit),
        expiresAt,
      }),
    });
    setNotice(typeof data.item === 'string' && data.item ? 'Promo is on the site banner.' : 'Promo saved.');
    load();
  };

  const link = code ? shortLink(origin || 'https://pocket-school-ochre.vercel.app', code) : '';
  const rate = Math.round(conversionRate(clicks, conversions) * 100);

  return (
    <DashPage>
      <DashHeader eyebrow="Affiliates" title="Share Poket School" description="A short link counts clicks and conversions. Commission is a share of the pre-tax amount, set by a super admin. Payouts use the same Connect account as teacher earnings." />
      <Panel className="space-y-3">
        {!enabled && <p className="text-sm text-muted-foreground">Referral codes are switched off.</p>}
        {enabled && code && (
          <>
            <p className="font-mono text-lg font-semibold break-all">{link}</p>
            <button type="button" className="h-10 px-4 rounded-full border border-border text-sm font-semibold" onClick={() => void navigator.clipboard.writeText(link).then(() => setNotice('Link copied.'))}>Copy link</button>
          </>
        )}
        {enabled && !code && (
          <button type="button" onClick={() => void create()} className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            Create my link
          </button>
        )}
        <p className="text-sm text-muted-foreground">
          Commission {share}% · clicks {clicks} · conversions {conversions} ({rate}%) · earned {formatMoney(total)} · awaiting payout {formatMoney(awaiting)}
        </p>
        <p className="text-sm"><Link href="/dashboard/teacher/earnings" className="underline">Open payouts</Link></p>
        {notice && <p className="text-sm">{notice}</p>}
      </Panel>
      {isSuperAdmin(profile) && (
        <Panel className="space-y-3">
          <h2 className="text-[15px] font-semibold">Affiliate commission</h2>
          <label className="text-sm block">Percent
            <input aria-label="Affiliate commission percent" value={commission} onChange={(event) => setCommission(event.target.value)} className="mt-1 h-10 w-28 rounded-xl border border-border px-3 text-sm block" />
          </label>
          <button type="button" className="h-10 px-4 rounded-full bg-foreground text-background text-sm font-bold" onClick={() => void saveCommission().catch(() => setNotice('Commission was not saved.'))}>Save commission</button>
        </Panel>
      )}
      <Panel className="space-y-3">
        <h2 className="text-[15px] font-semibold">Promo</h2>
        <p className="text-sm text-muted-foreground">A live promo shows on the public site until the quantity runs out or the countdown ends.</p>
        <input aria-label="Promo item" value={item} onChange={(event) => setItem(event.target.value)} placeholder="Course, programme, or book" className="h-10 w-full rounded-xl border border-border px-3 text-sm" />
        <div className="flex flex-wrap gap-2">
          <select aria-label="Promo kind" value={kind} onChange={(event) => setKind(event.target.value)} className="h-10 rounded-xl border border-border px-3 text-sm">
            <option value="course">Course</option>
            <option value="programme">Programme</option>
            <option value="book">Book</option>
          </select>
          <input aria-label="Percent off" value={percentOff} onChange={(event) => setPercentOff(event.target.value)} className="h-10 w-24 rounded-xl border border-border px-3 text-sm" />
          <input aria-label="Quantity limit" value={quantityLimit} onChange={(event) => setQuantityLimit(event.target.value)} className="h-10 w-24 rounded-xl border border-border px-3 text-sm" />
          <input aria-label="Promo end date" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="h-10 rounded-xl border border-border px-3 text-sm" />
        </div>
        <button type="button" className="h-10 px-4 rounded-full bg-foreground text-background text-sm font-bold" onClick={() => void savePromo().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Promo was not saved.'))}>Publish promo</button>
      </Panel>
    </DashPage>
  );
}
