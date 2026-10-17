/**
 * Email copies for billing notices. Resend is used when RESEND_API_KEY and
 * RESEND_FROM are set. A missing key does not fail the webhook or the cron.
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
