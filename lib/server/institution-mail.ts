import type { EmailDraft } from '../institution-membership';

/** Sends one academy email. Missing SMTP returns the text so the caller can show it. */
export async function sendInstitutionMail(to: string, draft: EmailDraft): Promise<{ emailed: boolean; text: string }> {
  if (!to || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { emailed: false, text: draft.text };
  }
  const nodemailer = (await import('nodemailer')).default;
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: draft.subject,
    text: draft.text,
  });
  return { emailed: true, text: draft.text };
}
