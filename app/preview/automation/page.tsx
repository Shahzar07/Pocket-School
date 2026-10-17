'use client';

import { useState } from 'react';
import { AutomationPanel } from '@/components/admin/automation-panel';
import { defaultAutomation, type AutomationEvent } from '@/lib/site-automation';

const FEED: AutomationEvent[] = [
  { id: '1', rule: 'teacher_library', outcome: 'auto', summary: 'Forces: In the institution library. The public marketplace waits for a super admin.', at: '2026-10-17T10:40:00.000Z' },
  { id: '2', rule: 'student_refund', outcome: 'auto', summary: 'Annual plan refunded for the unused days.', at: '2026-10-17T10:12:00.000Z' },
  { id: '3', rule: 'help_et', outcome: 'auto', summary: 'ET answered password_reset.', at: '2026-10-17T09:55:00.000Z' },
  { id: '4', rule: 'student_refund', outcome: 'refused', summary: 'Sparks packs stay on the account.', at: '2026-10-17T09:10:00.000Z' },
  { id: '5', rule: 'help_faq', outcome: 'held', summary: 'ET escalated a question to a ticket.', at: '2026-10-16T16:02:00.000Z' },
];

/** Static automation desk so the toggles and feed can be reviewed without Firebase. */
export default function AutomationPreview() {
  const [settings, setSettings] = useState(defaultAutomation());
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-10 text-[#1A3C34]">
      <div className="mx-auto max-w-5xl">
        <AutomationPanel
          settings={settings}
          feed={FEED}
          onToggle={(id, on) => setSettings({ rules: { ...settings.rules, [id]: on } })}
          onSave={() => undefined}
        />
      </div>
    </main>
  );
}
