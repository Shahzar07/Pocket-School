/**
 * Payment hook for the tutor marketplace.
 *
 * The wallet agent owns charging and payouts. Callers depend on this
 * interface. `stubWallet` records a pending charge so bookings work before
 * that wallet is wired in. Replace `getWallet()` when it lands.
 */

export interface WalletCharge {
  payerId: string;
  amountCents: number;
  currency: 'USD';
  memo: string;
  reference: string;
}

export interface WalletPayout {
  tutorId: string;
  amountCents: number;
  currency: 'USD';
  reference: string;
}

export interface WalletPort {
  charge(input: WalletCharge): Promise<{ paymentId: string; status: 'pending' | 'captured' }>;
  tutorPayout(input: WalletPayout): Promise<{ payoutId: string; status: 'pending' }>;
}

export const DEFAULT_COMMISSION_BPS = 2000;

export function splitFee(amountCents: number, commissionBps: number): { commissionCents: number; tutorCents: number } {
  const safeAmount = Number.isFinite(amountCents) && amountCents > 0 ? Math.round(amountCents) : 0;
  const bps = Number.isFinite(commissionBps) && commissionBps >= 0 && commissionBps <= 5000
    ? Math.round(commissionBps)
    : DEFAULT_COMMISSION_BPS;
  const commissionCents = Math.round(safeAmount * bps / 10_000);
  return { commissionCents, tutorCents: safeAmount - commissionCents };
}

export function quoteSession(hourlyCents: number, minutes: number, seats: number, commissionBps: number) {
  const hours = Math.max(15, minutes) / 60;
  const seatCount = Math.max(1, Math.min(30, Math.round(seats)));
  const totalCents = Math.round(hourlyCents * hours * (seatCount > 1 ? seatCount : 1));
  return { seats: seatCount, totalCents, ...splitFee(totalCents, commissionBps) };
}

export const stubWallet: WalletPort = {
  async charge(input) {
    return { paymentId: `stub_${input.reference}`, status: 'pending' };
  },
  async tutorPayout(input) {
    return { payoutId: `stub_payout_${input.reference}`, status: 'pending' };
  },
};

export function getWallet(): WalletPort {
  return stubWallet;
}
