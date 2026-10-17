import type { OfferTestimonial } from '@/lib/reads-offer';

/**
 * Reader reviews. The page passes READS_OFFER_TESTIMONIALS, which is empty
 * until a real review is added to that array. The card markup stays here so
 * a later entry does not need a new layout.
 */
export function OfferTestimonials({ items }: { items: readonly OfferTestimonial[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-10 space-y-4" aria-label="Reader reviews">
      {items.map(item => (
        <li key={item.id} className="rounded-3xl border border-border bg-card px-6 py-5">
          <blockquote className="text-[17px] leading-[1.7] text-foreground">“{item.quote}”</blockquote>
          <footer className="mt-4 text-sm">
            <p className="font-semibold text-foreground">{item.name}</p>
            {item.detail ? <p className="text-muted-foreground">{item.detail}</p> : null}
          </footer>
        </li>
      ))}
    </ul>
  );
}
