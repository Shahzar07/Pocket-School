'use client';

import { useMemo, useState } from 'react';
import {
  certificatePreviewCopy,
  checklistBlocksPublish,
  diffSincePublish,
  flattenLessons,
  nextReviewStatus,
  previousReviewStatus,
  publishChecklist,
  REVIEW_FLOW,
  REVIEW_LABEL,
  snapshotFromCourse,
  statusAfterCoursePublish,
  type LessonComment,
  type PreviewCourse,
  type PublishedSnapshot,
  type ReviewStatus,
} from '@/lib/course-review';
import { LessonBody } from '@/components/lesson-body';

export function ReviewScreen({
  initial,
  snapshot,
  comments,
  staff = true,
  expiresAt,
  actorName = 'You',
  onStatus,
  onComment,
  onShare,
}: {
  initial: PreviewCourse;
  snapshot: PublishedSnapshot | null;
  comments: LessonComment[];
  staff?: boolean;
  expiresAt?: number;
  actorName?: string;
  onStatus?: (status: ReviewStatus, course: PreviewCourse, snapshot: PublishedSnapshot | null) => Promise<void> | void;
  onComment?: (comment: LessonComment) => Promise<void> | void;
  onShare?: (course: PreviewCourse) => Promise<string | null>;
}) {
  const [course, setCourse] = useState(initial);
  const [history, setHistory] = useState<PublishedSnapshot | null>(snapshot);
  const [notes, setNotes] = useState(comments);
  const [activeId, setActiveId] = useState(flattenLessons(initial)[0]?.id ?? '');
  const [draft, setDraft] = useState('');
  const [share, setShare] = useState('');
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const issues = useMemo(() => publishChecklist(course), [course]);
  const diff = useMemo(() => diffSincePublish(course, history), [course, history]);
  const active = flattenLessons(course).find(lesson => lesson.id === activeId) ?? flattenLessons(course)[0];
  const lessonNotes = notes.filter(note => note.lessonId === active?.id);

  const move = async (status: ReviewStatus) => {
    setBusy(true);
    try {
      let nextCourse = { ...course, status };
      let nextHistory = history;
      if (status === 'published') {
        nextCourse = {
          ...nextCourse,
          modules: course.modules.map(module => ({
            ...module,
            lessons: module.lessons.map(lesson => ({ ...lesson, status: statusAfterCoursePublish(lesson.status) })),
          })),
        };
        nextHistory = snapshotFromCourse(nextCourse, Date.now());
        setHistory(nextHistory);
      }
      setCourse(nextCourse);
      await onStatus?.(status, nextCourse, nextHistory);
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    const body = draft.trim();
    if (!active || !body) return;
    const comment: LessonComment = {
      id: `note-${Date.now()}`,
      lessonId: active.id,
      authorId: 'staff',
      authorName: actorName,
      body,
      createdAt: Date.now(),
    };
    setNotes(list => [...list, comment]);
    setDraft('');
    await onComment?.(comment);
  };

  const shareLink = async () => {
    setBusy(true);
    try {
      const href = await onShare?.(course);
      setShare(href || `${window.location.origin}/preview/course/sample`);
    } finally {
      setBusy(false);
    }
  };

  const forward = nextReviewStatus(course.status);
  const back = previousReviewStatus(course.status);
  const blocked = forward === 'published' && checklistBlocksPublish(issues) && !override;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="space-y-6" data-course-preview>
        {staff && (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Preview course. This is the student view of every module, lesson, quiz, picture, and the certificate. Students do not see it until it is published.
          </p>
        )}
        {expiresAt && (
          <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Shared preview. This link stops working {new Date(expiresAt).toLocaleString('en-GB')}.
          </p>
        )}
        <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2786A4] to-[#1E6A83] p-7 text-white sm:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
            {[course.subject, course.level, course.language].filter(Boolean).join(' · ') || 'Poket School'}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{course.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">{course.description}</p>
        </header>
        {course.modules.map((module, moduleIndex) => {
          const certificate = certificatePreviewCopy(course.title, module.title);
          return (
            <section key={module.id} className="overflow-hidden rounded-3xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Module {moduleIndex + 1}</p>
                <h2 className="font-heading text-2xl text-foreground">{module.title}</h2>
              </div>
              <div className="divide-y divide-border">
                {module.lessons.map(lesson => (
                  <div key={lesson.id} id={`lesson-${lesson.id}`} className="space-y-4 px-5 py-5">
                    <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setActiveId(lesson.id)}>
                      <h3 className="font-semibold text-foreground">{lesson.title}</h3>
                      <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{REVIEW_LABEL[lesson.status === 'archived' ? 'draft' : lesson.status] ?? lesson.status}</span>
                    </button>
                    {lesson.body.trim() ? <LessonBody markdown={lesson.body.replace(/\[Image\s+\d+\s*:\s*[^\]]*\]/gi, '').trim()} /> : (
                      <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">This lesson is empty.</p>
                    )}
                    {lesson.images.map((image, index) => image.src ? (
                      <figure key={`${lesson.id}-img-${index}`} className="overflow-hidden rounded-2xl border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.src} alt={image.alt} className="max-h-80 w-full object-cover" />
                        {image.caption && <figcaption className="px-3 py-2 text-center text-sm text-muted-foreground">{image.caption}</figcaption>}
                      </figure>
                    ) : (
                      <div key={`${lesson.id}-missing-${index}`} className="rounded-2xl border border-dashed border-amber-400 bg-amber-50 px-4 py-8 text-center text-sm text-amber-900">
                        Missing image · {image.alt}
                      </div>
                    ))}
                    {lesson.media.map(item => (
                      <div key={item.url} className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{item.kind}</p>
                        <p className="font-semibold text-foreground">{item.label}</p>
                      </div>
                    ))}
                    {lesson.quiz.length > 0 && (
                      <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Quiz</p>
                        {lesson.quiz.map(question => (
                          <fieldset key={question.question} className="space-y-2">
                            <legend className="text-sm font-semibold text-foreground">{question.question}</legend>
                            {question.options.map(option => {
                              const chosen = answers[question.question] === option;
                              const correct = option === question.answer;
                              return (
                                <label key={option} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${chosen && correct ? 'border-emerald-500 bg-emerald-50' : chosen ? 'border-amber-400 bg-amber-50' : 'border-border'}`}>
                                  <input
                                    type="radio"
                                    name={question.question}
                                    checked={chosen}
                                    onChange={() => setAnswers(map => ({ ...map, [question.question]: option }))}
                                  />
                                  {option}
                                </label>
                              );
                            })}
                          </fieldset>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="m-5 rounded-3xl border border-[#1E6A83]/20 bg-gradient-to-br from-[#F4FBFC] to-white p-6 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1E6A83]">Certificate</p>
                <p className="mt-2 font-heading text-2xl text-foreground">{certificate.courseTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{certificate.moduleTitle}</p>
                <p className="mt-4 text-sm text-foreground">Awarded to {certificate.studentName}</p>
                <p className="text-xs text-muted-foreground">Issued by {certificate.issuedByName}</p>
                <p className="mt-4 text-[11px] text-muted-foreground">{certificate.copyright}</p>
              </div>
            </section>
          );
        })}
      </article>

      {staff && (
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start" data-review-desk>
          <section className="rounded-3xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Review</p>
            <ol className="mt-3 space-y-2">
              {REVIEW_FLOW.map((step, index) => {
                const here = REVIEW_FLOW.indexOf(course.status);
                const done = index < here;
                const current = index === here;
                return (
                  <li key={step} className="flex items-center gap-2 text-sm">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${current ? 'bg-[#1E6A83] text-white' : done ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}>{index + 1}</span>
                    <span className={current ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{REVIEW_LABEL[step]}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex flex-col gap-2">
              {back && (
                <button type="button" disabled={busy} className="h-10 rounded-xl border border-border text-sm font-semibold" onClick={() => void move(back)}>
                  Back to {REVIEW_LABEL[back]}
                </button>
              )}
              {forward && (
                <button type="button" disabled={busy || blocked} className="h-10 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void move(forward)}>
                  Move to {REVIEW_LABEL[forward]}
                </button>
              )}
              {forward === 'published' && checklistBlocksPublish(issues) && (
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} />
                  Publish anyway. Empty lessons, missing images, and broken links stay hidden from students until they are fixed, except drafts which stay unpublished.
                </label>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Publish checklist</p>
            {issues.length === 0 ? <p className="mt-2 text-sm text-emerald-700">Ready to publish.</p> : (
              <ul className="mt-2 space-y-2">
                {issues.map(issue => (
                  <li key={`${issue.code}-${issue.lessonId}`} className="text-sm">
                    <button type="button" className="text-left font-semibold text-foreground underline-offset-2 hover:underline" onClick={() => {
                      setActiveId(issue.lessonId);
                      document.getElementById(`lesson-${issue.lessonId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>
                      {labelFor(issue.code)}
                    </button>
                    <p className="text-muted-foreground">{issue.lessonTitle}. {issue.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Since last publish</p>
            {diff.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing has changed.</p> : (
              <ul className="mt-2 space-y-2 text-sm">
                {diff.map(item => (
                  <li key={`${item.kind}-${item.id}`}>
                    <span className="font-semibold capitalize text-foreground">{item.kind}.</span> {item.title}. {item.detail}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Preview link</p>
            <p className="mt-2 text-xs text-muted-foreground">A reviewer can open the whole course for 7 days. The link does not appear on student pages.</p>
            <button type="button" className="mt-3 h-10 w-full rounded-xl border border-border text-sm font-semibold" onClick={() => void shareLink()}>
              Create preview link
            </button>
            {share && <p className="mt-2 break-all text-xs text-foreground">{share}</p>}
          </section>

          <section className="rounded-3xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Comments · {active?.title ?? 'Lesson'}</p>
            <ul className="mt-2 space-y-2">
              {lessonNotes.map(note => (
                <li key={note.id} className="rounded-2xl bg-muted/50 px-3 py-2 text-sm">
                  <p className="font-semibold text-foreground">{note.authorName}</p>
                  <p className="text-foreground">{note.body}</p>
                </li>
              ))}
              {lessonNotes.length === 0 && <li className="text-sm text-muted-foreground">No comments on this lesson yet.</li>}
            </ul>
            <label className="mt-3 block text-xs font-semibold text-muted-foreground" htmlFor="lesson-comment">Add a comment</label>
            <textarea id="lesson-comment" value={draft} onChange={event => setDraft(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="What should change before this lesson is approved?" />
            <button type="button" className="mt-2 h-9 rounded-xl bg-[#1E6A83] px-3 text-sm font-semibold text-white" onClick={() => void addNote()}>Save comment</button>
          </section>
        </aside>
      )}
    </div>
  );
}

function labelFor(code: string): string {
  if (code === 'missing_images') return 'Missing images';
  if (code === 'empty_lessons') return 'Empty lesson';
  if (code === 'broken_links') return 'Broken link';
  return 'No quiz';
}
