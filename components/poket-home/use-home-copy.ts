"use client";
import { useTranslation } from "react-i18next";

/** Keep approved English art direction and reuse reviewed locale copy. */
export function useHomeCopy() {
  const { t, i18n } = useTranslation();
  const english = (i18n.resolvedLanguage ?? i18n.language ?? "en").startsWith(
    "en",
  );
  return (key: string, fallback: string) =>
    english ? fallback : t(key, { defaultValue: fallback });
}
