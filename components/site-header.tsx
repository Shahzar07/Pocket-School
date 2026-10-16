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

const NAV_LINKS = [
  { label: "Marketplace", href: "/courses" },
  { label: "AI Studio", href: "/ai-studio" },
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
  "/mode-preview",
  "/payments-preview",
  "/account-preview",
  "/teacher-studio",
  "/studio",
  "/a/",
];

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

  const isHidden =
    HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.includes("/session");

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
      <a className={styles.skip} href="#content">
        {t("landing.skip")}
      </a>
      <header className={`${styles.header} ${scrolled || !isLanding ? styles.scrolled : ""}`}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            <Globe size={25} />{" "}
            <span>
              Poket School <small>/ AI</small>
            </span>
          </Link>
          <nav className={styles.desktopNav} aria-label={t("header.mainNav")}>
            <Link href="/">{t("header.home")}</Link>
            <Link href="/courses">{t("header.courses")}</Link>
            <Link href="/ai-studio">{t("header.aiStudio")}</Link>
            <Link href="/ai-teachers">{t("header.aiTeachers")}</Link>
            <Link href="/reads">{t("nav.books")}</Link>
            <Link href="/pricing">{t("header.pricing")}</Link>
            {!user && <Link href="/login">{t("header.signIn")}</Link>}
          </nav>
          <div className={styles.headerTools}>
            <LanguageSwitcher tone={isLanding && !scrolled ? "onDark" : "default"} />
            <CurrencySwitcher tone={isLanding && !scrolled ? "onDark" : "default"} />
            <ThemeToggle onDark={isLanding && !scrolled} />
          </div>
          <Link className={styles.headerCta} href={user ? dashPath : "/signup"}>
            {user ? t("header.dashboard") : t("header.startFree")} <ArrowRight size={14} className="ps-dir-icon" />
          </Link>
          <button
            className={styles.menuButton}
            ref={menuButtonRef}
            type="button"
            aria-label={mobileOpen ? t("header.closeNav") : t("header.openNav")}
            aria-expanded={mobileOpen}
            aria-controls="site-navigation"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileOpen && (
          <nav
            className={styles.mobileNav}
            id="site-navigation"
            aria-label={t("header.mobileNav")}
            onClick={() => setMobileOpen(false)}
          >
            <Link href="/courses">{t("header.courses")}</Link>
            <Link href="/ai-studio">{t("header.aiStudio")}</Link>
            <Link href="/ai-teachers">{t("header.aiTeachers")}</Link>
            <Link href="/reads">{t("nav.books")}</Link>
            <Link href="/pricing">{t("header.pricing")}</Link>
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
