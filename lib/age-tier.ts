/** Server-set age tier. Clients never write this. */

export type AgeTier = 'under13' | 'teen' | 'adult';

const DOB = /^(\d{4})-(\d{2})-(\d{2})$/;

export function ageTierFromDob(dobIso: string, now: Date): AgeTier | null {
  const match = DOB.exec(dobIso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const born = new Date(Date.UTC(year, month - 1, day));
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) return null;
  if (born.getTime() > now.getTime()) return null;

  let age = now.getUTCFullYear() - year;
  const hadBirthday = now.getUTCMonth() > month - 1
    || (now.getUTCMonth() === month - 1 && now.getUTCDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < 0 || age > 120) return null;
  if (age >= 18) return 'adult';
  if (age >= 13) return 'teen';
  return 'under13';
}

/** Missing or unknown tiers fail closed as under-13. Legacy `minor` does too. */
export function asAgeTier(value: unknown): AgeTier {
  if (value === 'adult' || value === 'teen' || value === 'under13') return value;
  return 'under13';
}

export function isMinorTier(tier: AgeTier): boolean {
  return tier === 'under13' || tier === 'teen';
}

export function isAgeTier(value: unknown): value is AgeTier {
  return value === 'under13' || value === 'teen' || value === 'adult';
}
