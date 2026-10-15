'use client';

import { MODE_LABELS, MODE_NAMES, type AccountMode } from '@/lib/account-modes';

export function ModeSwitch({
  modes,
  active,
  onSwitch,
  onBecomeInstructor,
  layout = 'row',
}: {
  modes: readonly AccountMode[];
  active: AccountMode | null;
  onSwitch: (mode: AccountMode) => void;
  onBecomeInstructor?: () => void;
  layout?: 'row' | 'menu';
}) {
  const others = modes.filter(mode => mode !== active);
  if (!others.length && !onBecomeInstructor) return null;
  const itemClass = layout === 'menu'
    ? 'flex w-full items-center rounded-xl px-2 py-2 text-left text-sm font-semibold hover:bg-muted'
    : 'h-8 rounded-full border border-border px-3 text-xs font-semibold hover:bg-muted';
  return (
    <div
      data-mode-switch
      data-active-mode={active ?? ''}
      className={layout === 'menu' ? 'space-y-0.5 border-t border-border px-1 py-1' : 'flex flex-wrap items-center gap-1'}
    >
      {active && layout === 'row' && (
        <span className="px-1 text-xs font-semibold text-muted-foreground">{MODE_NAMES[active]}</span>
      )}
      {others.map(mode => (
        <button key={mode} type="button" role={layout === 'menu' ? 'menuitem' : undefined} data-mode-target={mode} className={itemClass} onClick={() => onSwitch(mode)}>
          {MODE_LABELS[mode]}
        </button>
      ))}
      {onBecomeInstructor && (
        <button type="button" role={layout === 'menu' ? 'menuitem' : undefined} data-become-instructor className={itemClass} onClick={onBecomeInstructor}>
          Become an instructor
        </button>
      )}
    </div>
  );
}
