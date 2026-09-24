'use client';

/**
 * Tier selector — the control that decides which field schema and output
 * format the AI generation call uses.
 *
 * It always shows the auto-detected tier first (read from the Programme /
 * Subject / Year already chosen) and lets the admin override it. The override
 * is sticky: once someone picks a tier by hand, changing the subject no longer
 * moves it under them.
 */

import { useEffect, useRef } from 'react';
import {
  TIERS, TIER_BY_ID, SUBJECT_TYPES, LAW_STAGES, TIER3_ASSESSMENTS,
  detectTier, describeSelection,
  type TierSelection, type TierId, type Tier2SubjectType, type LawStage,
  type Tier3Assessment,
} from '@/lib/curriculum-tiers';
import { Sparkles, Info, RotateCcw } from 'lucide-react';

export interface TierSelectorProps {
  /** Current selection. Pass `null`/undefined to run purely on auto-detect. */
  value?: TierSelection | null;
  onChange: (sel: TierSelection, manual: boolean) => void;
  /** Context used to auto-detect the default tier. */
  context: { programme?: string; subject?: string; yearLevel?: string; courseTitle?: string };
  /** True when the current value came from an admin override, not auto-detect. */
  overridden?: boolean;
  /** Clear the override and fall back to auto-detect. */
  onClearOverride?: () => void;
  /** Dense layout for the right-hand properties panel. */
  compact?: boolean;
  /** Where this selector sits, e.g. "Lesson" or "Chapter" — used in the label. */
  scope?: string;
  disabled?: boolean;
}

const selectCls =
  'w-full h-9 rounded-lg border border-border bg-card px-2 text-xs font-medium outline-none ' +
  'focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:opacity-50';

export function TierSelector({
  value, onChange, context, overridden, onClearOverride, compact, scope = 'Lesson', disabled,
}: TierSelectorProps) {
  const detected = detectTier(context);
  const effective: TierSelection = value ?? { tier: detected.tier, subjectType: detected.subjectType, lawStage: detected.lawStage, assessmentStyle: detected.assessmentStyle };
  const def = TIER_BY_ID[effective.tier] ?? TIER_BY_ID.tier1;

  // Keep the parent in step with auto-detect until an admin overrides it, so a
  // subject renamed from "Business" to "Business Law" re-routes to Tier 4.
  const lastAuto = useRef<string>('');
  useEffect(() => {
    if (overridden) return;
    const key = `${detected.tier}|${detected.subjectType ?? ''}|${detected.lawStage ?? ''}`;
    if (key === lastAuto.current) return;
    lastAuto.current = key;
    onChange(
      { tier: detected.tier, subjectType: detected.subjectType, lawStage: detected.lawStage, assessmentStyle: detected.assessmentStyle },
      false,
    );
    // onChange is recreated per render by most callers; detection is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected.tier, detected.subjectType, detected.lawStage, overridden]);

  const setTier = (tier: TierId) => {
    const next: TierSelection = { tier };
    // Carry sensible sub-defaults so the second dropdown is never empty.
    if (tier === 'tier2') next.subjectType = effective.subjectType ?? detected.subjectType ?? 'essay';
    if (tier === 'tier4') next.lawStage = effective.lawStage ?? detected.lawStage ?? 'llb';
    if (tier === 'tier3') next.assessmentStyle = effective.assessmentStyle ?? 'checklist';
    onChange(next, true);
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {scope} Tier
        </label>
        {overridden ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Manual
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
            <Sparkles className="w-2.5 h-2.5" /> Auto
          </span>
        )}
        {overridden && onClearOverride && (
          <button
            type="button"
            onClick={onClearOverride}
            className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
            title={`Go back to the auto-detected tier (${TIER_BY_ID[detected.tier].short})`}
          >
            <RotateCcw className="w-2.5 h-2.5" /> Reset to auto
          </button>
        )}
      </div>

      <select
        value={effective.tier}
        disabled={disabled}
        onChange={e => setTier(e.target.value as TierId)}
        className={selectCls}
        title="Which field set and output format the AI generation uses"
      >
        {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>

      {/* Tier 2 — Essay/Scenario vs Technical/Calculation changes the Case Study format. */}
      {effective.tier === 'tier2' && (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground">Subject Type</label>
          <select
            value={effective.subjectType ?? 'essay'}
            disabled={disabled}
            onChange={e => onChange({ ...effective, subjectType: e.target.value as Tier2SubjectType }, true)}
            className={selectCls}
          >
            {SUBJECT_TYPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {SUBJECT_TYPES.find(s => s.id === (effective.subjectType ?? 'essay'))?.hint}
          </p>
        </div>
      )}

      {/* Tier 4 — the stage drives how far case-law depth scales. */}
      {effective.tier === 'tier4' && (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground">Stage</label>
          <select
            value={effective.lawStage ?? 'llb'}
            disabled={disabled}
            onChange={e => onChange({ ...effective, lawStage: e.target.value as LawStage }, true)}
            className={selectCls}
          >
            {LAW_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {LAW_STAGES.find(s => s.id === (effective.lawStage ?? 'llb'))?.depth}
          </p>
        </div>
      )}

      {/* Tier 3 — checklist vs graded rubric. */}
      {effective.tier === 'tier3' && (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground">Assessment</label>
          <select
            value={effective.assessmentStyle ?? 'checklist'}
            disabled={disabled}
            onChange={e => onChange({ ...effective, assessmentStyle: e.target.value as Tier3Assessment }, true)}
            className={selectCls}
          >
            {TIER3_ASSESSMENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {TIER3_ASSESSMENTS.find(a => a.id === (effective.assessmentStyle ?? 'checklist'))?.hint}
          </p>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-snug">
        <Info className="w-3 h-3 mt-px shrink-0" />
        <span>
          {overridden ? def.blurb : `${detected.reason} ${def.blurb}`}
        </span>
      </p>
    </div>
  );
}

/** One-line read-only badge, for lists and headers. */
export function TierBadge({ selection, className = '' }: { selection: TierSelection; className?: string }) {
  const tone: Record<TierId, string> = {
    tier1: 'bg-sky-100 text-sky-700',
    tier2: 'bg-violet-100 text-violet-700',
    tier3: 'bg-amber-100 text-amber-700',
    tier4: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${tone[selection.tier] ?? tone.tier1} ${className}`}>
      {describeSelection(selection)}
    </span>
  );
}
