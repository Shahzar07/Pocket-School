/** Shown while the ET AI Studio bundle is still loading. */
export function StudioBoot() {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center bg-background px-6" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-muted-foreground">Opening ET AI Studio…</p>
    </div>
  );
}
