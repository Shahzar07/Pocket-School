'use client';

import { FormEvent, useState } from 'react';
import { Camera, GraduationCap, Library, ShieldAlert, Star, UserRound } from 'lucide-react';
import { DashHeader, DashPage, EmptyState, ListRow, Panel, PanelHeader } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import dynamic from 'next/dynamic';

import { AllocationPicker } from '@/components/allocation-picker';

const ContentEditor = dynamic(
  () => import('@/components/editor/content-editor').then(mod => mod.ContentEditor),
  { ssr: false, loading: () => <div className="ps-skeleton h-40 rounded-2xl" aria-hidden="true" /> },
);

export interface TutorSlotCard { startAtMs: number; minutes: number }
export interface TutorCard { id: string; name: string; bio: string; subjects: string[]; hourlyCents: number; slots?: TutorSlotCard[] }
export interface BookingCard { id: string; tutorId: string; kind: string; startAtMs: number; minutes: number; status: string }
export interface PendingTutor { id: string; name: string; bio: string; subjects: string[] }
export interface QuestionCard { id: string; prompt: string; marks: number }
export interface PaperCard { id: string; title: string; board: string; subject: string; minutes: number; license: string; questions?: QuestionCard[] }
export interface AttemptCard { paperId: string; attemptId: string; endsAtMs: number; questions: QuestionCard[] }
export interface GradeCard { score: number; maxScore: number; predictedGrade: string }
export interface ResourceCard { id: string; title: string; kind: string; status: string; priceCents: number; body?: string; audiences?: string[] }
export interface QueueCard { id: string; surface?: string; text?: string; decision?: string; ageTier?: string }
export interface GuidanceCard { id: string; kind: string; title: string; detail: string }

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TutorsScreen({
  tutors, note, bookings, pending, onBook, onSaveProfile, onReview, onVerify,
}: {
  tutors: TutorCard[];
  note?: string;
  bookings?: BookingCard[];
  pending?: PendingTutor[];
  onBook?: (tutorId: string, kind: 'one_to_one' | 'group', startAtMs: number) => void;
  onSaveProfile?: (bio: string, subjects: string, hourlyCents: number, slots: TutorSlotCard[]) => void;
  onReview?: (bookingId: string, rating: number, body: string) => void;
  onVerify?: (tutorId: string, approve: boolean) => void;
}) {
  const [bio, setBio] = useState('');
  const [subjects, setSubjects] = useState('Maths');
  const [hourly, setHourly] = useState('4000');
  const [slotInput, setSlotInput] = useState('');
  const [slots, setSlots] = useState<TutorSlotCard[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [reviewFor, setReviewFor] = useState('');
  const [rating, setRating] = useState('5');
  const [reviewBody, setReviewBody] = useState('');

  const addSlot = () => {
    const startAtMs = new Date(slotInput).getTime();
    if (!Number.isFinite(startAtMs)) return;
    setSlots((current) => current.some((slot) => slot.startAtMs === startAtMs) ? current : [...current, { startAtMs, minutes: 60 }]);
    setSlotInput('');
  };

  return (
    <DashPage>
      <DashHeader eyebrow="Marketplace" title="Tutors" accent="verified" description="Adults apply, an admin verifies them, and bookings take 1:1 or a group live class. Payment goes to the wallet interface." />
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Available tutors" />
          <div className="space-y-2">
            {tutors.length === 0 && <EmptyState icon={UserRound} title="No verified tutors yet" />}
            {tutors.map((tutor) => {
              const open = tutor.slots ?? [];
              const startAtMs = open.length > 0 ? Number(chosen[tutor.id] || open[0]?.startAtMs) : Date.now() + 86_400_000;
              return (
                <ListRow
                  key={tutor.id}
                  title={tutor.name}
                  subtitle={`${tutor.subjects.join(', ')} · $${(tutor.hourlyCents / 100).toFixed(0)}/hour · ${tutor.bio}`}
                  trailing={
                    <div className="flex flex-wrap gap-1 justify-end">
                      {open.length > 0 && (
                        <select
                          aria-label={`Time with ${tutor.name}`}
                          className="h-8 rounded-xl border border-border bg-card px-2 text-xs"
                          value={String(startAtMs)}
                          onChange={(event) => setChosen((current) => ({ ...current, [tutor.id]: event.target.value }))}
                        >
                          {open.map((slot) => (
                            <option key={slot.startAtMs} value={slot.startAtMs}>{formatWhen(slot.startAtMs)} · {slot.minutes}m</option>
                          ))}
                        </select>
                      )}
                      <Button size="sm" className="rounded-xl" onClick={() => onBook?.(tutor.id, 'one_to_one', startAtMs)}>1:1</Button>
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onBook?.(tutor.id, 'group', startAtMs)}>Group</Button>
                    </div>
                  }
                />
              );
            })}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Your tutor profile" />
          <form className="space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); onSaveProfile?.(bio, subjects, Number(hourly) || 0, slots); }}>
            <Textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="What you help with" className="rounded-xl min-h-24" />
            <Input value={subjects} onChange={(event) => setSubjects(event.target.value)} aria-label="Subjects" className="rounded-xl" />
            <Input value={hourly} onChange={(event) => setHourly(event.target.value)} aria-label="Hourly cents" className="rounded-xl" />
            <div className="flex gap-2">
              <Input type="datetime-local" value={slotInput} onChange={(event) => setSlotInput(event.target.value)} aria-label="Open time" className="rounded-xl" />
              <Button type="button" variant="outline" className="rounded-xl" onClick={addSlot}>Add time</Button>
            </div>
            {slots.length > 0 && <p className="text-xs text-muted-foreground">{slots.map((slot) => formatWhen(slot.startAtMs)).join(' · ')}</p>}
            <Button type="submit" className="rounded-xl" disabled={!onSaveProfile}>Submit for verification</Button>
          </form>
        </Panel>
      </div>
      {bookings && (
        <Panel>
          <PanelHeader title="Your bookings" />
          <div className="space-y-2">
            {bookings.length === 0 && <EmptyState icon={UserRound} title="No bookings yet" />}
            {bookings.map((booking) => (
              <ListRow
                key={booking.id}
                title={`${booking.kind === 'group' ? 'Group' : '1:1'} · ${formatWhen(booking.startAtMs)}`}
                subtitle={`${booking.status} · ${booking.minutes} min`}
                trailing={booking.status === 'booked' && onReview ? (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setReviewFor(booking.id)}>Review</Button>
                ) : null}
              />
            ))}
            {reviewFor && onReview && (
              <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); onReview(reviewFor, Number(rating) || 5, reviewBody); setReviewFor(''); setReviewBody(''); }}>
                <Input value={rating} onChange={(event) => setRating(event.target.value)} aria-label="Rating" className="rounded-xl w-20" />
                <Input value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} aria-label="Review" placeholder="How was the session?" className="rounded-xl flex-1" />
                <Button type="submit" className="rounded-xl">Send review</Button>
              </form>
            )}
          </div>
        </Panel>
      )}
      {pending && onVerify && (
        <Panel>
          <PanelHeader title="Waiting for verification" />
          <div className="space-y-2">
            {pending.length === 0 && <EmptyState icon={UserRound} title="No tutors waiting" />}
            {pending.map((tutor) => (
              <ListRow
                key={tutor.id}
                title={tutor.name}
                subtitle={`${tutor.subjects.join(', ')} · ${tutor.bio}`}
                trailing={
                  <div className="flex gap-1">
                    <Button size="sm" className="rounded-xl" onClick={() => onVerify(tutor.id, true)}>Verify</Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onVerify(tutor.id, false)}>Reject</Button>
                  </div>
                }
              />
            ))}
          </div>
        </Panel>
      )}
    </DashPage>
  );
}

