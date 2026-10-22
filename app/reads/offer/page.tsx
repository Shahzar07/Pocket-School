import type { Metadata } from 'next';
import { OfferCurrencyProvider } from '@/components/reads-offer/money';
import { ReadsOfferLetter } from '@/components/reads-offer/letter';
import { READS_OFFER_PATH, ownOrReadLine, readsOfferJsonLd } from '@/lib/reads-offer';
import { jsonLdScript } from '@/lib/seo';

export const revalidate = 86400;

const TITLE = 'Poket Reads — a bookshelf you can subscribe to from Malaysia';
const DESCRIPTION = `Poket Reads is sold on its own. ${ownOrReadLine()}. Academic titles and stories, Ask ET, and Malaysian payment methods. Kindle Unlimited is not sold here.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: READS_OFFER_PATH },
  keywords: ['Poket Reads', 'books Malaysia', 'IGCSE books', 'children\'s books', 'reading subscription'],
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
      alt: 'Poket Reads, a bookshelf you can subscribe to from Malaysia',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/reads/offer/og.jpg'],
  },
  robots: { index: false, follow: false },
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
