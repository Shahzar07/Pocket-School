/** Money in minor units (cents, sen) so quotes do not drift on floats. */

export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

export function roundMajor(amount: number): number {
  return fromMinor(toMinor(amount));
}
