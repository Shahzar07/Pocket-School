import type { MetadataRoute } from 'next';
import { READS_OFFER_PATH, readsOfferIndexable } from '@/lib/reads-offer';

const BASE_URL = 'https://poketschool.ai';

const PRIVATE_PATHS = ['/dashboard/', '/api/', '/onboarding', '/verify', '/school-notice/', '/authority-case/', '/preview/admin-desk', '/preview/admin-tools', '/preview/teacher-desk'];

export default function robots(): MetadataRoute.Robots {
  const disallow = readsOfferIndexable() ? PRIVATE_PATHS : [...PRIVATE_PATHS, READS_OFFER_PATH];
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
