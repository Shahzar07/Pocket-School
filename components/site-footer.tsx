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
import { IconMark } from "@/components/design/icons";
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
            <span className={styles.mark} aria-hidden>
              <IconMark size={16} />
            </span>
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
}
