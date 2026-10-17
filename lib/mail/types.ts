export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Overrides the env from-address. School notices use the safety@ sender. */
  from?: string;
  attachments?: { filename: string; content: string }[];
}

export interface MailSendResult {
  ok: boolean;
  provider: 'resend' | 'smtp' | 'console' | 'none';
  providerId: string;
  error: string;
}

export interface MailAdapter {
  name: MailSendResult['provider'];
  send(message: OutboundMail): Promise<MailSendResult>;
}

export interface MailEnv {
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  RESEND_WEBHOOK_SECRET?: string;
  SMTP_HOST?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_PORT?: string;
  SMTP_FROM?: string;
  NODE_ENV?: string;
}

export const MAIL_BACKOFF_MS = [0, 400, 1600] as const;

export function mailFromAddress(env: MailEnv): string {
  const from = env.MAIL_FROM?.trim();
  if (from) return from;
  return 'Poket School <safety@poketschool.ai>';
}
