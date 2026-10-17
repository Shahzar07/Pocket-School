'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AutomationPanel } from '@/components/admin/automation-panel';
import { authedFetch } from '@/lib/api-client';
import { defaultAutomation, type AutomationEvent, type AutomationSettings } from '@/lib/site-automation';

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings>(defaultAutomation());
  const [feed, setFeed] = useState<AutomationEvent[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authedFetch('/api/admin/automation')
      .then((data: { settings?: AutomationSettings; feed?: AutomationEvent[] }) => {
        if (data.settings?.rules) setSettings(data.settings);
        if (Array.isArray(data.feed)) setFeed(data.feed);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not load automation.'));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const data = await authedFetch('/api/admin/automation', { method: 'POST', body: JSON.stringify(settings) }) as { settings?: AutomationSettings; feed?: AutomationEvent[] };
      if (data.settings?.rules) setSettings(data.settings);
      if (Array.isArray(data.feed)) setFeed(data.feed);
      toast.success('Automation saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save automation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-2 pb-12">
      <AutomationPanel
        settings={settings}
        feed={feed}
        busy={busy}
        onToggle={(id, on) => setSettings({ rules: { ...settings.rules, [id]: on } })}
        onSave={() => void save()}
      />
    </div>
  );
}
