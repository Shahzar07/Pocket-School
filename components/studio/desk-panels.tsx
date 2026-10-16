'use client';

import { useEffect, useState } from 'react';
import { DeskFrame } from '@/components/studio/desk-frame';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { EssayDelivery } from '@/components/essays/essay-delivery';
import { authedFetch, ApiError } from '@/lib/api-client';
import { createCourse, createLesson, createModule, getChildrenProfiles, getTeacherCourses, type Course } from '@/lib/db';
import { sparksCostLine } from '@/lib/design/system';
import { useAuthSTORE } from '@/hooks/use-auth';
import { LANGUAGES } from '@/lib/languages';
import { PROGRAMMES } from '@/lib/programmes';
import {
  canUseDeskTool,
  deskSparkCost,
  explainerLines,
  parentExplainerFromFacts,
  RESEARCH_INTEGRITY,
  researchLines,
  teacherFallback,
  toolkitLessonBody,
  toolkitLines,
  TOOLKIT_KINDS,
  type DeskToolId,
  type ParentExplainer,
  type ResearchPack,
  type TeacherPack,
  type ToolkitKind,
} from '@/lib/studio/desk';

const FIELD = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground';

function rememberBalance(balance: unknown) {
  if (typeof balance !== 'number') return;
  const { profile, setProfile } = useAuthSTORE.getState();
  if (profile) setProfile({ ...profile, sparksBalance: balance });
}

async function askDesk(body: Record<string, unknown>) {
  const data = await authedFetch('/api/ai/studio-desk', { method: 'POST', body: JSON.stringify(body) });
  rememberBalance(data.balance);
  return data;
}

function failure(error: unknown, fallback: string) {
  toast.error(error instanceof ApiError ? error.message : fallback);
}

export { DeskFrame };

function Locked({ tool }: { tool: DeskToolId }) {
  const copy = tool === 'teacher-toolkit'
    ? 'Teacher Toolkit is for teachers and institution staff.'
    : tool === 'parent-explainer'
      ? 'Parent Explainer is for parents, and only for children linked to you.'
      : 'Research Helper is for students and teachers.';
  return <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">{copy}</p>;
}

