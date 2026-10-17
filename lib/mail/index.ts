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
