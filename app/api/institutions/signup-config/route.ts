import { NextResponse } from 'next/server';
import { institutionPaymentKeys, loadApprovalSettings } from '@/lib/server/institution-activate';
import { INVOICE_MIN_SEATS, SANDBOX_BANNER, checkoutChannel } from '@/lib/institution-self-serve';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [settings, keys] = await Promise.all([loadApprovalSettings(), institutionPaymentKeys()]);
  const channel = checkoutChannel({
    stripe: keys.stripe,
    gateway: keys.gateway,
    currency: 'USD',
    tender: 'card',
    total: 1,
  });
  return NextResponse.json({
    sandbox: channel === 'sandbox',
    banner: channel === 'sandbox' ? SANDBOX_BANNER : '',
    trialDays: settings.trialDays,
    trialSeatCap: settings.trialSeatCap,
    invoiceMinSeats: INVOICE_MIN_SEATS,
  });
}