export function TeacherPackView({ pack }: { pack: TeacherPack }) {
  return (
    <div className="space-y-4" data-testid="teacher-pack">
      <header>
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#C45C26]">{pack.subject} · {pack.level}</p>
        <h2 className="font-heading text-2xl text-foreground">{pack.title}</h2>
      </header>
      <Section title="Objectives" items={pack.objectives} />
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold text-foreground">Lesson plan</h3>
        <p className="mt-2 text-sm text-foreground"><span className="font-semibold">Starter. </span>{pack.lessonPlan.starter}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
          {pack.lessonPlan.main.map(item => <li key={item}>{item}</li>)}
        </ul>
        <p className="mt-2 text-sm text-foreground"><span className="font-semibold">Plenary. </span>{pack.lessonPlan.plenary}</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold text-foreground">Worksheet</h3>
        <p className="mt-2 text-sm text-foreground">{pack.worksheet.instructions}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{pack.worksheet.tasks.map(item => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="rounded-2xl border border-[#C45C26]/30 bg-[#FBF0E8] p-4 text-[#3A2418] dark:bg-[#2A1C14] dark:text-[#F0C2A4]">
        <h3 className="font-semibold">Same task, three versions</h3>
        <p className="mt-2 text-sm">{pack.differentiated.task}</p>
        <p className="mt-3 text-sm"><span className="font-semibold">Support, including SEN. </span>{pack.differentiated.support}</p>
        <p className="mt-2 text-sm"><span className="font-semibold">Core. </span>{pack.differentiated.core}</p>
        <p className="mt-2 text-sm"><span className="font-semibold">Stretch. </span>{pack.differentiated.stretch}</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold">Rubric</h3>
        <ul className="mt-3 space-y-3">
          {pack.rubric.map(row => (
            <li key={row.criterion} className="text-sm">
              <p className="font-semibold">{row.criterion}</p>
              <p>Support: {row.support}</p>
              <p>Core: {row.core}</p>
              <p>Stretch: {row.stretch}</p>
            </li>
          ))}
        </ul>
      </section>
      <Section title="Exit ticket" items={pack.exitTicket} />
      <p className="text-sm text-muted-foreground">{pack.teacherNotes}</p>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

export function TeacherToolkitPanel({ sample = false }: { sample?: boolean }) {
  const { user, profile } = useAuthSTORE();
  const allowed = sample || canUseDeskTool(profile, 'teacher-toolkit');
  const [subject, setSubject] = useState(sample ? 'Science' : 'Mathematics');
  const [topic, setTopic] = useState(sample ? 'Photosynthesis' : '');
  const [level, setLevel] = useState(sample ? 'IGCSE' : (PROGRAMMES[0]?.label ?? 'Primary'));
  const [kind, setKind] = useState<ToolkitKind>('pack');
  const [busy, setBusy] = useState(false);
  const [pack, setPack] = useState<TeacherPack | null>(sample ? teacherFallback({
    topic: 'Photosynthesis',
    subject: 'Science',
    level: 'IGCSE',
    kind: 'pack',
  }) : null);
  const [drafts, setDrafts] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('new');
  const [saving, setSaving] = useState(false);
  const [savedHref, setSavedHref] = useState('');

  useEffect(() => {
    if (sample || !user || !allowed) return;
    getTeacherCourses(user.uid).then(rows => {
      setDrafts(rows.filter(course => course.status === 'draft'));
    }).catch(() => setDrafts([]));
  }, [user, allowed, sample]);

  if (!allowed) return <Locked tool="teacher-toolkit" />;

  async function generate() {
    if (sample) {
      setPack(teacherFallback({ topic, subject, level, kind }));
      return;
    }
    setBusy(true);
    setSavedHref('');
    try {
      const data = await askDesk({ tool: 'teacher-toolkit', subject, topic, level, kind });
      setPack(data.result as TeacherPack);
      toast.success('Pack ready. It is a draft until you publish it.');
    } catch (error) {
      failure(error, 'ET AI could not make that pack.');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (sample) {
      toast.message('This preview does not save a course.');
      return;
    }
    if (!pack || !user) return;
    setSaving(true);
    try {
      let id = courseId;
      if (id === 'new') {
        id = await createCourse({
          title: pack.title,
          description: pack.teacherNotes,
          ownerId: user.uid,
          ownerName: profile?.name || 'Teacher',
          status: 'draft',
          subject: pack.subject,
          level: pack.level,
          isPublic: false,
          enrollmentCount: 0,
        });
      }
      const moduleId = await createModule(id, {
        title: pack.title,
        description: 'ET AI Teacher Toolkit draft',
        courseId: id,
        order: 0,
      });
      await createLesson(id, moduleId, {
        title: pack.title,
        moduleId,
        courseId: id,
        order: 0,
        status: 'draft',
        teacherNotes: pack.teacherNotes,
        lessonType: 'lesson',
        aiOutputs: { text: toolkitLessonBody(pack), notes: pack.teacherNotes },
      });
      setSavedHref(`/dashboard/teacher/courses/${id}`);
      toast.success('Saved to your course drafts.');
    } catch (error) {
      failure(error, 'The draft could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void generate(); }}>
        <label className="text-sm font-semibold">Subject
          <input className={`${FIELD} mt-1 font-normal`} value={subject} onChange={event => setSubject(event.target.value)} required />
        </label>
        <label className="text-sm font-semibold">Programme
          <select className={`${FIELD} mt-1 font-normal`} value={level} onChange={event => setLevel(event.target.value)} aria-label="Programme">
            {PROGRAMMES.map(programme => <option key={programme.value} value={programme.label}>{programme.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">Topic
          <input className={`${FIELD} mt-1 font-normal`} value={topic} onChange={event => setTopic(event.target.value)} placeholder="Photosynthesis" required />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">What to make
          <select className={`${FIELD} mt-1 font-normal`} value={kind} onChange={event => setKind(event.target.value as ToolkitKind)} aria-label="What to make">
            {TOOLKIT_KINDS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <p className="text-sm text-muted-foreground sm:col-span-2">{sparksCostLine(deskSparkCost('teacher-toolkit'), profile?.sparksBalance)}</p>
        <button type="submit" disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#C45C26] px-4 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-fit">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Make the pack
        </button>
      </form>
      {pack && (
        <>
          <TeacherPackView pack={pack} />
          <EssayDelivery title={pack.title} lines={toolkitLines(pack)} holderEmail={user?.email ?? undefined} />
          <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void saveDraft(); }}>
            <label className="text-sm font-semibold">Course draft
              <select className={`${FIELD} mt-1 font-normal`} value={courseId} onChange={event => setCourseId(event.target.value)} aria-label="Course draft">
                <option value="new">New draft course</option>
                {drafts.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </label>
            <button type="submit" disabled={saving} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">
              {saving ? 'Saving…' : 'Save to course drafts'}
            </button>
            {savedHref && <Link href={savedHref} className="text-sm font-semibold text-[#1E6A83] hover:underline">Open the draft</Link>}
          </form>
        </>
      )}
    </div>
  );
}

export function ParentExplainerView({ note }: { note: ParentExplainer }) {
  return (
    <div className="space-y-4" data-testid="parent-explainer">
      <section className="rounded-2xl border border-[#8B3A62]/30 bg-[#F8EEF3] p-4 dark:bg-[#2A1822]">
        <h2 className="font-heading text-2xl text-foreground">What {note.childName} learned</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{note.learned}</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold">Strengths</h3>
        <p className="mt-2 text-sm leading-relaxed">{note.strengths}</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold">Gaps</h3>
        <p className="mt-2 text-sm leading-relaxed">{note.gaps}</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold">How to help at home</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {note.helpAtHome.map(item => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </div>
  );
}

const SAMPLE_NOTE = parentExplainerFromFacts({
  childName: 'Mina',
  studyMinutes: 40,
  quizAverage: 72,
  mastery: 61,
  lessonsCompleted: 3,
  goalsMet: 2,
  goalsMissed: 1,
  strengths: ['fractions'],
  gaps: ['decimals'],
  courses: [{ label: 'Mathematics', progress: 48 }],
  goalTitles: ['Finish the fractions goal'],
  misconceptions: ['place value'],
});

export function ParentExplainerPanel({ sample = false }: { sample?: boolean }) {
  const { user, profile } = useAuthSTORE();
  const allowed = sample || canUseDeskTool(profile, 'parent-explainer');
  const [children, setChildren] = useState<{ id: string; name: string }[]>(sample ? [{ id: 'mina', name: 'Mina' }] : []);
  const [childId, setChildId] = useState(sample ? 'mina' : '');
  const [language, setLanguage] = useState(profile?.language || 'en');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<ParentExplainer | null>(sample ? SAMPLE_NOTE : null);

  useEffect(() => {
    if (sample || !user || !allowed) return;
    getChildrenProfiles(user.uid).then(rows => {
      const list = rows.map(row => ({ id: row.id, name: row.data.name || 'Your child' }));
      setChildren(list);
      setChildId(current => current || list[0]?.id || '');
    }).catch(() => setChildren([]));
  }, [user, allowed, sample]);

  if (!allowed) return <Locked tool="parent-explainer" />;

  async function generate() {
    if (sample) {
      setNote(SAMPLE_NOTE);
      return;
    }
    setBusy(true);
    try {
      const data = await askDesk({ tool: 'parent-explainer', childId, language });
      setNote(data.result as ParentExplainer);
    } catch (error) {
      failure(error, 'ET AI could not write that note.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {children.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Link a child from your parent home before ET AI can explain their week. Only children who approved the link are listed.
        </p>
      ) : (
        <form className="grid gap-3 rounded-2xl border border-border bg-card p-4" onSubmit={event => { event.preventDefault(); void generate(); }}>
          <label className="text-sm font-semibold">Child
            <select className={`${FIELD} mt-1 font-normal`} value={childId} onChange={event => setChildId(event.target.value)} aria-label="Child">
              {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Language
            <select className={`${FIELD} mt-1 font-normal`} value={language} onChange={event => setLanguage(event.target.value)} aria-label="Language">
              {LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">{sparksCostLine(deskSparkCost('parent-explainer'), profile?.sparksBalance)} An empty week is free, and ET AI will not invent one.</p>
          <button type="submit" disabled={busy || !childId} className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-[#8B3A62] px-4 text-sm font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Explain this week
          </button>
        </form>
      )}
      {note && (
        <>
          <ParentExplainerView note={note} />
          <EssayDelivery title={`Week for ${note.childName}`} lines={explainerLines(note)} holderEmail={user?.email ?? undefined} />
        </>
      )}
    </div>
  );
}

export function ResearchPackView({ pack }: { pack: ResearchPack }) {
  return (
    <div className="space-y-4" data-testid="research-pack">
      {pack.refusedWriting && (
        <p className="text-sm font-semibold text-foreground">That asked ET AI to write the work. The sources below are for your question. The assignment is still yours to write.</p>
      )}
      <h2 className="font-heading text-2xl text-foreground">{pack.question}</h2>
      <ul className="space-y-3">
        {pack.sources.map(source => (
          <li key={`${source.title}-${source.url}`} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-semibold text-foreground">{source.title}</p>
            <p className="text-sm text-muted-foreground">{source.authors}</p>
            {source.url && <p className="mt-1 break-all text-sm text-[#2457A6] dark:text-[#C5D4F0]">{source.url}</p>}
            <p className="mt-2 text-sm leading-relaxed">{source.summary}</p>
            <p className="mt-2 text-sm"><span className="font-semibold">Credibility. </span>{source.credibility}</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div><dt className="inline font-semibold">APA. </dt><dd className="inline">{source.citations.apa}</dd></div>
              <div><dt className="inline font-semibold">Harvard. </dt><dd className="inline">{source.citations.harvard}</dd></div>
              <div><dt className="inline font-semibold">MLA. </dt><dd className="inline">{source.citations.mla}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <section>
        <h3 className="font-semibold">What to do next</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {pack.nextSteps.map(step => <li key={step}>{step}</li>)}
        </ul>
      </section>
    </div>
  );
}

const SAMPLE_RESEARCH: ResearchPack = {
  question: 'How do plants store energy from light?',
  integrity: RESEARCH_INTEGRITY,
  refusedWriting: false,
  nextSteps: [
    'Read one source and note the claim you might use.',
    'Check the credibility note before you quote it.',
    'Write the assignment yourself.',
  ],
  sources: [
    {
      title: 'NASA Climate',
      authors: 'NASA',
      url: 'https://climate.nasa.gov',
      summary: 'A public page on how plants use light. It describes the process. It is not a finished answer.',
      credibility: 'A government science office. Check the date on the page before you cite it.',
      citations: {
        apa: 'NASA. NASA Climate. https://climate.nasa.gov',
        harvard: 'NASA, NASA Climate. Available at: https://climate.nasa.gov',
        mla: 'NASA. "NASA Climate." https://climate.nasa.gov',
      },
    },
  ],
};

export function ResearchHelperPanel({ sample = false }: { sample?: boolean }) {
  const { user, profile } = useAuthSTORE();
  const allowed = sample || canUseDeskTool(profile, 'research-helper');
  const [question, setQuestion] = useState(sample ? SAMPLE_RESEARCH.question : '');
  const [busy, setBusy] = useState(false);
  const [pack, setPack] = useState<ResearchPack | null>(sample ? SAMPLE_RESEARCH : null);

  if (!allowed) return <Locked tool="research-helper" />;

  async function generate() {
    if (sample) {
      setPack({ ...SAMPLE_RESEARCH, question: question || SAMPLE_RESEARCH.question });
      return;
    }
    setBusy(true);
    try {
      const data = await askDesk({ tool: 'research-helper', question });
      setPack(data.result as ResearchPack);
    } catch (error) {
      failure(error, 'ET AI could not find sources.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="rounded-2xl border border-[#2457A6]/30 bg-[#EAF0FA] p-4 text-sm leading-relaxed text-[#152033] dark:bg-[#152033] dark:text-[#C5D4F0]">{RESEARCH_INTEGRITY}</p>
      <form className="space-y-3 rounded-2xl border border-border bg-card p-4" onSubmit={event => { event.preventDefault(); void generate(); }}>
        <label className="text-sm font-semibold">Research question
          <textarea className={`${FIELD} mt-1 min-h-24 font-normal`} value={question} onChange={event => setQuestion(event.target.value)} placeholder="How do plants store energy from light?" required />
        </label>
        <p className="text-sm text-muted-foreground">{sparksCostLine(deskSparkCost('research-helper'), profile?.sparksBalance)} Sparks are spent only when sources come back.</p>
        <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#2457A6] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Find sources
        </button>
      </form>
      {pack && (
        <>
          <ResearchPackView pack={pack} />
          <EssayDelivery title={pack.question} lines={researchLines(pack)} holderEmail={user?.email ?? undefined} />
        </>
      )}
    </div>
  );
}
