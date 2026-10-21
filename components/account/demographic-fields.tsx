'use client';

import { DEMOGRAPHIC_CONSENT, type Gender } from '@/lib/insights/census';
import { LevelMenu } from '@/components/level-menu';
import { isKnownLevel } from '@/lib/levels';

export function GenderSelect({
  value,
  onChange,
  tone = 'default',
  disabled = false,
  id = 'gender',
}: {
  value: string;
  onChange: (value: Gender | '') => void;
  tone?: 'inverse' | 'default';
  disabled?: boolean;
  id?: string;
}) {
  const inverse = tone === 'inverse';
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className={inverse ? 'text-white/60 text-xs font-semibold uppercase tracking-wider' : 'text-sm font-medium'}>Gender</span>
      <select
        id={id}
        aria-label="Gender"
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === 'male' || next === 'female' ? next : '');
        }}
        className={inverse
          ? 'w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white px-4 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E6A83]'
          : 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm'}
      >
        <option value="" className="bg-[#0B0F1A]">Choose</option>
        <option value="female" className="bg-[#0B0F1A]">Female</option>
        <option value="male" className="bg-[#0B0F1A]">Male</option>
      </select>
    </label>
  );
}

export function LevelNameSelect({
  value,
  onChange,
  tone = 'default',
  disabled = false,
  id = 'level-name',
  label = 'Level',
}: {
  value: string;
  onChange: (value: string) => void;
  tone?: 'inverse' | 'default';
  disabled?: boolean;
  id?: string;
  label?: string;
}) {
  const extra = value && !isKnownLevel(value) ? [value] : [];
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className={tone === 'inverse' ? 'text-white/60 text-xs font-semibold uppercase tracking-wider' : 'text-sm font-medium'}>{label}</span>
      <LevelMenu
        ariaLabel={label}
        value={value}
        valueKind="label"
        allowEmpty
        emptyLabel="Choose a level"
        extra={extra}
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

export function DemographicConsent({
  checked,
  onChange,
  tone = 'default',
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: 'inverse' | 'default';
  disabled?: boolean;
}) {
  const inverse = tone === 'inverse';
  return (
    <label className={inverse
      ? 'flex items-start gap-3 rounded-2xl border border-[#1E6A83]/40 bg-[#203337] p-4 cursor-pointer'
      : 'flex items-start gap-3 rounded-xl border border-[#1E6A83]/40 bg-[#E9F7FA]/40 p-3 cursor-pointer'}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E6A83]"
        aria-label="Demographic statistics consent"
      />
      <span className={inverse ? 'text-xs leading-relaxed text-[#E9F7FA]' : 'text-xs leading-relaxed text-[#203337]'}>
        {DEMOGRAPHIC_CONSENT}
      </span>
    </label>
  );
}
