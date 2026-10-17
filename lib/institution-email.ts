export const EMAIL_TEMPLATE_KINDS = ['otp', 'notification', 'invoice', 'welcome'] as const;
export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number];

export interface InstitutionEmailTemplate {
  kind: EmailTemplateKind;
  subject: string;
  body: string;
}

export function isEmailTemplateKind(value: string): value is EmailTemplateKind {
  return (EMAIL_TEMPLATE_KINDS as readonly string[]).includes(value);
}

export function defaultEmailTemplate(kind: EmailTemplateKind): InstitutionEmailTemplate {
  const letters: Record<EmailTemplateKind, InstitutionEmailTemplate> = {
    otp: {
      kind: 'otp',
      subject: '{{code}} is your verification code',
      body: 'Hello {{name}},\n\nYour Poket School verification code is {{code}}. It expires in 10 minutes.\n',
    },
    notification: {
      kind: 'notification',
      subject: '{{title}}',
      body: 'Hello {{name}},\n\n{{message}}\n',
    },
    invoice: {
      kind: 'invoice',
      subject: 'Invoice {{number}}',
      body: 'Hello {{name}},\n\nYour invoice {{number}} for {{amount}} is paid.\n',
    },
    welcome: {
      kind: 'welcome',
      subject: 'Welcome to {{school}}',
      body: 'Hello {{name}},\n\nYour place at {{school}} is ready.\n',
    },
  };
  return letters[kind];
}

export function renderEmailTemplate(template: InstitutionEmailTemplate, vars: Record<string, string>): { subject: string; text: string } {
  const fill = (value: string) => value.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => vars[key] ?? '');
  return {
    subject: fill(template.subject).slice(0, 180),
    text: fill(template.body).slice(0, 8000),
  };
}
