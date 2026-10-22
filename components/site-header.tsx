"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthSTORE } from "@/hooks/use-auth";
import { Globe, Menu, X, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isAdmin } from "@/lib/roles";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencySwitcher } from "@/components/currency-switcher";
import styles from "./home-chrome.module.css";
import { PromoBanner } from "@/components/promo-banner";
import { isBrandedLoginPath } from "@/lib/institution-login";
import { isInstitutionJourneyPath } from "@/lib/institution-journey";
import { MARKET_LINKS } from "@/lib/marketing/nav";

const NAV_LINKS = [
  { label: "Marketplace", href: "/courses" },
  { label: "ET AI Studio", href: "/ai-studio" },
  { label: "AI Teachers", href: "/ai-teachers" },
];

const HIDDEN_PREFIXES = [
  "/login",
  "/signup",
  "/dashboard",
  "/onboarding",
  "/ai-studio",
  "/ai-teachers",
  "/reads",
  "/preview",
  "/alerts",
  "/mode-preview",
  "/payments-preview",
  "/account-preview",
  "/teacher-studio",
  "/studio/essays",
  "/a/",
];

/** /offer is a standalone landing page with its own header. */
function hidesSiteChrome(pathname: string): boolean {
  return (
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    isBrandedLoginPath(pathname) ||
    isInstitutionJourneyPath(pathname) ||
    pathname === "/offer" ||
    pathname.startsWith("/offer/") ||
    pathname === "/p" ||
    pathname.startsWith("/p/") ||
    pathname === "/results" ||
    pathname.startsWith("/results/")
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user, profile } = useAuthSTORE();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const wide = window.matchMedia(
      pathname === "/" ? "(min-width: 801px)" : "(min-width: 768px)",
    );
    const closeOnResize = () => {
      if (wide.matches) setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    wide.addEventListener("change", closeOnResize);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      wide.removeEventListener("change", closeOnResize);
    };
  }, [mobileOpen, pathname]);

  const isHidden = hidesSiteChrome(pathname) || pathname.includes("/session");

  if (isHidden) return null;

  const isLanding = pathname === "/";

  const dashPath =
    profile?.role === "teacher"
      ? "/dashboard/teacher"
      : isAdmin(profile)
        ? "/dashboard/admin"
        : profile?.role === "parent"
          ? "/dashboard/parent"
          : "/dashboard/student";

  // One header for every public page. It used to render two entirely
  // different designs — a glass bar on the landing page and a separate
  // Tailwind bar everywhere else — so the header visibly changed as you
  // navigated. Only the transparency differs now, and only over the hero.
  return (
    <>
      <PromoBanner />
      <a className={styles.skip} href="#content">
        {t("landing.skip")}
      </a>
      <header
        className={`${styles.header} ${isLanding ? styles.headerFlow : styles.scrolled}`}
        data-site-header={isLanding ? "flow" : "fixed"}
      >
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.mark} aria-hidden>
              <Globe size={16} />
            </span>
            <span>
              Poket School <small>/ AI</small>
            </span>
          </Link>
          {!isLanding && (
            <nav className={styles.desktopNav} aria-label={t("header.mainNav")}>
              <Link href="/">{t("header.home")}</Link>
              <Link href="/courses">{t("header.courses")}</Link>
              <Link href="/ai-studio">{t("header.aiStudio")}</Link>
              <Link href="/dashboard/studio/maths">{t("header.etMaths")}</Link>
              <details className={styles.moreMenu}>
                <summary>{t("header.more")}</summary>
                <div className={styles.morePanel}>
                  <Link href="/dashboard/studio/exam-prep">{t("header.examPrep")}</Link>
                  <Link href="/ai-teachers">{t("header.aiTeachers")}</Link>
                  <Link href="/reads">{t("nav.books")}</Link>
                  <Link href="/pricing">{t("header.pricing")}</Link>
                  <Link href="/blog" aria-current={pathname.startsWith("/blog") ? "page" : undefined}>{t("header.blog")}</Link>
                  <Link href="/institutions/register">{t("header.forSchools")}</Link>
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[#1E6A83]">{t("header.programmes")}</p>
                  {MARKET_LINKS.map((item) => (
                    <Link key={item.href} href={item.href}>{item.label}</Link>
                  ))}
                </div>
              </details>
            </nav>
          )}
          <div className={styles.headerTools}>
            <LanguageSwitcher tone={isLanding && !scrolled ? "onDark" : "default"} />
            <CurrencySwitcher tone={isLanding && !scrolled ? "onDark" : "default"} />
            <ThemeToggle onDark={isLanding && !scrolled} />
          </div>
          {!user && (
            <Link className={styles.headerSign} href="/login">{t("header.signIn")}</Link>
          )}
          <Link className={styles.headerCta} href={user ? dashPath : "/signup"}>
            {user ? t("header.dashboard") : t("header.startFree")} <ArrowRight size={14} className="ps-dir-icon" />
          </Link>
          {!isLanding && <button
            className={styles.menuButton}
            ref={menuButtonRef}
            type="button"
            aria-label={mobileOpen ? t("header.closeNav") : t("header.openNav")}
            aria-expanded={mobileOpen}
            aria-controls="site-navigation"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>}
        </div>
        {!isLanding && mobileOpen && (
          <nav
            className={styles.mobileNav}
            id="site-navigation"
            aria-label={t("header.mobileNav")}
            onClick={() => setMobileOpen(false)}
          >
            <Link href="/courses">{t("header.courses")}</Link>
            <Link href="/ai-studio">{t("header.aiStudio")}</Link>
            <Link href="/dashboard/studio/maths">{t("header.etMaths")}</Link>
            <Link href="/dashboard/studio/exam-prep">{t("header.examPrep")}</Link>
            <Link href="/ai-teachers">{t("header.aiTeachers")}</Link>
            <Link href="/reads">{t("nav.books")}</Link>
            <Link href="/pricing">{t("header.pricing")}</Link>
            <Link href="/blog">{t("header.blog")}</Link>
            <Link href="/institutions/register">{t("header.forSchools")}</Link>
            {MARKET_LINKS.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
            <Link href={user ? dashPath : "/login"}>
              {user ? t("header.dashboard") : t("header.signIn")}
            </Link>
            <div className={styles.mobileTools} onClick={(event) => event.stopPropagation()}>
              <LanguageSwitcher />
              <CurrencySwitcher />
              <ThemeToggle />
            </div>
          </nav>
        )}
      </header>
      {/* The header is fixed, so non-landing pages need a spacer the height
          of the scrolled bar: 16px padding, ~44px content, 16px padding. */}
      {!isLanding && <div className="h-[76px]" aria-hidden />}
    </>
  );
}
