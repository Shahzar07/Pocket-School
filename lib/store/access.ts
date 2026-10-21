export interface DownloadInput {
  contentStaff: boolean;
  access: 'paid' | 'free';
  status: 'draft' | 'published';
  purchased: boolean;
  entitled: boolean;
}

/** Staff can review drafts. Everyone else needs a published free file, a purchase, or an entitlement. */
export function downloadDecision(input: DownloadInput): 'allow' | 'deny' {
  if (input.contentStaff) return 'allow';
  if (input.status !== 'published') return 'deny';
  if (input.access === 'free') return 'allow';
  if (input.purchased || input.entitled) return 'allow';
  return 'deny';
}

export function hasStoreEntitlement(permissions: readonly string[], productId: string): boolean {
  return permissions.includes(`alloc:store:${productId}`)
    || permissions.includes(`alloc:resource:${productId}`);
}