const GUIDE_SUBJECTS = ['biology', 'chemistry', 'maths', 'physics', 'english'] as const;

export function ExamScreen({
  papers, suggestions, attempt, result, onStart, onSubmit, onGuide, onUpload,
}: {
  papers: PaperCard[];
  suggestions: GuidanceCard[];
  attempt?: AttemptCard | null;
  result?: GradeCard | null;
  onStart?: (paperId: string) => void;
  onSubmit?: (attemptId: string, answers: Record<string, string>) => void;
  onGuide?: (interest: string, grades: Record<string, string>) => void;
  onUpload?: (paper: { title: string; board: string; subject: string; minutes: number; questions: { prompt: string; answer: string; marks: number }[] }) => void;
}) {
  const [interest, setInterest] = useState('Medicine');
  const [grades, setGrades] = useState<Record<string, string>>({ biology: 'A', chemistry: 'A', maths: 'A', physics: 'B', english: 'B' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [board, setBoard] = useState('School');
  const [subject, setSubject] = useState('Maths');
  const [minutes, setMinutes] = useState('45');
  const [lines, setLines] = useState('Simplify 2x + 4 = 10 | x = 3 | 2');

  const parseLines = () => lines.split('\n').map((line) => {
    const [prompt, answer, marks] = line.split('|').map((part) => part.trim());
    return { prompt: prompt || '', answer: answer || '', marks: Number(marks) || 1 };
  }).filter((question) => question.prompt);

  return (
    <DashPage>
      <DashHeader eyebrow="Exam centre" title="Papers" accent="and guidance" description="Past papers are licensed or uploaded by a teacher. Mocks are timed on the server and return a predicted grade." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Past papers" />
          <div className="space-y-2">
            {papers.length === 0 && <EmptyState icon={GraduationCap} title="No papers published" />}
            {papers.map((paper) => (
              <ListRow
                key={paper.id}
                title={paper.title}
                subtitle={`${paper.board} · ${paper.subject} · ${paper.minutes} min · ${paper.license}`}
                trailing={<Button size="sm" className="rounded-xl" onClick={() => onStart?.(paper.id)}>Start mock</Button>}
              />
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="University and careers" />
          <form className="space-y-2 mb-3" onSubmit={(event) => { event.preventDefault(); onGuide?.(interest, grades); }}>
            <div className="flex gap-2">
              <Input value={interest} onChange={(event) => setInterest(event.target.value)} aria-label="Interest" className="rounded-xl" />
              <Button type="submit" className="rounded-xl">Suggest</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GUIDE_SUBJECTS.map((subjectName) => (
                <Input
                  key={subjectName}
                  value={grades[subjectName] ?? ''}
                  aria-label={`${subjectName} grade`}
                  className="rounded-xl"
                  onChange={(event) => setGrades((current) => ({ ...current, [subjectName]: event.target.value }))}
                />
              ))}
            </div>
          </form>
          <div className="space-y-2">
            {suggestions.map((card) => (
              <ListRow key={card.id} title={card.title} subtitle={`${card.kind} · ${card.detail}`} />
            ))}
          </div>
        </Panel>
      </div>
      {attempt && (
        <Panel>
          <PanelHeader title="Timed mock" meta={<span className="text-xs text-muted-foreground">Closes {formatWhen(attempt.endsAtMs)}</span>} />
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onSubmit?.(attempt.attemptId, answers); }}>
            {attempt.questions.map((question) => (
              <label key={question.id} className="block space-y-1">
                <span className="text-sm">{question.prompt} <span className="text-muted-foreground">({question.marks})</span></span>
                <Input value={answers[question.id] ?? ''} aria-label={question.prompt} className="rounded-xl" onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
              </label>
            ))}
            <Button type="submit" className="rounded-xl" disabled={!onSubmit}>Submit paper</Button>
          </form>
          {result && <p className="text-sm mt-3">Score {result.score}/{result.maxScore}. Predicted grade {result.predictedGrade}.</p>}
        </Panel>
      )}
      {onUpload && (
        <Panel>
          <PanelHeader title="Upload a teacher paper" />
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            onUpload({ title, board, subject, minutes: Number(minutes) || 45, questions: parseLines() });
          }}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" aria-label="Paper title" className="rounded-xl" />
            <div className="grid grid-cols-3 gap-2">
              <Input value={board} onChange={(event) => setBoard(event.target.value)} aria-label="Board" className="rounded-xl" />
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Subject" className="rounded-xl" />
              <Input value={minutes} onChange={(event) => setMinutes(event.target.value)} aria-label="Minutes" className="rounded-xl" />
            </div>
            <Textarea value={lines} onChange={(event) => setLines(event.target.value)} aria-label="Questions" className="rounded-xl min-h-24" placeholder="prompt | answer | marks" />
            <Button type="submit" className="rounded-xl">Publish paper</Button>
          </form>
        </Panel>
      )}
    </DashPage>
  );
}

