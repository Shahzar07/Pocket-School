'use client';

import Link from 'next/link';
import { BookOpen, Globe2, CalendarDays, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AcademyLockup } from '@/components/academy-lockup';
import { useWhiteLabel } from '@/components/white-label-provider';
import { Scene } from '@/components/poket-home/Brand';

const FEATURES = [
  { icon: MessageCircle, title: 'auth.f1title', desc: 'auth.f1desc' },
  { icon: BookOpen, title: 'auth.f2title', desc: 'auth.f2desc' },
  { icon: Globe2, title: 'auth.f3title', desc: 'auth.f3desc' },
  { icon: CalendarDays, title: 'auth.f4title', desc: 'auth.f4desc' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { branding } = useWhiteLabel();
  const accent = branding.isWhiteLabel && /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor ?? '') ? branding.primaryColor : undefined;
  const brand = <AcademyLockup name={branding.isWhiteLabel ? branding.displayName : 'Poket'} logoUrl={branding.isWhiteLabel ? branding.logoUrl : null} accent={accent} powered={branding.isWhiteLabel && !branding.hidePoweredBy} tone="light" />;
  return <div className="poket-auth" style={{ fontFamily: 'var(--font-institution, var(--font-sans))' }}>
    <aside className="poket-auth__story" aria-label={t("auth.subtitle")}>
      <div className="poket-auth__sky" aria-hidden="true"><Scene scene="sky" /></div>
      <Link href="/" className="poket-auth__brand">{brand}</Link>
      <div className="poket-auth__copy"><h1>{t('auth.line1')}<br />{t('auth.line2')}</h1><p>{t('auth.subtitle')}</p></div>
      <div className="poket-auth__features">{FEATURES.map(feature => <div key={feature.title}><feature.icon /><strong>{t(feature.title)}</strong><p>{t(feature.desc)}</p></div>)}</div>
    </aside>
    <div className="poket-auth__form"><div className="poket-auth__language"><LanguageSwitcher /></div><div className="poket-auth__form-inner"><Link href="/" className="poket-auth__mobile-brand">{brand}</Link>{children}</div></div>
  </div>;
}
