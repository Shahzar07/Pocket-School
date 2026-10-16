/**
 * Attach an academy hostname to the Vercel project so SSL is issued there.
 * With no token, callers keep the manual DNS instructions.
 */

import {
  interpretVercelDomain,
  manualDomainResult,
  vercelDomainConfigured,
  type DomainAttachResult,
} from '../tenant-host';

interface VercelErrorBody {
  error?: { message?: string };
  verified?: boolean;
  misconfigured?: boolean;
}

export async function attachCustomDomain(
  env: { [key: string]: string | undefined },
  domain: string,
): Promise<DomainAttachResult> {
  if (!vercelDomainConfigured({ VERCEL_TOKEN: env.VERCEL_TOKEN, VERCEL_PROJECT_ID: env.VERCEL_PROJECT_ID })) return manualDomainResult();
  const token = env.VERCEL_TOKEN?.trim() ?? '';
  const project = encodeURIComponent(env.VERCEL_PROJECT_ID?.trim() ?? '');
  const team = env.VERCEL_TEAM_ID?.trim() ? `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID.trim())}` : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const created = await fetch(`https://api.vercel.com/v10/projects/${project}/domains${team}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: domain }),
    });
    const payload = await created.json().catch(() => ({})) as VercelErrorBody;
    const alreadyExists = created.status === 409;
    const config = await fetch(`https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config${team}`, { headers });
    const configBody = await config.json().catch(() => ({})) as VercelErrorBody;
    return interpretVercelDomain({
      httpStatus: created.ok || alreadyExists ? 200 : created.status,
      verified: payload.verified === true,
      misconfigured: configBody.misconfigured === true,
      alreadyExists,
      error: payload.error?.message,
    });
  } catch {
    return {
      status: 'error',
      ssl: 'pending',
      message: 'The Vercel domains API could not be reached. Use the DNS instructions and try again.',
    };
  }
}
