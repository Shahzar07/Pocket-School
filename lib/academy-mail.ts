/**
 * Academy name on outbound mail. The SMTP mailbox stays the platform address.
 */

import { escapeHtml, safeLogoUrl } from './certificates';

export interface MailBrand {
  name: string;
  fromName: string;
  logoUrl?: string;
  primaryColor?: string;
}

function smtpEnv(env?: { SMTP_FROM?: string; SMTP_USER?: string }): { SMTP_FROM?: string; SMTP_USER?: string } {
  return env ?? { SMTP_FROM: process.env.SMTP_FROM, SMTP_USER: process.env.SMTP_USER };
}

export function smtpMailbox(env?: { SMTP_FROM?: string; SMTP_USER?: string }): string {
  const from = smtpEnv(env).SMTP_FROM?.trim() ?? '';
  const angled = from.match(/<([^>]+)>/);
  if (angled?.[1]?.includes('@')) return angled[1].trim();
  if (from.includes('@') && !from.includes(' ')) return from;
  return smtpEnv(env).SMTP_USER?.trim() ?? '';
}

/** Display name changes. The address inside the brackets does not. */
export function mailFromHeader(fromName: string | undefined, env?: { SMTP_FROM?: string; SMTP_USER?: string }): string {
  const source = smtpEnv(env);
  const address = smtpMailbox(source);
  const name = (fromName ?? '').replace(/[<>"]/g, '').trim();
  if (!address) return name || 'Poket School';
  if (!name) {
    if (source.SMTP_FROM?.includes('<')) return source.SMTP_FROM.trim();
    return `Poket School <${address}>`;
  }
  return `${name} <${address}>`;
}

export function mailBrandFromInstitution(data: Record<string, unknown> | null | undefined): MailBrand | null {
  if (!data) return null;
  const branding = data.branding && typeof data.branding === 'object' ? data.branding as Record<string, unknown> : {};
  const storedName = typeof branding.displayName === 'string' ? branding.displayName.trim() : '';
  const academyName = typeof data.name === 'string' ? data.name.trim() : '';
  const name = storedName || academyName;
  if (!name) return null;
  const fromName = typeof branding.emailFromName === 'string' && branding.emailFromName.trim()
    ? branding.emailFromName.trim()
    : name;
  const logo = typeof branding.logoUrl === 'string' ? safeLogoUrl(branding.logoUrl) ?? undefined : undefined;
  const primary = typeof branding.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor)
    ? branding.primaryColor
    : undefined;
  return { name, fromName, logoUrl: logo, primaryColor: primary };
}

export function brandedMailHtml(input: { brand?: MailBrand | null; heading: string; paragraphs: readonly string[] }): string {
  const name = escapeHtml(input.brand?.name || 'Poket School');
  const accent = input.brand?.primaryColor || '#2786A4';
  const logo = input.brand?.logoUrl
    ? `<img alt="" src="${escapeHtml(input.brand.logoUrl)}" width="48" height="48" style="display:block;margin:0 0 12px;object-fit:contain" />`
    : '';
  const body = input.paragraphs.map((line) => `<p style="color:rgba(255,255,255,0.72);font-size:14px;line-height:1.5;margin:0 0 12px">${escapeHtml(line)}</p>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#06060F;border-radius:16px;color:#fff">
    ${logo}
    <h1 style="font-size:20px;margin:0 0 8px;color:${accent}">${name}</h1>
    <p style="color:#fff;font-size:16px;margin:0 0 16px">${escapeHtml(input.heading)}</p>
    ${body}
    <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:16px 0 0">Powered by Poket School</p>
  </div>`;
}
