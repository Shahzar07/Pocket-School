import type {Metadata} from 'next';
import './globals.css';
import { Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { AuthProvider } from '@/components/auth-provider';
import { Toaster } from "@/components/ui/sonner"
import { SiteHeader } from '@/components/site-header';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pocket School — AI-Powered Learning',
  description: 'Upload any material. AI transforms it into podcasts, flashcards, quizzes and 11 more formats tailored to how you learn best.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans antialiased", plusJakarta.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground" suppressHydrationWarning>
        <AuthProvider>
          <SiteHeader />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
