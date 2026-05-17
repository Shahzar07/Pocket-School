'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { AI_TEACHERS } from '@/lib/ai-teachers';

export default function TeacherSessionPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const router = useRouter();
  const { user, loading } = useAuthSTORE();
  const teacher = AI_TEACHERS.find((t) => t.id === teacherId);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(`/ai-teachers/${teacherId}/session`)}`);
    }
  }, [loading, user, router, teacherId]);

  if (!teacher) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg mb-4">Teacher not found.</p>
          <Link href="/ai-teachers" className="text-blue-400 underline">Back to AI Teachers</Link>
        </div>
      </div>
    );
  }

  if (teacher.status !== 'live' || !teacher.iframeUrl) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-xs font-bold tracking-widest text-amber-400 mb-3">COMING SOON</p>
          <h1 className="text-3xl font-black mb-3">{teacher.name}</h1>
          <p className="text-sm text-white/70 mb-6">{teacher.tagline}</p>
          <Link
            href="/ai-teachers"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-sm font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to AI Teachers
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0A0A0F] text-white flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0 z-10">
        <Link href="/ai-teachers" className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to AI Teachers</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-bold tracking-widest text-white/90 uppercase">Live · {teacher.name}</span>
        </div>
        <button
          onClick={() => window.close()}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="End session"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Full-bleed iframe — LiveAvatar provides native chat, voice, mic, speaker, end controls */}
      <main className="flex-1 relative bg-black">
        <iframe
          src={teacher.iframeUrl}
          allow="microphone; autoplay; camera; clipboard-read; clipboard-write"
          allowFullScreen
          title={`Live conversation with ${teacher.name}`}
          className="absolute inset-0 w-full h-full border-0"
        />
      </main>
    </div>
  );
}