export function StoreScreen({
  resources, onCreate, onSubmit, onApprove, onAllocate,
}: {
  resources: ResourceCard[];
  onCreate?: (title: string, body: string, kind: string, audiences: string[]) => void;
  onSubmit?: (id: string) => void;
  onApprove?: (id: string) => void;
  onAllocate?: (id: string, studentId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('note');
  const [body, setBody] = useState('');
  const [audiences, setAudiences] = useState<string[]>(['students', 'marketplace']);
  const [studentId, setStudentId] = useState('');
  const [allocateFor, setAllocateFor] = useState('');
  return (
    <DashPage>
      <DashHeader eyebrow="Creator store" title="Resources" accent="to share" description="Notes, worksheets, and templates. Allocation uses the same permission strings as courses. Marketplace listing needs admin approval." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Library" />
          <div className="space-y-2">
            {resources.length === 0 && <EmptyState icon={Library} title="Nothing approved yet" />}
            {resources.map((resource) => (
              <div key={resource.id} className="space-y-2">
                <ListRow
                  title={resource.title}
                  subtitle={`${resource.kind} · ${resource.status} · $${(resource.priceCents / 100).toFixed(0)}${resource.audiences?.length ? ` · ${resource.audiences.join(', ')}` : ''}`}
                  trailing={
                    <div className="flex gap-1">
                      {onSubmit && resource.status === 'draft' && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onSubmit(resource.id)}>Submit</Button>}
                      {onApprove && resource.status === 'pending' && <Button size="sm" className="rounded-xl" onClick={() => onApprove(resource.id)}>Approve</Button>}
                      {onAllocate && resource.status === 'approved' && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setAllocateFor(resource.id)}>Allocate</Button>}
                    </div>
                  }
                />
                {allocateFor === resource.id && onAllocate && (
                  <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); onAllocate(resource.id, studentId); setStudentId(''); }}>
                    <Input value={studentId} onChange={(event) => setStudentId(event.target.value)} aria-label="Student id" placeholder="Student id" className="rounded-xl" />
                    <Button type="submit" className="rounded-xl">Grant</Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Write a resource" />
          <div className="space-y-3">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="rounded-xl" aria-label="Resource title" />
            <select value={kind} onChange={(event) => setKind(event.target.value)} className="h-10 rounded-xl border border-border bg-card px-2 text-sm" aria-label="Resource kind">
              <option value="note">Note</option>
              <option value="worksheet">Worksheet</option>
              <option value="template">Template</option>
            </select>
            <AllocationPicker value={audiences} onChange={setAudiences} label="Who can use this" />
            <ContentEditor value={body} onChange={setBody} placeholder="Write the note in markdown" />
            <Button className="rounded-xl" disabled={!onCreate} onClick={() => onCreate?.(title, body, kind, audiences)}>Save draft</Button>
          </div>
        </Panel>
      </div>
    </DashPage>
  );
}

export function SnapScreen({
  onSolve, result, blocked,
}: {
  onSolve?: (text: string, context: 'study' | 'assessment', imageBase64?: string) => void;
  result?: { answer: string; steps: string[]; similar: string[] } | null;
  blocked?: string;
}) {
  const [text, setText] = useState('2x + 4 = 10');
  const [context, setContext] = useState<'study' | 'assessment'>('study');
  const [photo, setPhoto] = useState('');
  const [photoNote, setPhotoNote] = useState('');

  const readPhoto = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_200_000) {
      setPhoto('');
      setPhotoNote('That photo is too large. Use one under 1.2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(typeof reader.result === 'string' ? reader.result : '');
      setPhotoNote(file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <DashPage>
      <DashHeader eyebrow="Study help" title="Snap" accent="and solve" description="A photo or the question text becomes a worked explanation and similar questions. It is refused during an assessment, and every attempt is logged." />
      <Panel>
        <div className="space-y-3">
          <Textarea value={text} onChange={(event) => setText(event.target.value)} className="rounded-xl min-h-24" aria-label="Question" />
          <Input type="file" accept="image/*" aria-label="Question photo" className="rounded-xl" onChange={(event) => readPhoto(event.target.files?.[0])} />
          {photoNote && <p className="text-xs text-muted-foreground">{photoNote}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={context === 'study' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setContext('study')}>Studying</Button>
            <Button type="button" variant={context === 'assessment' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setContext('assessment')}>In an assessment</Button>
            <Button className="rounded-xl" onClick={() => onSolve?.(photo ? '' : text, context, photo || undefined)}><Camera className="w-4 h-4 mr-1" />Solve</Button>
          </div>
          {blocked && <p className="text-sm text-destructive">{blocked}</p>}
          {result && (
            <div className="space-y-2">
              <p className="font-semibold">{result.answer}</p>
              {result.steps.map((step) => <p key={step} className="text-sm text-muted-foreground">{step}</p>)}
              <p className="text-[12px] font-semibold uppercase tracking-wide text-primary">Similar</p>
              {result.similar.map((item) => <p key={item} className="text-sm">{item}</p>)}
            </div>
          )}
        </div>
      </Panel>
    </DashPage>
  );
}

export function ModerationScreen({
  items, onResolve,
}: {
  items: QueueCard[];
  onResolve?: (id: string, approve: boolean) => void;
}) {
  return (
    <DashPage>
      <DashHeader eyebrow="Admin" title="Moderation" accent="queue" description="Community, messages, lesson questions, and reports land here when the moderation route holds or blocks them." />
      <Panel>
        <div className="space-y-2">
          {items.length === 0 && <EmptyState icon={ShieldAlert} title="Queue is clear" />}
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={item.text || 'Item'}
              subtitle={`${item.surface || 'community'} · ${item.decision || 'hold'} · ${item.ageTier || ''}`}
              trailing={
                <div className="flex gap-1">
                  <Button size="sm" className="rounded-xl" onClick={() => onResolve?.(item.id, true)}>Allow</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onResolve?.(item.id, false)}>Reject</Button>
                </div>
              }
            />
          ))}
        </div>
      </Panel>
    </DashPage>
  );
}

