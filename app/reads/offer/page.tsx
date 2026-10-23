import type { Metadata } from 'next';
import { OfferCurrencyProvider } from '@/components/reads-offer/money';
import { ReadsOfferLetter } from '@/components/reads-offer/letter';
import { READS_OFFER_HEADLINE, READS_OFFER_PATH, ownOrReadLine, readsOfferIndexable, readsOfferJsonLd } from '@/lib/reads-offer';
import { jsonLdScript } from '@/lib/seo';

export const revalidate = 86400;

const indexable = readsOfferIndexable();

const TITLE = `Poket Reads — ${READS_OFFER_HEADLINE.replace(/\.$/, '')}`;
const DESCRIPTION = `${READS_OFFER_HEADLINE} Poket Reads is sold on its own. ${ownOrReadLine()}. Academic titles and stories, and Ask ET. Kindle Unlimited is not sold here.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: READS_OFFER_PATH },
  keywords: ['Poket Reads', 'books', 'IGCSE books', 'children\'s books', 'reading subscription'],
  openGraph: {
    type: 'website',
    url: READS_OFFER_PATH,
    siteName: 'Poket School',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_GB',
    images: [{
      url: '/reads/offer/og.jpg',
      width: 1200,
      height: 630,
      alt: `Poket Reads, ${READS_OFFER_HEADLINE.charAt(0).toLowerCase()}${READS_OFFER_HEADLINE.slice(1)}`,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/reads/offer/og.jpg'],
  },
  robots: { index: indexable, follow: indexable },
};

export default function ReadsOfferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(readsOfferJsonLd()) }} />
      <OfferCurrencyProvider>
        <ReadsOfferLetter />
      </OfferCurrencyProvider>
    </>
  );
}
