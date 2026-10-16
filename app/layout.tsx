import type { Metadata } from 'next';
import './globals.css';
import { Plus_Jakarta_Sans, Instrument_Sans, Noto_Sans_Arabic, Noto_Sans_Hebrew } from "next/font/google";
import { cn } from "@/lib/utils";
import { AuthProvider } from '@/components/auth-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { WhiteLabelProvider } from '@/components/white-label-provider';
import { TenantChrome } from '@/components/tenant-chrome';
import { Toaster } from "@/components/ui/sonner"
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CookieConsent } from '@/components/cookie-consent';
import { ThemeProvider } from '@/components/theme-provider';

/** Body and UI. The homepage is built on this, so it stays the base face. */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

/**
 * Display face for headings.
 *
 * --font-heading previously pointed at 'Instrument Serif', which was never
 * actually loaded — so all 60 files using `font-heading` were rendering in
 * whatever generic serif the browser had. Instrument Sans is loaded properly
 * here and sits naturally beside Plus Jakarta: same geometric skeleton, a
 * little more editorial, and it takes the tight tracking the homepage uses.
 */
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  weight: ['400', '600', '700'],
  display: 'swap',
});

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew'],
  variable: '--font-hebrew',
  weight: ['400', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://poketschool.ai'),
  title: {
    default: 'Poket School — AI-Powered Learning for IGCSE, A Level & Beyond',
    template: '%s · Poket School',
  },
  description:
    'Adaptive AI learning built around how you think. ET AI tutors you one-to-one and turns any topic into lessons, quizzes, videos and audio across academic pathways.',
  applicationName: 'Poket School',
  keywords: ['IGCSE', 'A Level', 'AI tutor', 'online learning', 'Malaysia', 'SPM', 'Poket School'],
  authors: [{ name: 'Poket Media Sdn Bhd' }],
  openGraph: {
    type: 'website',
    siteName: 'Poket School',
    title: 'Poket School — AI-Powered Learning',
    description:
      'Adaptive AI learning built around how you think. ET AI tutors you, and builds your study materials.',
    locale: 'en_MY',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Poket School — AI-Powered Learning',
    description: 'ET AI tutors you, and builds your study materials.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans antialiased", plusJakarta.variable, instrumentSans.variable, notoArabic.variable, notoHebrew.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground" suppressHydrationWarning>
        <ThemeProvider>
        <AuthProvider>
          <I18nProvider>
          <WhiteLabelProvider>
            <SiteHeader />
            <TenantChrome />
            <div id="content">{children}</div>
            <SiteFooter />
            <CookieConsent />
            <Toaster />
          </WhiteLabelProvider>
          </I18nProvider>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