export function LessonQaScreen({
  questions, suggestion, onAsk, onPublish,
}: {
  questions: { id: string; body?: string; aiSuggestedReply?: string; publishedReply?: string; status?: string }[];
  suggestion?: string;
  onAsk?: (body: string) => void;
  onPublish?: (id: string, reply: string) => void;
}) {
  const [body, setBody] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <Panel>
      <PanelHeader title="Lesson questions" meta={<Star className="w-4 h-4 text-primary" />} />
      <form className="space-y-2 mb-3" onSubmit={(event) => { event.preventDefault(); onAsk?.(body); setBody(''); }}>
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Ask about this lesson" className="rounded-xl min-h-20" />
        <Button type="submit" className="rounded-xl" disabled={!onAsk}>Ask</Button>
      </form>
      {suggestion && <p className="text-sm bg-muted rounded-xl p-3 mb-3"><span className="font-semibold">Suggested reply. </span>{suggestion}</p>}
      <div className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="space-y-2">
            <ListRow
              title={question.body || ''}
              subtitle={question.publishedReply || question.status}
            />
            {onPublish && !question.publishedReply && (
              <div className="space-y-2">
                <Textarea
                  value={drafts[question.id] ?? question.aiSuggestedReply ?? ''}
                  aria-label="Reply"
                  className="rounded-xl min-h-20"
                  onChange={(event) => setDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                />
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onPublish(question.id, drafts[question.id] ?? question.aiSuggestedReply ?? '')}>Publish reply</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
