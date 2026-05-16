import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Pocket School — Studio',
  description: 'Generate audio lessons, video scripts, flashcards, quizzes and more from any source.',
};

export default function AiStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-[#0A0A0F] text-slate-100">
      {children}
    </div>
  );
}
