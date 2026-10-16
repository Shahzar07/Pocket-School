/** Pick the markdown that should decide how many pages a chapter has. */
export function markdownForPageCount(source: string, translated: string | undefined, useTranslation: boolean): string {
  if (!useTranslation) return source;
  const next = translated?.trim();
  return next ? next : source;
}
