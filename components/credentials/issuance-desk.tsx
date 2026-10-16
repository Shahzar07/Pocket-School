'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { DEFAULT_TEMPLATE, type CertificateTemplate } from '@/lib/credentials/badge-model';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function IssuanceDesk({ mode }: { mode: 'admin' | 'school' }) {
  const [template, setTemplate] = useState<CertificateTemplate>(DEFAULT_TEMPLATE);
  const [months, setMonths] = useState('');
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [students, setStudents] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch('/api/credentials/template')
      .then((data) => {
        const next = data.template as CertificateTemplate | undefined;
        if (!next) return;
        setTemplate(next);
        setMonths(next.expiresInMonths ? String(next.expiresInMonths) : '');
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Could not load the certificate template.');
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      const data = await authedFetch('/api/credentials/template', {
        method: 'POST',
        body: JSON.stringify({
          ...template,
          expiresInMonths: months.trim() ? Number(months) : null,
        }),
      });
      const next = data.template as CertificateTemplate;
      setTemplate(next);
      toast.success('Certificate template saved. New badges use it.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the template.');
    }
  };

  const issue = async () => {
    setResult('');
    try {
      const data = await authedFetch('/api/credentials/bulk', {
        method: 'POST',
        body: JSON.stringify({ courseId, moduleId, students }),
      });
      const issued = Array.isArray(data.issued) ? data.issued as { studentId: string; certificateId: string }[] : [];
      const skipped = Array.isArray(data.skipped) ? data.skipped as { studentId: string; reason: string }[] : [];
      const lines = [
        ...issued.map((row) => `Issued ${row.certificateId} for ${row.studentId}`),
        ...skipped.map((row) => `Skipped ${row.studentId}: ${row.reason}`),
      ];
      setResult(lines.join('\n') || 'Nothing to issue.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not issue certificates.');
    }
  };

  if (loading) return <div className="h-40 bg-muted animate-pulse rounded-3xl" />;

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-3xl p-6 space-y-4">
        <h2 className="text-2xl font-semibold">{mode === 'admin' ? 'Certificate template' : 'School badge'}</h2>
        <p className="text-sm text-muted-foreground">
          {template.issuerName} signs each finished module as an Open Badge. {template.narrative}
        </p>
        {mode === 'admin' ? (
          <>
            <label className="block text-sm font-semibold">
              Headline
              <Input aria-label="Headline" value={template.headline} onChange={(event) => setTemplate({ ...template, headline: event.target.value })} className="mt-1 h-11 rounded-xl" />
            </label>
            <label className="block text-sm font-semibold">
              Criteria
              <textarea aria-label="Criteria" value={template.narrative} onChange={(event) => setTemplate({ ...template, narrative: event.target.value })} className="mt-1 w-full min-h-24 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm font-semibold">
                Accent
                <Input aria-label="Accent colour" value={template.accent} onChange={(event) => setTemplate({ ...template, accent: event.target.value })} className="mt-1 h-11 rounded-xl" />
              </label>
              <label className="text-sm font-semibold">
                Expires after months
                <Input aria-label="Expiry months" value={months} onChange={(event) => setMonths(event.target.value)} placeholder="Blank means no expiry" className="mt-1 h-11 rounded-xl" />
              </label>
              <label className="text-sm font-semibold">
                Issuer name
                <Input aria-label="Issuer name" value={template.issuerName} onChange={(event) => setTemplate({ ...template, issuerName: event.target.value })} className="mt-1 h-11 rounded-xl" />
              </label>
            </div>
            <Button type="button" className="rounded-full" onClick={() => void save()}>Save template</Button>
          </>
        ) : (
          <p className="text-sm">Expiry: {template.expiresInMonths ? `${template.expiresInMonths} months` : 'does not expire'}.</p>
        )}
      </section>

      <section className="bg-card border border-border rounded-3xl p-6 space-y-4">
        <h2 className="text-2xl font-semibold">Issue to a class</h2>
        <p className="text-sm text-muted-foreground">
          One line per student: a user id or an email. A certificate is written only when every published lesson in the module is already complete.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm font-semibold">
            Course id
            <Input aria-label="Course id" value={courseId} onChange={(event) => setCourseId(event.target.value)} className="mt-1 h-11 rounded-xl" />
          </label>
          <label className="text-sm font-semibold">
            Module id
            <Input aria-label="Module id" value={moduleId} onChange={(event) => setModuleId(event.target.value)} className="mt-1 h-11 rounded-xl" />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Students
          <textarea aria-label="Students" value={students} onChange={(event) => setStudents(event.target.value)} className="mt-1 w-full min-h-28 rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono" placeholder="student@school.edu" />
        </label>
        <Button type="button" className="rounded-full" onClick={() => void issue()}>Issue badges</Button>
        {result ? <pre className="text-xs whitespace-pre-wrap rounded-2xl bg-muted p-4">{result}</pre> : null}
      </section>
    </div>
  );
}
