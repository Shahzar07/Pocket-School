'use client';

import { AUTOMATION_RULES, type AutomationEvent, type AutomationSettings } from '@/lib/site-automation';

export function AutomationPanel({
  settings,
  feed,
  busy,
  onToggle,
  onSave,
}: {
  settings: AutomationSettings;
  feed: AutomationEvent[];
  busy?: boolean;
  onToggle: (id: keyof AutomationSettings['rules'], on: boolean) => void;
  onSave?: () => void;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
      <section className="rounded-3xl border border-[#203337]/10 bg-white p-5 shadow-[0_24px_60px_-36px_rgba(26,60,52,0.45)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Super admin</p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight text-[#203337]">Automation</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#203337]/75">
          Each rule runs on its own. Turning one off sends that step back to a person. Suspend, refund, and edit stay available as overrides.
        </p>
        <ul className="mt-4 divide-y divide-[#203337]/10">
          {AUTOMATION_RULES.map((rule) => (
            <li key={rule.id} className="flex items-start justify-between gap-3 py-3">
              <span>
                <span className="block text-sm font-medium text-[#203337]">{rule.label}</span>
                <span className="mt-0.5 block text-xs text-[#203337]/60">{rule.offMeans}</span>
              </span>
              <button
                type="button"
                aria-pressed={settings.rules[rule.id]}
                disabled={busy}
                onClick={() => onToggle(rule.id, !settings.rules[rule.id])}
                className={`mt-0.5 h-7 w-12 shrink-0 rounded-full px-1 ${settings.rules[rule.id] ? 'bg-[#203337]' : 'bg-[#203337]/20'}`}
              >
                <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${settings.rules[rule.id] ? 'translate-x-5' : ''}`} />
                <span className="sr-only">{settings.rules[rule.id] ? 'On' : 'Off'}</span>
              </button>
            </li>
          ))}
        </ul>
        {onSave && (
          <button type="button" disabled={busy} onClick={onSave} className="mt-4 inline-flex h-11 items-center rounded-full bg-[#203337] px-5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Saving…' : 'Save automation'}
          </button>
        )}
      </section>
      <aside className="rounded-3xl border border-[#203337]/10 bg-[#E9F7FA] p-5">
        <h2 className="font-heading text-xl text-[#203337]">Activity</h2>
        <p className="mt-1 text-xs text-[#203337]/70">Automatic steps, holds, and super-admin changes.</p>
        <ul className="mt-4 space-y-3">
          {feed.length === 0 && <li className="text-sm text-[#203337]/70">Nothing has run yet.</li>}
          {feed.map((event) => (
            <li key={event.id} className="rounded-2xl bg-white px-3 py-3 text-sm text-[#203337]">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1E6A83]">{event.outcome}</span>
              <span className="mt-1 block">{event.summary}</span>
              {event.at && <span className="mt-1 block text-xs text-[#203337]/55">{event.at.slice(0, 16).replace('T', ' ')}</span>}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
