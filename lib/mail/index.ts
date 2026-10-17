import { resendAdapter } from './resend';
import { adapterForMode, mailMode } from './select';
import { smtpAdapter } from './smtp';
import type { MailAdapter, MailEnv } from './types';

export function currentMailEnv(source: NodeJS.ProcessEnv = process.env): MailEnv {
  return {
    RESEND_API_KEY: source.RESEND_API_KEY,
    MAIL_FROM: source.MAIL_FROM,
    RESEND_WEBHOOK_SECRET: source.RESEND_WEBHOOK_SECRET,
    SMTP_HOST: source.SMTP_HOST,
    SMTP_USER: source.SMTP_USER,
    SMTP_PASS: source.SMTP_PASS,
    SMTP_PORT: source.SMTP_PORT,
    SMTP_FROM: source.SMTP_FROM,
    NODE_ENV: source.NODE_ENV,
  };
}

export function currentMailAdapter(env: MailEnv = currentMailEnv()): MailAdapter {
  const mode = mailMode(env);
  return adapterForMode(mode, env, resendAdapter(env).send, smtpAdapter(env).send);
}

export { sendWithBackoff } from './retry';
export { mailMode } from './select';
export type { MailEnv, MailSendResult, OutboundMail } from './types';

/**
 * Billing notices. Resend is used when RESEND_API_KEY and RESEND_FROM are set.
 * A missing key does not fail the webhook or the cron.
 */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from || !input.to.includes('@')) return { sent: false, reason: 'not_configured' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!response.ok) return { sent: false, reason: 'provider' };
    return { sent: true };
  } catch {
    return { sent: false, reason: 'provider' };
  }
}
