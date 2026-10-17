'use client';

import { useEffect, useState } from 'react';
import { AUTOMATION_RULES, defaultAutomation, type AutomationRules } from '@/lib/site-automation';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';

/** Read-only view of the rules a super admin can change. Institution admins do not edit them here. */
export default function InstitutionAutomationPage() {
  const [rules, setRules] = useState<AutomationRules>(defaultAutomation().rules);

  useEffect(() => {
    void fetch('/api/automation/status')
      .then((response) => response.json())
      .then((data: { rules?: Partial<AutomationRules> }) => {
        if (!data.rules) return;
        setRules({ ...defaultAutomation().rules, ...data.rules });
      })
      .catch(() => {});
  }, []);

  return (
    <DashPage className="max-w-3xl">
      <DashHeader
        eyebrow="Institution"
        title="Automation"
        description="These steps run on their own. A super admin turns a rule off from Automation. This page is the view for your academy."
      />
      <Panel>
        <ul className="divide-y divide-border">
          {AUTOMATION_RULES.map((rule) => (
            <li key={rule.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold">{rule.journey}</p>
                <p className="text-sm text-muted-foreground">{rule.label}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${rules[rule.id] ? 'bg-[#203337] text-white' : 'bg-muted text-muted-foreground'}`}>
                {rules[rule.id] ? 'On' : 'Off'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </DashPage>
  );
}
