'use client';

import { useMemo, useState } from 'react';
import { describeTargets, targetLabel, uniqueTokens } from '@/lib/allocation-targets';

export interface AllocationOption {
  token: string;
  label: string;
  group: string;
  detail?: string;
}

export interface AllocationChip {
  token: string;
  label: string;
}

export const ALLOCATION_CHIPS: AllocationChip[] = [
  { token: 'students', label: 'Students' },
  { token: 'teachers', label: 'Teachers' },
  { token: 'parents', label: 'Parents' },
  { token: 'institutions', label: 'Institutions' },
  { token: 'all', label: 'Everyone' },
  { token: 'marketplace', label: 'Marketplace' },
];

const CUSTOM_GROUPS = [
  { prefix: 'user', label: 'Student' },
  { prefix: 'class', label: 'Class' },
  { prefix: 'parent', label: 'Parent' },
  { prefix: 'institution', label: 'Institution' },
] as const;

/**
 * Shared allocation control. Several targets stay selected together:
 * students, a class, a parent, a school, and the marketplace.
 */
export function AllocationPicker({
  value,
  onChange,
  options = [],
  label = 'Who can see this',
  chips = ALLOCATION_CHIPS,
  allowCustom = true,
}: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  options?: readonly AllocationOption[];
  label?: string;
  chips?: readonly AllocationChip[];
  allowCustom?: boolean;
}) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(value), [value]);
  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const chip of chips) map[chip.token] = chip.label.toLowerCase() === 'institutions' ? 'every institution' : chip.label.toLowerCase();
    if (map.marketplace) map.marketplace = 'the marketplace';
    if (map.all) map.all = 'everyone signed in';
    for (const option of options) map[option.token] = option.label;
    return map;
  }, [chips, options]);

  const toggle = (token: string) => {
    const next = selected.has(token) ? value.filter(item => item !== token) : [...value, token];
    onChange(uniqueTokens(next));
  };

  const needle = query.trim().toLowerCase();
  const filtered = options.filter(option => {
    if (!needle) return true;
    return option.label.toLowerCase().includes(needle)
      || option.token.toLowerCase().includes(needle)
      || (option.detail ?? '').toLowerCase().includes(needle)
      || option.group.toLowerCase().includes(needle);
  });
  const groups = [...new Set(filtered.map(option => option.group))];
  const customId = query.trim().replace(/^(user|class|parent|institution):/, '');
  const showCustom = allowCustom && customId.length >= 2 && !options.some(option => option.token.endsWith(`:${customId}`) || option.label.toLowerCase() === needle);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{label}</legend>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(chip => {
            const on = selected.has(chip.token);
            return (
              <label
                key={chip.token}
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-semibold ${on ? 'bg-foreground text-background' : 'border border-border'}`}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(chip.token)} />
                {chip.label}
              </label>
            );
          })}
        </div>
      )}

      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search students, classes, parents, or institutions"
        aria-label="Search allocation targets"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />

      {value.filter(token => !chips.some(chip => chip.token === token)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.filter(token => !chips.some(chip => chip.token === token)).map(token => (
            <button
              key={token}
              type="button"
              onClick={() => toggle(token)}
              className="inline-flex h-8 items-center rounded-full bg-success/15 px-3 text-xs font-semibold"
            >
              {targetLabel(token, labels)}
              <span className="ml-2" aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      {groups.map(group => (
        <div key={group} className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{group}</p>
          {filtered.filter(option => option.group === group).map(option => (
            <label key={option.token} className="flex cursor-pointer items-center justify-between gap-2 py-0.5 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-semibold">{option.label}</span>
                {option.detail && <span className="ml-2 text-xs text-muted-foreground">{option.detail}</span>}
              </span>
              <input type="checkbox" checked={selected.has(option.token)} onChange={() => toggle(option.token)} />
            </label>
          ))}
        </div>
      ))}

      {showCustom && (
        <div className="flex flex-wrap gap-2">
          {CUSTOM_GROUPS.map(group => {
            const token = `${group.prefix}:${customId}`;
            return (
              <button
                key={group.prefix}
                type="button"
                onClick={() => { toggle(token); setQuery(''); }}
                className="h-8 rounded-full border border-border px-3 text-xs font-semibold"
              >
                Add {group.label.toLowerCase()} {customId}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm" data-allocation-summary>{describeTargets(value, labels)}</p>
    </fieldset>
  );
}
