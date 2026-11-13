import i18n from "@/lib/i18n";
import { homeDesignEn } from "@/lib/i18n/poket-home";

export function homeText(key: keyof typeof homeDesignEn): string {
  return i18n.t(`homeDesign.${key}`, { defaultValue: homeDesignEn[key] });
}
