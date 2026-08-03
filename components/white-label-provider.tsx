'use client';

/**
 * Resolves the current host to an institution and applies its branding.
 *
 * Runs client-side on purpose: the tenant lookup is a Firestore read, and
 * doing it in middleware would put a database round trip in front of every
 * request including static assets. The default branding renders immediately
 * and is replaced once the tenant resolves, so a slow lookup degrades to the
 * platform's own look rather than a blank page.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { getInstitutionBySubdomain, type Institution } from '@/lib/db';
import { subdomainFromHost, brandingFor, DEFAULT_BRANDING, type Branding } from '@/lib/white-label';

interface WhiteLabelValue {
  branding: Branding;
  institution: Institution | null;
  /** True until the tenant lookup settles. */
  resolving: boolean;
}

const WhiteLabelContext = createContext<WhiteLabelValue>({
  branding: DEFAULT_BRANDING,
  institution: null,
  resolving: false,
});

export function useWhiteLabel() {
  return useContext(WhiteLabelContext);
}

export function WhiteLabelProvider({ children }: { children: React.ReactNode }) {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const label = subdomainFromHost(window.location.hostname);
    if (!label) {
      setResolving(false);
      return;
    }
    getInstitutionBySubdomain(label)
      .then(found => { if (!cancelled) setInstitution(found); })
      // An unresolvable tenant falls back to platform branding rather than
      // erroring — a branding lookup must never take the app down.
      .catch(() => { if (!cancelled) setInstitution(null); })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, []);

  const branding = brandingFor(institution);

  // Push the tenant accent into the CSS variable the theme already uses, so
  // existing components pick it up without knowing about white-labelling.
  useEffect(() => {
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty('--primary', branding.primaryColor);
    } else {
      root.style.removeProperty('--primary');
    }
  }, [branding.primaryColor]);

  useEffect(() => {
    if (branding.isWhiteLabel) document.title = branding.displayName;
  }, [branding.isWhiteLabel, branding.displayName]);

  return (
    <WhiteLabelContext.Provider value={{ branding, institution, resolving }}>
      {children}
    </WhiteLabelContext.Provider>
  );
}
