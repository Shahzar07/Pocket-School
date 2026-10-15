'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { enabledCurrencies, seedPricing } from '@/lib/pricing';
import { scheduleDeletion, type PayoutDetails, type ProfileDraft } from '@/lib/account-settings';
import { defaultChildControls, type ChildControls, type PaymentMethod } from '@/lib/parent-controls';
import {
  EMPTY_PAYOUT,
  SettingsPanel,
  blankDraft,
  type SettingsView,
} from '@/components/account/settings-panel';

const ROLES = ['student', 'teacher', 'parent', 'institution_admin', 'admin'] as const;

function viewFor(role: string): SettingsView {
  const draft = blankDraft({
    name: role === 'parent' ? 'Sara Rahman' : role === 'teacher' ? 'Ms Lee' : role === 'admin' ? 'Platform admin' : role === 'institution_admin' ? 'Poket Academy' : 'Amina Yusuf',
    displayName: role === 'student' ? 'Amina' : role === 'teacher' ? 'Ms Lee' : 'Sara',
    bio: 'Learning with Poket School.',
    country: 'Malaysia',
    timezone: 'Asia/Kuala_Lumpur',
    phone: '+60123456789',
    language: 'en',
    currency: 'MYR',
    level: 'secondary',
    yearGroup: 'Year 8',
    twoFactorEnabled: role !== 'student',
    instructor: { headline: 'Physics and science', bio: 'I teach Year 8 labs.', public: true },
  });
  return {
    role,
    email: `${role}@poketschool.ai`,
    emailVerified: true,
    providers: role === 'teacher'
      ? [{ id: 'google.com', label: 'Google' }]
      : [{ id: 'password', label: 'Email and password' }, { id: 'google.com', label: 'Google' }],
    hasPassword: role !== 'teacher',
    draft,
    sessions: [
      { id: 'this', deviceInfo: 'This browser', lastSeenLabel: 'Just now', current: true },
      { id: 'phone', deviceInfo: 'iPhone', lastSeenLabel: 'Yesterday', current: false },
    ],
    deletion: role === 'admin' ? scheduleDeletion(Date.UTC(2026, 9, 1)) : null,
    children: role === 'parent' ? [
      {
        id: 'child-1',
        name: 'Amina Yusuf',
        email: 'student@poketschool.ai',
        ageTier: 'teen',
        controls: defaultChildControls('child-1'),
      },
      {
        id: 'child-2',
        name: 'Adam Rahman',
        email: 'adam@poketschool.ai',
        ageTier: 'under13',
        bio: 'Year 4 science',
        avatarUrl: '',
        controls: { ...defaultChildControls('child-2'), screenTimeMinutes: 60, sparksDailyLimit: 20, teacherMessages: 'digest' },
      },
    ] : [],
    parents: role === 'student' ? [{ id: 'parent-1', name: 'Sara Rahman', email: 'parent@poketschool.ai' }] : [],
    payout: role === 'teacher' ? { method: 'bank', email: 'lee@poketschool.ai', accountName: 'Lee Wei', bankName: 'Maybank', accountLast4: '4242' } : EMPTY_PAYOUT,
    institutionName: role === 'institution_admin' ? 'Poket Academy' : '',
    ageTier: role === 'student' ? 'teen' : 'adult',
    hasDateOfBirth: true,
    inviteCode: role === 'parent' ? 'POKET7K2' : '',
    linkRequests: role === 'parent'
      ? [{ id: 'req-1', parentId: 'parent-1', parentName: 'Sara Rahman', studentEmail: 'new.student@poketschool.ai', status: 'pending' }]
      : role === 'student'
        ? [{ id: 'req-2', parentId: 'parent-1', parentName: 'Sara Rahman', studentEmail: 'student@poketschool.ai', status: 'pending' }]
        : [],
    payment: role === 'parent' ? { brand: 'Visa', last4: '4242', expiry: '12/28', holder: 'Sara Rahman' } : { brand: '', last4: '', expiry: '', holder: '' },
    receipts: role === 'parent' ? [{ id: 'inv-1', description: 'Year 8 science pack', amountLabel: 'RM 89', status: 'paid' }] : [],
    purchases: role === 'parent' ? [{ id: 'buy-1', title: 'Year 8 science pack', amountLabel: 'RM 89', status: 'pending' }] : [],
    studentLimits: role === 'student' ? { screenTimeMinutes: 120, sparksDailyLimit: 50, purchaseApproval: true } : null,
  };
}

