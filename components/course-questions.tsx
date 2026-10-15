'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { askCourseQuestion, replyToCourseQuestion, type CourseQuestion } from '@/lib/db';
import { toast } from 'sonner';

export function CourseQuestions({
  courseId,
  questions,
  mode,
  actorId,
  actorName,
  onChanged,
}: {
  courseId: string;
  questions: CourseQuestion[];
  mode: 'ask' | 'reply';
  actorId: string;
  actorName: string;
  onChanged: () => void;
}) {
  const [text, setText] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const mine = questions.filter(question => question.courseId === courseId || mode === 'reply');

  const ask = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await askCourseQuestion(courseId, { authorId: actorId, authorName: actorName, text });
      setText('');
      toast.success('Question sent to your instructor.');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the question.');
    } finally {
      setBusy(false);
    }
  };

  const reply = async (question: CourseQuestion) => {
    const body = replies[question.id]?.trim();
    if (!body) return;
    setBusy(true);
    try {
      await replyToCourseQuestion(question.courseId, question.id, body, actorId);
      toast.success('Reply saved.');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the reply.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3" data-course-qa>
      <h3 className="font-heading text-2xl text-foreground">Questions</h3>
      {mine.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
      <ul className="space-y-3">
        {mine.map(question => (
          <li key={question.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">{question.authorName}</p>
            <p className="text-sm text-foreground">{question.text}</p>
            {question.reply && <p className="text-sm text-muted-foreground">Instructor: {question.reply}</p>}
            {mode === 'reply' && !question.reply && (
              <div className="space-y-2">
                <Textarea
                  value={replies[question.id] ?? ''}
                  onChange={event => setReplies(current => ({ ...current, [question.id]: event.target.value }))}
                  placeholder="Write a reply"
                  rows={3}
                />
                <Button type="button" size="sm" className="rounded-full" disabled={busy} onClick={() => { void reply(question); }}>
                  Reply
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {mode === 'ask' && (
        <div className="space-y-2">
          <Textarea value={text} onChange={event => setText(event.target.value)} placeholder="Ask your instructor" rows={3} />
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => { void ask(); }}>
            Ask
          </Button>
        </div>
      )}
    </section>
  );
}
