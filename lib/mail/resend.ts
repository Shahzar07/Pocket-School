import { fromHeader } from './select';
import type { MailAdapter, MailEnv, MailSendResult, OutboundMail } from './types';

export function resendAdapter(env: MailEnv, fetchImpl: typeof fetch = fetch): MailAdapter {
  return {
    name: 'resend',
    async send(message: OutboundMail): Promise<MailSendResult> {
      const key = env.RESEND_API_KEY?.trim() ?? '';
      if (!key) return { ok: false, provider: 'resend', providerId: '', error: 'Email is not configured.' };
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from || fromHeader(env),
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.attachments && message.attachments.length > 0 ? { attachments: message.attachments } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
      if (!response.ok) {
        return { ok: false, provider: 'resend', providerId: '', error: payload.message || `Resend returned ${response.status}.` };
      }
      return { ok: true, provider: 'resend', providerId: payload.id || '', error: '' };
    },
  };
}
