/**
 * Product switches. Defaults live here so a deploy can turn a feature on
 * without a database write. An admin override is a partial map, for example
 * from a future `settings/flags` document.
 *
 * Poket Reads should read `books` before it mounts the catalogue. The nav
 * entry stays visible either way: the route is the hook.
 */

export const FEATURE_FLAGS = {
  books: true,
  referral: false,
  emailDigests: false,
  push: false,
  spacedRepetition: false,
  studyPlanner: false,
  lessonDiscussion: false,
} as const;

export type FlagName = keyof typeof FEATURE_FLAGS;

export function isFlagEnabled(
  name: FlagName,
  overrides?: Partial<Record<FlagName, boolean>> | null,
): boolean {
  const override = overrides?.[name];
  if (typeof override === 'boolean') return override;
  return FEATURE_FLAGS[name];
}
