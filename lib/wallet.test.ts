import { describe, expect, it } from 'vitest';
import { getWallet, quoteSession, splitFee } from './wallet';

describe('wallet stub', () => {
  it('keeps twenty percent and pays the tutor the rest', () => {
    expect(splitFee(5000, 2000)).toEqual({ commissionCents: 1000, tutorCents: 4000 });
  });

  it('quotes a group session from the hourly rate', () => {
    const quote = quoteSession(6000, 60, 4, 2000);
    expect(quote.totalCents).toBe(24000);
    expect(quote.tutorCents).toBe(19200);
  });

  it('returns a pending charge without calling a real wallet', async () => {
    const result = await getWallet().charge({
      payerId: 'student', amountCents: 1000, currency: 'USD', memo: 'tutor', reference: 'book_1',
    });
    expect(result.status).toBe('pending');
    expect(result.paymentId).toBe('stub_book_1');
  });
});
