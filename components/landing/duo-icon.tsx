import type { LucideIcon } from 'lucide-react';

/** Duotone mark: cyan glow, blue stroke. Decorative when the card already has a name. */
export function DuoIcon({ icon: Icon, label }: { icon: LucideIcon; label?: string }) {
  const named = Boolean(label);
  return (
    <span
      role={named ? 'img' : undefined}
      aria-hidden={named ? undefined : true}
      aria-label={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#3FE0D0]/30 text-[#1E6A83] shadow-[0_0_0_6px_rgba(63,224,208,0.18)] dark:bg-[#3FE0D0]/15 dark:text-[#3FE0D0] dark:shadow-[0_0_16px_rgba(63,224,208,0.28)]"
    >
      <Icon size={20} strokeWidth={1.75} />
    </span>
  );
}
