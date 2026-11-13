'use client';

import { motion } from 'motion/react';
import { ArrowLeft, Brain, BookOpen, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AcademyLockup } from '@/components/academy-lockup';
import { useWhiteLabel } from '@/components/white-label-provider';
import { accentInk } from '@/lib/white-label';

const FEATURES = [
  { icon: <Brain className="h-4 w-4" />, title: 'auth.f1title', desc: 'auth.f1desc' },
  { icon: <BookOpen className="h-4 w-4" />, title: 'auth.f2title', desc: 'auth.f2desc' },
  { icon: <Sparkles className="h-4 w-4" />, title: 'auth.f3title', desc: 'auth.f3desc' },
  { icon: <Trophy className="h-4 w-4" />, title: 'auth.f4title', desc: 'auth.f4desc' },
];

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Sign-in and sign-up share the home page's surface: the light page colour,
 * one white card, the heading face, and a single teal panel. The form sits on
 * the left so the first thing read is the task, not the artwork.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { branding } = useWhiteLabel();
  const accent = branding.isWhiteLabel && /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor ?? '') ? branding.primaryColor : '';
  const ink = accent ? accentInk(accent) : '';
  return (
    <div
      className="relative flex min-h-dvh bg-background text-foreground"
      style={{ fontFamily: 'var(--font-institution), inherit' }}
    >
      {/* ── Form column ── */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-10 sm:py-6">
          <Link href="/" className="flex w-fit items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <AcademyLockup
              name={branding.isWhiteLabel ? branding.displayName : 'Poket School'}
              logoUrl={branding.isWhiteLabel ? branding.logoUrl : null}
              accent={accent || undefined}
              powered={branding.isWhiteLabel && !branding.hidePoweredBy}
              tone="light"
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t('header.home')}
            </Link>
            <LanguageSwitcher />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-12 pt-2 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="w-full max-w-[30rem] rounded-[2rem] border border-border bg-card p-6 shadow-[0_24px_60px_-28px_rgba(32,51,55,0.28)] sm:p-9"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* ── Brand panel ── */}
      <div className="sticky top-0 hidden h-dvh w-[46%] max-w-[46rem] shrink-0 p-4 lg:block">
        <div
          className="relative flex h-full flex-col justify-between overflow-hidden rounded-[2rem] p-10 xl:p-12"
          style={{ background: 'linear-gradient(155deg, #0B1417 0%, #123A47 34%, #1E6A83 68%, #2786A4 100%)' }}
          data-auth-panel="brand"
        >
          {/* Soft light in the corner and a hairline grid, the same quiet depth as the home hero. */}
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: accent || 'var(--ps-cyan)' }} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse at 70% 20%, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 70% 20%, black 0%, transparent 70%)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="relative"
          >
            <p className="text-sm font-medium text-white/70">{t('auth.subtitle')}</p>
            <h1 className="mt-4 font-heading text-[2.75rem] leading-[1.04] tracking-tight text-white xl:text-[3.25rem]">
              {t('auth.line1')}
              <br />
              <span className="underline decoration-[3px] underline-offset-[10px]" style={{ textDecorationColor: accent || 'var(--ps-cyan)' }}>
                {t('auth.line2')}
              </span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
            className="relative rounded-[1.75rem] bg-white p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]"
          >
            <ul className="divide-y divide-[#E7EDED]">
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f.title}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.3 + i * 0.08, ease: EASE }}
                  className="flex items-center gap-3.5 px-4 py-3.5"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={accent ? { background: accent, color: ink } : { background: 'rgba(63, 224, 208, 0.18)', color: '#1E6A83' }}
                  >
                    {f.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight text-[#203337]">{t(f.title)}</span>
                    <span className="mt-0.5 block text-xs text-[#203337]/60">{t(f.desc)}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
