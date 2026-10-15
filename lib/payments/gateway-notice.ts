import { billplzSignature, ipay88Signature, rmsSignature, signaturesMatch } from './signatures';

export interface GatewayNotice {
  ok: boolean;
  paid: boolean;
  checkoutId?: string;
  eventId: string;
  reason?: string;
}

function value(params: Record<string, string>, key: string): string {
  return params[key] ?? '';
}

/**
 * Verifies a Malaysian gateway callback. The sandbox route does not use this.
 * A missing secret fails closed.
 */
export function verifyGatewayNotice(
  vendor: 'ipay88' | 'billplz' | 'rms',
  secret: string | undefined,
  params: Record<string, string>,
): GatewayNotice {
  if (!secret) return { ok: false, paid: false, eventId: 'none', reason: 'Gateway secret is not configured.' };

  if (vendor === 'billplz') {
    const expected = billplzSignature(secret, params);
    const received = value(params, 'x_signature');
    if (!signaturesMatch(expected, received)) {
      return { ok: false, paid: false, eventId: value(params, 'id') || 'billplz', reason: 'Signature did not match.' };
    }
    const paid = value(params, 'paid') === 'true';
    return {
      ok: true,
      paid,
      checkoutId: value(params, 'reference_1') || undefined,
      eventId: value(params, 'id') || 'billplz',
    };
  }

  if (vendor === 'ipay88') {
    const amount = value(params, 'Amount');
    const expected = ipay88Signature({
      merchantKey: secret,
      merchantCode: value(params, 'MerchantCode'),
      paymentId: value(params, 'PaymentId'),
      refNo: value(params, 'RefNo'),
      amount,
      currency: value(params, 'Currency') || 'MYR',
      status: value(params, 'Status'),
    });
    if (!signaturesMatch(expected, value(params, 'Signature'))) {
      return { ok: false, paid: false, eventId: value(params, 'TransId') || value(params, 'RefNo'), reason: 'Signature did not match.' };
    }
    return {
      ok: true,
      paid: value(params, 'Status') === '1',
      checkoutId: value(params, 'RefNo') || undefined,
      eventId: value(params, 'TransId') || value(params, 'RefNo'),
    };
  }

  const expected = rmsSignature({
    txnId: value(params, 'tranID'),
    orderId: value(params, 'orderid'),
    status: value(params, 'status'),
    merchantId: value(params, 'domain'),
    amount: value(params, 'amount'),
    currency: value(params, 'currency'),
    secret,
  });
  if (!signaturesMatch(expected, value(params, 'skey'))) {
    return { ok: false, paid: false, eventId: value(params, 'tranID') || 'rms', reason: 'Signature did not match.' };
  }
  return {
    ok: true,
    paid: value(params, 'status') === '00',
    checkoutId: value(params, 'orderid') || undefined,
    eventId: value(params, 'tranID') || value(params, 'orderid'),
  };
}
