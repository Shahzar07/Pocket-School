'use client';

/**
 * Resolves the current host, or `/a/{slug}`, to an institution and applies its branding.
 *
 * The lookup stays on the client. Middleware only marks the tenant; it does not
 * call Firestore. A renamed slug redirects to the current address. On the path
 * fallback, in-app links keep the `/a/{slug}` prefix so the apex site stays
 * unbranded.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getInstitutionByDomain, getInstitutionBySubdomain, type Institution } from '@/lib/db';
import { brandingFor, DEFAULT_BRANDING, type Branding } from '@/lib/white-label';
import { brandFontStack } from '@/lib/enterprise';
import { prefixAcademyHref, renameRedirect, tenantFromRequest, type TenantRequest } from '@/lib/tenant-host';

interface WhiteLabelValue {
  branding: Branding;
  institution: Institution | null;
  /** True until the tenant lookup settles. */
  resolving: boolean;
  mode: TenantRequest['kind'];
  /** Prefixes an internal link while the visitor is on `/a/{slug}`. */
  hrefFor: (href: string) => string;
}

const WhiteLabelContext = createContext<WhiteLabelValue>({
  branding: DEFAULT_BRANDING,
  institution: null,
  resolving: false,
  mode: 'platform',
  hrefFor: (href) => href,
});

export function useWhiteLabel() {
  return useContext(WhiteLabelContext);
}

export function WhiteLabelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [resolving, setResolving] = useState(true);
  const [mode, setMode] = useState<TenantRequest['kind']>('platform');
  const [pathSlug, setPathSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hostname = window.location.hostname;
    const request = tenantFromRequest(hostname, pathname);
    setMode(request.kind);
    setPathSlug(request.kind === 'path' ? request.slug : null);
    if (request.kind === 'platform') {
      setInstitution(null);
      setResolving(false);
      return;
    }
    setResolving(true);
    const lookup = request.kind === 'custom'
      ? getInstitutionByDomain(request.hostname)
      : getInstitutionBySubdomain(request.slug);
    lookup
      .then((found) => {
        if (cancelled) return;
        const requested = request.kind === 'custom' ? '' : request.slug;
        const current = found?.subdomain ?? '';
        if (found && requested && current && current !== requested && (request.kind === 'path' || request.kind === 'subdomain')) {
          const target = renameRedirect({
            requestedSlug: requested,
            currentSlug: current,
            mode: request.kind,
            pathname: window.location.pathname,
            search: window.location.search,
          });
          if (target) {
            window.location.replace(target);
            return;
          }
        }
        setInstitution(found);
      })
      .catch(() => { if (!cancelled) setInstitution(null); })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    if (mode !== 'path' || !pathSlug) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/a/')) return;
      if (anchor.target && anchor.target !== '_self') return;
      event.preventDefault();
      window.location.assign(prefixAcademyHref(href, pathSlug));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [mode, pathSlug]);

  const branding = brandingFor(institution);
  const hrefFor = useMemo(
    () => (href: string) => prefixAcademyHref(href, mode === 'path' ? pathSlug : null),
    [mode, pathSlug],
  );

  useEffect(() => {
    const root = document.documentElement;
    if (branding.primaryColor) root.style.setProperty('--primary', branding.primaryColor);
    else root.style.removeProperty('--primary');
  }, [branding.primaryColor]);

  useEffect(() => {
    if (branding.isWhiteLabel) document.title = branding.displayName;
  }, [branding.isWhiteLabel, branding.displayName]);

  useEffect(() => {
    const root = document.documentElement;
    const stack = brandFontStack(branding.fontId);
    if (stack) root.style.setProperty('--font-institution', stack);
    else root.style.removeProperty('--font-institution');
    if (branding.secondaryColor) root.style.setProperty('--accent', branding.secondaryColor);
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (branding.faviconUrl && icon) icon.href = branding.faviconUrl;
    if (institution?.defaultLocale) root.lang = institution.defaultLocale;
  }, [branding.fontId, branding.secondaryColor, branding.faviconUrl, institution?.defaultLocale]);

  return (
    <WhiteLabelContext.Provider value={{ branding, institution, resolving, mode, hrefFor }}>
      {children}
    </WhiteLabelContext.Provider>
  );
}
