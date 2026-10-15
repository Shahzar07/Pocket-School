'use client';

import { FormEvent, useState } from 'react';
import { Camera, GraduationCap, Library, ShieldAlert, Star, UserRound } from 'lucide-react';
import { DashHeader, DashPage, EmptyState, ListRow, Panel, PanelHeader } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ContentEditor } from '@/components/editor';

export interface TutorCard { id: string; name: string; bio: string; subjects: string[]; hourlyCents: number }
export interface PaperCard { id: string; title: string; board: string; subject: string; minutes: number; license: string }
export interface ResourceCard { id: string; title: string; kind: string; status: string; priceCents: number; body?: string }
export interface QueueCard { id: string; surface?: string; text?: string; decision?: string; ageTier?: string }
export interface GuidanceCard { id: string; kind: string; title: string; detail: string }

export function TutorsScreen({
  tutors, note, onBook, onSaveProfile,
}: {
  tutors: TutorCard[];
  note?: string;
  onBook?: (tutorId: string, kind: 'one_to_one' | 'group') => void;
  onSaveProfile?: (bio: string, subjects: string, hourlyCents: number) => void;
}) {
  const [bio, setBio] = useState('');
  const [subjects, setSubjects] = useState('Maths');
  const [hourly, setHourly] = useState('4000');
  return (
    <DashPage>
      <DashHeader eyebrow="Marketplace" title="Tutors" accent="verified" description="Adults apply, an admin verifies them, and bookings take 1:1 or a group live class. Payment goes to the wallet interface." />
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Available tutors" />
          <div className="space-y-2">
            {tutors.length === 0 && <EmptyState icon={UserRound} title="No verified tutors yet" />}
            {tutors.map((tutor) => (
              <ListRow
                key={tutor.id}
                title={tutor.name}
                subtitle={`${tutor.subjects.join(', ')} · $${(tutor.hourlyCents / 100).toFixed(0)}/hour · ${tutor.bio}`}
                trailing={
                  <div className="flex gap-1">
                    <Button size="sm" className="rounded-xl" onClick={() => onBook?.(tutor.id, 'one_to_one')}>1:1</Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onBook?.(tutor.id, 'group')}>Group</Button>
                  </div>
                }
              />
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Your tutor profile" />
          <form className="space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); onSaveProfile?.(bio, subjects, Number(hourly) || 0); }}>
            <Textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="What you help with" className="rounded-xl min-h-24" />
            <Input value={subjects} onChange={(event) => setSubjects(event.target.value)} aria-label="Subjects" className="rounded-xl" />
            <Input value={hourly} onChange={(event) => setHourly(event.target.value)} aria-label="Hourly cents" className="rounded-xl" />
            <Button type="submit" className="rounded-xl" disabled={!onSaveProfile}>Submit for verification</Button>
          </form>
        </Panel>
      </div>
    </DashPage>
  );
}

export function ExamScreen({
  papers, suggestions, onStart, onGuide,
}: {
  papers: PaperCard[];
  suggestions: GuidanceCard[];
  onStart?: (paperId: string) => void;
  onGuide?: (interest: string) => void;
}) {
  const [interest, setInterest] = useState('Medicine');
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
          <form className="flex gap-2 mb-3" onSubmit={(event) => { event.preventDefault(); onGuide?.(interest); }}>
            <Input value={interest} onChange={(event) => setInterest(event.target.value)} aria-label="Interest" className="rounded-xl" />
            <Button type="submit" className="rounded-xl">Suggest</Button>
          </form>
          <div className="space-y-2">
            {suggestions.map((card) => (
              <ListRow key={card.id} title={card.title} subtitle={`${card.kind} · ${card.detail}`} />
            ))}
          </div>
        </Panel>
      </div>
    </DashPage>
  );
}

export function StoreScreen({
  resources, onCreate, onSubmit, onApprove,
}: {
  resources: ResourceCard[];
  onCreate?: (title: string, body: string, kind: string) => void;
  onSubmit?: (id: string) => void;
  onApprove?: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('note');
  const [body, setBody] = useState('');
  return (
    <DashPage>
      <DashHeader eyebrow="Creator store" title="Resources" accent="to share" description="Notes, worksheets, and templates. Allocation uses the same permission strings as courses. Marketplace listing needs admin approval." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Library" />
          <div className="space-y-2">
            {resources.length === 0 && <EmptyState icon={Library} title="Nothing approved yet" />}
            {resources.map((resource) => (
              <ListRow
                key={resource.id}
                title={resource.title}
                subtitle={`${resource.kind} · ${resource.status} · $${(resource.priceCents / 100).toFixed(0)}`}
                trailing={
                  <div className="flex gap-1">
                    {onSubmit && resource.status === 'draft' && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onSubmit(resource.id)}>Submit</Button>}
                    {onApprove && resource.status === 'pending' && <Button size="sm" className="rounded-xl" onClick={() => onApprove(resource.id)}>Approve</Button>}
                  </div>
                }
              />
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
            <ContentEditor value={body} onChange={setBody} placeholder="Write the note in markdown" />
            <Button className="rounded-xl" disabled={!onCreate} onClick={() => onCreate?.(title, body, kind)}>Save draft</Button>
          </div>
        </Panel>
      </div>
    </DashPage>
  );
}

export function SnapScreen({
  onSolve, result, blocked,
}: {
  onSolve?: (text: string, context: 'study' | 'assessment') => void;
  result?: { answer: string; steps: string[]; similar: string[] } | null;
  blocked?: string;
}) {
  const [text, setText] = useState('2x + 4 = 10');
  const [context, setContext] = useState<'study' | 'assessment'>('study');
  return (
    <DashPage>
      <DashHeader eyebrow="Study help" title="Snap" accent="and solve" description="A photo or the question text becomes a worked explanation and similar questions. It is refused during an assessment, and every attempt is logged." />
      <Panel>
        <div className="space-y-3">
          <Textarea value={text} onChange={(event) => setText(event.target.value)} className="rounded-xl min-h-24" aria-label="Question" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={context === 'study' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setContext('study')}>Studying</Button>
            <Button type="button" variant={context === 'assessment' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setContext('assessment')}>In an assessment</Button>
            <Button className="rounded-xl" onClick={() => onSolve?.(text, context)}><Camera className="w-4 h-4 mr-1" />Solve</Button>
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
  return (
    <Panel>
      <PanelHeader title="Lesson questions" meta={<Star className="w-4 h-4 text-primary" />} />
      <form className="space-y-2 mb-3" onSubmit={(event) => { event.preventDefault(); onAsk?.(body); setBody(''); }}>
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Ask about this lesson" className="rounded-xl min-h-20" />
        <Button type="submit" className="rounded-xl" disabled={!onAsk}>Ask</Button>
      </form>
      {suggestion && <p className="text-sm bg-muted rounded-xl p-3 mb-3"><span className="font-semibold">Suggested reply. </span>{suggestion}</p>}
      <div className="space-y-2">
        {questions.map((question) => (
          <ListRow
            key={question.id}
            title={question.body || ''}
            subtitle={question.publishedReply || question.aiSuggestedReply || question.status}
            trailing={onPublish && !question.publishedReply ? (
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onPublish(question.id, question.aiSuggestedReply || '')}>Publish suggestion</Button>
            ) : null}
          />
        ))}
      </div>
    </Panel>
  );
}
