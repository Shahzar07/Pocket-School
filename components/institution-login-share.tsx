'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download } from 'lucide-react';
import { institutionLoginLinks } from '@/lib/institution-login';

/** Copy and download the academy's branded login link. */
export function InstitutionLoginShare({
  slug,
  customDomain,
  schoolName,
}: {
  slug?: string | null;
  customDomain?: string | null;
  schoolName: string;
}) {
  const links = institutionLoginLinks({ slug, customDomain });
  const [copied, setCopied] = useState<'share' | 'direct' | ''>('');
  const url = links.share;

  const copy = async (value: string, kind: 'share' | 'direct') => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(''), 1600);
  };

  const download = async () => {
    if (!url) return;
    const QRCode = (await import('qrcode')).default;
    const dataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      width: 640,
      color: { dark: '#203337', light: '#FFFFFF' },
    });
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `${(slug || 'academy').replace(/[^a-z0-9-]+/gi, '-')}-login.png`;
    anchor.click();
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="font-semibold">Login page</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {schoolName} students, teachers, and institution admins sign in here. The super admin login stays separate.
          </p>
          {url ? (
            <>
              <p className="mt-3 break-all font-mono text-sm">{url}</p>
              {links.direct && links.direct !== url && (
                <p className="mt-2 break-all text-xs text-muted-foreground">Also at {links.direct}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void copy(url, 'share')} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#203337] px-4 text-sm font-semibold text-white">
                  {copied === 'share' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === 'share' ? 'Copied' : 'Copy link'}
                </button>
                {links.direct && links.direct !== url && (
                  <button type="button" onClick={() => void copy(links.direct, 'direct')} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold">
                    {copied === 'direct' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === 'direct' ? 'Copied' : 'Copy Poket School link'}
                  </button>
                )}
                <button type="button" onClick={() => void download()} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold">
                  <Download className="h-4 w-4" /> Download QR
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Save a subdomain to publish this login page.</p>
          )}
        </div>
        <div className="flex h-[148px] w-[148px] items-center justify-center rounded-2xl border border-[#203337]/10 bg-white p-2">
          {url ? <QRCodeSVG value={url} size={128} fgColor="#203337" bgColor="#FFFFFF" /> : <span className="text-xs text-muted-foreground">QR</span>}
        </div>
      </div>
    </section>
  );
}
