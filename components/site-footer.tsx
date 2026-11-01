"use client";

/**
 * One footer for every public page. Legal links, the rights line, and the
 * examination-board disclaimer stay visible.
 */

import Link from "next/link";
import { useWhiteLabel } from "@/components/white-label-provider";
import { isBrandedLoginPath } from "@/lib/institution-login";
import { isInstitutionJourneyPath } from "@/lib/institution-journey";
import { FooterColumns, FooterLegalRow } from "@/components/site-footer-columns";
import { PoketWordmark } from "@/components/poket-wordmark";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import styles from "./home-chrome.module.css";

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

function hidesSiteFooter(pathname: string): boolean {
  return (
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    isBrandedLoginPath(pathname) ||
    isInstitutionJourneyPath(pathname) ||
    pathname === "/offer" ||
    pathname.startsWith("/offer/")
  );
}

export function SiteFooter() {
  const { t } = useTranslation();
  const { branding } = useWhiteLabel();
  const pathname = usePathname() || "";
  const brandName = branding.isWhiteLabel ? branding.displayName : "Poket School";
  const powered = branding.isWhiteLabel && !branding.hidePoweredBy;
  if (hidesSiteFooter(pathname)) return null;

  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div>
          <Link href="/" className={styles.brand}>
            {branding.isWhiteLabel ? <span>{brandName}</span> : <PoketWordmark />}
          </Link>
          {powered && <p className="mt-2 text-xs">Powered by Poket School</p>}
          <p>
            {t("footer.tagline1")}
            <br />
            {t("footer.tagline2")}
          </p>
          <p>{t("footer.question")}<br /><a href="mailto:hello@poketschool.ai">hello@poketschool.ai ↗</a></p>
        </div>
        <FooterColumns tone="ink" />

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
}
