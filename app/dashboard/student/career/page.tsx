'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CareerHome, ProgressRing, fieldClass, primaryButton, quietButton } from '@/components/career/app-surface';
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

const empty: CareerDesk = {
  interests: [], skills: [], endorsements: [], matches: [], openings: [], campaigns: [], reunions: [], talks: [],
  bridge: { needsConsent: false, keepsPdf: false }, schools: [], note: '',
};

export default function StudentCareerPage() {
  const [desk, setDesk] = useState<CareerDesk>(empty);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState('home');
  const [interests, setInterests] = useState('');
  const [cvVersionId, setCvVersionId] = useState('');
  const [talkTitle, setTalkTitle] = useState('');
  const [talkLink, setTalkLink] = useState('');

  const load = useCallback(() => {
    authedFetch('/api/institutions/extras')
      .then((data) => {
        const next = data as unknown as CareerDesk;
        setDesk({ ...empty, ...next, bridge: next.bridge ?? empty.bridge });
        setInterests((next.interests ?? []).join(', '));
        setReady(true);
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

  const giving = desk.campaigns[0]?.progress ?? 0;
  const tiles = [
    { id: 'skills', label: 'Skills', hint: 'Show or hide', category: 'learning' as const, badge: desk.skills.length },
    { id: 'references', label: 'References', hint: 'Locked notes', category: 'people' as const, badge: desk.endorsements.length },
    { id: 'matches', label: 'Matches', hint: 'ET AI list', category: 'careers' as const, badge: desk.matches.length },
    { id: 'board', label: 'Board', hint: 'This academy', category: 'careers' as const, badge: desk.openings.length },
    { id: 'giving', label: 'Giving', hint: 'Sandbox', category: 'payments' as const, badge: desk.campaigns.length },
    { id: 'reunions', label: 'Reunions', hint: 'RSVP', category: 'community' as const, badge: desk.reunions.length },
    { id: 'talks', label: 'Talks', hint: 'Approved', category: 'insights' as const, badge: desk.talks.length },
  ];

  return (
    <CareerHome
      title="Career"
      blurb={desk.note || 'ET AI matches opportunities your academy entered. It does not invent one.'}
      active={section}
      onActive={setSection}
      tasks={[
        { id: 'skills', label: 'Refresh skills', category: 'learning', onSelect: () => { setSection('skills'); void send('refresh-skills', {}); } },
        { id: 'matches', label: 'Review matches', category: 'careers', onSelect: () => setSection('matches') },
        desk.bridge.needsConsent
          ? { id: 'parents', label: 'Share with parents', category: 'people', onSelect: () => setSection('parents') }
          : { id: 'reunions', label: 'Reunion RSVP', category: 'community', onSelect: () => setSection('reunions') },
      ]}
      tiles={tiles}
      stats={ready ? [
        { label: 'Proven skills', value: String(desk.skills.filter((skill) => skill.visible).length), hint: 'Visible on your CV', ring: desk.skills.length ? Math.round((desk.skills.filter((skill) => skill.visible).length / desk.skills.length) * 100) : 0 },
        { label: 'Matches', value: String(desk.matches.length), hint: 'From the entered list' },
        { label: 'Giving', value: desk.campaigns.length ? `${giving}%` : 'Off', hint: 'Sandbox only', ring: giving },
      ] : []}
    >
      {section === 'skills' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Skills passport</h2>
          <p className="text-sm text-muted-foreground">Proven skills come from verified lessons, unit tests, and badges. You can show or hide one. You cannot edit it.</p>
          <button type="button" onClick={() => send('refresh-skills', {})} className={primaryButton}>Refresh from my record</button>
          <ul className="divide-y divide-border">
            {desk.skills.map((skill) => (
              <li key={skill.id} className="flex min-h-12 items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{skill.name}</p>
                  <p className="text-sm text-muted-foreground">{skill.evidence.map((item) => item.label).join(' · ') || 'Verified by Poket School'}</p>
                </div>
                <button type="button" onClick={() => send('hide-skill', { skillId: skill.id, visible: !skill.visible })} className={quietButton}>{skill.visible ? 'Hide' : 'Show'}</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === 'references' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Teacher references</h2>
          <ul className="divide-y divide-border">
            {desk.endorsements.map((note) => (
              <li key={note.id} className="py-3">
                <p className="text-sm">{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note.teacherName} · Locked</p>
                <button type="button" onClick={() => send('hide-endorsement', { id: note.id, visible: !note.visible })} className={`${quietButton} mt-2`}>{note.visible ? 'Hide' : 'Show'}</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === 'matches' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">ET AI matcher</h2>
          <label className="block text-sm">Interests
            <input value={interests} onChange={(event) => setInterests(event.target.value)} className={fieldClass} placeholder="biology, design" />
          </label>
          <label className="block text-sm">CV version
            <input value={cvVersionId} onChange={(event) => setCvVersionId(event.target.value)} className={fieldClass} placeholder="Optional" />
          </label>
          <button type="button" onClick={() => send('interests', { interests: interests.split(',').map((item) => item.trim()).filter(Boolean) })} className={primaryButton}>Save interests</button>
          <ul className="divide-y divide-border">
            {desk.matches.map((row) => (
              <li key={row.id} className="flex min-h-12 flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-sm text-muted-foreground">{row.organisation} · {row.kind} · {row.deadline}</p>
                </div>
                <button type="button" onClick={() => send('save-match', { opportunityId: row.id, cvVersionId })} className={primaryButton}>Save to tracker</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === 'board' ? (
        <ul className="divide-y divide-border">
          {desk.openings.map((row) => (
            <li key={row.id} className="flex min-h-12 flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.employer} · {row.kind}{row.level ? ` · ${row.level}` : ''} · {row.deadline}</p>
              </div>
              <button type="button" onClick={() => send('apply-opening', { institutionId: row.institutionId, openingId: row.id, cvVersionId })} className={primaryButton}>Apply with this CV</button>
            </li>
          ))}
        </ul>
      ) : null}

      {section === 'giving' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Alumni giving</h2>
          {desk.campaigns.length === 0 ? <p className="text-sm text-muted-foreground">This academy has not opened alumni giving.</p> : null}
          {desk.campaigns.map((row) => (
            <div key={row.id} className="flex min-h-12 items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.kind} · sandbox</p>
              </div>
              <ProgressRing value={row.progress} label={`${row.title} ${row.progress}%`} />
              <button type="button" onClick={() => send('give', { institutionId: row.institutionId, campaignId: row.id, amount: 10 })} className={primaryButton}>Give 10 {row.currency}</button>
            </div>
          ))}
        </div>
      ) : null}

      {section === 'reunions' ? (
        <ul className="divide-y divide-border">
          {desk.reunions.map((row) => (
            <li key={row.id} className="py-3">
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm text-muted-foreground">{row.when} · {row.place} · {row.publicRsvpCount === null ? 'RSVPs stay private until five people reply' : `${row.publicRsvpCount} going`}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => send('rsvp', { institutionId: row.institutionId, reunionId: row.id, going: true })} className={primaryButton}>RSVP</button>
                {row.ticketed ? <button type="button" onClick={() => send('ticket', { institutionId: row.institutionId, reunionId: row.id })} className={quietButton}>Sandbox ticket</button> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {section === 'talks' ? (
        <div className="space-y-3">
          <ul className="divide-y divide-border">
            {desk.talks.map((row) => (
              <li key={row.id} className="min-h-12 py-3">
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.format}{row.provider ? ` · ${row.provider}` : ''}{row.level ? ` · ${row.level}` : ''} · {row.when}</p>
                {row.link ? <a href={row.link} className="mt-1 inline-flex min-h-12 items-center text-sm font-semibold text-primary">Open the talk</a> : null}
              </li>
            ))}
          </ul>
          <h2 className="font-heading text-xl">Offer a talk</h2>
          <p className="text-sm text-muted-foreground">An adult alumnus can offer a live Zoom, Meet, or Teams talk. The academy approves it before students see it.</p>
          <input value={talkTitle} onChange={(event) => setTalkTitle(event.target.value)} className={fieldClass} placeholder="Talk title" />
          <input value={talkLink} onChange={(event) => setTalkLink(event.target.value)} className={fieldClass} placeholder="https://meet.google.com/..." />
          <button type="button" onClick={() => send('propose-talk', { institutionId: desk.schools[0] ?? '', title: talkTitle, format: 'live', provider: 'meet', link: talkLink, level: '' })} className={primaryButton}>Offer this talk</button>
        </div>
      ) : null}

      {section === 'parents' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Parent summary</h2>
          <p className="text-sm text-muted-foreground">You are 18 or over. Parents keep the achievement PDF only if you agree.</p>
          <button type="button" onClick={() => send('parent-consent', { consent: true })} className={primaryButton}>Share the PDF with my parents</button>
        </div>
      ) : null}
    </CareerHome>
  );
}
