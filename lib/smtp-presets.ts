export interface SmtpPreset {
  id: string;
  name: string;
  host: string;
  port: string;
  userHint: string;
}

/** Host presets only. The password stays in SMTP_PASS. */
export const SMTP_PRESETS: SmtpPreset[] = [
  { id: 'gmail', name: 'Gmail', host: 'smtp.gmail.com', port: '587', userHint: 'you@gmail.com' },
  { id: 'sendgrid', name: 'SendGrid', host: 'smtp.sendgrid.net', port: '587', userHint: 'apikey' },
  { id: 'mailgun', name: 'Mailgun', host: 'smtp.mailgun.org', port: '587', userHint: 'postmaster@your-domain' },
  { id: 'ses', name: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: '587', userHint: 'SMTP username from SES' },
  { id: 'resend', name: 'Resend', host: 'smtp.resend.com', port: '465', userHint: 'resend' },
];

export function smtpPreset(id: string): SmtpPreset | null {
  return SMTP_PRESETS.find((preset) => preset.id === id) ?? null;
}
