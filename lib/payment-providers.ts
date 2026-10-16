export interface PaymentProvider {
  id: string;
  name: string;
  region: string;
}

/** Checkout providers. Secrets are environment variables, edited only in Integrations. */
export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  { id: 'stripe', name: 'Stripe', region: 'Cards, worldwide' },
  { id: 'billplz', name: 'Billplz', region: 'Malaysia' },
  { id: 'ipay88', name: 'iPay88', region: 'Malaysia' },
  { id: 'rms', name: 'RMS', region: 'Malaysia' },
  { id: 'paypal', name: 'PayPal', region: 'Worldwide' },
  { id: 'xendit', name: 'Xendit', region: 'Southeast Asia' },
];
