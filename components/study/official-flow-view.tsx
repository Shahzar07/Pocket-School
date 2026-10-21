'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MathMarkdown } from '@/components/math-markdown';
import { DashPage } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch, postJSON } from '@/lib/authed-fetch';
import { boardsForLevel, BOARD_STYLES } from '@/lib/essay/board-styles';
import { LEVEL_GROUPS, LEARNER_LEVELS, levelLabel } from '@/lib/levels';
import { createAssignment, getAssignmentSubmissions, getAssignmentsForCourse, getTeacherCourses, type Course } from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import { listPacks } from '@/lib/study/pack-admin';
import { filterPacks, officialSubjectOptions, subjectSlug } from '@/lib/study/pack-catalog';
import { getPackProgress, savePackProgress, type PackProgress } from '@/lib/study/db';
import { isFreeTopic, packTopics, type ExamPack, type PackQuestion } from '@/lib/study/exam-packs';
import { GRADE_SCALES } from '@/lib/study/grades';
import { readAttempt, readMock, writeAttempt, writeMock, type FlowAttempt } from '@/lib/study/official-attempt';
import { readExamDate, readSavedExams, rememberExam, saveExamDate, saveReadiness, type SavedExam } from '@/lib/study/my-exams';
import { flowCopy as copy } from '@/lib/study/official-flow-copy';
import {
  boardHref,
  browseHref,
  collectPackQuestions,
  estimateFor,
  hintSteps,
  lessonHref,
  levelHref,
  markingHref,
  markParts,
  mockHref,
  mockQuestions,
  neighborTopic,
  packHref,
  percentScore,
  practiceHref,
  questionsFromTopic,
  readinessHref,
  resultsHref,
  revisionPlan,
  studentCrumbHref,
  subjectHref,
  topicHref,
  topicLocked,
  weakQuestions,
  type ExamChoice,
  type FlowQuestion,
  type StudentStepId,
} from '@/lib/study/official-flow';
import { FlowRow, OfficialNav, OfficialTrail, QuestionArrows } from '@/components/study/official-chrome';
import { STUDY_COSTS } from '@/lib/sparks';

export type OfficialScreen = StudentStepId | 'browse' | 'marking' | 'mock' | 'readiness';

function weightedReady(pack: ExamPack, progress: PackProgress): number {
  const topics = packTopics(pack).filter((topic) => progress.mastery[topic.id] !== undefined);
  if (!topics.length) return 0;
  const total = topics.reduce((sum, topic) => sum + (progress.mastery[topic.id] ?? 0), 0);
  return Math.round(total / topics.length);
}

