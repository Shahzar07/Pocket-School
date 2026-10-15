'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NEUTRAL_LINK, defaultChildControls, normaliseChildControls, type ChildControls, type DigestCadence, type PaymentMethod, type TeacherMessagePref } from '@/lib/parent-controls';
import { ProfilePhoto } from '@/components/account/profile-photo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface FamilyChild {
  id: string;
  name: string;
  email: string;
  ageTier?: string;
  bio?: string;
  avatarUrl?: string;
  controls?: ChildControls;
}

export interface LinkRequestRow {
  id: string;
  parentId: string;
  parentName: string;
  studentEmail: string;
  status: string;
}

export interface ReceiptRow {
  id: string;
  description: string;
  amountLabel: string;
  status: string;
}

export interface PurchaseRow {
  id: string;
  title: string;
  amountLabel: string;
  status: string;
}

export interface StudentLimits {
  screenTimeMinutes: number;
  sparksDailyLimit: number;
  purchaseApproval: boolean;
}

const EMPTY_PAYMENT: PaymentMethod = { brand: '', last4: '', expiry: '', holder: '' };

export function FamilySettings({
  children,
  inviteCode,
  linkRequests,
  payment,
  receipts,
  purchases,
  scopeId,
  preview,
  onAskChild,
  onUnlinkChild,
  onCreateInvite,
  onRevokeInvite,
  onSaveChild,
  onSaveControls,
  onSavePayment,
  onDecidePurchase,
}: {
  children: FamilyChild[];
  inviteCode: string;
  linkRequests: LinkRequestRow[];
  payment: PaymentMethod;
  receipts: ReceiptRow[];
  purchases: PurchaseRow[];
  scopeId: string;
  preview?: boolean;
  onAskChild: (email: string) => Promise<void> | void;
  onUnlinkChild: (childId: string) => Promise<void> | void;
  onCreateInvite: () => Promise<void> | void;
  onRevokeInvite: () => Promise<void> | void;
  onSaveChild: (childId: string, next: { name: string; displayName: string; bio: string; avatarUrl: string; photoStoragePath: string }) => Promise<void> | void;
  onSaveControls: (controls: ChildControls) => Promise<void> | void;
  onSavePayment: (method: PaymentMethod) => Promise<void> | void;
  onDecidePurchase: (requestId: string, approve: boolean) => Promise<void> | void;
}) {
  const [email, setEmail] = useState('');
  const [card, setCard] = useState(payment.last4 ? payment : EMPTY_PAYMENT);

  return (
    <div data-parent-family className="space-y-8">
      <Section title="Linked children">
        <p className="text-sm text-muted-foreground">{NEUTRAL_LINK}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            Child email
            <Input value={email} onChange={event => setEmail(event.target.value)} placeholder="Child's email" aria-label="Child email" className="h-11 w-72 rounded-xl" />
          </label>
          <Button type="button" className="rounded-full" onClick={() => void onAskChild(email.trim())}>Ask them to approve</Button>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-4" data-invite-code>
          <p className="text-sm font-semibold">Invite code</p>
          <p className="mt-1 text-sm text-muted-foreground">Share this code with your child. They enter it in their profile settings.</p>
          <p className="mt-2 font-mono text-lg tracking-[0.2em]">{inviteCode || 'No open code yet'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" className="rounded-full" onClick={() => void onCreateInvite()}>Create invite code</Button>
            {inviteCode && (
              <Button type="button" variant="outline" className="rounded-full" onClick={() => void onRevokeInvite()}>Revoke code</Button>
            )}
          </div>
        </div>
        <ul className="space-y-2">
          {linkRequests.filter(row => row.status === 'pending').map(row => (
            <li key={row.id} className="rounded-xl border border-border px-3 py-2 text-sm">
              Waiting for approval · {row.studentEmail || 'invite sent'}
            </li>
          ))}
        </ul>
        <ul className="space-y-6">
          {children.length === 0 && <li className="text-sm text-muted-foreground">No children are linked yet.</li>}
          {children.map(child => (
            <ChildCard
              key={child.id}
              child={child}
              scopeId={scopeId}
              preview={preview}
              onUnlink={() => void onUnlinkChild(child.id)}
              onSaveChild={next => void onSaveChild(child.id, next)}
              onSaveControls={next => void onSaveControls(next)}
            />
          ))}
        </ul>
      </Section>

      <Section title="Billing and receipts">
        <p className="text-sm text-muted-foreground">
          Poket School stores the card brand, the last four digits, the expiry, and the name on the card. The full card number is never saved.
        </p>
        <div className="grid gap-4 sm:grid-cols-2" data-payment-method>
          <Field label="Card brand">
            <Input value={card.brand} onChange={event => setCard({ ...card, brand: event.target.value })} className="h-11 rounded-xl" aria-label="Card brand" />
          </Field>
          <Field label="Last 4 digits">
            <Input value={card.last4} onChange={event => setCard({ ...card, last4: event.target.value })} className="h-11 rounded-xl" inputMode="numeric" aria-label="Card last 4 digits" />
          </Field>
          <Field label="Expiry">
            <Input value={card.expiry} onChange={event => setCard({ ...card, expiry: event.target.value })} placeholder="MM/YY" className="h-11 rounded-xl" aria-label="Card expiry" />
          </Field>
          <Field label="Name on card">
            <Input value={card.holder} onChange={event => setCard({ ...card, holder: event.target.value })} className="h-11 rounded-xl" aria-label="Name on card" />
          </Field>
        </div>
        <Button type="button" className="rounded-full" onClick={() => void onSavePayment(card)}>Save payment method</Button>
        <p className="text-sm font-semibold">Receipts</p>
        <ul className="space-y-2" data-receipts>
          {receipts.length === 0 && <li className="text-sm text-muted-foreground">No receipts yet.</li>}
          {receipts.map(receipt => (
            <li key={receipt.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
              <span>{receipt.description}</span>
              <span>{receipt.amountLabel} · {receipt.status}</span>
            </li>
          ))}
        </ul>
        <Link href="/dashboard/parent/billing" className="text-sm font-semibold text-primary">Open billing</Link>
      </Section>

      <Section title="Purchase approval">
        <p className="text-sm text-muted-foreground">When purchase approval is on for a child, Poket School asks you before that child buys.</p>
        <ul className="space-y-2">
          {purchases.filter(row => row.status === 'pending').length === 0 && (
            <li className="text-sm text-muted-foreground">No purchases are waiting.</li>
          )}
          {purchases.filter(row => row.status === 'pending').map(row => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span>{row.title} · {row.amountLabel}</span>
              <span className="flex gap-2">
                <Button type="button" className="h-8 rounded-full" onClick={() => void onDecidePurchase(row.id, true)}>Approve</Button>
                <Button type="button" variant="outline" className="h-8 rounded-full" onClick={() => void onDecidePurchase(row.id, false)}>Decline</Button>
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function ChildCard({
  child,
  scopeId,
  preview,
  onUnlink,
  onSaveChild,
  onSaveControls,
}: {
  child: FamilyChild;
  scopeId: string;
  preview?: boolean;
  onUnlink: () => void;
  onSaveChild: (next: { name: string; displayName: string; bio: string; avatarUrl: string; photoStoragePath: string }) => void;
  onSaveControls: (controls: ChildControls) => void;
}) {
  const under13 = child.ageTier === 'under13';
  const [profile, setProfile] = useState({
    name: child.name,
    displayName: child.name,
    bio: child.bio ?? '',
    avatarUrl: child.avatarUrl ?? '',
    photoStoragePath: '',
  });
  const [controls, setControls] = useState<ChildControls>(normaliseChildControls(child.controls ?? defaultChildControls(child.id)));

  return (
    <li className="space-y-4 rounded-2xl border border-border p-4" data-child-id={child.id}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          <span className="font-semibold">{child.name}</span>
          {child.email ? ` · ${child.email}` : ''}
          {child.ageTier ? ` · ${child.ageTier === 'under13' ? 'Under 13' : child.ageTier}` : ''}
        </span>
        <Button type="button" variant="outline" className="h-8 rounded-full" onClick={onUnlink}>Unlink</Button>
      </div>
      {under13 && (
        <div className="space-y-3" data-under13-editor>
          <p className="text-sm font-semibold">Basic profile for this under-13 account</p>
          <ProfilePhoto
            src={profile.avatarUrl}
            name={profile.displayName || profile.name}
            scopeId={scopeId}
            preview={preview}
            onChange={next => {
              const updated = { ...profile, avatarUrl: next.avatarUrl, photoStoragePath: next.photoStoragePath };
              setProfile(updated);
              onSaveChild(updated);
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Child name">
              <Input value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} className="h-11 rounded-xl" aria-label="Child name" />
            </Field>
            <Field label="Child display name">
              <Input value={profile.displayName} onChange={event => setProfile({ ...profile, displayName: event.target.value })} className="h-11 rounded-xl" aria-label="Child display name" />
            </Field>
          </div>
          <Field label="Child bio">
            <textarea value={profile.bio} onChange={event => setProfile({ ...profile, bio: event.target.value })} rows={2} className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm" aria-label="Child bio" />
          </Field>
          <Button type="button" className="rounded-full" onClick={() => onSaveChild(profile)}>Save child profile</Button>
        </div>
      )}
      <div className="space-y-3" data-child-controls>
        <p className="text-sm font-semibold">Weekly progress report</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={controls.weeklyReportEmail} onChange={event => setControls({ ...controls, weeklyReportEmail: event.target.checked })} />
          Email me a weekly progress report
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={controls.weeklyReportInApp} onChange={event => setControls({ ...controls, weeklyReportInApp: event.target.checked })} />
          In-app alert for the weekly progress report
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Screen time minutes per day">
            <Input type="number" min={0} max={1440} value={controls.screenTimeMinutes} onChange={event => setControls({ ...controls, screenTimeMinutes: Number(event.target.value) })} className="h-11 rounded-xl" aria-label="Screen time minutes" />
          </Field>
          <Field label="Sparks spending limit per day">
            <Input type="number" min={0} value={controls.sparksDailyLimit} onChange={event => setControls({ ...controls, sparksDailyLimit: Number(event.target.value) })} className="h-11 rounded-xl" aria-label="Sparks spending limit" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={controls.purchaseApproval} onChange={event => setControls({ ...controls, purchaseApproval: event.target.checked })} />
          Ask me before this child buys
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={controls.goalPush} onChange={event => setControls({ ...controls, goalPush: event.target.checked })} />
          Push me when this child sets, finishes, or misses a goal
        </label>
        <Field label="Progress digest">
          <select
            aria-label="Progress digest"
            value={controls.digestCadence}
            onChange={event => setControls({ ...controls, digestCadence: event.target.value as DigestCadence })}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly digest</option>
            <option value="off">No digest</option>
          </select>
        </Field>
        <Field label="Teacher messages">
          <select
            aria-label="Teacher messages"
            value={controls.teacherMessages}
            onChange={event => setControls({ ...controls, teacherMessages: event.target.value as TeacherMessagePref })}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="all">All teacher messages</option>
            <option value="digest">A daily digest</option>
            <option value="off">No teacher messages</option>
          </select>
        </Field>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => onSaveControls(controls)}>Save limits for {child.name}</Button>
      </div>
    </li>
  );
}

export function StudentFamily({
  pending,
  limits,
  onAcceptInvite,
  onRespond,
}: {
  pending: LinkRequestRow[];
  limits: StudentLimits | null;
  onAcceptInvite: (code: string) => Promise<void> | void;
  onRespond: (linkId: string, approve: boolean) => Promise<void> | void;
}) {
  const [code, setCode] = useState('');
  return (
    <div className="space-y-4" data-student-family>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
          Parent invite code
          <Input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="8 character code" aria-label="Parent invite code" className="h-11 w-56 rounded-xl" />
        </label>
        <Button type="button" className="rounded-full" onClick={() => void onAcceptInvite(code.trim())}>Accept invite</Button>
      </div>
      <ul className="space-y-2">
        {pending.length === 0 && <li className="text-sm text-muted-foreground">No parent request is waiting.</li>}
        {pending.map(row => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            <span>{row.parentName || 'A parent'} asked to link to your account.</span>
            <span className="flex gap-2">
              <Button type="button" className="h-8 rounded-full" onClick={() => void onRespond(row.id, true)}>Approve</Button>
              <Button type="button" variant="outline" className="h-8 rounded-full" onClick={() => void onRespond(row.id, false)}>Decline</Button>
            </span>
          </li>
        ))}
      </ul>
      {limits && (
        <p className="text-sm text-muted-foreground">
          A linked parent set {limits.screenTimeMinutes} minutes of screen time a day and a Sparks limit of {limits.sparksDailyLimit}.
          {limits.purchaseApproval ? ' Purchases wait for their approval.' : ''}
        </p>
      )}
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
