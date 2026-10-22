/** Resolves a sidebar label the same way the dashboard nav does. */
export interface SidebarLabelEntry {
  labelKey: string;
  label?: string;
}

export function sidebarLabel(
  entry: SidebarLabelEntry,
  language: string,
  translate: (key: string) => string,
): string {
  if (entry.label && language.startsWith('en')) return entry.label;
  return translate(entry.labelKey);
}

/** A catalog miss comes back as the key itself, which must never be shown. */
export function isRawNavKey(label: string): boolean {
  return label.startsWith('nav.');
}
