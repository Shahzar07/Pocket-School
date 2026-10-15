'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listSchoolTemplates, saveNotifySettings, saveSchoolTemplate } from '@/lib/insights/client';
import { SCALES, normaliseTemplate } from '@/lib/insights/report-cards';
import { DEFAULT_NOTIFY_SETTINGS } from '@/lib/insights/concerns';
import { toast } from 'sonner';

export default function SchoolTemplatesPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [label, setLabel] = useState('School term');
  const [heading, setHeading] = useState('Term report');
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
          <Input value={label} onChange={event => setLabel(event.target.value)} aria-label="Template name" />
          <Input value={heading} onChange={event => setHeading(event.target.value)} aria-label="Heading" />
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
    </DashPage>
  );
}
