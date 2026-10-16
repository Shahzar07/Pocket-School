/** Shown while one studio tool's own bundle is still loading. */
export function ToolLoading({ label, tall = false }: { label: string; tall?: boolean }) {
  return (
    <div className={`${tall ? 'h-64' : 'h-40'} animate-pulse rounded-2xl bg-muted`} role="status" aria-label={label} />
  );
}

/** Shown while the ET AI Studio bundle is still loading. */
export function StudioBoot() {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center bg-background px-6" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-muted-foreground">Opening ET AI Studio…</p>
    </div>
  );
}
