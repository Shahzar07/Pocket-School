/**
 * Family bundle discount. The seed is null until a super admin saves rates
 * on pricing_config/current.familyBundleDiscount. Ten percent and fifteen
 * percent are an example an admin can enter. They are not charged until then.
 */

export interface FamilyBundleRates {
  secondChildOff: number;
  furtherChildOff: number;
}

/** Example only. Not stored and not charged. */
export const FAMILY_BUNDLE_EXAMPLE: FamilyBundleRates = {
  secondChildOff: 0.1,
  furtherChildOff: 0.15,
};

export const FAMILY_BUNDLE_DISCOUNT: FamilyBundleRates | null = null;

export const FAMILY_BUNDLE_UNSET_LABEL =
  'Family bundle discount is not set. Each child pays the plan price from config until a super admin saves a discount.';

export function familyDiscountLabel(rates: FamilyBundleRates | null): string {
  if (!rates) return FAMILY_BUNDLE_UNSET_LABEL;
  const second = Math.round(rates.secondChildOff * 1000) / 10;
  const further = Math.round(rates.furtherChildOff * 1000) / 10;
  return `Second child ${second}% off, third and later ${further}% off, applied to the config plan price.`;
}
