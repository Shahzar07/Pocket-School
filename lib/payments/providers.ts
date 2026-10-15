import type { MethodId, PaymentProviderId } from './methods';
import { methodById } from './methods';

export type GatewayVendor = 'ipay88' | 'billplz' | 'rms';
export type ProviderMode = 'live' | 'test' | 'mock';

export function providerForMethod(methodId: string): PaymentProviderId | null {
  return methodById(methodId)?.provider ?? null;
}

export function stripeMode(secret: string | undefined | null): ProviderMode {
  const value = secret?.trim() ?? '';
  if (!value) return 'mock';
  if (value.startsWith('sk_live')) return 'live';
  return 'test';
}

export function gatewayMode(vendor: GatewayVendor, secrets: {
  ipay88MerchantCode?: string;
  ipay88MerchantKey?: string;
  billplzApiKey?: string;
  billplzCollectionId?: string;
  rmsMerchantId?: string;
  rmsSecret?: string;
}, explicit?: string | null): ProviderMode {
  const ready = vendor === 'ipay88'
    ? !!(secrets.ipay88MerchantCode && secrets.ipay88MerchantKey)
    : vendor === 'billplz'
      ? !!(secrets.billplzApiKey && secrets.billplzCollectionId)
      : !!(secrets.rmsMerchantId && secrets.rmsSecret);
  if (!ready) return 'mock';
  return explicit === 'live' ? 'live' : 'test';
}

export function isLocalWalletMethod(methodId: MethodId | string): boolean {
  return methodId === 'wallet';
}

export const GATEWAY_VENDORS: readonly { id: GatewayVendor; label: string }[] = [
  { id: 'billplz', label: 'Billplz' },
  { id: 'ipay88', label: 'iPay88' },
  { id: 'rms', label: 'Razer Merchant Services' },
];
