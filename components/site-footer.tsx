"use client";

/**
 * The site footer — one footer, rendered once from the root layout.
 *
 * This is the original liquid-glass footer design, with the legal content it
 * was missing folded in: working links to the legal documents (they used to
 * be href="#"), the PoketSchool.Ai copyright line, and the mandatory
 * examination-board non-affiliation disclaimer.
 *
 * Placement rules live here rather than in each page, so there is exactly one
 * place that decides whether a footer appears. Pages must not render their own.
 */

import Link from "next/link";
import { useWhiteLabel } from "@/components/white-label-provider";
import { isBrandedLoginPath } from "@/lib/institution-login";
import { isInstitutionJourneyPath } from "@/lib/institution-journey";
import { FooterColumns, FooterLegalRow } from "@/components/site-footer-columns";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Brain,
  Sparkles,
  Instagram,
  Twitter,
  Youtube,
  Facebook,
  Music2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./home-chrome.module.css";

/**
 * Routes with no footer: authenticated app chrome, immersive AI surfaces, and
 * the auth flows — a marketing footer under a login form is noise.
 */
const HIDDEN_PREFIXES = [
  "/dashboard",
  "/ai-studio",
  "/ai-teachers/",
  "/onboarding",
  "/verify",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/reads",
  "/studio/essays",
  "/preview/design",
  "/alerts",
];

/** /offer ships its own footer, including the operating-company line. */
function hidesSiteFooter(pathname: string): boolean {
  return (
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    isBrandedLoginPath(pathname) ||
    isInstitutionJourneyPath(pathname) ||
    pathname === "/offer" ||
    pathname.startsWith("/offer/")
  );
}

const FOOTER_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260429_114316_1c7889ad-2885-410e-b493-98119fee0ddb.mp4";

const SOCIALS = [
  { Icon: Instagram, label: "Instagram", href: "https://instagram.com" },
  { Icon: Twitter, label: "Twitter", href: "https://twitter.com" },
  { Icon: Youtube, label: "YouTube", href: "https://youtube.com" },
  { Icon: Facebook, label: "Facebook", href: "https://facebook.com" },
  { Icon: Music2, label: "TikTok", href: "https://tiktok.com" },
];

export function SiteFooter() {
  const { t } = useTranslation();
  const { branding } = useWhiteLabel();
  const pathname = usePathname() || "";
  const brandName = branding.isWhiteLabel ? branding.displayName : "Poket School";
  const powered = branding.isWhiteLabel && !branding.hidePoweredBy;
  if (hidesSiteFooter(pathname)) return null;

  if (pathname === "/")
    return (
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div>
            <Link href="/" className={styles.brand}>
              <Brain size={26} />
              <span>
                {brandName} <small>/ AI</small>
              </span>
            </Link>
            {powered && <p className="mt-2 text-xs">Powered by Poket School</p>}
            <p>
              {t("footer.tagline1")}
              <br />
              {t("footer.tagline2")}
            </p>
          </div>
          <FooterColumns tone="ink" />
          <div className={styles.contactCard}>
            <h2>{t("footer.keepLearning")}</h2>
            <p>{t("footer.question")}</p>
            <a href="mailto:hello@poketschool.ai">hello@poketschool.ai ↗</a>
          </div>
        </div>
        <div className={styles.legalLinks}>
          <FooterLegalRow tone="ink" />
        </div>
        <div className={styles.footerLegal}>
          <p>{t("footer.disclaimer")}</p>
          <p>
            {t("footer.rights", { year: new Date().getFullYear() })}
          </p>
        </div>
        <div className={styles.footerWordmark} aria-hidden="true">
          {brandName}
        </div>
      </footer>
    );

  // The video treatment belongs to the landing page; elsewhere it would drag a
  // large autoplaying asset onto pages that never asked for one.
  const withVideo = pathname === "/";

  return (
    <section className="relative w-full overflow-hidden bg-black print:hidden">
      {withVideo && (
        <>
          <video
            src={FOOTER_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
          <div className="absolute inset-0 bg-black/40 z-[1]" />
        </>
      )}

      <div
        className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-8 ${withVideo ? "pt-32 sm:pt-48" : "pt-12"}`}
      >
        <motion.footer
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="liquid-glass w-full rounded-3xl p-6 md:p-10 text-white/70"
        >
          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 mb-10">
            {/* Brand block */}
            <div className="md:col-span-5">
              <Link
                href="/"
                className="flex items-center gap-2 text-white mb-4 w-fit"
              >
                <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-white/20">
                  <Brain className="w-5 h-5" />
                </div>
                <span className="text-xl font-semibold">{brandName}</span>
                {powered && <span className="text-[11px] text-white/50">Powered by Poket School</span>}
              </Link>
              <p className="text-sm leading-relaxed max-w-sm text-white/60">
                {t("footer.blurb")}
              </p>
              <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-white/70">
                <Sparkles className="w-3 h-3 text-[#3FE0D0]" />
                {t("footer.badge")}
              </div>
            </div>

            {/* Link columns */}
            <div className="md:col-span-7">
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                <FooterColumns tone="glass" />
              </div>
              <div className="mt-6 border-t border-white/15 pt-4">
                <FooterLegalRow tone="glass" />
              </div>
            </div>
          </div>

          {/* Mandatory non-affiliation disclaimer — must be visible, not buried */}
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 mb-8">
            <p className="text-[11px] leading-relaxed text-white/55">
              {t("footer.disclaimer")}
            </p>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
            <p className="text-[10px] uppercase tracking-widest opacity-50 text-center md:text-left">
              {t("footer.rights", { year: new Date().getFullYear() })}
            </p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase tracking-widest opacity-50">
                {t("footer.follow")}
              </span>
              <div className="flex items-center gap-3">
                {SOCIALS.map(({ Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="opacity-70 hover:opacity-100 transition-opacity hover:text-white"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </motion.footer>
      </div>
    </section>
  );
}
