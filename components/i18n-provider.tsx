'use client';

import { useEffect, useRef } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { updateUser } from '@/lib/db';
import { isSupportedLanguage, readLanguage } from '@/lib/languages';
import { applyAppLanguage, detectAndStoreLanguage } from '@/lib/i18n/apply';

/**
 * Applies the saved or detected language once, then lets a signed-in profile
 * win on the first load for that account. A later click is not overwritten
 * by a profile snapshot that has not caught up yet.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, setProfile } = useAuthSTORE();
  const hydratedFor = useRef<string | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    detectAndStoreLanguage();
  }, []);

  useEffect(() => {
    if (!user) {
      hydratedFor.current = null;
      return;
    }
    if (!profile || hydratedFor.current === user.uid) return;
    hydratedFor.current = user.uid;
    const saved = profile.language;
    if (saved && isSupportedLanguage(saved)) {
      applyAppLanguage(saved);
      return;
    }
    const code = readLanguage();
    updateUser(user.uid, { language: code })
      .then(() => {
        const current = profileRef.current;
        if (current) setProfile({ ...current, language: code });
      })
      .catch(() => {});
  }, [user, profile, setProfile]);

  return children;
}
