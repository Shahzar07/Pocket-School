import { BRAND, tierMetal } from '@/lib/brand';
import { STARTER_BADGES, mergeDefinitions, type BadgeDefinition } from '@/lib/gamification/catalog';

export function badgeById(id: string, overrides?: readonly Partial<BadgeDefinition>[]): BadgeDefinition | null {
  return mergeDefinitions(overrides).find(badge => badge.id === id) ?? STARTER_BADGES.find(badge => badge.id === id) ?? null;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] ?? char));
}

/** Shareable card. Blue hero gradient, with the badge name and a short learner label. */
export function badgeCardSvg(badge: BadgeDefinition, earner: string, school: string): string {
  const who = escapeXml([earner, school].filter(Boolean).join(' · ').slice(0, 80));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900">
  <defs>
    <linearGradient id="poket-hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.blueDeep}"/>
      <stop offset="50%" stop-color="${BRAND.primary}"/>
      <stop offset="100%" stop-color="${BRAND.blueBright}"/>
    </linearGradient>
  </defs>
  <rect width="720" height="900" rx="48" fill="url(#poket-hero)"/>
  <text x="64" y="96" fill="${BRAND.mint}" font-family="Georgia, serif" font-size="22" letter-spacing="4">POKET SCHOOL</text>
  <circle cx="360" cy="340" r="150" fill="${BRAND.blueDeep}"/>
  <circle cx="360" cy="340" r="132" fill="none" stroke="${BRAND.blueBright}" stroke-width="10"/>
  <text x="360" y="356" text-anchor="middle" fill="${tierMetal(badge.tier)}" font-family="Georgia, serif" font-size="42">${escapeXml(badge.tier)}</text>
  <text x="64" y="580" fill="#ffffff" font-family="Georgia, serif" font-size="54">${escapeXml(badge.name)}</text>
  <text x="64" y="650" fill="#ffffff" font-family="Georgia, serif" font-size="26" opacity="0.85">${escapeXml(badge.description).slice(0, 90)}</text>
  <text x="64" y="800" fill="#ffffff" font-family="Georgia, serif" font-size="28">${who}</text>
</svg>`;
}
