export interface WhatsAppEnv {
  token?: string;
  phoneNumberId?: string;
}

export function whatsAppConfig(source: WhatsAppEnv = {
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
}): { token: string; phoneNumberId: string } | null {
  const token = source.token?.trim() ?? '';
  const phoneNumberId = source.phoneNumberId?.trim() ?? '';
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

export function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export function whatsAppPayload(to: string, template: string, params: readonly string[]): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    to: digitsOnly(to),
    type: 'template',
    template: {
      name: template,
      language: { code: 'en' },
      components: params.length
        ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }]
        : [],
    },
  };
}

export async function sendWhatsAppTemplate(input: {
  to: string;
  template: string;
  params?: readonly string[];
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const config = whatsAppConfig();
  const to = digitsOnly(input.to);
  if (!config) return { ok: false, detail: 'WhatsApp is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.' };
  if (to.length < 8) return { ok: false, detail: 'A phone number is required for WhatsApp.' };
  const send = input.fetchImpl ?? fetch;
  try {
    const response = await send(`https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whatsAppPayload(to, input.template, input.params ?? [])),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, detail: text.slice(0, 300) || `WhatsApp returned ${response.status}.` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'WhatsApp request failed.' };
  }
}

/** WhatsApp template first. Email runs only when WhatsApp is unavailable or fails. */
export async function deliverWithEmailFallback(input: {
  phone?: string;
  template: string;
  params?: readonly string[];
  sendEmail: () => Promise<void>;
}): Promise<{ channel: 'whatsapp' | 'email' | 'skipped'; detail: string }> {
  if (input.phone && whatsAppConfig()) {
    const sent = await sendWhatsAppTemplate({ to: input.phone, template: input.template, params: input.params });
    if (sent.ok) return { channel: 'whatsapp', detail: 'Sent by WhatsApp.' };
    try {
      await input.sendEmail();
      return { channel: 'email', detail: `WhatsApp failed (${sent.detail}). Sent by email.` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email failed.';
      return { channel: 'skipped', detail: `${sent.detail} ${message}` };
    }
  }
  try {
    await input.sendEmail();
    return { channel: 'email', detail: 'Sent by email.' };
  } catch (error) {
    return { channel: 'skipped', detail: error instanceof Error ? error.message : 'Email failed.' };
  }
}
