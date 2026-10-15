import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** iPay88 amount string with the decimal point removed. 12.50 becomes "1250". */
export function ipay88Amount(major: number): string {
  return major.toFixed(2).replace('.', '');
}

export function ipay88Signature(input: {
  merchantKey: string;
  merchantCode: string;
  refNo: string;
  amount: string;
  currency: string;
  status?: string;
  paymentId?: string;
}): string {
  const payload = `${input.merchantKey}${input.merchantCode}${input.paymentId ?? ''}${input.refNo}${input.amount}${input.currency}${input.status ?? ''}`;
  return createHmac('sha512', input.merchantKey).update(payload).digest('hex');
}

/** Billplz X-Signature source: sorted keys, excluding the signature itself. */
export function billplzSource(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== 'x_signature')
    .sort()
    .map((key) => `${key}${params[key] ?? ''}`)
    .join('|');
}

export function billplzSignature(secret: string, params: Record<string, string>): string {
  return createHmac('sha256', secret).update(billplzSource(params)).digest('hex');
}

/**
 * Razer Merchant Services (MOLPay) response signature.
 * md5(txnId + orderId + status + domain + amount + currency + secret)
 */
export function rmsSignature(input: {
  txnId: string;
  orderId: string;
  status: string;
  merchantId: string;
  amount: string;
  currency: string;
  secret: string;
}): string {
  const raw = `${input.txnId}${input.orderId}${input.status}${input.merchantId}${input.amount}${input.currency}${input.secret}`;
  return createHash('md5').update(raw).digest('hex');
}

export function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected.trim().toLowerCase());
  const b = Buffer.from(received.trim().toLowerCase());
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
