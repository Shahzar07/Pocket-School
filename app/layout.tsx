import type { Metadata } from 'next';
import './globals.css';
import { Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { AuthProvider } from '@/components/auth-provider';
import { WhiteLabelProvider } from '@/components/white-label-provider';
import { Toaster } from "@/components/ui/sonner"
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CookieConsent } from '@/components/cookie-consent';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://poketschool.ai'),
  title: {
    default: 'Poket School — AI-Powered Learning for IGCSE, A Level & Beyond',
    template: '%s · Poket School',
  },
  description:
    'Adaptive AI learning built around how you think. Ayla tutors you one-to-one; ET turns any topic into lessons, quizzes, videos and audio across 9 academic pathways.',
  applicationName: 'Poket School',
  keywords: ['IGCSE', 'A Level', 'AI tutor', 'online learning', 'Malaysia', 'SPM', 'Poket School'],
  authors: [{ name: 'Poket Media Sdn Bhd' }],
  openGraph: {
    type: 'website',
    siteName: 'Poket School',
    title: 'Poket School — AI-Powered Learning',
    description:
      'Adaptive AI learning built around how you think. Ayla tutors you; ET builds your study materials.',
    locale: 'en_MY',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Poket School — AI-Powered Learning',
    description: 'Ayla tutors you. ET builds your study materials.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans antialiased", plusJakarta.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground" suppressHydrationWarning>
        <AuthProvider>
          <WhiteLabelProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
            <CookieConsent />
            <Toaster />
          </WhiteLabelProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
