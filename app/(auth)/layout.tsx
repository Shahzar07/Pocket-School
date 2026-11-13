'use client';

import Link from 'next/link';
import { BookOpen, Globe2, CalendarDays, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AcademyLockup } from '@/components/academy-lockup';
import { useWhiteLabel } from '@/components/white-label-provider';
import { Scene } from '@/components/poket-home/Brand';
import './auth.css';

const FEATURES = [
  { icon: MessageCircle, title: 'auth.f1title', desc: 'auth.f1desc' },
  { icon: BookOpen, title: 'auth.f2title', desc: 'auth.f2desc' },
  { icon: Globe2, title: 'auth.f3title', desc: 'auth.f3desc' },
  { icon: CalendarDays, title: 'auth.f4title', desc: 'auth.f4desc' },
];

/** Exam boards and frameworks the home page already names. */
const ALIGNED = ['Cambridge International', 'Pearson Edexcel', 'Oxford AQA', 'IB Diploma', 'IGCSE', 'A-Level'];

/**
 * Split screen. The story panel carries the sky, the headline, a drifting row
 * of glass cards and the boards the courses align with. The form panel is
 * plain paper with the legal links at the foot.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { branding } = useWhiteLabel();
  const accent = branding.isWhiteLabel && /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor ?? '') ? branding.primaryColor : undefined;
  const brand = (
    <AcademyLockup
      name={branding.isWhiteLabel ? branding.displayName : 'Poket'}
      logoUrl={branding.isWhiteLabel ? branding.logoUrl : null}
      accent={accent}
      powered={branding.isWhiteLabel && !branding.hidePoweredBy}
      tone="light"
    />
  );
  // Three copies so the row can loop without a visible seam.
  const reel = [...FEATURES, ...FEATURES, ...FEATURES];
  return (
    <div className="poket-auth pk-auth" style={{ fontFamily: 'var(--font-institution, var(--font-sans))' }}>
      <aside className="poket-auth__story" aria-label={t('auth.subtitle')}>
        <div className="poket-auth__sky" aria-hidden="true"><Scene scene="sky" /></div>
        <div className="pk-auth__bloom" aria-hidden="true" />

        <Link href="/" className="poket-auth__brand pk-in" style={{ animationDelay: '0ms' }}>{brand}</Link>

        <div className="pk-auth__mid">
          <div className="poket-auth__copy">
            <h1>
              <span className="pk-line"><span style={{ animationDelay: '120ms' }}>{t('auth.line1')}</span></span>
              <span className="pk-line"><span style={{ animationDelay: '210ms' }}>{t('auth.line2')}</span></span>
            </h1>
            <p className="pk-in" style={{ animationDelay: '420ms' }}>{t('auth.subtitle')}</p>
          </div>

          <div className="pk-reel" aria-hidden="true">
            <div className="pk-reel__track">
              {reel.map((feature, i) => (
                <figure key={i} className="pk-card pk-lift" style={{ animationDelay: `${560 + Math.min(i, 4) * 90}ms` }}>
                  <span className="pk-card__icon"><feature.icon /></span>
                  <figcaption>
                    <strong>{t(feature.title)}</strong>
                    <span>{t(feature.desc)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          {/* The same four points for screen readers, once. */}
          <ul className="sr-only">
            {FEATURES.map(feature => <li key={feature.title}>{t(feature.title)}. {t(feature.desc)}</li>)}
          </ul>

          {!branding.isWhiteLabel ? (
            <div className="pk-trust pk-in" style={{ animationDelay: '980ms' }}>
              <div className="pk-trust__rule"><span>Aligned with</span></div>
              <ul className="pk-marks">
                {ALIGNED.map(name => <li key={name}>{name}</li>)}
              </ul>
            </div>
          ) : null}
        </div>

        <p className="pk-legal pk-in" style={{ animationDelay: '1180ms' }}>
          © {new Date().getFullYear()} {branding.isWhiteLabel ? branding.displayName : 'Poket Media Sdn Bhd'}. All rights reserved.
        </p>
      </aside>

      <div className="poket-auth__form">
        <div className="poket-auth__language"><LanguageSwitcher /></div>
        <div className="poket-auth__form-inner pk-in" style={{ animationDelay: '260ms' }}>
          <Link href="/" className="poket-auth__mobile-brand">{brand}</Link>
          {children}
        </div>
        <nav className="pk-foot" aria-label="Legal">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/help">Support</Link>
        </nav>
      </div>
    </div>
  );
}
