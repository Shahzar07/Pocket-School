'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { listSchoolTemplates, saveNotifySettings, saveSchoolTemplate } from '@/lib/insights/client';
import { SCALES, normaliseTemplate } from '@/lib/insights/report-cards';
import { DEFAULT_NOTIFY_SETTINGS } from '@/lib/insights/concerns';
import { authedFetch } from '@/lib/api-client';
import { EMAIL_TEMPLATE_KINDS, defaultEmailTemplate, type EmailTemplateKind, type InstitutionEmailTemplate } from '@/lib/institution-email';
import { toast } from 'sonner';

export default function SchoolTemplatesPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [label, setLabel] = useState('');
  const [heading, setHeading] = useState('');
  const [scaleId, setScaleId] = useState('a_to_e');
  const [logoUrl, setLogoUrl] = useState('');
  const [quietStart, setQuietStart] = useState(DEFAULT_NOTIFY_SETTINGS.quietStart);
  const [quietEnd, setQuietEnd] = useState(DEFAULT_NOTIFY_SETTINGS.quietEnd);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    if (!institutionId) return;
    listSchoolTemplates(institutionId).then(rows => {
      setSaved(rows.map(row => String(row.label ?? row.id)));
    }).catch(() => setSaved([]));
  }, [institutionId]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="School"
        title="Report template"
        description="The logo, heading, and grading scale are used when teachers publish a class. Wellbeing check-ins stay with the parent and the teacher."
      />
      <Panel>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input value={label} onChange={event => setLabel(event.target.value)} aria-label="Template name" placeholder="e.g. School term" />
          <Input value={heading} onChange={event => setHeading(event.target.value)} aria-label="Heading" placeholder="e.g. Term report" />
          <Input value={logoUrl} onChange={event => setLogoUrl(event.target.value)} placeholder="https:// logo" aria-label="Logo URL" />
          <select className="h-10 rounded-xl border border-border bg-card px-3" value={scaleId} onChange={event => setScaleId(event.target.value)} aria-label="Grading scale">
            {SCALES.map(scale => <option key={scale.id} value={scale.id}>{scale.label}</option>)}
          </select>
        </div>
        <Button className="mt-3" type="button" onClick={async () => {
          if (!institutionId) return;
          const template = normaliseTemplate({ institutionId, label, heading, scaleId, logoUrl });
          await saveSchoolTemplate(template.id, template);
          setSaved(current => current.concat(template.label));
          toast.success('Template saved for this school.');
        }}>Save template</Button>
        {saved.length > 0 && <p className="text-sm mt-3">Saved: {saved.join(', ')}</p>}
      </Panel>
      <Panel>
        <p className="font-semibold">Quiet hours</p>
        <p className="text-sm text-muted-foreground mt-1">Push waits. The inbox still updates.</p>
        <div className="mt-3 flex gap-3">
          <Input type="time" value={quietStart} onChange={event => setQuietStart(event.target.value)} aria-label="Quiet start" />
          <Input type="time" value={quietEnd} onChange={event => setQuietEnd(event.target.value)} aria-label="Quiet end" />
        </div>
        <Button className="mt-3" type="button" variant="outline" onClick={async () => {
          if (!institutionId) return;
          await saveNotifySettings(`school_${institutionId}`, { quietStart, quietEnd, institutionId });
          toast.success('Quiet hours saved.');
        }}>Save quiet hours</Button>
      </Panel>
      <EmailTemplates institutionId={institutionId} />
    </DashPage>
  );
}

const KIND_LABELS: Record<EmailTemplateKind, string> = {
  otp: 'Verification code',
  notification: 'Notification',
  invoice: 'Invoice',
  welcome: 'Welcome',
};

function EmailTemplates({ institutionId }: { institutionId: string }) {
  const [kind, setKind] = useState<EmailTemplateKind>('otp');
  const [templates, setTemplates] = useState<Record<EmailTemplateKind, InstitutionEmailTemplate>>(() => {
    const next = {} as Record<EmailTemplateKind, InstitutionEmailTemplate>;
    for (const item of EMAIL_TEMPLATE_KINDS) next[item] = defaultEmailTemplate(item);
    return next;
  });

  useEffect(() => {
    if (!institutionId) return;
    authedFetch(`/api/institution/email-templates?institutionId=${encodeURIComponent(institutionId)}`)
      .then((data) => {
        const rows = Array.isArray(data.templates) ? data.templates as InstitutionEmailTemplate[] : [];
        setTemplates((current) => {
          const next = { ...current };
          for (const row of rows) {
            if (EMAIL_TEMPLATE_KINDS.includes(row.kind)) next[row.kind] = row;
          }
          return next;
        });
      })
      .catch(() => toast.error('Could not load email templates.'));
  }, [institutionId]);

  const current = templates[kind];

  return (
    <Panel>
      <p className="font-semibold">Email templates</p>
      <p className="text-sm text-muted-foreground mt-1">
        Placeholders: {'{{name}}'}, {'{{code}}'}, {'{{title}}'}, {'{{message}}'}, {'{{number}}'}, {'{{amount}}'}, {'{{school}}'}.
        WhatsApp still uses its own templates. <Link className="underline" href="/dashboard/institution/activity">Activity log</Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {EMAIL_TEMPLATE_KINDS.map((item) => (
          <Button key={item} type="button" variant={item === kind ? 'default' : 'outline'} onClick={() => setKind(item)}>
            {KIND_LABELS[item]}
          </Button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        <Input
          value={current.subject}
          aria-label="Email subject"
          onChange={(event) => setTemplates((rows) => ({ ...rows, [kind]: { ...rows[kind], subject: event.target.value } }))}
        />
        <Textarea
          value={current.body}
          aria-label="Email body"
          rows={6}
          onChange={(event) => setTemplates((rows) => ({ ...rows, [kind]: { ...rows[kind], body: event.target.value } }))}
        />
        <Button type="button" onClick={async () => {
          if (!institutionId) return;
          try {
            await authedFetch('/api/institution/email-templates', {
              method: 'POST',
              body: JSON.stringify({ institutionId, kind, subject: current.subject, body: current.body }),
            });
            toast.success('Email template saved.');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save the email template.');
          }
        }}>Save email template</Button>
      </div>
    </Panel>
  );
}
