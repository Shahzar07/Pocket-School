'use client';

import { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  unlink,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  signOut,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { useAccountMode } from '@/hooks/use-account-mode';
import { auth } from '@/lib/firebase';
import { authedFetch } from '@/lib/api-client';
import { applyAppLanguage } from '@/lib/i18n/apply';
import { readGeoCountry } from '@/lib/countries';
import { writeCurrencyChoice, enabledCurrencies, seedPricing } from '@/lib/pricing';
import { usePricing } from '@/hooks/use-pricing';
import { formatMoney } from '@/lib/money';
import { defaultChildControls, strictestControls, type ChildControls, type PaymentMethod } from '@/lib/parent-controls';
import { removeStoredMedia } from '@/components/media';
import {
  normalisePayout,
  profilePatch,
  scheduleDeletion,
  type DeletionRequest,
  type NotificationPrefs,
  type PayoutDetails,
  type PrivacySettings,
  type ProfileDraft,
} from '@/lib/account-settings';
import {
  acceptParentInvite,
  clearUserFields,
  createParentInvite,
  decidePurchaseRequest,
  deleteAllUserSessions,
  deleteUserSession,
  getChildControls,
  getChildrenProfiles,
  getInvoicesForStudent,
  getParentsOfStudent,
  getPaymentMethod,
  getPayoutDetails,
  getUserSessions,
  linkChildToParent,
  listOpenParentInvites,
  listParentLinkRequests,
  listPurchaseRequests,
  respondToParentLink,
  revokeParentInvite,
  saveChildControls,
  savePaymentMethod,
  savePayoutDetails,
  saveUnder13Profile,
  unlinkChildFromParent,
  updateUser,
  type UserProfile,
} from '@/lib/db';
import {
  EMPTY_PAYOUT,
  SettingsPanel,
  blankDraft,
  type LinkedPerson,
  type SettingsSession,
  type SettingsView,
} from '@/components/account/settings-panel';

function providerLabel(id: string): string {
  if (id === 'password') return 'Email and password';
  if (id === 'google.com') return 'Google';
  return id;
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'this device';
  return `${navigator.userAgent.slice(0, 80)}|${screen.width}x${screen.height}`;
}

function seenLabel(value: { toDate?: () => Date } | undefined): string {
  const date = value?.toDate?.();
  if (!date) return 'Recently';
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function reauthenticate(password: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to continue.');
  const hasPassword = user.providerData.some(provider => provider.providerId === 'password');
  if (hasPassword) {
    if (!password || !user.email) throw new Error('Enter your current password.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return;
  }
  await reauthenticateWithPopup(user, new GoogleAuthProvider());
}

function authMessage(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Current password is incorrect.';
  if (code === 'auth/requires-recent-login') return 'Sign in again, then retry.';
  if (code === 'auth/email-already-in-use') return 'That email is already in use.';
  if (code === 'auth/provider-already-linked') return 'That provider is already linked.';
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, fetchProfile } = useAuthSTORE();
  const { mode, ready } = useAccountMode();
  const { config } = usePricing();
  const [view, setView] = useState<SettingsView | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const sectionRole = mode ?? profile?.role ?? 'student';

  useEffect(() => {
    if (!user || !profile || !ready) return;
    let cancelled = false;
    const load = async () => {
      if (user.email && user.emailVerified && profile.email && user.email.toLowerCase() !== profile.email.toLowerCase()) {
        try {
          await updateUser(user.uid, { email: user.email });
          await fetchProfile(user.uid);
          return;
        } catch {
          /* The token email is not writable yet. The form still shows the auth email. */
        }
      }
      const here = deviceLabel();
      const [sessions, children, parents, payout] = await Promise.all([
        getUserSessions(user.uid).catch(() => []),
        sectionRole === 'parent' ? getChildrenProfiles(user.uid).catch(() => []) : Promise.resolve([]),
        sectionRole === 'student' ? getParentsOfStudent(user.uid).catch(() => []) : Promise.resolve([]),
        sectionRole === 'teacher' ? getPayoutDetails(user.uid).catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      const people = (rows: { id: string; data: UserProfile }[]): LinkedPerson[] => rows.map(row => ({
        id: row.id,
        name: row.data.displayName || row.data.name,
        email: row.data.email,
      }));
      let childRows = people(children);
      let inviteCode = '';
      let linkRequests: SettingsView['linkRequests'] = [];
      let payment: PaymentMethod = { brand: '', last4: '', expiry: '', holder: '' };
      let receipts: SettingsView['receipts'] = [];
      let purchases: SettingsView['purchases'] = [];
      let studentLimits: SettingsView['studentLimits'] = null;
      if (sectionRole === 'parent') {
        const [invites, requests, method, ownInvoices, purchaseRows, withControls] = await Promise.all([
          listOpenParentInvites(user.uid).catch(() => []),
          listParentLinkRequests('parentId', user.uid).catch(() => []),
          getPaymentMethod(user.uid).catch(() => null),
          getInvoicesForStudent(user.uid).catch(() => []),
          listPurchaseRequests('parentId', user.uid).catch(() => []),
          Promise.all(children.map(async row => {
            const controls = await getChildControls(user.uid, row.id).catch(() => null);
            return {
              id: row.id,
              name: row.data.displayName || row.data.name,
              email: row.data.email,
              ageTier: row.data.ageTier,
              bio: row.data.bio,
              avatarUrl: row.data.avatarUrl,
              controls: controls ?? defaultChildControls(row.id),
            };
          })),
        ]);
        const childInvoices = await Promise.all(children.map(row => getInvoicesForStudent(row.id).catch(() => [])));
        inviteCode = invites[0]?.code ?? '';
        linkRequests = requests.filter(row => row.status === 'pending');
        payment = method ?? payment;
        receipts = [...ownInvoices, ...childInvoices.flat()].map(invoice => ({
          id: invoice.id,
          description: invoice.description,
          amountLabel: formatMoney(invoice.amount, invoice.currency),
          status: invoice.status,
        }));
        purchases = purchaseRows.filter(row => row.status === 'pending').map(row => ({
          id: row.id,
          title: row.title,
          amountLabel: formatMoney(row.amount, row.currency),
          status: row.status,
        }));
        childRows = withControls;
      }
      if (sectionRole === 'student') {
        const requests = await listParentLinkRequests('studentId', user.uid).catch(() => []);
        linkRequests = requests.filter(row => row.status === 'pending');
        const controlRows: ChildControls[] = [];
        for (const parentRow of parents) {
          const controls = await getChildControls(parentRow.id, user.uid).catch(() => null);
          if (controls) controlRows.push(controls);
        }
        const tight = strictestControls(controlRows);
        studentLimits = tight
          ? { screenTimeMinutes: tight.screenTimeMinutes, sparksDailyLimit: tight.sparksDailyLimit, purchaseApproval: tight.purchaseApproval }
          : null;
      }
      const sessionRows: SettingsSession[] = sessions.map(session => ({
        id: session.id ?? '',
        deviceInfo: session.deviceInfo,
        lastSeenLabel: seenLabel(session.lastSeen),
        current: session.deviceInfo === here,
      }));
      setView({
        role: sectionRole,
        email: user.email ?? profile.email ?? '',
        emailVerified: user.emailVerified,
        providers: user.providerData.map(provider => ({ id: provider.providerId, label: providerLabel(provider.providerId) })),
        hasPassword: user.providerData.some(provider => provider.providerId === 'password'),
        draft: blankDraft({
          name: profile.name ?? '',
          displayName: profile.displayName ?? profile.name ?? '',
          bio: profile.bio ?? '',
          country: profile.country || readGeoCountry(),
          timezone: profile.timezone ?? 'Asia/Kuala_Lumpur',
          phone: profile.phone ?? '',
          language: profile.language ?? 'en',
          currency: profile.currency ?? 'USD',
          avatarUrl: profile.avatarUrl ?? '',
          photoStoragePath: profile.photoStoragePath ?? '',
          level: profile.level ?? '',
          learningStyle: profile.learningStyle ?? '',
          yearGroup: profile.yearGroup ?? '',
          notificationPrefs: profile.notificationPrefs,
          privacy: {
            shareBoard: profile.privacy?.shareBoard ?? profile.shareBoard !== false,
            profilePublic: profile.privacy?.profilePublic ?? false,
            showEmail: profile.privacy?.showEmail ?? false,
          },
          twoFactorEnabled: profile.twoFactorEnabled === true,
          instructor: profile.instructor ?? { headline: '', bio: '', public: false },
        }),
        sessions: sessionRows,
        deletion: profile.deletionRequest ?? null,
        children: childRows,
        parents: people(parents),
        payout: payout ?? EMPTY_PAYOUT,
        institutionName: profile.institutionId ?? '',
        ageTier: profile.ageTier ?? '',
        hasDateOfBirth: Boolean(profile.dateOfBirth),
        inviteCode,
        linkRequests,
        payment,
        receipts,
        purchases,
        studentLimits,
      });
    };
    void load();
    return () => { cancelled = true; };
  }, [user, profile, reloadKey, ready, mode, sectionRole]);

  if (!user || !profile || !view) return null;

  const refresh = async () => {
    await fetchProfile(user.uid);
    setReloadKey(key => key + 1);
  };

  const saveProfile = async (draft: ProfileDraft) => {
    try {
      const patch = profilePatch(draft, sectionRole);
      if (sectionRole === 'student') {
        await authedFetch('/api/account/placement', {
          method: 'POST',
          body: JSON.stringify({ programme: draft.level, year: draft.yearGroup }),
        });
      }
      await updateUser(user.uid, patch as Partial<UserProfile>);
      applyAppLanguage(draft.language, { explicit: true });
      writeCurrencyChoice(draft.currency, true);
      await updateProfile(user, { displayName: draft.displayName.trim() || draft.name.trim(), photoURL: draft.avatarUrl || null });
      await refresh();
      toast.success('Profile saved.');
    } catch (error) {
      toast.error(authMessage(error, 'Could not save your profile.'));
    }
  };

  const onPhoto = async (next: { avatarUrl: string; photoStoragePath: string }) => {
    try {
      if (!next.avatarUrl) {
        if (profile.photoStoragePath) await removeStoredMedia(profile.photoStoragePath);
        await clearUserFields(user.uid, ['avatarUrl', 'photoStoragePath']);
        await updateProfile(user, { photoURL: null });
      } else {
        await updateUser(user.uid, { avatarUrl: next.avatarUrl, photoStoragePath: next.photoStoragePath || undefined });
        await updateProfile(user, { photoURL: next.avatarUrl });
      }
      await refresh();
    } catch (error) {
      toast.error(authMessage(error, 'Could not update the photo.'));
    }
  };

  const currencies = enabledCurrencies(config ?? seedPricing()).map(item => item.code);

  return (
    <SettingsPanel
      view={view}
      currencies={currencies.length ? currencies : ['USD']}
      scopeId={user.uid}
      onSaveProfile={saveProfile}
      onPhoto={onPhoto}
      onChangeEmail={async (email, password) => {
        try {
          await reauthenticate(password);
          await verifyBeforeUpdateEmail(user, email);
          toast.success('Check the new inbox. The email changes after you open the link.');
        } catch (error) {
          toast.error(authMessage(error, 'Could not change the email.'));
        }
      }}
      onResendVerification={async () => {
        try {
          await sendEmailVerification(user);
          toast.success('Verification email sent.');
        } catch (error) {
          toast.error(authMessage(error, 'Could not send the verification email.'));
        }
      }}
      onChangePassword={async (current, next) => {
        try {
          await reauthenticate(current);
          await updatePassword(user, next);
          toast.success('Password changed.');
        } catch (error) {
          toast.error(authMessage(error, 'Could not change the password.'));
        }
      }}
      onSetPassword={async next => {
        try {
          if (!user.email) throw new Error('Add an email before setting a password.');
          await reauthenticate('');
          await linkWithCredential(user, EmailAuthProvider.credential(user.email, next));
          toast.success('Password added. You can sign in with email as well.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not set a password.'));
        }
      }}
      onLinkGoogle={async () => {
        try {
          await linkWithPopup(user, new GoogleAuthProvider());
          toast.success('Google is linked.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not link Google.'));
        }
      }}
      onUnlink={async providerId => {
        try {
          await unlink(user, providerId);
          toast.success('Provider unlinked.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not unlink that provider.'));
        }
      }}
      onToggleTwoFactor={async enabled => {
        try {
          await updateUser(user.uid, { twoFactorEnabled: enabled });
          await refresh();
          toast.success(enabled ? 'Two-factor authentication is on.' : 'Two-factor authentication is off.');
        } catch (error) {
          toast.error(authMessage(error, 'Could not update two-factor authentication.'));
        }
      }}
      onSignOutSession={async sessionId => {
        try {
          const row = view.sessions.find(session => session.id === sessionId);
          await deleteUserSession(sessionId);
          if (row?.current) {
            await signOut(auth);
            router.push('/login');
            return;
          }
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not sign out that session.'));
        }
      }}
      onSignOutEverywhere={async () => {
        try {
          await deleteAllUserSessions(user.uid);
          await updateUser(user.uid, { sessionsRevokedAt: Date.now() });
          await signOut(auth);
          router.push('/login');
        } catch (error) {
          toast.error(authMessage(error, 'Could not sign out everywhere.'));
        }
      }}
      onSaveNotifications={async (prefs: NotificationPrefs) => {
        await updateUser(user.uid, { notificationPrefs: prefs });
        await refresh();
        toast.success('Notification preferences saved.');
      }}
      onSavePrivacy={async (privacy: PrivacySettings) => {
        await updateUser(user.uid, { privacy, shareBoard: privacy.shareBoard });
        await refresh();
        toast.success('Privacy settings saved.');
      }}
      onExport={async () => {
        const body = {
          exportedAt: new Date().toISOString(),
          account: {
            email: user.email,
            name: profile.name,
            displayName: profile.displayName,
            bio: profile.bio,
            country: profile.country,
            timezone: profile.timezone,
            phone: profile.phone,
            language: profile.language,
            currency: profile.currency,
            role: profile.role,
            notificationPrefs: profile.notificationPrefs,
            privacy: profile.privacy,
            instructor: profile.instructor,
          },
          sessions: view.sessions,
          payout: view.payout,
          children: view.children,
          parents: view.parents,
        };
        const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'poket-school-account.json';
        link.click();
        URL.revokeObjectURL(url);
      }}
      onRequestDeletion={async () => {
        try {
          const request: DeletionRequest = scheduleDeletion(Date.now());
          await updateUser(user.uid, { deletionRequest: request });
          await refresh();
          toast.success('Deletion scheduled. You can cancel it during the next 14 days.');
        } catch (error) {
          toast.error(authMessage(error, 'Could not schedule deletion.'));
        }
      }}
      onCancelDeletion={async () => {
        try {
          await clearUserFields(user.uid, ['deletionRequest']);
          await refresh();
          toast.success('Deletion cancelled.');
        } catch (error) {
          toast.error(authMessage(error, 'Could not cancel deletion.'));
        }
      }}
      onSavePayout={async (payout: PayoutDetails) => {
        try {
          await savePayoutDetails(user.uid, normalisePayout(payout));
          toast.success('Payout details saved.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not save payout details.'));
        }
      }}
      onLinkChild={async email => {
        try {
          const result = await linkChildToParent(user.uid, email.toLowerCase(), { name: profile.name, email: user.email ?? profile.email });
          toast.success(result.message);
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not send that request.'));
        }
      }}
      onUnlinkChild={async childId => {
        try {
          await unlinkChildFromParent(user.uid, childId);
          toast.success('Child unlinked.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not unlink that child.'));
        }
      }}
      onCreateInvite={async () => {
        try {
          const code = await createParentInvite(user.uid, profile.name || 'Parent');
          toast.success(`Invite code ${code}. Your child enters it in their settings.`);
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not create an invite code.'));
        }
      }}
      onRevokeInvite={async () => {
        try {
          if (view.inviteCode) await revokeParentInvite(user.uid, view.inviteCode);
          toast.success('Invite code revoked.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not revoke that code.'));
        }
      }}
      onSaveChild={async (childId, next) => {
        try {
          const child = view.children.find(row => row.id === childId);
          if (child?.ageTier !== 'under13') {
            toast.error('A parent can edit a profile only for an under-13 account.');
            return;
          }
          await saveUnder13Profile(user.uid, childId, next);
          toast.success('Child profile saved.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not save that child profile.'));
        }
      }}
      onSaveControls={async (controls: ChildControls) => {
        try {
          await saveChildControls(user.uid, controls);
          toast.success('Limits saved.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not save those limits.'));
        }
      }}
      onSavePayment={async (method: PaymentMethod) => {
        try {
          await savePaymentMethod(user.uid, method);
          toast.success('Payment method saved.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not save the payment method.'));
        }
      }}
      onDecidePurchase={async (requestId, approve) => {
        try {
          await decidePurchaseRequest(requestId, approve);
          toast.success(approve ? 'Purchase approved. Your child can buy it now.' : 'Purchase declined.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not update that purchase.'));
        }
      }}
      onAcceptInvite={async code => {
        try {
          await acceptParentInvite(code, user.uid);
          toast.success('Invite accepted. Your parent can see your progress.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not accept that invite.'));
        }
      }}
      onRespondLink={async (linkId, approve) => {
        try {
          await respondToParentLink(linkId, user.uid, approve);
          toast.success(approve ? 'Linked. They can see your progress now.' : 'Request declined.');
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not update that request.'));
        }
      }}
      onSaveDob={async date => {
        try {
          const data = await authedFetch('/api/community/dob', { method: 'POST', body: JSON.stringify({ dateOfBirth: date }) });
          toast.success(`Age tier set to ${String(data.ageTier ?? 'saved')}.`);
          await refresh();
        } catch (error) {
          toast.error(authMessage(error, 'Could not save the date of birth.'));
        }
      }}
    />
  );
}
