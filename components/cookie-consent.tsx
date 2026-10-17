'use client';

/**
 * PDPA-compliant cookie consent.
 * Nothing beyond strictly-essential cookies runs until the visitor chooses.
 * The stored decision is read by analytics/AI-performance code via
 * `hasCookieConsent(category)`.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'poket-cookie-consent';

export interface CookiePrefs {
  essential: true;
  functional: boolean;
  analytics: boolean;
  aiPerformance: boolean;
  decidedAt: string;
}

/** Read a stored consent decision (SSR-safe). */
export function getCookiePrefs(): CookiePrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookiePrefs) : null;
  } catch {
    return null;
  }
}

/** True only when the visitor actively allowed that category. */
export function hasCookieConsent(category: 'functional' | 'analytics' | 'aiPerformance'): boolean {
  return !!getCookiePrefs()?.[category];
}

const CATEGORIES = [
  { key: 'essential', labelKey: 'cookie.essential', descKey: 'cookie.essentialDesc', locked: true },
  { key: 'functional', labelKey: 'cookie.functional', descKey: 'cookie.functionalDesc', locked: false },
  { key: 'analytics', labelKey: 'cookie.analytics', descKey: 'cookie.analyticsDesc', locked: false },
  { key: 'aiPerformance', labelKey: 'cookie.aiPerformance', descKey: 'cookie.aiPerformanceDesc', locked: false },
] as const;

export function CookieConsent() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [prefs, setPrefs] = useState({ functional: true, analytics: false, aiPerformance: false });

  useEffect(() => {
    // Only prompt when no decision has been recorded yet.
    if (!getCookiePrefs()) {
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const persist = (p: { functional: boolean; analytics: boolean; aiPerformance: boolean }) => {
    const record: CookiePrefs = { essential: true, ...p, decidedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch { /* private mode */ }
    setOpen(false);
    setManaging(false);
  };

  const acceptAll = () => persist({ functional: true, analytics: true, aiPerformance: true });
  const rejectAll = () => persist({ functional: false, analytics: false, aiPerformance: false });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className="fixed bottom-0 inset-x-0 z-[200] p-3 sm:p-5 print:hidden"
          role="dialog"
          aria-label={t('cookie.dialog')}
        >
          <div className="max-w-4xl mx-auto rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-[var(--ps-cyan-soft)] dark:bg-[var(--ps-cyan-soft)] flex items-center justify-center shrink-0">
                  <Cookie className="w-4.5 h-4.5 text-[var(--ps-cyan-text)]" />
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-foreground text-sm mb-1">{t('cookie.title')}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('cookie.intro')}{' '}
                    <Link href="/legal?doc=cookies" className="text-primary hover:underline font-medium">{t('cookie.cookiePolicy')}</Link>{' '}
                    {t('cookie.and')}{' '}
                    <Link href="/legal?doc=privacy" className="text-primary hover:underline font-medium">{t('cookie.privacyPolicy')}</Link>.
                  </p>
                </div>
                <button onClick={rejectAll} aria-label={t('cookie.close')} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <AnimatePresence>
                {managing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-2 pt-4 border-t border-border">
                      {CATEGORIES.map(c => {
                        const checked = c.locked ? true : prefs[c.key as keyof typeof prefs];
                        return (
                          <label
                            key={c.key}
                            className={`flex items-start gap-3 rounded-xl border border-border p-3 ${c.locked ? 'opacity-70' : 'cursor-pointer hover:bg-muted/50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={c.locked}
                              onChange={e => setPrefs(p => ({ ...p, [c.key]: e.target.checked }))}
                              className="mt-0.5 accent-primary w-4 h-4 shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-foreground">
                                {t(c.labelKey)}{c.locked && <span className="ms-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('cookie.alwaysOn')}</span>}
                              </span>
                              <span className="block text-xs text-muted-foreground leading-relaxed mt-0.5">{t(c.descKey)}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <button
                  onClick={acceptAll}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  {t('cookie.acceptAll')}
                </button>
                {managing ? (
                  <button
                    onClick={() => persist(prefs)}
                    className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    {t('cookie.saveChoices')}
                  </button>
                ) : (
                  <button
                    onClick={() => setManaging(true)}
                    className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    {t('cookie.manage')}
                  </button>
                )}
                <button
                  onClick={rejectAll}
                  className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  {t('cookie.reject')}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
