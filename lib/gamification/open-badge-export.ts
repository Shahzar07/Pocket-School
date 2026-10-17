import { privateKeyFromPem, signCredential } from '@/lib/credentials/open-badge';
import type { BadgeDefinition } from '@/lib/gamification/catalog';

const ISSUER = 'https://poketschool.ai/issuer';

/** Open Badges 3.0 achievement credential. Unsigned unless a private key is passed. */
export function achievementCredential(badge: BadgeDefinition, earnerName: string, awardedAt: string, id: string): Record<string, unknown> {
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id: `urn:uuid:${id}`,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: { id: ISSUER, type: ['Profile'], name: 'Poket School' },
    validFrom: awardedAt,
    name: badge.name,
    credentialSubject: {
      type: ['AchievementSubject'],
      name: earnerName,
      achievement: {
        id: `https://poketschool.ai/badges/${badge.id}`,
        type: ['Achievement'],
        name: badge.name,
        description: badge.description,
        criteria: { narrative: badge.description },
      },
    },
  };
}

/**
 * Signs only when `OPEN_BADGE_PRIVATE_KEY` (or an explicit PEM) is present.
 * A missing or unreadable key leaves the credential unsigned so export still works.
 */
export function exportAchievementBadge(
  badge: BadgeDefinition,
  earnerName: string,
  awardedAt: string,
  id: string,
  privateKeyPem?: string | null,
): Record<string, unknown> {
  const credential = achievementCredential(badge, earnerName, awardedAt, id);
  const pem = (privateKeyPem ?? '').trim();
  if (!pem) return credential;
  try {
    const key = privateKeyFromPem(pem);
    return signCredential(credential, key, `${ISSUER}#key`, awardedAt);
  } catch {
    return credential;
  }
}
