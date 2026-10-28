import type { Metadata } from 'next';
import './globals.css';
import { Plus_Jakarta_Sans, Noto_Sans_Arabic, Noto_Sans_Hebrew, Noto_Sans_Tamil, DM_Sans, DM_Serif_Display } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppChrome } from '@/components/app-chrome';

/** Body and UI. The homepage is built on this, so it stays the base face. */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  weight: ['400', '600', '700'],
  display: 'swap',
  preload: false,
});

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew'],
  variable: '--font-hebrew',
  weight: ['400', '600', '700'],
  display: 'swap',
  preload: false,
});

const notoTamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  variable: '--font-tamil',
  weight: ['400', '600', '700'],
  display: 'swap',
  preload: false,
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif',
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
    <html lang="en" className={cn("font-sans antialiased", plusJakarta.variable, notoArabic.variable, notoHebrew.variable, notoTamil.variable, dmSans.variable, dmSerif.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground" suppressHydrationWarning>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
