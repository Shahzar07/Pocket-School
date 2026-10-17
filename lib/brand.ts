/** Poket School brand. Forest green and gold belong to Rochford, not this product. */

export const BRAND = {
  hero: 'linear-gradient(135deg, #1E6A83 0%, #2786A4 50%, #6FBBCE 100%)',
  primary: '#2786A4',
  blueDeep: '#1E6A83',
  blueBright: '#6FBBCE',
  amber: '#E2AF4D',
  coral: '#D0553F',
  good: '#1F8A70',
  mint: '#E5F6EF',
} as const;

/** Metallic tones for bronze, silver, and gold tiers. Not the brand field colour. */
export const TIER_METAL = {
  bronze: '#A97142',
  silver: '#B8B8B8',
  gold: '#C6A15B',
} as const;

export function tierMetal(tier: string): string {
  if (tier === 'bronze' || tier === 'silver' || tier === 'gold') return TIER_METAL[tier];
  return BRAND.amber;
}
