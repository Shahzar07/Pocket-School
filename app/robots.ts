import type { MetadataRoute } from 'next';

const BASE_URL = 'https://poketschool.ai';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/onboarding', '/verify', '/school-notice/', '/authority-case/', '/preview/admin-desk', '/preview/admin-tools', '/preview/teacher-desk', '/reads/offer'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
