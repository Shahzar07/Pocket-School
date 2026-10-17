'use client';

import { useEffect, useState } from 'react';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { InstitutionLoginScreen } from '@/components/institution-login-screen';
import { auth, storage } from '@/lib/firebase';
import { isSubdomainAvailable, updateInstitution, type Institution } from '@/lib/db';
import { slugAvailabilityLabel } from '@/lib/institution-journey';
import { normaliseCustomDomain } from '@/lib/oem';
import { cnameInstructions, normaliseSubdomain } from '@/lib/tenant-host';

const field = 'mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm';

export function BrandedLoginStep({
  institution,
  preview = false,
  onSaved,
}: {
  institution: Pick<Institution, 'id' | 'name' | 'plan' | 'subdomain' | 'customDomain' | 'customDomainMessage' | 'branding'>;
  preview?: boolean;
  onSaved?: (patch: Partial<Institution>) => void;
}) {
  const branding = institution.branding ?? {};
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl ?? '');
  const [primary, setPrimary] = useState(branding.primaryColor || '#1A3C34');
  const [secondary, setSecondary] = useState(branding.secondaryColor || '#C8922A');
  const [slug, setSlug] = useState(institution.subdomain || (preview ? 'rochfords' : ''));
  const [domain, setDomain] = useState(institution.customDomain || (preview ? 'learn.rochfords.example' : ''));
  const [published, setPublished] = useState(branding.loginPublished === true || (preview && Boolean(institution.subdomain)));
  const [slugNote, setSlugNote] = useState(preview ? slugAvailabilityLabel('rochfords', true) : '');
  const [domainNote, setDomainNote] = useState(institution.customDomainMessage || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const schoolName = branding.displayName || institution.name || 'Academy';
  const normalised = normaliseSubdomain(slug);
  const domainHost = normaliseCustomDomain(domain);
  const dns = domainHost ? cnameInstructions(domainHost) : null;

  useEffect(() => {
    if (preview) return;
    if (!slug.trim()) {
      setSlugNote('');
      return;
    }
    const normal = normaliseSubdomain(slug);
    if (!normal) {
      setSlugNote(slugAvailabilityLabel(slug, null));
      return;
    }
    let cancelled = false;
    setSlugNote(slugAvailabilityLabel(normal, null));
    const timer = window.setTimeout(() => {
      void isSubdomainAvailable(normal, institution.id)
        .then((free) => {
          if (!cancelled) setSlugNote(slugAvailabilityLabel(normal, free));
        })
        .catch(() => {
          if (!cancelled) setSlugNote('Could not check that address. Try again.');
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug, institution.id, preview]);

  const uploadLogo = async (file: File) => {
    if (preview) {
      setLogoUrl(URL.createObjectURL(file));
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('Sign in again to upload a logo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const path = `media/${uid}/institution-logo-${Date.now()}`;
      const stored = storageRef(storage, path);
      await uploadBytes(stored, file, { contentType: file.type || 'image/png' });
      setLogoUrl(await getDownloadURL(stored));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that logo.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (nextPublished: boolean) => {
    if (preview) {
      setPublished(nextPublished);
      return;
    }
    if (nextPublished && !normalised) {
      setError('Choose an available address before publishing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (nextPublished && normalised) {
        const free = await isSubdomainAvailable(normalised, institution.id);
        if (!free) {
          setSlugNote(slugAvailabilityLabel(normalised, false));
          setError('That address is already in use.');
          return;
        }
      }
      const patch: Partial<Institution> = {
        ...(normalised ? { subdomain: normalised } : {}),
        branding: {
          ...branding,
          displayName: branding.displayName || schoolName,
          logoUrl,
          primaryColor: primary,
          secondaryColor: secondary,
          loginPublished: nextPublished,
        },
      };
      await updateInstitution(institution.id, patch);
      setPublished(nextPublished);
      onSaved?.(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the login page.');
    } finally {
      setBusy(false);
    }
  };

  const attachDomain = async () => {
    if (!domainHost || !dns) {
      setError('Enter a hostname the academy owns, such as learn.rochfords.example.');
      return;
    }
    if (preview) {
      setDomainNote(dns.note);
      return;
    }
    const current = auth.currentUser;
    if (!current) {
      setError('Sign in again to attach a domain.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const token = await current.getIdToken();
      const res = await fetch('/api/institutions/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ institutionId: institution.id, domain: domainHost }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
      setDomainNote(data.message || data.error || dns.note);
      if (!res.ok && res.status !== 403) setError(data.error || 'Could not attach that domain.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach that domain.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="branded-login" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Logo
          <input
            aria-label="Academy logo"
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
        </label>
        <label className="block text-sm font-medium">
          Primary colour
          <input aria-label="Primary colour" type="color" value={/^#[0-9a-fA-F]{6}$/.test(primary) ? primary : '#1A3C34'} onChange={(event) => setPrimary(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background" />
        </label>
        <label className="block text-sm font-medium">
          Secondary colour
          <input aria-label="Secondary colour" type="color" value={/^#[0-9a-fA-F]{6}$/.test(secondary) ? secondary : '#C8922A'} onChange={(event) => setSecondary(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background" />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Address
          <span className="mt-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">poketschool.ai/i/</span>
            <input
              aria-label="Login address"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="rochfords"
              className={field}
            />
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">{slugNote || 'For example, poketschool.ai/i/rochfords.'}</span>
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Custom domain or subdomain
          <input
            aria-label="Custom domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="learn.rochfords.example"
            className={field}
          />
        </label>
      </div>
      {dns && (
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-semibold">DNS</p>
          <p className="mt-1">{dns.note}</p>
          <p className="mt-2 font-mono text-xs">{dns.type} {dns.host} → {dns.value}</p>
          {domainNote && <p className="mt-2 text-muted-foreground">{domainNote}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            {institution.plan === 'enterprise' || institution.plan === 'oem'
              ? 'Enterprise and OEM plans attach this hostname on Vercel.'
              : 'A custom hostname is attached on Enterprise and OEM plans. The poketschool.ai/i address works on every plan.'}
          </p>
          <button type="button" className="mt-3 text-sm font-semibold text-primary" disabled={busy} onClick={() => void attachDomain()}>
            Save domain instructions
          </button>
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-[#F8E7C4] px-3 py-2 text-sm">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="h-11 rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void save(published)}>
          Save login page
        </button>
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input
            aria-label="Publish login page"
            type="checkbox"
            checked={published}
            onChange={(event) => void save(event.target.checked)}
          />
          Publish
        </label>
        {normalised && <span className="text-xs text-muted-foreground">poketschool.ai/i/{normalised}</span>}
      </div>
      <div className="overflow-hidden rounded-3xl border border-border">
        <p className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
        <div className="pointer-events-none origin-top scale-[0.92]">
          <InstitutionLoginScreen
            schoolName={schoolName}
            logoUrl={logoUrl}
            primaryColor={primary}
            secondaryColor={secondary}
            headline={branding.loginHeadline || `Welcome back to ${schoolName}`}
            body={branding.loginBody || 'Students, teachers, and institution admins sign in here.'}
            showPoweredBy={branding.hidePoweredBy !== true}
            status="ready"
            step="credentials"
            embedded
            onCredentials={() => undefined}
            onGoogle={() => undefined}
            onVerify={() => undefined}
            onResend={() => undefined}
            onCancel={() => undefined}
          />
        </div>
      </div>
    </div>
  );
}
