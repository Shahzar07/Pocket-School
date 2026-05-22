'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthSTORE } from '@/hooks/use-auth';
import { Globe, Menu, X, ArrowRight } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Marketplace', href: '/courses' },
  { label: 'AI Studio', href: '/ai-studio' },
  { label: 'AI Teachers', href: '/ai-teachers' },
];

const HIDDEN_PREFIXES = ['/login', '/signup', '/dashboard', '/onboarding'];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, profile } = useAuthSTORE();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isHidden =
    HIDDEN_PREFIXES.some(p => pathname.startsWith(p)) ||
    pathname.includes('/session');

  if (isHidden) return null;

  const isLanding = pathname === '/';
  const useGlass = isLanding && !scrolled;

  const dashPath =
    profile?.role === 'teacher' ? '/dashboard/teacher' :
    profile?.role === 'admin'   ? '/dashboard/admin'   :
    profile?.role === 'parent'  ? '/dashboard/parent'  :
    '/dashboard/student';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          useGlass ? 'px-6 py-4' : 'px-0 py-0 border-b border-border'
        }`}
      >
        <div
          className={`flex items-center justify-between transition-all duration-300 ${
            useGlass
              ? 'liquid-glass rounded-full px-6 py-3 max-w-5xl mx-auto'
              : 'bg-white/90 backdrop-blur-xl px-6 h-14 max-w-none'
          }`}
        >
          {/* Logo */}
          <div className="flex items-center gap-7">
            <Link href="/" className="flex items-center gap-2">
              {useGlass ? (
                <Globe className="w-5 h-5 text-white" />
              ) : (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#1A73E8] to-[#1E3A8A] flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <span
                className={`font-semibold text-[15px] transition-colors ${
                  useGlass ? 'text-white' : 'text-foreground'
                }`}
              >
                Pocket School
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-5">
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === href
                      ? useGlass ? 'text-white' : 'text-[#1A73E8]'
                      : useGlass ? 'text-white/75 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Auth (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                href={dashPath}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                  useGlass
                    ? 'liquid-glass text-white hover:bg-white/5'
                    : 'bg-[#1A73E8] text-white hover:bg-[#1557B0] shadow-md shadow-blue-900/20'
                }`}
              >
                <span className="inline-flex w-6 h-6 rounded-full bg-[#1A73E8] items-center justify-center text-[10px] font-bold uppercase">
                  {(user.displayName || user.email || 'U')[0]}
                </span>
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className={`text-sm font-medium transition-colors ${
                    useGlass ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    useGlass
                      ? 'liquid-glass text-white hover:bg-white/5'
                      : 'bg-[#1A73E8] text-white hover:bg-[#1557B0] shadow-md shadow-blue-900/20'
                  }`}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className={`md:hidden p-2 rounded-lg transition-colors ${
              useGlass ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'
            }`}
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden mx-4 mt-2 rounded-2xl overflow-hidden bg-white/95 backdrop-blur-xl border border-border shadow-xl">
            <div className="px-4 py-4 flex flex-col gap-3">
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className={`text-sm font-medium py-1 ${
                    pathname === href ? 'text-[#1A73E8]' : 'text-foreground'
                  }`}
                >
                  {label}
                </Link>
              ))}
              <div className="border-t border-border pt-3 flex flex-col gap-2">
                {user ? (
                  <Link href={dashPath} className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className="inline-flex w-6 h-6 rounded-full bg-[#1A73E8] items-center justify-center text-[10px] font-bold text-white uppercase">
                      {(user.displayName || user.email || 'U')[0]}
                    </span>
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="text-sm font-medium text-muted-foreground">Sign In</Link>
                    <Link
                      href="/signup"
                      className="flex items-center justify-center gap-2 rounded-xl h-10 text-sm font-semibold bg-[#1A73E8] text-white"
                    >
                      Get Started <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Spacer so content doesn't hide under fixed header (non-landing pages) */}
      {!isLanding && <div className="h-14" />}
    </>
  );
}
