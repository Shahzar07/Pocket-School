import type { Metadata } from 'next';
import { WelcomePing } from '@/components/onboarding/welcome-ping';

export const metadata: Metadata = {
  title: 'ET AI Studio · Poket School',
  description: 'ET AI turns a topic into a lesson, quiz, flashcards, audio or video at Poket School.',
};

export default function AiStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WelcomePing />
      {children}
    </div>
  );
}
