'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ContentEditor } from '@/components/editor';
import { CoverArtPicker, storeMedia } from '@/components/media';
import { AllocationPanel } from '@/components/allocation-panel';
import { CourseStudentPreview } from '@/components/course-student-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePricing } from '@/hooks/use-pricing';
import {
  COURSE_CATEGORIES,
  COURSE_LANGUAGES,
  COURSE_LEVELS,
  STUDIO_STEPS,
  applyAllocationPreset,
  blankPolicy,
  courseWrite,
  emptyLecture,
  emptySection,
  moveStudioLecture,
  moveStudioSection,
  publishDecision,
  type AllocationTarget,
  type LectureKind,
  type StudioLecture,
  type StudioRole,
  type StudioSection,
  type StudioStep,
} from '@/lib/course-builder';
import type { AccessPolicy } from '@/lib/access-policy';
import { describeAccess } from '@/lib/access-policy';
import { describeTargets, migrateAllocation } from '@/lib/allocation-targets';
import {
  createCouponCode,
  createCourse,
  createLesson,
  createModule,
  deleteLesson,
  deleteUnit,
  generateCouponCode,
  saveAccessGrants,
  updateCourse,
  updateLesson,
  updateUnit,
  writeAccessAudit,
  type Course,
  type Institution,
  type Lesson,
} from '@/lib/db';

function lectureFromLesson(lesson: Lesson): StudioLecture {
  const kind: LectureKind = lesson.lessonType === 'assessment' || lesson.isUnitQuiz
    ? 'quiz'
    : lesson.lessonType === 'assignment'
      ? 'assignment'
      : lesson.lessonType === 'resource'
        ? 'resource'
        : 'lecture';
  return {
    id: lesson.id,
    title: lesson.title,
    kind,
    body: lesson.aiOutputs?.text || lesson.assignmentConfig?.brief || '',
    resourceUrl: lesson.contentSources?.find(source => source.type === 'url')?.value,
    quiz: lesson.aiOutputs?.quiz?.map(item => ({
      question: item.question,
      options: item.options?.length ? item.options : ['', '', '', ''],
      answer: item.answer,
    })),
  };
}

export function sectionsFromCourse(modules: { module: { id: string; title: string }; lessons: Lesson[] }[]): StudioSection[] {
  return modules.map(entry => ({
    id: entry.module.id,
    title: entry.module.title,
    lectures: entry.lessons.map(lectureFromLesson),
  }));
}