export function OfficialFlow({ step }: { step: OfficialScreen }) {
  const params = useParams<{ levelId?: string; boardId?: string; subjectSlug?: string; packId?: string; topicId?: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user, profile } = useAuthSTORE();
  const [packs, setPacks] = useState<ExamPack[]>(() => listPacks());
  const [saved, setSaved] = useState<SavedExam[]>([]);
  const [progress, setProgress] = useState<PackProgress>({ mastery: {}, setsDone: 0 });
  const [examDate, setExamDate] = useState('');
  const [notice, setNotice] = useState('');
  const level = params.levelId || '';
  const board = params.boardId || '';
  const subjectParam = params.subjectSlug || search.get('subject') || '';
  const pack = packs.find((item) => item.id === params.packId) ?? null;
  const subjectName = pack?.subject || officialSubjectOptions().find((item) => item.slug === subjectSlug(subjectParam))?.label || subjectParam;
  const choice: ExamChoice = {
    level: level || pack?.learnerLevel || '',
    board: board || pack?.boardStyle || '',
    subject: subjectName,
    packId: pack?.id,
    topicId: params.topicId || progress.lastTopic,
  };
  const trailStep: StudentStepId = step === 'browse' ? 'subject' : step === 'marking' ? 'practice' : step === 'mock' ? 'pack' : step === 'readiness' ? 'results' : step;
  const canAssign = profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'institution_admin';

  useEffect(() => {
    if (step !== 'level') return;
    const chosen = search.get('subject');
    if (chosen) router.replace(browseHref('all', 'all', chosen));
  }, [step, search, router]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    authedFetch('/api/study/exam-packs').then(async (res) => {
      if (!res.ok || cancel) return;
      const data = await res.json() as { packs?: ExamPack[] };
      if (Array.isArray(data.packs)) setPacks(data.packs);
    }).catch(() => undefined);
    return () => { cancel = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    readSavedExams(user.uid).then(setSaved).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user || !pack) return;
    getPackProgress(user.uid, pack.id).then(setProgress).catch(() => undefined);
    readExamDate(user.uid, pack.id).then(setExamDate).catch(() => undefined);
    rememberExam(user.uid, {
      level: pack.learnerLevel || 'igcse',
      board: pack.boardStyle || '',
      subject: pack.subject || 'Mathematics',
      packId: pack.id,
      name: pack.name,
    }).catch(() => undefined);
  }, [user, pack]);

  return (
    <DashPage className="w-full px-4 sm:px-6">
        <div data-official-exams data-flow-step-page={step} className="flex min-h-[70vh] flex-col">
        <p className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{copy.headline}</p>
        <div className="mt-3">
          <OfficialTrail choice={choice} currentId={trailStep} hrefFor={(id) => studentCrumbHref(id as StudentStepId, choice)} />
        </div>
        {step === 'level' ? <LevelStep saved={saved} /> : null}
        {step === 'board' ? <BoardStep level={level} /> : null}
        {step === 'subject' ? <SubjectStep level={level} board={board} /> : null}
        {step === 'browse' ? <BrowseStep packs={packs} level={level} board={board} subject={subjectParam} /> : null}
        {step === 'pack' && pack ? (
          <PackStep
            pack={pack}
            progress={progress}
            examDate={examDate}
            canAssign={canAssign}
            onDate={(value) => {
              setExamDate(value);
              if (user) saveExamDate(user.uid, pack.id, value).catch(() => undefined);
            }}
            setNotice={setNotice}
          />
        ) : null}
        {step === 'topic' && pack && params.topicId ? <TopicStep pack={pack} topicId={params.topicId} progress={progress} /> : null}
        {step === 'practice' && pack && params.topicId ? <PracticeStep pack={pack} topicId={params.topicId} difficulty={search.get('difficulty') || 'similar'} /> : null}
        {step === 'marking' && pack && params.topicId ? <MarkingStep pack={pack} topicId={params.topicId} uid={user?.uid} onProgress={setProgress} progress={progress} /> : null}
        {step === 'results' && pack && params.topicId ? <ResultsStep pack={pack} topicId={params.topicId} /> : null}
        {step === 'mock' && pack ? <MockStep pack={pack} /> : null}
        {step === 'readiness' && pack ? (
          <ReadinessStep
            pack={pack}
            progress={progress}
            examDate={examDate}
            onSave={() => {
              if (!user) return;
              const percent = weightedReady(pack, progress);
              const estimate = estimateFor(pack.scale, percent);
              saveReadiness(user.uid, pack.id, { academicResult: `${estimate.label} ${estimate.grade}` }).then(() => setNotice(copy.savedResults)).catch(() => undefined);
            }}
            onShare={() => {
              if (!user) return;
              saveReadiness(user.uid, pack.id, { sharedAt: Date.now() }).then(() => setNotice(copy.shared)).catch(() => undefined);
            }}
          />
        ) : null}
        {notice ? <p className="mt-3 text-sm text-[#1E6A83] dark:text-[#3FE0D0]" role="status">{notice}</p> : null}
        <StepNav step={step} pack={pack} packs={packs} topicId={params.topicId} level={level} board={board} subject={subjectParam} progress={progress} />
      </div>
    </DashPage>
  );
}

