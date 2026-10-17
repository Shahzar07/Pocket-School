import { fromHeader } from './select';
import type { MailAdapter, MailEnv, MailSendResult, OutboundMail } from './types';

export function smtpAdapter(env: MailEnv): MailAdapter {
  return {
    name: 'smtp',
    async send(message: OutboundMail): Promise<MailSendResult> {
      if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
        return { ok: false, provider: 'smtp', providerId: '', error: 'SMTP is not configured.' };
      }
      const nodemailer = (await import('nodemailer')).default;
      const port = Number(env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
      const sent = await transport.sendMail({
        from: fromHeader(env),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      const providerId = typeof sent.messageId === 'string' ? sent.messageId : '';
      return { ok: true, provider: 'smtp', providerId, error: '' };
    },
  };
}
