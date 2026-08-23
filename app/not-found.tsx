import Link from 'next/link';
import { ArrowRight, BookOpen, Home, Sparkles, Tag } from 'lucide-react';

const LINKS = [
  { href: '/', label: 'Back home', desc: 'Start from the top', icon: Home },
  { href: '/courses', label: 'Marketplace', desc: 'Courses & past papers', icon: BookOpen },
  { href: '/ai-studio', label: 'AI Studio', desc: 'Create with ET', icon: Sparkles },
  { href: '/pricing', label: 'Pricing', desc: 'Plans & Sparks', icon: Tag },
];

export default function NotFound() {
  return (
    <main className="relative min-h-screen bg-white overflow-hidden flex items-center">
      {/* Ambient wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#EEF3FF] via-[#F5F1FF] to-white" aria-hidden />
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#1A73E8]/10 blur-3xl" aria-hidden />
      <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#F5B400]/10 blur-3xl" aria-hidden />

      <div className="relative w-full max-w-3xl mx-auto px-4 sm:px-6 py-28 lg:py-32 text-center">
        <p className="text-xs font-bold tracking-[0.25em] text-[#1A73E8] mb-6">PAGE NOT FOUND</p>

        <p
          className="font-heading text-[7rem] sm:text-[10rem] lg:text-[12rem] leading-[0.85] tracking-tight bg-gradient-to-r from-[#1A73E8] via-[#1E3A8A] to-[#1A73E8] bg-clip-text text-transparent select-none"
          aria-hidden
        >
          404
        </p>

        <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#0B1B3F] leading-[1.05] mt-6 mb-4">
          This page took a study break.
        </h1>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto">
          We could not find what you were looking for — the link may be old, or the page may have moved.
          Ayla is still here, and so is everything else.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-3 text-left">
          {LINKS.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-[#1A73E8]/40 hover:shadow-[0_20px_50px_-20px_rgba(26,115,232,0.25)] transition-all"
            >
              <span className="w-10 h-10 shrink-0 rounded-xl bg-[#EEF3FF] text-[#1A73E8] flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-extrabold text-[#0B1B3F]">{label}</span>
                <span className="block text-xs text-slate-500">{desc}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-slate-300 transition-all group-hover:text-[#1A73E8] group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>

        <p className="mt-10 text-xs text-slate-500">
          Think something is broken? Email{' '}
          <a
            href="mailto:support@poketschool.ai?subject=Broken%20link%20on%20Poket%20School"
            className="font-semibold text-[#1A73E8] hover:underline"
          >
            support@poketschool.ai
          </a>{' '}
          and we will fix it.
        </p>
      </div>
    </main>
  );
}
