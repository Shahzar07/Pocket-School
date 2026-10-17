'use client';

import { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { DEFAULT_AUTOMATION, type NetworkAutomation } from '@/lib/network/settings';
import { authedFetch } from '@/lib/authed-fetch';

const ROWS: { key: keyof NetworkAutomation; label: string }[] = [
  { key: 'networkOn', label: 'Professional network' },
  { key: 'recruiterTierOn', label: 'Recruiter tiers' },
  { key: 'foundersOn', label: 'Poket School Founders' },
  { key: 'foundersProOn', label: 'Founders Pro' },
  { key: 'studentGroupsOn', label: 'Student group creation' },
  { key: 'groupDuesOn', label: 'Group dues sandbox' },
];

export function NetworkAutomationPanel() {
  const [settings, setSettings] = useState<NetworkAutomation>(DEFAULT_AUTOMATION);
  const [note, setNote] = useState('');

  const save = async (next: NetworkAutomation) => {
    setSettings(next);
    try {
      const response = await authedFetch('/api/network/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        setNote('Sign in as a super admin to save these switches.');
        return;
      }
      setNote('Saved.');
    } catch {
      setNote('Sign in as a super admin to save these switches.');
    }
  };

  return (
    <section className="bg-card border border-border rounded-3xl p-6 sm:p-7">
      <h2 className="font-heading text-2xl text-foreground mb-1">Network automation</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Founders and recruiter billing stay off until you enable them. Prices are placeholders and charges are sandbox only.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {ROWS.map(row => (
          <button
            key={row.key}
            type="button"
            className="flex items-center justify-between gap-3 h-11 px-3 rounded-xl border border-border text-sm font-semibold"
            onClick={() => void save({ ...settings, [row.key]: !settings[row.key] })}
          >
            <span>{row.label}</span>
            <span style={{ color: settings[row.key] ? BRAND.primary : undefined }}>{settings[row.key] ? 'On' : 'Off'}</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground mt-3">
        {`School groups use ${settings.groupApprovalMode === 'auto' ? 'automatic' : 'school'} approval. Org verification is ${settings.orgVerificationMode === 'admin_only' ? 'admin only' : 'a domain check plus admin approval'}.`}
      </p>
      {note ? <p className="text-sm mt-2">{note}</p> : null}
    </section>
  );
}
