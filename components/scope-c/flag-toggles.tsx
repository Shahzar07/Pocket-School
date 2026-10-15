'use client';

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { FEATURE_FLAGS, FEATURE_FLAG_LABELS, isFeatureEnabled } from '@/lib/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

export function FlagToggles() {
  const flags = useFeatureFlags();
  const [saving, setSaving] = useState<string>('');

  const toggle = async (flag: (typeof FEATURE_FLAGS)[number]) => {
    setSaving(flag);
    try {
      await setDoc(doc(db, 'platform_settings', 'feature_flags'), { [flag]: !isFeatureEnabled(flags, flag) }, { merge: true });
      toast.success(`${FEATURE_FLAG_LABELS[flag]} updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the flag.');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 card-glow">
      <h2 className="font-heading text-2xl text-foreground mb-1">Feature flags</h2>
      <p className="text-sm text-muted-foreground mb-4">Each new surface can be turned off without a deploy. Both the site and the mobile app read the same switches.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {FEATURE_FLAGS.map((flag) => (
          <button
            key={flag}
            type="button"
            onClick={() => toggle(flag)}
            disabled={saving === flag}
            className="flex items-center justify-between gap-3 h-11 px-3 rounded-xl border border-border text-sm font-semibold"
          >
            <span>{FEATURE_FLAG_LABELS[flag]}</span>
            <span className={isFeatureEnabled(flags, flag) ? 'text-primary' : 'text-muted-foreground'}>
              {isFeatureEnabled(flags, flag) ? 'On' : 'Off'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
