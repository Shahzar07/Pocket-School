"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthSTORE } from "@/hooks/use-auth";
import { Globe, Menu, X, ArrowRight } from "lucide-react";
import { isAdmin } from "@/lib/roles";
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
];

export function SiteHeader() {
  const pathname = usePathname();
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
      <header className={`${styles.header} ${scrolled || !isLanding ? styles.scrolled : ""}`}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            <Globe size={25} />{" "}
            <span>
              Poket School <small>/ AI</small>
            </span>
          </Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <Link href="/">Home</Link>
            <Link href="/courses">Courses</Link>
            <Link href="/ai-studio">AI Studio</Link>
            <Link href="/ai-teachers">AI Teachers</Link>
            <Link href="/pricing">Pricing</Link>
            {!user && <Link href="/login">Sign in</Link>}
          </nav>
          <Link className={styles.headerCta} href={user ? dashPath : "/signup"}>
            {user ? "Dashboard" : "Start for free"} <ArrowRight size={14} />
          </Link>
          <button
            className={styles.menuButton}
            ref={menuButtonRef}
            type="button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
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
            aria-label="Mobile navigation"
            onClick={() => setMobileOpen(false)}
          >
            <Link href="/courses">Courses</Link>
            <Link href="/ai-studio">AI Studio</Link>
            <Link href="/ai-teachers">AI Teachers</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href={user ? dashPath : "/login"}>
              {user ? "Dashboard" : "Sign in"}
            </Link>
          </nav>
        )}
      </header>
      {/* The header is fixed, so non-landing pages need a spacer the height
          of the scrolled bar: 16px padding, ~44px content, 16px padding. */}
      {!isLanding && <div className="h-[76px]" aria-hidden />}
    </>
  );
}
