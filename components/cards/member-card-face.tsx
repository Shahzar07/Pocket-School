import type { PublicCard } from '@/lib/cards/model';
import { POKET_SAMPLE_CARD, viewFromPublic } from '@/lib/cards/id-face';
import { IdCard } from './id-card';

/**
 * The face people share. A sample is Alex Student, PSM-SAMPLE.
 * A public share does not print the student number.
 */
export function MemberCardFace({
  card,
  schoolOnCard = false,
  sample = false,
}: {
  card: PublicCard;
  /** Owner view may name the school. The public face passes the card's own schoolName, which is already hidden for under-18s. */
  schoolOnCard?: boolean;
  /** Sample faces add the cyan chip and a light watermark. */
  sample?: boolean;
}) {
  const view = sample
    ? { ...POKET_SAMPLE_CARD, levelName: card.levelName || POKET_SAMPLE_CARD.levelName }
    : viewFromPublic(card, schoolOnCard);
  return <IdCard view={view} />;
}
