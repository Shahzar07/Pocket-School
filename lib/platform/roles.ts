/** Account modes until `users.roles[]` exists. The choice is kept on this device. */
export const ACCOUNT_MODES = ['student', 'parent', 'teacher', 'admin'] as const;
export type AccountMode = (typeof ACCOUNT_MODES)[number];

const KEY = 'poket-account-mode';

export function isAccountMode(value: string): value is AccountMode {
  return (ACCOUNT_MODES as readonly string[]).includes(value);
}

export function readAccountMode(): AccountMode {
  if (typeof localStorage === 'undefined') return 'student';
  const stored = localStorage.getItem(KEY) ?? '';
  return isAccountMode(stored) ? stored : 'student';
}

export function writeAccountMode(mode: AccountMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, mode);
}