function LevelStep({ saved }: { saved: SavedExam[] }) {
  return (
    <section className="mt-6">
      <h1 className="font-heading text-3xl text-[#203337] dark:text-[#EDEAE4]">{copy.choose}</h1>
      {saved.length ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{copy.myExams}</h2>
          <div className="mt-2" data-my-exams>
            {saved.map((exam) => (
              <FlowRow
                key={`${exam.packId ?? exam.subject}-${exam.board}`}
                href={exam.packId ? packHref(exam.packId) : browseHref(exam.level, exam.board, exam.subject)}
                title={exam.name || exam.subject}
                meta={`${levelLabel(exam.level) || exam.level} · ${exam.board}`}
                trailing={`${copy.continue} →`}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-6" data-level-list>
        {LEVEL_GROUPS.map((group) => (
          <div key={group.id} className="mt-4">
            <h2 className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{group.label}</h2>
            {LEARNER_LEVELS.filter((item) => item.group === group.id).map((item) => (
              <FlowRow key={item.id} href={boardHref(item.id)} title={item.label} trailing="→" />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function BoardStep({ level }: { level: string }) {
  const boards = level === 'all' ? BOARD_STYLES : boardsForLevel(level);
  return (
    <section className="mt-6">
      <h1 className="font-heading text-3xl text-[#203337] dark:text-[#EDEAE4]">{copy.board}</h1>
      <p className="mt-1 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{levelLabel(level) || level}</p>
      <div className="mt-4" data-board-list>
        {boards.map((item) => (
          <FlowRow key={item.id} href={subjectHref(level || 'all', item.id)} title={item.label} trailing="→" />
        ))}
      </div>
    </section>
  );
}

function SubjectStep({ level, board }: { level: string; board: string }) {
  const label = BOARD_STYLES.find((item) => item.id === board)?.label || board;
  return (
    <section className="mt-6">
      <h1 className="font-heading text-3xl text-[#203337] dark:text-[#EDEAE4]">{copy.subject}</h1>
      <p className="mt-1 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{label}</p>
      <div className="mt-4" data-subject-list>
        {officialSubjectOptions().map((item) => (
          <FlowRow key={item.slug} href={browseHref(level || 'all', board || 'all', item.slug)} title={item.label} trailing="→" />
        ))}
      </div>
    </section>
  );
}

function BrowseStep({ packs, level, board, subject }: { packs: ExamPack[]; level: string; board: string; subject: string }) {
  const visible = filterPacks(packs, {
    subject: subject === 'all' ? '' : subject,
    level: level === 'all' ? '' : level,
    board: board === 'all' ? '' : board,
  });
  const label = officialSubjectOptions().find((item) => item.slug === subjectSlug(subject))?.label || subject;
  return (
    <section className="mt-6">
      <h1 className="font-heading text-3xl text-[#203337] dark:text-[#EDEAE4]">{label}</h1>
      {visible.length === 0 ? (
        <div data-coming-soon className="mt-6 rounded-2xl border border-border px-6 py-12 text-center">
          <p className="font-heading text-2xl">{copy.comingSoon}</p>
          <p className="mt-2 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{copy.comingSoonDetail}</p>
        </div>
      ) : (
        <div className="mt-4" data-exam-pack-list>
          {visible.map((pack) => (
            <FlowRow key={pack.id} href={packHref(pack.id)} title={pack.name} meta={`${pack.level} · ${pack.board}`} trailing="→" />
          ))}
        </div>
      )}
    </section>
  );
}

function PackStep({
  pack, progress, examDate,   canAssign, onDate, setNotice,
}: {
  pack: ExamPack;
  progress: PackProgress;
  examDate: string;
  canAssign: boolean;
  onDate: (value: string) => void;
  setNotice: (value: string) => void;
}) {
  const topics = packTopics(pack);
  const last = progress.lastTopic && topics.some((topic) => topic.id === progress.lastTopic) ? progress.lastTopic : topics[0]?.id;
  return (
    <section className="mt-6" data-pack-overview>
      <h1 className="font-heading text-3xl text-[#203337] dark:text-[#EDEAE4]">{pack.name}</h1>
      <p className="mt-1 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{pack.blurb}</p>
      <label className="mt-4 block text-sm font-semibold">
        {copy.examDate}
        <input className="mt-1 h-11 rounded-xl border border-border bg-card px-3" type="date" value={examDate} aria-label={copy.examDate} onChange={(event) => onDate(event.target.value)} />
      </label>
      <p className="mt-1 text-xs text-[#1E6A83] dark:text-[#3FE0D0]">{copy.examDateHint}</p>
      {last ? <div className="mt-4"><FlowRow href={topicHref(pack.id, last)} title={copy.startLeft} trailing="→" /></div> : null}
      {pack.units.map((unit) => (
        <div key={unit.id} className="mt-6">
          <h2 className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{unit.title}</h2>
          {unit.topics.map((topic) => {
            const free = isFreeTopic(pack, topic.id);
            const score = progress.mastery[topic.id];
            const meta = `${free ? copy.freeTopic : copy.locked} · ${score === undefined ? copy.progress : `${score}%`}`;
            return <FlowRow key={topic.id} href={topicHref(pack.id, topic.id)} title={topic.title} meta={meta} trailing="→" />;
          })}
        </div>
      ))}
      {canAssign ? <AssignPanel pack={pack} setNotice={setNotice} /> : null}
    </section>
  );
}

function AssignPanel({ pack, setNotice }: { pack: ExamPack; setNotice: (value: string) => void }) {
  const { user } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('official-exams');
  const [kind, setKind] = useState<'pack' | 'topic' | 'mock'>('pack');
  const [topicId, setTopicId] = useState(pack.units[0]?.topics[0]?.id ?? '');
  const [rows, setRows] = useState<{ id: string; title: string; count: number }[]>([]);
  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then((list) => {
      setCourses(list);
      if (list[0]) setCourseId(list[0].id);
    }).catch(() => undefined);
  }, [user]);
  useEffect(() => {
    getAssignmentsForCourse(courseId).then(async (list) => {
      const mine = list.filter((item) => item.description.includes(pack.id));
      const counts = await Promise.all(mine.map(async (item) => ({ id: item.id, title: item.title, count: (await getAssignmentSubmissions(item.id)).length })));
      setRows(counts);
    }).catch(() => undefined);
  }, [courseId, pack.id]);
  async function assign() {
    if (!user) return;
    try {
      const topic = packTopics(pack).find((item) => item.id === topicId);
      const title = kind === 'topic' ? `${pack.name}: ${topic?.title ?? copy.topic}` : kind === 'mock' ? `${pack.name}: ${copy.mock}` : pack.name;
      await createAssignment({
        courseId,
        title,
        description: `${pack.name}\n${packHref(pack.id)}\n${pack.id}`,
        dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 86_400_000)),
        maxScore: 100,
        submissionType: 'text',
        status: 'published',
        allowLate: true,
        createdBy: user.uid,
      });
      setNotice(copy.assigned);
      const list = await getAssignmentsForCourse(courseId);
      const mine = list.filter((item) => item.description.includes(pack.id));
      setRows(mine.map((item) => ({ id: item.id, title: item.title, count: 0 })));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : copy.assigned);
    }
  }
  return (
    <form className="mt-6 rounded-2xl border border-border p-4" data-assign-pack onSubmit={(event) => { event.preventDefault(); void assign(); }}>
      <h2 className="font-heading text-xl">{copy.assign}</h2>
      <label className="mt-3 block text-sm font-semibold">{copy.assign}
        <select className="mt-1 h-11 w-full rounded-xl border px-3" aria-label={copy.assign} value={kind} onChange={(event) => setKind(event.target.value as 'pack' | 'topic' | 'mock')}>
          <option value="pack">{copy.assignPack}</option>
          <option value="topic">{copy.assignTopic}</option>
          <option value="mock">{copy.assignMock}</option>
        </select>
      </label>
      {kind === 'topic' ? (
        <label className="mt-3 block text-sm font-semibold">{copy.topic}
          <select className="mt-1 h-11 w-full rounded-xl border px-3" aria-label={copy.topic} value={topicId} onChange={(event) => setTopicId(event.target.value)}>
            {packTopics(pack).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
      ) : null}
      <label className="mt-3 block text-sm font-semibold">{copy.classResults}
        <select className="mt-1 h-11 w-full rounded-xl border px-3" aria-label={copy.classResults} value={courseId} onChange={(event) => setCourseId(event.target.value)}>
          <option value="official-exams">{copy.classResults}</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </label>
      <button type="submit" className="mt-4 inline-flex h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]">{copy.assign} →</button>
      <div className="mt-4" data-class-results>
        {rows.map((row) => (
          <FlowRow key={row.id} href="/dashboard/teacher/assignments" title={row.title} meta={`${row.count}`} trailing="→" />
        ))}
      </div>
    </form>
  );
}

function TopicStep({ pack, topicId, progress }: { pack: ExamPack; topicId: string; progress: PackProgress }) {
  const topic = packTopics(pack).find((item) => item.id === topicId);
  if (!topic) return null;
  const locked = topicLocked(pack, topicId);
  const first = pack.units[0]?.topics[0]?.id ?? '';
  return (
    <section className="mt-6" data-topic-step>
      <h1 className="font-heading text-3xl text-[#203337] dark:text-[#EDEAE4]">{topic.title}</h1>
      <p className="mt-1 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{topic.unit} · {locked ? copy.locked : copy.unlocked}</p>
      {progress.mastery[topicId] !== undefined ? <p className="mt-2 text-sm">{progress.mastery[topicId]}%</p> : null}
      {locked ? (
        <div data-upgrade className="mt-6 rounded-2xl border border-[#3FE0D0] p-4">
          <p className="font-heading text-xl">{copy.upgradeTitle}</p>
          <p className="mt-2 text-sm">{copy.upgradeBody}</p>
          <p className="mt-2 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{STUDY_COSTS.packSet}</p>
          <div className="mt-3">
            <FlowRow href="/dashboard/student/billing" title={copy.seePlans} trailing="→" />
            {first ? <FlowRow href={topicHref(pack.id, first)} title={copy.freeTopicLink} trailing="→" /> : null}
            <FlowRow href={practiceHref(pack.id, topicId)} title={copy.continue} trailing="→" />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <FlowRow href={practiceHref(pack.id, topicId)} title={copy.start} trailing="→" />
        </div>
      )}
    </section>
  );
}

function PracticeStep({ pack, topicId, difficulty }: { pack: ExamPack; topicId: string; difficulty: string }) {
  const router = useRouter();
  const topic = packTopics(pack).find((item) => item.id === topicId);
  const [attempt, setAttempt] = useState<FlowAttempt | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [timer, setTimer] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const existing = readAttempt(pack.id, topicId);
    if (existing) setAttempt(existing);
    else {
      const authored = questionsFromTopic(topic);
      if (authored.length) {
        const next = { packId: pack.id, topicId, difficulty, questions: authored, answers: authored.map(() => ''), scores: null, index: 0 };
        writeAttempt(next);
        setAttempt(next);
      }
    }
  }, [pack.id, topicId, topic, difficulty]);
  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [timer]);
  const question = attempt?.questions[attempt.index];
  const hints = question ? hintSteps(question) : [];
  const changeIndex = useCallback((index: number) => {
    setAttempt((current) => {
      if (!current) return current;
      const next = { ...current, index };
      writeAttempt(next);
      return next;
    });
    setHintCount(0);
  }, []);
  async function prepare() {
    setBusy(true);
    setError('');
    try {
      const data = await postJSON<{ questions: PackQuestion[] }>('/api/study/pack/questions', { packId: pack.id, topicId, difficulty });
      const questions: FlowQuestion[] = data.questions.map((item) => ({
        question: item.question,
        marks: item.marks,
        answer: item.answer,
        solution: item.solution,
        markScheme: '',
        paper: item.paper,
      }));
      const next = { packId: pack.id, topicId, difficulty, questions, answers: questions.map(() => ''), scores: null, index: 0 };
      writeAttempt(next);
      setAttempt(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.noQuestions);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6" data-practice>
      <h1 className="font-heading text-3xl text-[#203337] dark:text-[#EDEAE4]">{topic?.title}</h1>
      <button type="button" className="mt-3 h-11 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] dark:border-[#3FE0D0] dark:text-[#3FE0D0]" aria-pressed={timer} aria-label={copy.timer} onClick={() => setTimer((value) => !value)}>{copy.timer} {timer ? seconds : ''}</button>
      {!attempt ? (
        <div className="mt-6">
          <p>{copy.noQuestions}</p>
          <button type="button" className="mt-3 inline-flex h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" disabled={busy} onClick={() => void prepare()}>{busy ? copy.preparing : copy.prepare} →</button>
          {error ? <p className="mt-2 text-sm">{error}</p> : null}
        </div>
      ) : question ? (
        <div className="mt-4">
          <div className="text-[16px] leading-relaxed"><MathMarkdown>{question.question}</MathMarkdown></div>
          {question.image ? <img src={question.image} alt="" className="mt-3 max-h-64 rounded-xl border" /> : null}
          <label className="mt-4 block text-sm font-semibold">{copy.yourAnswer}
            <textarea className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2" rows={4} aria-label={copy.yourAnswer} value={attempt.answers[attempt.index] ?? ''} onChange={(event) => {
              const answers = [...attempt.answers];
              answers[attempt.index] = event.target.value;
              const next = { ...attempt, answers };
              writeAttempt(next);
              setAttempt(next);
            }} />
          </label>
          <button type="button" className="mt-3 h-11 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] dark:border-[#3FE0D0] dark:text-[#3FE0D0]" onClick={() => setHintCount((count) => count > 0 ? 0 : 1)}>{hintCount ? copy.hideHint : copy.hint}</button>
          {hintCount > 0 ? (
            <div className="mt-3 space-y-2" data-hints>
              {hints.slice(0, hintCount).map((hint) => <p key={hint} className="rounded-xl bg-[#3FE0D0]/15 px-3 py-2 text-sm">{hint}</p>)}
              {hintCount < hints.length ? <button type="button" className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => setHintCount((count) => count + 1)}>{copy.hint} →</button> : null}
            </div>
          ) : null}
          <QuestionArrows index={attempt.index} count={attempt.questions.length} onChange={changeIndex} />
          <button type="button" className="mt-4 hidden" data-submit-practice onClick={() => router.push(markingHref(pack.id, topicId))}>{copy.submit}</button>
        </div>
      ) : null}
    </section>
  );
}

function MarkingStep({ pack, topicId, uid, progress, onProgress }: { pack: ExamPack; topicId: string; uid?: string; progress: PackProgress; onProgress: (value: PackProgress) => void }) {
  const [attempt, setAttempt] = useState<FlowAttempt | null>(null);
  const [partScores, setPartScores] = useState<Record<string, number>>({});
  useEffect(() => { setAttempt(readAttempt(pack.id, topicId)); }, [pack.id, topicId]);
  useEffect(() => { setPartScores({}); }, [attempt?.index, topicId]);
  const changeIndex = useCallback((index: number) => {
    setAttempt((current) => {
      if (!current) return current;
      const next = { ...current, index };
      writeAttempt(next);
      return next;
    });
  }, []);
  if (!attempt) {
    return <section className="mt-6"><p>{copy.noQuestions}</p></section>;
  }
  const question = attempt.questions[attempt.index];
  const parts = question ? markParts(question.markScheme) : null;
  const score = attempt.scores?.[attempt.index] ?? 0;
  function setScore(value: number) {
    const scores = attempt?.scores ? [...attempt.scores] : attempt!.questions.map(() => 0);
    scores[attempt!.index] = value;
    const next = { ...attempt!, scores };
    writeAttempt(next);
    setAttempt(next);
    if (uid) {
      const percent = percentScore(next.questions, scores);
      const saved: PackProgress = { ...progress, mastery: { ...progress.mastery, [topicId]: percent }, setsDone: progress.setsDone || 1, lastTopic: topicId };
      onProgress(saved);
      savePackProgress(uid, pack.id, saved).catch(() => undefined);
    }
  }
  return (
    <section className="mt-6" data-marking>
      <h1 className="font-heading text-3xl">{copy.marking}</h1>
      {question ? (
        <div className="mt-4">
          <div className="text-[16px]"><MathMarkdown>{question.question}</MathMarkdown></div>
          <p className="mt-3 text-sm"><span className="font-semibold">{copy.yourAnswer}</span> {attempt.answers[attempt.index] || '—'}</p>
          {parts ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {parts.map((part) => (
                <label key={part} className="text-sm font-semibold">{copy[part]}
                  <input className="mt-1 h-11 w-full rounded-xl border px-3" type="number" min={0} max={question.marks} aria-label={copy[part]} value={partScores[part] ?? 0} onChange={(event) => {
                    const nextParts = { ...partScores, [part]: Number(event.target.value) || 0 };
                    setPartScores(nextParts);
                    setScore(Math.min(question.marks, parts.reduce((sum, name) => sum + (nextParts[name] ?? 0), 0)));
                  }} />
                </label>
              ))}
            </div>
          ) : (
            <label className="mt-3 block text-sm font-semibold">{copy.marks}
              <input className="mt-1 h-11 w-full rounded-xl border px-3" type="number" min={0} max={question.marks} aria-label={copy.marks} value={score} onChange={(event) => setScore(Number(event.target.value) || 0)} />
            </label>
          )}
          {question.markScheme ? <p className="mt-3 text-sm">{question.markScheme}</p> : <p className="mt-3 text-sm">{copy.noScheme}</p>}
          <h2 className="mt-4 text-sm font-semibold">{copy.worked}</h2>
          <div className="mt-1 text-sm"><MathMarkdown>{question.solution}</MathMarkdown></div>
          <h2 className="mt-4 text-sm font-semibold">{copy.examinerTip}</h2>
          <p className="mt-1 text-sm">{question.examinerTip || copy.noTip}</p>
          <QuestionArrows index={attempt.index} count={attempt.questions.length} onChange={changeIndex} />
        </div>
      ) : null}
    </section>
  );
}

function ResultsStep({ pack, topicId }: { pack: ExamPack; topicId: string }) {
  const attempt = readAttempt(pack.id, topicId);
  const scores = attempt?.scores ?? [];
  const percent = attempt ? percentScore(attempt.questions, scores) : 0;
  const weak = attempt ? weakQuestions(attempt.questions, scores) : [];
  const next = neighborTopic(pack, topicId, 1);
  return (
    <section className="mt-6" data-topic-results>
      <h1 className="font-heading text-3xl">{copy.results}</h1>
      <p className="mt-2 text-2xl font-semibold">{copy.score} {percent}%</p>
      <h2 className="mt-6 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{copy.weak}</h2>
      {weak.length === 0 ? <p className="mt-2 text-sm">{copy.noWeak}</p> : weak.map((question) => <p key={question.question} className="mt-2 text-sm">{question.question}</p>)}
      <div className="mt-4">
        <FlowRow href={practiceHref(pack.id, topicId)} title={copy.retry} trailing="→" />
        <FlowRow href={practiceHref(pack.id, topicId, 'similar')} title={copy.similar} trailing="→" />
        <FlowRow href={practiceHref(pack.id, topicId, 'harder')} title={copy.harder} trailing="→" />
        <FlowRow href={lessonHref(pack.subject || '')} title={copy.lesson} trailing="→" />
        {next ? <FlowRow href={topicHref(pack.id, next)} title={copy.nextTopic} trailing="→" /> : null}
        <FlowRow href={mockHref(pack.id)} title={copy.takeMock} trailing="→" />
      </div>
    </section>
  );
}

function MockStep({ pack }: { pack: ExamPack }) {
  const questions = collectPackQuestions(pack);
  const full = mockQuestions(questions, 'full');
  const half = mockQuestions(questions, 'half');
  const [started, setStarted] = useState<'full' | 'half' | null>(null);
  const [index, setIndex] = useState(0);
  const [timer, setTimer] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [timer]);
  const set = started === 'half' ? half : full;
  const changeIndex = useCallback((next: number) => setIndex(next), []);
  function begin(length: 'full' | 'half') {
    const chosen = length === 'half' ? half : full;
    setStarted(length);
    setAnswers(chosen.questions.map(() => ''));
    setIndex(0);
    setTimer(true);
    writeMock({ packId: pack.id, length, papers: chosen.papers, questions: chosen.questions, answers: chosen.questions.map(() => ''), scores: null, index: 0 });
  }
  const question = set.questions[index];
  return (
    <section className="mt-6" data-mock>
      <h1 className="font-heading text-3xl">{copy.mock}</h1>
      {!full.defined ? <p className="mt-3 text-sm">{copy.noPaper}</p> : (
        <>
          <p className="mt-2 text-sm">{copy.mockFromPack}</p>
          {!started ? (
            <div className="mt-4">
              <button type="button" className="inline-flex h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" aria-label={copy.fullPaper} onClick={() => begin('full')}>{copy.fullPaper} · {full.papers.join(', ')} <span aria-hidden>→</span></button>
              <button type="button" className="mt-3 inline-flex h-11 items-center rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] dark:border-[#3FE0D0] dark:text-[#3FE0D0]" aria-label={copy.halfPaper} onClick={() => begin('half')}>{copy.halfPaper} <span aria-hidden>→</span></button>
            </div>
          ) : question ? (
            <div className="mt-4">
              <button type="button" className="h-11 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold" aria-pressed={timer} aria-label={copy.timer} onClick={() => setTimer((value) => !value)}>{copy.timer} {seconds}</button>
              <p className="mt-2 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{question.paper}</p>
              <div className="mt-2"><MathMarkdown>{question.question}</MathMarkdown></div>
              <textarea className="mt-3 w-full rounded-xl border px-3 py-2" rows={4} aria-label={copy.yourAnswer} value={answers[index] ?? ''} onChange={(event) => {
                const next = [...answers];
                next[index] = event.target.value;
                setAnswers(next);
                writeMock({ packId: pack.id, length: started, papers: set.papers, questions: set.questions, answers: next, scores: null, index });
              }} />
              <QuestionArrows index={index} count={set.questions.length} onChange={changeIndex} />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function ReadinessStep({
  pack, progress, examDate, onSave, onShare,
}: {
  pack: ExamPack;
  progress: PackProgress;
  examDate: string;
  onSave: () => void;
  onShare: () => void;
}) {
  const topics = packTopics(pack);
  const percent = weightedReady(pack, progress);
  const estimate = estimateFor(pack.scale, percent);
  const today = new Date().toISOString().slice(0, 10);
  const plan = examDate ? revisionPlan(topics, progress.mastery, examDate, today) : [];
  const mock = readMock(pack.id);
  const mockPercent = mock?.scores ? percentScore(mock.questions, mock.scores) : null;
  return (
    <section className="mt-6" data-readiness>
      <h1 className="font-heading text-3xl">{copy.readiness}</h1>
      <h2 className="mt-6 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{copy.heatMap}</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" data-heat-map>
        {topics.map((topic) => {
          const score = progress.mastery[topic.id] ?? 0;
          return <div key={topic.id} className="rounded-xl px-3 py-2 text-sm text-[#203337]" style={{ background: `rgba(63, 224, 208, ${0.15 + score / 140})` }}>{topic.title} {score}%</div>;
        })}
      </div>
      <p className="mt-4 text-lg font-semibold" data-estimate>{copy.estimate} · {GRADE_SCALES[pack.scale].label} · {estimate.grade}{mockPercent !== null ? ` · ${mockPercent}%` : ''}</p>
      <h2 className="mt-6 text-sm font-semibold">{copy.revision}</h2>
      {plan.length === 0 ? <p className="mt-2 text-sm">{copy.setDate}</p> : plan.map((row) => <p key={row.day} className="mt-1 text-sm">{row.day} · {row.title}</p>)}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="h-11 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" onClick={onSave}>{copy.saveResults} →</button>
        <button type="button" className="h-11 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] dark:border-[#3FE0D0] dark:text-[#3FE0D0]" onClick={onShare}>{copy.share} →</button>
      </div>
      <div className="mt-3"><FlowRow href="/dashboard/student/transcript" title={copy.openTranscript} trailing="→" /></div>
    </section>
  );
}

function StepNav({
  step, pack, packs, topicId, level, board, subject, progress,
}: {
  step: OfficialScreen;
  pack: ExamPack | null;
  packs: ExamPack[];
  topicId?: string;
  level: string;
  board: string;
  subject: string;
  progress: PackProgress;
}) {
  const back = useMemo(() => {
    if (step === 'level') return undefined;
    if (step === 'board') return levelHref();
    if (step === 'subject') return boardHref(level || 'all');
    if (step === 'browse') return subjectHref(level || 'all', board || 'all');
    if (step === 'pack') return browseHref(pack?.learnerLevel || level || 'all', pack?.boardStyle || board || 'all', pack?.subject || subject || 'mathematics');
    if (step === 'topic' && pack) return packHref(pack.id);
    if (step === 'practice' && pack && topicId) return topicHref(pack.id, topicId);
    if (step === 'marking' && pack && topicId) return practiceHref(pack.id, topicId);
    if (step === 'results' && pack && topicId) return markingHref(pack.id, topicId);
    if (step === 'mock' && pack) return packHref(pack.id);
    if (step === 'readiness' && pack) return mockHref(pack.id);
    return levelHref();
  }, [step, pack, topicId, level, board, subject]);
  let nextHref: string | undefined;
  let nextLabel: string = copy.next;
  if (step === 'level') {
    const first = LEARNER_LEVELS[0];
    nextHref = first ? boardHref(first.id) : undefined;
  } else if (step === 'board') {
    const boards = level === 'all' ? BOARD_STYLES : boardsForLevel(level);
    nextHref = boards[0] ? subjectHref(level || 'all', boards[0].id) : undefined;
  } else if (step === 'subject') {
    const first = officialSubjectOptions()[0];
    nextHref = first ? browseHref(level || 'all', board || 'all', first.slug) : undefined;
  } else if (step === 'browse') {
    const visible = filterPacks(packs, {
      subject: subject === 'all' ? '' : subject,
      level: level === 'all' ? '' : level,
      board: board === 'all' ? '' : board,
    });
    nextHref = visible[0] ? packHref(visible[0].id) : undefined;
  } else if (step === 'pack' && pack) {
    const last = progress.lastTopic || pack.units[0]?.topics[0]?.id;
    nextHref = last ? topicHref(pack.id, last) : undefined;
    nextLabel = copy.startLeft;
  } else if (step === 'topic' && pack && topicId) {
    nextHref = practiceHref(pack.id, topicId);
    nextLabel = copy.start;
  } else if (step === 'practice' && pack && topicId) {
    nextHref = markingHref(pack.id, topicId);
    nextLabel = copy.submit;
  } else if (step === 'marking' && pack && topicId) {
    nextHref = resultsHref(pack.id, topicId);
  } else if (step === 'results' && pack) {
    nextHref = mockHref(pack.id);
    nextLabel = copy.takeMock;
  } else if (step === 'mock' && pack) {
    nextHref = readinessHref(pack.id);
  } else if (step === 'readiness') {
    nextHref = '/dashboard/student/transcript';
    nextLabel = copy.openTranscript;
  }
  return <OfficialNav backHref={back} nextHref={nextHref} nextLabel={nextLabel} nextDisabled={!nextHref} />;
}
