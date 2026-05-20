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

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  if (!teacher) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0F] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg mb-4">Teacher not found.</p>
          <Link href="/ai-teachers" className="text-blue-400 underline">Back to AI Teachers</Link>
        </div>
      </div>
    );
  }

  if (teacher.status !== 'live' || !teacher.iframeUrl) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0F] text-white flex items-center justify-center px-4">
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
      <div className="fixed inset-0 bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#07070E] text-white overflow-hidden flex flex-col">
      {/* Compact top bar */}
      <header className="h-12 px-4 sm:px-5 flex items-center justify-between border-b border-white/[0.06] shrink-0 bg-[#0D0D18]">
        <Link
          href="/ai-teachers"
          className="flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">AI Teachers</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-bold tracking-widest text-white/80 uppercase truncate max-w-[180px] sm:max-w-none">
            Live · {teacher.name}
          </span>
        </div>

        <button
          onClick={() => window.close()}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white/90 transition-colors px-2.5 py-1 rounded-full hover:bg-white/[0.07]"
          title="End session"
        >
          <X className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">End</span>
        </button>
      </header>

      {/* Session canvas — minimal padding so the iframe gets maximum usable area */}
      <main className="flex-1 min-h-0 relative bg-[#07070E] p-2 sm:p-3">
        <div
          className="absolute inset-2 sm:inset-3 rounded-xl sm:rounded-2xl overflow-hidden border border-white/[0.08] bg-black"
          style={{ boxShadow: '0 0 60px -12px rgba(99, 77, 255, 0.3)' }}
        >
          <iframe
            src={teacher.iframeUrl}
            allow="microphone; autoplay; camera; clipboard-read; clipboard-write"
            allowFullScreen
            title={`Live conversation with ${teacher.name}`}
            className="absolute inset-0 w-full h-full border-0 block"
          />
        </div>
      </main>
    </div>
  );
}
