/**
 * PLACEHOLDER family bundle rates. The Primary & Lower Secondary price is
 * not decided, so these percents are not a price. Replace them from
 * pricing_config.familyDiscount when that field exists. Charged amounts
 * still come from each plan's config price.
 */
export const FAMILY_BUNDLE_DISCOUNT = {
  placeholder: true as const,
  label: 'PLACEHOLDER — not a locked price. Second child 10% off, third and later 15% off, applied to the config plan price.',
  secondChildOff: 0.1,
  furtherChildOff: 0.15,
};
