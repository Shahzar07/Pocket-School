import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Poket School — Studio',
  description: 'Generate audio lessons, video scripts, flashcards, quizzes and more from any source.',
};

export default function AiStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
