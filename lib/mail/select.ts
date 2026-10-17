import { mailFromAddress, type MailAdapter, type MailEnv, type MailSendResult, type OutboundMail } from './types';

export type MailMode = 'resend' | 'smtp' | 'console' | 'failed';

export function mailMode(env: MailEnv): MailMode {
  if (env.RESEND_API_KEY?.trim()) return 'resend';
  if (env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim()) return 'smtp';
  if (env.NODE_ENV === 'production') return 'failed';
  return 'console';
}

export function consoleAdapter(): MailAdapter {
  return {
    name: 'console',
    async send(message: OutboundMail): Promise<MailSendResult> {
      console.info('staff case email (dev console)', { to: message.to, subject: message.subject, text: message.text });
      return { ok: true, provider: 'console', providerId: `console-${message.to}`, error: '' };
    },
  };
}

export function failedAdapter(): MailAdapter {
  return {
    name: 'none',
    async send(): Promise<MailSendResult> {
      return { ok: false, provider: 'none', providerId: '', error: 'Email is not configured.' };
    },
  };
}

export function adapterForMode(mode: MailMode, env: MailEnv, sendResend?: MailAdapter['send'], sendSmtp?: MailAdapter['send']): MailAdapter {
  if (mode === 'resend' && sendResend) return { name: 'resend', send: sendResend };
  if (mode === 'smtp' && sendSmtp) return { name: 'smtp', send: sendSmtp };
  if (mode === 'console') return consoleAdapter();
  if (mode === 'failed') return failedAdapter();
  return failedAdapter();
}

export function fromHeader(env: MailEnv): string {
  return mailFromAddress(env);
}