export default function AccountPreviewPage() {
  const [role, setRole] = useState<(typeof ROLES)[number]>('student');
  const [view, setView] = useState<SettingsView>(() => viewFor('student'));

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('role');
    if (selected && (ROLES as readonly string[]).includes(selected)) {
      setRole(selected as (typeof ROLES)[number]);
      setView(viewFor(selected));
    }
  }, []);

  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (focus) document.getElementById(focus)?.scrollIntoView();
  }, [role]);

  const currencies = enabledCurrencies(seedPricing()).map(item => item.code);
  const note = () => { toast.success('Saved on this preview.'); };

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <div data-account-menu className="rounded-2xl border border-border bg-card p-3">
          <p className="text-sm font-semibold">{view.draft.displayName || view.draft.name}</p>
          <p className="text-xs text-muted-foreground">{view.email}</p>
          <p className="mt-2 text-sm font-semibold">My profile & settings</p>
          <p className="text-sm font-semibold text-destructive">Sign out</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLES.map(item => (
            <button
              key={item}
              type="button"
              className={`h-9 rounded-full px-3 text-sm font-semibold ${item === role ? 'bg-[#203337] text-white' : 'border border-border'}`}
              onClick={() => { setRole(item); setView(viewFor(item)); }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <SettingsPanel
        key={role}
        preview
        view={view}
        currencies={currencies}
        scopeId="preview"
        onSaveProfile={async (draft: ProfileDraft) => { setView(current => ({ ...current, draft })); note(); }}
        onPhoto={async next => setView(current => ({ ...current, draft: { ...current.draft, ...next } }))}
        onChangeEmail={async () => note()}
        onResendVerification={async () => note()}
        onChangePassword={async () => note()}
        onSetPassword={async () => note()}
        onLinkGoogle={async () => note()}
        onUnlink={async () => note()}
        onToggleTwoFactor={async enabled => setView(current => ({ ...current, draft: { ...current.draft, twoFactorEnabled: enabled } }))}
        onSignOutSession={async id => setView(current => ({ ...current, sessions: current.sessions.filter(session => session.id !== id) }))}
        onSignOutEverywhere={async () => setView(current => ({ ...current, sessions: [] }))}
        onSaveNotifications={async prefs => setView(current => ({ ...current, draft: { ...current.draft, notificationPrefs: prefs } }))}
        onSavePrivacy={async privacy => setView(current => ({ ...current, draft: { ...current.draft, privacy } }))}
        onExport={async () => note()}
        onRequestDeletion={async () => setView(current => ({ ...current, deletion: scheduleDeletion(Date.now()) }))}
        onCancelDeletion={async () => setView(current => ({ ...current, deletion: null }))}
        onSavePayout={async (payout: PayoutDetails) => { setView(current => ({ ...current, payout })); note(); }}
        onLinkChild={async email => setView(current => ({
          ...current,
          linkRequests: [...current.linkRequests, { id: email, parentId: 'parent', parentName: 'Sara Rahman', studentEmail: email, status: 'pending' }],
        }))}
        onUnlinkChild={async id => setView(current => ({ ...current, children: current.children.filter(child => child.id !== id) }))}
        onCreateInvite={async () => { setView(current => ({ ...current, inviteCode: 'POKET7K2' })); note(); }}
        onRevokeInvite={async () => setView(current => ({ ...current, inviteCode: '' }))}
        onSaveChild={async (childId, next) => setView(current => ({
          ...current,
          children: current.children.map(child => child.id === childId ? { ...child, name: next.name, bio: next.bio, avatarUrl: next.avatarUrl } : child),
        }))}
        onSaveControls={async (controls: ChildControls) => setView(current => ({
          ...current,
          children: current.children.map(child => child.id === controls.childId ? { ...child, controls } : child),
        }))}
        onSavePayment={async (method: PaymentMethod) => { setView(current => ({ ...current, payment: method })); note(); }}
        onDecidePurchase={async (id, approve) => setView(current => ({
          ...current,
          purchases: current.purchases.map(row => row.id === id ? { ...row, status: approve ? 'approved' : 'rejected' } : row),
        }))}
        onAcceptInvite={async () => note()}
        onRespondLink={async (id, approve) => setView(current => ({
          ...current,
          linkRequests: current.linkRequests.filter(row => approve ? row.id !== id : row.id !== id),
        }))}
      />
    </main>
  );
}
