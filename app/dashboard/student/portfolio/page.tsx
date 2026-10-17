'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RecordPanels } from '@/components/portfolio/record-panels';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { authedFetch } from '@/lib/api-client';
import { DESTINATION_KINDS } from '@/lib/destinations';
import {
  CV_TEMPLATES,
  defaultConsent,
  SECTION_IDS,
  SELF_KINDS,
  type PortfolioConsent,
  type RecordItem,
  type SectionAudience,
} from '@/lib/portfolio';

interface PortfolioState {
  name: string;
  studentNumber: string;
  consent: PortfolioConsent;
  items: RecordItem[];
  summary: string;
  bullets: string[];
  nudges: string[];
  publication: { public: boolean; reason: string };
}

function asPortfolio(data: Record<string, unknown>): PortfolioState | null {
  const portfolio = data.portfolio && typeof data.portfolio === 'object' ? data.portfolio as Record<string, unknown> : data;
  if (!portfolio || typeof portfolio !== 'object' || !portfolio.consent) return null;
  return portfolio as unknown as PortfolioState;
}

function download(filename: string, bytes: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function StudentPortfolioPage() {
  const [record, setRecord] = useState<PortfolioState | null>(null);
  const [kind, setKind] = useState<string>('volunteering');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [nextName, setNextName] = useState('');
  const [nextCourse, setNextCourse] = useState('');
  const [nextCountry, setNextCountry] = useState('');
  const [nextKind, setNextKind] = useState<string>('university');
  const [shareDestination, setShareDestination] = useState(false);
  const [shareName, setShareName] = useState(false);
  const [testimonial, setTestimonial] = useState('');
  const [shareTestimonial, setShareTestimonial] = useState(false);

  const load = useCallback(() => {
    authedFetch('/api/portfolio')
      .then((data) => {
        const next = asPortfolio(data);
        if (next) setRecord(next);
      })
      .catch(() => toast.error('Could not open the portfolio.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveConsent = (patch: Partial<PortfolioConsent>) => {
    const consent = { ...(record?.consent ?? defaultConsent()), ...patch };
    void authedFetch('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify({ action: 'consent', ...consent }),
    })
      .then((data) => {
        const next = asPortfolio(data);
        if (next) setRecord(next);
        toast.success('Sharing choices saved.');
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save sharing choices.'));
  };

  const consent = record?.consent ?? defaultConsent();

  return (
    <DashPage className="max-w-5xl">
      <DashHeader
        eyebrow="Student"
        title="CV and portfolio"
        description="Verified lines come from your Poket School record. Self-reported lines stay labelled. The same student number follows this account across academies."
      />
      {record ? (
        <RecordPanels
          name={record.name}
          studentNumber={record.studentNumber}
          items={record.items}
          summary={record.summary}
          bullets={record.bullets}
          nudges={record.nudges}
          reason={record.publication.reason}
          consent={consent}
        />
      ) : <p className="text-sm text-[#1A3C34]">Opening your record…</p>}

      <Panel>
        <h2 className="font-heading text-2xl text-[#1A3C34]">Add an achievement</h2>
        <p className="mt-1 text-sm text-[#1A3C34]/80">Activities, awards, competitions, volunteering, sports, leadership, work, skills, languages, and links. These stay marked self-reported.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Kind
            <select value={kind} onChange={(event) => setKind(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
              {SELF_KINDS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm">Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <label className="text-sm md:col-span-2">Detail
            <input value={detail} onChange={(event) => setDetail(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <label className="text-sm md:col-span-2">Evidence link
            <input value={evidenceLink} onChange={(event) => setEvidenceLink(event.target.value)} placeholder="https://" className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
        </div>
        <p className="mt-2 text-xs text-[#1A3C34]/70">A file stays in your portfolio folder under media, named for this item. The link, when you add one, starts with https.</p>
        <button
          type="button"
          className="mt-4 h-11 rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white"
          onClick={() => {
            void authedFetch('/api/portfolio', {
              method: 'POST',
              body: JSON.stringify({ action: 'save-item', kind, title, detail, evidenceLink }),
            })
              .then(() => {
                setTitle('');
                setDetail('');
                setEvidenceLink('');
                toast.success('Added to your portfolio.');
                load();
              })
              .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not add that item.'));
          }}
        >
          Add to portfolio
        </button>
      </Panel>

      <Panel>
        <h2 className="font-heading text-2xl text-[#1A3C34]">Sharing</h2>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={consent.publicPortfolio} onChange={(event) => saveConsent({ publicPortfolio: event.target.checked })} /> Public portfolio</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={consent.sharePortfolioWithSchools} onChange={(event) => saveConsent({ sharePortfolioWithSchools: event.target.checked })} /> Share the portfolio with former schools</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={consent.shareDestinationWithSchools} onChange={(event) => saveConsent({ shareDestinationWithSchools: event.target.checked })} /> Share my next step with former schools</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={consent.includeScores} onChange={(event) => saveConsent({ includeScores: event.target.checked })} /> Include unit and final scores</label>
        </div>
        <p className="mt-3 text-sm leading-relaxed">Turn destination sharing on before you join the next academy if that move may be counted. A public portfolio for a learner under 18 stays off until a parent approves it.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {SECTION_IDS.map((id) => (
            <label key={id} className="text-sm capitalize">{id}
              <select
                value={consent.sections[id] ?? 'private'}
                onChange={(event) => saveConsent({ sections: { ...consent.sections, [id]: event.target.value as SectionAudience } })}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3"
              >
                <option value="private">Private</option>
                <option value="schools">Former schools</option>
                <option value="public">Public</option>
              </select>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {CV_TEMPLATES.map((template) => (
            <button key={template} type="button" onClick={() => saveConsent({ template })} className={`h-10 rounded-full px-4 text-sm ${consent.template === template ? 'bg-[#1A3C34] text-white' : 'bg-[#F6F1E7] text-[#1A3C34]'}`}>
              {template}
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="font-heading text-2xl text-[#1A3C34]">Summary and downloads</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="h-11 rounded-full bg-[#C8922A] px-5 text-sm font-semibold text-[#1A3C34]" onClick={() => {
            void authedFetch('/api/portfolio', { method: 'POST', body: JSON.stringify({ action: 'summary' }) })
              .then((data) => {
                setRecord((current) => current ? {
                  ...current,
                  summary: typeof data.summary === 'string' ? data.summary : current.summary,
                  bullets: Array.isArray(data.bullets) ? data.bullets.filter((item): item is string => typeof item === 'string') : current.bullets,
                } : current);
              })
              .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not draft the summary.'));
          }}>
            Draft with ET AI
          </button>
          <button type="button" className="h-11 rounded-full border border-[#1A3C34] px-5 text-sm font-semibold text-[#1A3C34]" onClick={() => {
            void authedFetch('/api/portfolio', { method: 'POST', body: JSON.stringify({ action: 'save-summary' }) })
              .then((data) => {
                setRecord((current) => current ? {
                  ...current,
                  summary: typeof data.summary === 'string' ? data.summary : '',
                  bullets: Array.isArray(data.bullets) ? data.bullets.filter((item): item is string => typeof item === 'string') : [],
                } : current);
                toast.success('The reviewed wording is saved.');
              })
              .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save the wording.'));
          }}>
            Save this wording
          </button>
          {(['cv', 'json', 'linkedin'] as const).map((format) => (
            <button key={format} type="button" className="h-11 rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white" onClick={() => {
              void authedFetch('/api/portfolio', { method: 'POST', body: JSON.stringify({ action: 'export', format, template: consent.template }) })
                .then((data) => {
                  const filename = typeof data.filename === 'string' ? data.filename : 'portfolio';
                  if (typeof data.pdf === 'string') {
                    const binary = atob(data.pdf);
                    const bytes = new Uint8Array(binary.length);
                    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
                    download(filename, bytes, 'application/pdf');
                    return;
                  }
                  if (typeof data.json === 'string') {
                    download(filename, data.json, 'application/json');
                    return;
                  }
                  if (typeof data.text === 'string') download(filename, data.text, 'text/plain');
                })
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not download the portfolio.'));
            }}>
              {format === 'cv' ? 'CV PDF' : format === 'json' ? 'JSON' : 'LinkedIn text'}
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="font-heading text-2xl text-[#1A3C34]">Next step</h2>
        <p className="mt-1 text-sm leading-relaxed">Record a university, college, institution, or workplace. Former schools see a count. Your name is included only if you opt in.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Kind
            <select value={nextKind} onChange={(event) => setNextKind(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
              {DESTINATION_KINDS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm">Name
            <input value={nextName} onChange={(event) => setNextName(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <label className="text-sm">Course
            <input value={nextCourse} onChange={(event) => setNextCourse(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <label className="text-sm">Country
            <input value={nextCountry} onChange={(event) => setNextCountry(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
          <label className="text-sm md:col-span-2">Testimonial
            <input value={testimonial} onChange={(event) => setTestimonial(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
          </label>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={shareDestination} onChange={(event) => setShareDestination(event.target.checked)} /> Share this destination with former schools</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={shareName} onChange={(event) => setShareName(event.target.checked)} /> Share my name with that school</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={shareTestimonial} onChange={(event) => setShareTestimonial(event.target.checked)} /> Share this testimonial</label>
        </div>
        <button type="button" className="mt-4 h-11 rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white" onClick={() => {
          void authedFetch('/api/portfolio', {
            method: 'POST',
            body: JSON.stringify({
              action: 'destination',
              kind: nextKind,
              name: nextName,
              course: nextCourse,
              country: nextCountry,
              shareWithSchools: shareDestination,
              shareName,
              testimonial,
              shareTestimonial,
            }),
          })
            .then(() => {
              toast.success(shareDestination ? 'Former schools can count this next step.' : 'Your next step stays on this account.');
              load();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save the next step.'));
        }}>
          Save next step
        </button>
      </Panel>
    </DashPage>
  );
}
