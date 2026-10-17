import type { Metadata } from 'next';
import { OfferLanding } from '@/components/offer/offer-landing';
import { offerCopy } from '@/lib/offer';

const title = offerCopy.meta.title;
const description = offerCopy.meta.description;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/offer' },
  keywords: [
    'Poket School',
    'PoketSchool.Ai',
    'ET AI',
    'IGCSE',
    'A-Level',
    'Primary',
    'Lower Secondary',
    'Open Badges',
    'CEFR',
  ],
  openGraph: {
    type: 'website',
    url: '/offer',
    siteName: 'Poket School',
    title,
    description,
    locale: 'en_MY',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: { index: true, follow: true },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: offerCopy.faq.title,
      acceptedAnswer: {
        '@type': 'Answer',
        text: offerCopy.faq.body,
      },
    },
  ],
};

export default function OfferPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <OfferLanding />
    </>
  );
}
