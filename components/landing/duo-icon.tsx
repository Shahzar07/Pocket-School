import type { LucideIcon } from 'lucide-react';

/** One icon box. 32px, 16px line, the muted text colour. */
export function DuoIcon({ icon: Icon, label }: { icon: LucideIcon; label?: string }) {
  const named = Boolean(label);
  return (
    <span
      role={named ? 'img' : undefined}
      aria-hidden={named ? undefined : true}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4F6F6] text-[#5F7074] dark:bg-[#17282D] dark:text-[#93A7AB]"
    >
      <Icon size={16} strokeWidth={1.5} />
    </span>
  );
}
