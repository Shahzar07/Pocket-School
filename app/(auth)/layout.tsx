'use client';

import { motion } from 'motion/react';
import { Brain, BookOpen, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AcademyLockup } from '@/components/academy-lockup';
import { useWhiteLabel } from '@/components/white-label-provider';
import { accentInk } from '@/lib/white-label';
import { dark, light } from '@/lib/design/tokens';

const FEATURES = [
  { icon: <Brain className="w-4 h-4" />, title: 'auth.f1title', desc: 'auth.f1desc' },
  { icon: <BookOpen className="w-4 h-4" />, title: 'auth.f2title', desc: 'auth.f2desc' },
  { icon: <Sparkles className="w-4 h-4" />, title: 'auth.f3title', desc: 'auth.f3desc' },
  { icon: <Trophy className="w-4 h-4" />, title: 'auth.f4title', desc: 'auth.f4desc' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { branding } = useWhiteLabel();
  const accent = branding.isWhiteLabel && /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor ?? '') ? branding.primaryColor : '';
  const ink = accent ? accentInk(accent) : '#ffffff';
  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-institution), inherit', background: dark.bg }}>
      {/* ── Left: video hero panel ── */}
      <div className="hidden lg:block w-[52%] shrink-0 p-5">
        <div className="relative w-full h-full rounded-3xl overflow-hidden bg-black min-h-[calc(100vh-2.5rem)]">
          {/* Video — NO overlay/tint */}
          <video
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Floating content — no full-screen overlay, text/cards carry their own blur */}
          <div className="relative z-10 h-full flex flex-col justify-between p-10">
            {/* Logo */}
            <Link href="/" className="flex w-fit drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
              <AcademyLockup
                name={branding.displayName}
                logoUrl={branding.isWhiteLabel ? branding.logoUrl : null}
                accent={accent || undefined}
                powered={branding.isWhiteLabel && !branding.hidePoweredBy}
              />
            </Link>

            {/* Hero text + feature cards */}
            <div className="space-y-7">
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="font-heading text-[2.6rem] leading-[1.1] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] mb-3">
                  {t('auth.line1')}<br />
                  <em>{t('auth.line2')}</em>
                </h1>
                <p className="text-white/70 text-sm leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                  {t('auth.subtitle')}
                </p>
              </motion.div>

              <div className="space-y-2.5">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.35 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3 bg-black/25 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10"
                  >
                    <div className="backdrop-blur-sm p-2 rounded-lg shrink-0" style={{ background: accent || light.primary, color: ink }}>
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold leading-tight">{t(f.title)}</p>
                      <p className="text-white/50 text-xs mt-0.5">{t(f.desc)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: form area ── */}
      <div className="relative flex-1 flex items-center justify-center px-8 py-12" style={{ background: dark.bg }}>
        <div className="absolute top-4 end-4 z-20">
          <LanguageSwitcher tone="onDark" />
        </div>
        <div className="w-full max-w-md">
          {/* Mobile-only logo */}
          <div className="lg:hidden mb-10">
            <AcademyLockup
              name={branding.isWhiteLabel ? branding.displayName : 'Poket School'}
              logoUrl={branding.isWhiteLabel ? branding.logoUrl : null}
              accent={accent || light.primary}
              powered={branding.isWhiteLabel && !branding.hidePoweredBy}
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