function DragRow({
  id,
  label,
  selected,
  onSelect,
  onDropId,
  trailing,
}: {
  id: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onDropId: (fromId: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <div
      draggable
      onDragStart={event => {
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        const fromId = event.dataTransfer.getData('text/plain');
        if (fromId && fromId !== id) onDropId(fromId);
      }}
      className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${selected ? 'border-emerald-600 bg-emerald-500/10' : 'border-border bg-card'}`}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-semibold" onClick={onSelect}>
        {label}
      </button>
      {trailing}
    </div>
  );
}

export function TeacherCourseStudio({
  ownerId,
  ownerName,
  role,
  courseId,
  initial,
  initialSections,
  institutions,
  demo = false,
  sample = false,
  initialStep = 'basics',
  initialPreview = false,
  initialTarget,
}: {
  ownerId: string;
  ownerName?: string;
  role: StudioRole;
  courseId?: string;
  initial?: Course | null;
  initialSections?: StudioSection[];
  institutions: Pick<Institution, 'id' | 'name'>[];
  demo?: boolean;
  sample?: boolean;
  initialStep?: StudioStep;
  initialPreview?: boolean;
  initialTarget?: AllocationTarget;
}) {
  const { courseLabel, currency } = usePricing();
  const [step, setStep] = useState<StudioStep>(initialStep);
  const [preview, setPreview] = useState(initialPreview);
  const [savedId, setSavedId] = useState(courseId);
  const [title, setTitle] = useState(initial?.title ?? (sample ? 'Introduction to forces' : ''));
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? (sample ? 'A short course on how pushes and pulls change motion' : ''));
  const [description, setDescription] = useState(initial?.description ?? (sample ? 'Students explain contact and non-contact forces, then check their understanding.' : ''));
  const [category, setCategory] = useState(initial?.category ?? 'Science');
  const [level, setLevel] = useState(initial?.level ?? 'Secondary');
  const [language, setLanguage] = useState(initial?.language ?? 'en');
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnailUrl ?? '');
  const [previewUrl, setPreviewUrl] = useState(initial?.previewUrl ?? '');
  const [sections, setSections] = useState<StudioSection[]>(initialSections?.length ? initialSections : sample ? [
    {
      id: 'demo-section',
      title: 'Forces around us',
      lectures: [
        { id: 'demo-lecture', title: 'What is a force?', kind: 'lecture', body: 'A force is a push or a pull.' },
        { id: 'demo-quiz', title: 'Check your understanding', kind: 'quiz', body: '', quiz: [{ question: 'Which is a force?', options: ['Mass', 'A push', 'Colour', 'Time'], answer: 'A push' }] },
        { id: 'demo-resource', title: 'Lab sheet', kind: 'resource', body: '', resourceUrl: 'https://example.com/lab-sheet' },
      ],
    },
  ] : [emptySection()]);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [lectureId, setLectureId] = useState(sections[0]?.lectures[0]?.id ?? '');
  const [free, setFree] = useState((initial?.price ?? 19) <= 0 && initial?.priceType === 'FREE');
  const [price, setPrice] = useState(initial?.price && initial.price > 0 ? String(initial.price) : '19');
  const [policy, setPolicy] = useState<AccessPolicy>(initial?.accessPolicy ?? (
    initialTarget === 'students'
      ? applyAllocationPreset(blankPolicy(), 'students', ['student-demo'])
      : initialTarget === 'marketplace'
        ? applyAllocationPreset(blankPolicy(), 'marketplace')
        : blankPolicy()
  ));
  const [targets, setTargets] = useState<string[]>(() => migrateAllocation({
    targets: initial?.targets,
    accessPolicy: initial?.accessPolicy ?? (
      initialTarget === 'students'
        ? applyAllocationPreset(blankPolicy(), 'students', ['student-demo'])
        : initialTarget === 'marketplace'
          ? applyAllocationPreset(blankPolicy(), 'marketplace')
          : undefined
    ),
    audiences: initial?.audiences,
    publishScope: initial?.publishScope,
    allocatedInstitutionIds: initial?.allocatedInstitutionIds,
  }));
  const [couponCode, setCouponCode] = useState(generateCouponCode());
  const [discount, setDiscount] = useState('20');
  const [couponNote, setCouponNote] = useState('');
  const [statusNote, setStatusNote] = useState(initialTarget === 'students'
    ? 'Allocated to student-demo. Status: published. Not listed on the marketplace.'
    : initialTarget === 'marketplace'
      ? 'Submitted for marketplace review. Status: pending approval.'
      : '');
  const [busy, setBusy] = useState(false);

  const section = sections.find(item => item.id === sectionId) ?? sections[0];
  const lecture = section?.lectures.find(item => item.id === lectureId) ?? section?.lectures[0];
  const numericPrice = free ? 0 : Number(price) || 0;
  const localPrice = courseLabel(numericPrice, 'USD');
  const decision = publishDecision({ intent: 'publish', policy, role });

  const product = useMemo(() => ({
    id: savedId || 'draft',
    title,
    status: decision.status,
    price: numericPrice,
    accessPolicy: policy,
    targets,
    audiences: policy.include.filter((item): item is 'students' | 'teachers' | 'parents' | 'institutions' | 'all' | 'marketplace' =>
      ['students', 'teachers', 'parents', 'institutions', 'all', 'marketplace'].includes(item)),
    priceType: free ? 'FREE' : 'MARKETPLACE_PURCHASE',
    enrollmentCount: initial?.enrollmentCount ?? 0,
    revenueTotal: initial?.revenueTotal ?? 0,
  }), [savedId, title, decision.status, numericPrice, policy, targets, free, initial?.enrollmentCount, initial?.revenueTotal]);

  const patchLecture = (patch: Partial<StudioLecture>) => {
    if (!section || !lecture) return;
    setSections(current => current.map(item => item.id === section.id
      ? { ...item, lectures: item.lectures.map(row => row.id === lecture.id ? { ...row, ...patch } : row) }
      : item));
  };

  const persistCurriculum = async (id: string, previous: StudioSection[]) => {
    const keptSections = new Set<string>();
    for (const [index, item] of sections.entries()) {
      const existingSection = !item.id.startsWith('new-') && !item.id.startsWith('demo-');
      const moduleId = existingSection
        ? item.id
        : await createModule(id, { title: item.title, courseId: id, order: index + 1 });
      if (existingSection) await updateUnit(id, item.id, { title: item.title, order: index + 1 });
      keptSections.add(moduleId);
      const keptLectures = new Set<string>();
      for (const [lectureIndex, row] of item.lectures.entries()) {
        const payload = {
          title: row.title.trim() || 'Untitled',
          moduleId,
          courseId: id,
          order: lectureIndex + 1,
          lessonType: row.kind === 'quiz' ? 'assessment' as const
            : row.kind === 'assignment' ? 'assignment' as const
            : row.kind === 'resource' ? 'resource' as const
            : 'lesson' as const,
          status: 'published' as const,
          aiOutputs: {
            text: row.body,
            quiz: row.kind === 'quiz'
              ? (row.quiz ?? []).filter(question => question.question.trim()).map(question => ({
                question: question.question,
                options: question.options,
                answer: question.answer,
              }))
              : undefined,
          },
          assignmentConfig: row.kind === 'assignment' ? { title: row.title, brief: row.body } : undefined,
          contentSources: row.resourceUrl ? [{ type: 'url' as const, value: row.resourceUrl }] : undefined,
        };
        const existingLecture = !row.id.startsWith('new-') && !row.id.startsWith('demo-');
        if (existingLecture) {
          await updateLesson(id, moduleId, row.id, payload);
          keptLectures.add(row.id);
        } else {
          keptLectures.add(await createLesson(id, moduleId, payload));
        }
      }
      const previousSection = previous.find(entry => entry.id === item.id);
      for (const old of previousSection?.lectures ?? []) {
        if (!old.id.startsWith('new-') && !old.id.startsWith('demo-') && !keptLectures.has(old.id)) {
          await deleteLesson(id, moduleId, old.id);
        }
      }
    }
    for (const old of previous) {
      if (!old.id.startsWith('new-') && !old.id.startsWith('demo-') && !keptSections.has(old.id)) {
        await deleteUnit(id, old.id);
      }
    }
  };

  const save = async (intent: 'draft' | 'publish') => {
    if (!title.trim() || !description.trim()) {
      toast.error('Add a title and a description.');
      setStep('basics');
      return;
    }
    const payload = courseWrite({
      title, subtitle, description, category, level, language,
      thumbnailUrl, previewUrl, ownerId, ownerName,
      price: numericPrice, free, policy, targets, intent, role,
    });
    if (demo) {
      setStatusNote(intent === 'draft'
        ? 'Draft saved in this preview. Nothing was written.'
        : `${String(payload.status).replace('_', ' ')}. ${describeAccess({ ...product, accessPolicy: policy })}`);
      return;
    }
    setBusy(true);
    try {
      const previous = sections;
      const id = savedId
        ? savedId
        : await createCourse(payload as unknown as Omit<Course, 'id'>);
      if (savedId) await updateCourse(savedId, payload as Partial<Course>);
      setSavedId(id);
      await persistCurriculum(id, previous);
      const userIds = policy.userIds ?? [];
      if (userIds.length) await saveAccessGrants(id, userIds.map(userId => ({ id: userId, active: true })));
      await writeAccessAudit(id, {
        actorId: ownerId,
        action: intent === 'draft' ? 'draft' : 'allocate',
        detail: describeAccess({ ...product, accessPolicy: policy, status: String(payload.status) }),
      });
      const label = payload.status === 'pending_approval'
        ? 'Submitted for marketplace review.'
        : payload.status === 'published'
          ? 'Published to the people you allocated.'
          : 'Draft saved.';
      setStatusNote(label);
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the course.');
    } finally {
      setBusy(false);
    }
  };

  const addCoupon = async () => {
    const pct = Number(discount);
    if (!savedId && !demo) {
      toast.error('Save the course before adding a coupon.');
      return;
    }
    if (demo) {
      setCouponNote(`${couponCode} saves ${pct}% and is ready once this course is saved.`);
      setCouponCode(generateCouponCode());
      return;
    }
    try {
      const code = await createCouponCode({
        code: couponCode,
        courseId: savedId!,
        courseTitle: title,
        discountPct: pct,
        maxUses: 50,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10),
        createdBy: ownerId,
        createdByName: ownerName,
      });
      setCouponNote(`${code} is active for this course.`);
      setCouponCode(generateCouponCode());
      toast.success('Coupon created.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the coupon.');
    }
  };

  const onThumbnail = async (file: File) => {
    const stored = await storeMedia(savedId || ownerId, file, file.name);
    setThumbnailUrl(stored.src);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Course studio</p>
          <h1 className="font-heading text-4xl text-foreground">{title || 'New course'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {decision.status === 'pending_approval' ? 'Marketplace review' : decision.status === 'published' ? 'Ready for your students' : 'Draft'}
            {savedId ? '' : demo ? ' · preview' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setPreview(value => !value)}>
            {preview ? 'Back to editor' : 'Preview as student'}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => { void save('draft'); }}>
            Save draft
          </Button>
          <Button type="button" className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy} onClick={() => { void save('publish'); }}>
            {policy.include.includes('marketplace') && role !== 'admin' ? 'Submit for review' : 'Publish'}
          </Button>
        </div>
      </header>

      {statusNote && <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm" data-studio-status>{statusNote}</p>}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-2">
          {STUDIO_STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setStep(item.id); setPreview(false); }}
              className={`w-full rounded-2xl border px-3 py-3 text-left ${step === item.id && !preview ? 'border-emerald-600 bg-emerald-500/10' : 'border-border bg-card'}`}
            >
              <span className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Step {index + 1}</span>
              <span className="font-semibold text-foreground">{item.label}</span>
            </button>
          ))}
          {savedId && !demo && (
            <Link href={`/dashboard/teacher/courses/${savedId}/preview`} className="block px-3 text-sm font-semibold text-primary underline">
              Open student preview
            </Link>
          )}
        </nav>

        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          {preview ? (
            <CourseStudentPreview
              title={title}
              subtitle={subtitle}
              description={description}
              category={category}
              level={level}
              language={language}
              thumbnailUrl={thumbnailUrl}
              previewUrl={previewUrl}
              priceLabel={localPrice}
              sections={sections}
            />
          ) : step === 'basics' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="course-title">Title</Label>
                <Input id="course-title" value={title} onChange={event => setTitle(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="course-subtitle">Subtitle</Label>
                <Input id="course-subtitle" value={subtitle} onChange={event => setSubtitle(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="course-description">Description</Label>
                <Textarea id="course-description" rows={4} value={description} onChange={event => setDescription(event.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-semibold">Category
                  <select className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2" value={category} onChange={event => setCategory(event.target.value)}>
                    {COURSE_CATEGORIES.map(item => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">Level
                  <select className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2" value={level} onChange={event => setLevel(event.target.value)}>
                    {COURSE_LEVELS.map(item => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">Language
                  <select className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2" value={language} onChange={event => setLanguage(event.target.value)}>
                    {COURSE_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <Label htmlFor="thumb-file">Thumbnail</Label>
                <Input id="thumb-file" type="file" accept="image/*" onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void onThumbnail(file);
                }} />
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="mt-3 h-32 w-full rounded-2xl object-cover" />}
                <div className="mt-3">
                  <CoverArtPicker brief={`${title}. ${subtitle}`} onSelect={option => setThumbnailUrl(option.artSrc)} />
                </div>
              </div>
              <div>
                <Label htmlFor="promo-video">Promo video</Label>
                <Input id="promo-video" placeholder="https://" value={previewUrl} onChange={event => setPreviewUrl(event.target.value)} />
              </div>
            </div>
          ) : step === 'curriculum' ? (
            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <div className="space-y-2">
                {sections.map(item => (
                  <DragRow
                    key={item.id}
                    id={item.id}
                    label={item.title}
                    selected={item.id === section?.id}
                    onSelect={() => { setSectionId(item.id); setLectureId(item.lectures[0]?.id ?? ''); }}
                    onDropId={fromId => setSections(current => moveStudioSection(current, fromId, item.id))}
                    trailing={<button type="button" aria-label="Remove section" onClick={() => setSections(current => current.filter(row => row.id !== item.id))}><Trash2 className="h-4 w-4" /></button>}
                  />
                ))}
                <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => {
                  const created = emptySection();
                  setSections(current => [...current, created]);
                  setSectionId(created.id);
                  setLectureId(created.lectures[0].id);
                }}>
                  <Plus className="mr-1 h-4 w-4" /> Section
                </Button>
              </div>
              {section && (
                <div className="space-y-3">
                  <Input aria-label="Section title" value={section.title} onChange={event => setSections(current => current.map(item => item.id === section.id ? { ...item, title: event.target.value } : item))} />
                  <div className="space-y-2">
                    {section.lectures.map(row => (
                      <DragRow
                        key={row.id}
                        id={row.id}
                        label={`${row.title} · ${row.kind}`}
                        selected={row.id === lecture?.id}
                        onSelect={() => setLectureId(row.id)}
                        onDropId={fromId => setSections(current => moveStudioLecture(current, section.id, fromId, row.id))}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['lecture', 'quiz', 'assignment', 'resource'] as LectureKind[]).map(kind => (
                      <Button key={kind} type="button" variant="outline" className="rounded-full capitalize" onClick={() => {
                        const created = emptyLecture(kind);
                        setSections(current => current.map(item => item.id === section.id ? { ...item, lectures: [...item.lectures, created] } : item));
                        setLectureId(created.id);
                      }}>
                        Add {kind}
                      </Button>
                    ))}
                  </div>
                  {lecture && (
                    <div className="space-y-3 rounded-2xl border border-border p-3">
                      <Input aria-label="Lecture title" value={lecture.title} onChange={event => patchLecture({ title: event.target.value })} />
                      {lecture.kind === 'resource' ? (
                        <Input aria-label="Resource link" placeholder="https://" value={lecture.resourceUrl ?? ''} onChange={event => patchLecture({ resourceUrl: event.target.value })} />
                      ) : lecture.kind === 'quiz' ? (
                        <div className="space-y-3">
                          {(lecture.quiz ?? []).map((question, index) => (
                            <div key={`${lecture.id}-${index}`} className="space-y-2">
                              <Input aria-label="Quiz question" value={question.question} onChange={event => {
                                const quiz = [...(lecture.quiz ?? [])];
                                quiz[index] = { ...question, question: event.target.value };
                                patchLecture({ quiz });
                              }} />
                              {question.options.map((option, optionIndex) => (
                                <Input key={optionIndex} aria-label={`Option ${optionIndex + 1}`} value={option} onChange={event => {
                                  const quiz = [...(lecture.quiz ?? [])];
                                  const options = [...question.options];
                                  options[optionIndex] = event.target.value;
                                  quiz[index] = { ...question, options };
                                  patchLecture({ quiz });
                                }} />
                              ))}
                              <Input aria-label="Correct answer" value={question.answer} onChange={event => {
                                const quiz = [...(lecture.quiz ?? [])];
                                quiz[index] = { ...question, answer: event.target.value };
                                patchLecture({ quiz });
                              }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ContentEditor value={lecture.body} onChange={body => patchLecture({ body })} placeholder={lecture.kind === 'assignment' ? 'Assignment brief' : 'Lecture notes'} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : step === 'pricing' ? (
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-semibold">
                Free course
                <input type="checkbox" checked={free} onChange={event => setFree(event.target.checked)} />
              </label>
              <div>
                <Label htmlFor="usd-price">Price in USD</Label>
                <Input id="usd-price" type="number" min={0} step="0.01" disabled={free} value={free ? '0' : price} onChange={event => setPrice(event.target.value)} />
                <p className="mt-2 text-sm text-muted-foreground">
                  Charged in USD. Students currently see {localPrice}
                  {currency !== 'USD' ? ` in ${currency}, using the admin pricing rates.` : '.'}
                </p>
              </div>
              <div className="rounded-2xl border border-border p-4 space-y-3">
                <p className="text-sm font-semibold">Coupon</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                  <Input aria-label="Coupon code" value={couponCode} onChange={event => setCouponCode(event.target.value.toUpperCase())} />
                  <Input aria-label="Discount percent" type="number" min={1} max={100} value={discount} onChange={event => setDiscount(event.target.value)} />
                </div>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => { void addCoupon(); }}>Create coupon</Button>
                {couponNote && <p className="text-sm text-muted-foreground">{couponNote}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm" data-allocation-summary>{describeTargets(targets, Object.fromEntries(institutions.map(school => [`institution:${school.id}`, school.name])))}</p>
              <AllocationPanel
                product={product}
                institutions={institutions}
                onChange={patch => {
                  if (patch.accessPolicy) setPolicy(patch.accessPolicy);
                  if (patch.targets) setTargets(patch.targets);
                  if (patch.targets) {
                    const outcome = publishDecision({
                      intent: 'publish',
                      policy: patch.accessPolicy ?? policy,
                      role,
                    });
                    setStatusNote(`${describeTargets(patch.targets)} Status: ${outcome.status.replaceAll('_', ' ')}.`);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
