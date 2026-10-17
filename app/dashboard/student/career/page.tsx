'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';

interface SkillRow { id: string; name: string; visible: boolean; evidence: { label: string; url: string }[] }
interface NoteRow { id: string; teacherName: string; body: string; visible: boolean }
interface MatchRow { id: string; kind: string; title: string; organisation: string; deadline: string; url: string }
interface OpeningRow { id: string; institutionId: string; title: string; employer: string; kind: string; deadline: string; level: string }
interface CampaignRow { id: string; institutionId: string; title: string; kind: string; progress: number; currency: string }
interface ReunionRow { id: string; institutionId: string; title: string; when: string; place: string; ticketed: boolean; publicRsvpCount: number | null }
interface TalkRow { id: string; institutionId: string; title: string; format: string; provider: string; when: string; level: string; link: string; status: string }
interface CareerDesk {
  interests: string[];
  skills: SkillRow[];
  endorsements: NoteRow[];
  matches: MatchRow[];
  openings: OpeningRow[];
  campaigns: CampaignRow[];
  reunions: ReunionRow[];
  talks: TalkRow[];
  bridge: { needsConsent: boolean; keepsPdf: boolean };
  schools: string[];
  note: string;
}

export default function StudentCareerPage() {
  const [desk, setDesk] = useState<CareerDesk | null>(null);
  const [interests, setInterests] = useState('');
  const [cvVersionId, setCvVersionId] = useState('');
  const [talkTitle, setTalkTitle] = useState('');
  const [talkLink, setTalkLink] = useState('');

  const load = useCallback(() => {
    authedFetch('/api/institutions/extras')
      .then((data) => {
        const next = data as unknown as CareerDesk;
        setDesk(next);
        setInterests((next.interests ?? []).join(', '));
      })
      .catch((error: Error) => toast.error(error.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function send(action: string, body: Record<string, unknown>) {
    try {
      await authedFetch('/api/institutions/extras', { method: 'POST', body: JSON.stringify({ action, ...body }) });
      toast.success('Saved.');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Try again.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-deep">Poket School</p>
        <h1 className="font-heading text-3xl text-ink">Career</h1>
        <p className="mt-2 text-sm text-muted">{desk?.note || 'ET AI matches opportunities your academy entered. It does not invent one.'}</p>
      </header>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold text-ink">Skills passport</h2>
        <p className="mt-1 text-sm text-muted">Proven skills come from verified lessons, unit tests, and badges. You can show or hide one. You cannot edit it.</p>
        <button type="button" onClick={() => send('refresh-skills', {})} className="mt-3 h-10 rounded-full bg-blue-deep px-4 text-sm text-white">Refresh from my record</button>
        <ul className="mt-4 space-y-3">
          {(desk?.skills ?? []).map((skill) => (
            <li key={skill.id} className="rounded-2xl bg-wash px-4 py-3">
              <p className="font-semibold text-ink">{skill.name}</p>
              <p className="text-sm text-muted">{skill.evidence.map((item) => item.label).join(' · ') || 'Verified by Poket School'}</p>
              <button type="button" onClick={() => send('hide-skill', { skillId: skill.id, visible: !skill.visible })} className="mt-2 text-sm font-semibold text-blue-deep">
                {skill.visible ? 'Hide on CV' : 'Show on CV'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold text-ink">Teacher references</h2>
        <ul className="mt-3 space-y-3">
          {(desk?.endorsements ?? []).map((note) => (
            <li key={note.id} className="rounded-2xl bg-wash px-4 py-3">
              <p className="text-sm text-ink">{note.body}</p>
              <p className="mt-1 text-xs text-muted">{note.teacherName} · Locked</p>
              <button type="button" onClick={() => send('hide-endorsement', { id: note.id, visible: !note.visible })} className="mt-2 text-sm font-semibold text-blue-deep">
                {note.visible ? 'Hide' : 'Show'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold text-ink">ET AI matcher</h2>
        <label className="mt-3 block text-sm text-ink">
          Interests
          <input value={interests} onChange={(event) => setInterests(event.target.value)} className="mt-1 h-11 w-full rounded-xl bg-wash px-3" placeholder="biology, design" />
        </label>
        <label className="mt-3 block text-sm text-ink">
          CV version id
          <input value={cvVersionId} onChange={(event) => setCvVersionId(event.target.value)} className="mt-1 h-11 w-full rounded-xl bg-wash px-3" placeholder="Optional" />
        </label>
        <button type="button" onClick={() => send('interests', { interests: interests.split(',').map((item) => item.trim()).filter(Boolean) })} className="mt-3 h-10 rounded-full bg-blue-deep px-4 text-sm text-white">Save interests</button>
        <ul className="mt-4 space-y-3">
          {(desk?.matches ?? []).map((row) => (
            <li key={row.id} className="rounded-2xl bg-wash px-4 py-3">
              <p className="font-semibold text-ink">{row.title}</p>
              <p className="text-sm text-muted">{row.organisation} · {row.kind} · {row.deadline}</p>
              <button type="button" onClick={() => send('save-match', { opportunityId: row.id, cvVersionId })} className="mt-2 text-sm font-semibold text-blue-deep">Save to tracker</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold text-ink">School board</h2>
        <ul className="mt-3 space-y-3">
          {(desk?.openings ?? []).map((row) => (
            <li key={row.id} className="rounded-2xl bg-wash px-4 py-3">
              <p className="font-semibold text-ink">{row.title}</p>
              <p className="text-sm text-muted">{row.employer} · {row.kind}{row.level ? ` · ${row.level}` : ''} · {row.deadline}</p>
              <button type="button" onClick={() => send('apply-opening', { institutionId: row.institutionId, openingId: row.id, cvVersionId })} className="mt-2 text-sm font-semibold text-blue-deep">Apply with this CV</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold text-ink">Alumni giving</h2>
        {(desk?.campaigns ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">This academy has not opened alumni giving.</p> : null}
        <ul className="mt-3 space-y-3">
          {(desk?.campaigns ?? []).map((row) => (
            <li key={row.id} className="rounded-2xl bg-wash px-4 py-3">
              <p className="font-semibold text-ink">{row.title}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full bg-blue-deep" style={{ width: `${Math.min(100, row.progress)}%` }} /></div>
              <button type="button" onClick={() => send('give', { institutionId: row.institutionId, campaignId: row.id, amount: 10 })} className="mt-2 text-sm font-semibold text-blue-deep">Give 10 {row.currency} in sandbox</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold text-ink">Reunions</h2>
        <ul className="mt-3 space-y-3">
          {(desk?.reunions ?? []).map((row) => (
            <li key={row.id} className="rounded-2xl bg-wash px-4 py-3">
              <p className="font-semibold text-ink">{row.title}</p>
              <p className="text-sm text-muted">{row.when} · {row.place} · {row.publicRsvpCount === null ? 'RSVPs stay private until five people reply' : `${row.publicRsvpCount} going`}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => send('rsvp', { institutionId: row.institutionId, reunionId: row.id, going: true })} className="h-10 rounded-full bg-blue-deep px-4 text-sm text-white">RSVP</button>
                {row.ticketed ? <button type="button" onClick={() => send('ticket', { institutionId: row.institutionId, reunionId: row.id })} className="h-10 rounded-full bg-white px-4 text-sm text-ink">Sandbox ticket</button> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold text-ink">Career talks</h2>
        <ul className="mt-3 space-y-3">
          {(desk?.talks ?? []).map((row) => (
            <li key={row.id} className="rounded-2xl bg-wash px-4 py-3">
              <p className="font-semibold text-ink">{row.title}</p>
              <p className="text-sm text-muted">{row.format}{row.provider ? ` · ${row.provider}` : ''}{row.level ? ` · ${row.level}` : ''} · {row.when}</p>
              {row.link ? <a href={row.link} className="mt-1 inline-block text-sm font-semibold text-blue-deep">Open the talk</a> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5 space-y-3">
        <h2 className="font-semibold text-ink">Offer a career talk</h2>
        <p className="text-sm text-muted">An adult alumnus can offer a live Zoom, Meet, or Teams talk, or a recording. The academy approves it before students see it.</p>
        <input value={talkTitle} onChange={(event) => setTalkTitle(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Talk title" />
        <input value={talkLink} onChange={(event) => setTalkLink(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="https://meet.google.com/..." />
        <button type="button" onClick={() => send('propose-talk', { institutionId: desk?.schools[0] ?? '', title: talkTitle, format: 'live', provider: 'meet', link: talkLink, level: '' })} className="h-10 rounded-full bg-blue-deep px-4 text-sm text-white">Offer this talk</button>
      </section>

      {desk?.bridge.needsConsent ? (
        <section className="rounded-3xl bg-white p-5">
          <h2 className="font-semibold text-ink">Parent summary</h2>
          <p className="mt-1 text-sm text-muted">You are 18 or over. Parents keep the achievement PDF only if you agree.</p>
          <button type="button" onClick={() => send('parent-consent', { consent: true })} className="mt-3 h-10 rounded-full bg-blue-deep px-4 text-sm text-white">Share the PDF with my parents</button>
        </section>
      ) : null}
    </div>
  );
}
