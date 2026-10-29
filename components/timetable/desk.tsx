'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FlowNav } from '@/components/flow/flow-nav';
import { FlowTrail } from '@/components/flow/flow-trail';
import { DAY_LABEL, ROOM_TYPE_LABEL, TIMETABLE_COPY } from '@/lib/timetable/copy';
import { canEditPersonal, canEditSchool, canUseMultipleCampuses, timetableEdition, type TimetableActor } from '@/lib/timetable/access';
import { canMove, hardViolations, suggestFix } from '@/lib/timetable/clashes';
import { approveCover, coverLoad, coverNotices, proposeCover, setStaffStatus, weekdayOf } from '@/lib/timetable/cover';
import { exportCsv, importCsv } from '@/lib/timetable/csv';
import { applyParsedConstraint, parseNaturalConstraint } from '@/lib/timetable/explain';
import { approveOptions, saveChoice, suggestBlocks } from '@/lib/timetable/options';
import { buildFeed, publishTimetable, rollbackTimetable, visibleLessons, type TimetableFeed } from '@/lib/timetable/publish';
import { blankTimetable, mondayOf } from '@/lib/timetable/seed';
import { explainSolve, proposeSoftFixes, requestedCount, solveTimetable } from '@/lib/timetable/solver';
import { loadBundle, readTimetableFeed, saveDoc, writeTimetableFeed } from '@/lib/timetable/store';
import type { Lesson, RoomType, TimetableDoc, Weekday } from '@/lib/timetable/types';
import { ROOM_TYPES, WEEKDAYS } from '@/lib/timetable/types';
import { TimetableGrid } from './grid';
import { GoogleCalendarSync } from '@/components/calendar/google-sync';
import { GOOGLE_CALENDAR_COPY } from '@/lib/google-calendar/copy';
import { eventsFromTimetable } from '@/lib/google-calendar/events';
import { applyAvailability } from '@/lib/google-calendar/freebusy';
import { applyWorkspace } from '@/lib/google-calendar/workspace';

type Surface = 'institution' | 'personal' | 'teacher' | 'student' | 'parent';
type Tab = 'setup' | 'options' | 'generate' | 'grid' | 'cover' | 'publish';

const button = 'h-10 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] disabled:opacity-50';
const ghost = 'h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] dark:border-[#3FE0D0]/50 dark:text-[#3FE0D0]';
const field = 'h-10 w-full rounded-xl border border-[#1E6A83]/30 bg-white px-3 text-sm text-[#203337] dark:border-[#3FE0D0]/30 dark:bg-[#0B1417] dark:text-[#E7F4F2] dark:[color-scheme:dark]';
const panel = 'rounded-3xl border border-[#1E6A83]/20 bg-white p-4 text-[#203337] dark:border-[#3FE0D0]/25 dark:bg-[#122226] dark:text-[#E7F4F2]';
const card = `${panel} space-y-3`;

function stamp(): string {
  return new Date().toISOString();
}

export function TimetableDesk({ surface, actor }: { surface: Surface; actor: TimetableActor }) {
  const sample = usePathname().startsWith('/preview') && useSearchParams().get('data') !== 'live';
  const edition = timetableEdition(actor);
  const schoolEditor = surface === 'institution' && canEditSchool(actor);
  const personalEditor = (surface === 'personal' || surface === 'teacher') && canEditPersonal(actor);
  const editing = surface === 'institution' ? schoolEditor : surface === 'personal' ? personalEditor : false;
  const bundleOptions = { sample, ownerId: actor.uid, institutionId: actor.institutionId };
  const feedOptions = { sample, institutionId: actor.institutionId, ownerId: actor.uid };
  const [bundle, setBundle] = useState(() => loadBundle(bundleOptions));
  const [tab, setTab] = useState<Tab>(editing || personalEditor ? 'generate' : 'grid');
  const [selected, setSelected] = useState('');
  const [attempt, setAttempt] = useState<string[]>([]);
  const [constraint, setConstraint] = useState('');
  const [notice, setNotice] = useState('');
  const [csv, setCsv] = useState('');
  const [campus, setCampus] = useState('');
  const [coverTeacher, setCoverTeacher] = useState('');
  const [coverDate, setCoverDate] = useState(() => sample ? '2026-10-19' : mondayOf());
  const [coverReason, setCoverReason] = useState<'absent' | 'leave' | 'new_hire'>('absent');
  const [proposals, setProposals] = useState<ReturnType<typeof proposeCover>>([]);
  const [queued, setQueued] = useState<ReturnType<typeof coverNotices>>([]);
  const [feed, setFeed] = useState<TimetableFeed | null>(null);
  const [privateMode, setPrivateMode] = useState(surface === 'personal');
  const [ready, setReady] = useState(false);
  const [generated, setGenerated] = useState<number | null>(null);

  const doc = privateMode || surface === 'personal' ? bundle.personal : bundle.school;
  const multi = canUseMultipleCampuses(actor);

  useEffect(() => {
    setBundle(loadBundle(bundleOptions));
    setFeed(readTimetableFeed(feedOptions));
    setReady(true);
    // The signed-in identity decides which saved week to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample, actor.uid, actor.institutionId]);

  const commit = (next: TimetableDoc, detail?: string) => {
    const withAudit = detail
      ? { ...next, audit: [{ id: `audit-${next.audit.length + 1}`, at: stamp(), actorId: actor.uid || 'timetabler', action: detail, detail }, ...next.audit] }
      : next;
    if (detail) setNotice(detail);
    setBundle(saveDoc(withAudit, bundleOptions));
  };

  useEffect(() => {
    if (doc.staff.some(person => person.id === coverTeacher)) return;
    setCoverTeacher(doc.staff[0]?.id ?? '');
  }, [coverTeacher, doc.staff]);

  const lessons = useMemo(() => {
    if (surface === 'teacher' && !privateMode) return visibleLessons(doc, { teacherUserId: actor.uid || '', campusId: campus || undefined });
    if (surface === 'student') return visibleLessons(doc, { studentId: actor.uid || '' });
    if (surface === 'parent') return visibleLessons(doc, { childIds: [...(actor.childIds ?? [])] });
    return visibleLessons(doc, { campusId: campus || undefined });
  }, [actor.childIds, actor.uid, campus, doc, privateMode, surface]);

  const clashes = hardViolations(doc, doc.lessons);
  const fixes = proposeSoftFixes(doc.unmet);

  const move = (lessonId: string, day: Weekday, periodId: string) => {
    const check = canMove(doc, doc.lessons, lessonId, day, periodId);
    if (!check.ok) {
      setSelected(lessonId);
      setAttempt(check.reasons);
      setTab('grid');
      return;
    }
    commit({
      ...doc,
      lessons: doc.lessons.map(lesson => lesson.id === lessonId ? { ...lesson, day, periodId } : lesson),
      status: 'draft',
    }, 'move');
    setAttempt([]);
    setSelected(lessonId);
  };

  const applyFix = () => {
    if (!selected) return;
    const fixed = suggestFix(doc, doc.lessons, selected);
    if (!fixed) {
      setAttempt([]);
      return;
    }
    commit({ ...doc, lessons: doc.lessons.map(lesson => lesson.id === fixed.id ? fixed : lesson), status: 'draft' }, 'fix');
    setAttempt([]);
  };

  const generate = () => {
    const result = solveTimetable(doc);
    const explanation = explainSolve(result, requestedCount(doc));
    const next = {
      ...doc,
      lessons: result.lessons,
      quality: result.quality,
      unmet: result.unmet,
      explanation,
      status: 'draft' as const,
    };
    commit(next, 'generate');
    setGenerated(result.lessons.length);
    setNotice(explanation);
    setTab('grid');
    void fetch('/api/timetable/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: next }),
    }).then(async response => {
      if (!response.ok) return;
      const body = await response.json() as { model?: string; source?: string };
      if (body.source === 'openrouter' && body.model) setNotice(body.model);
    }).catch(() => undefined);
  };

  const applyConstraint = () => {
    const parsed = parseNaturalConstraint(constraint, doc.staff, doc.periods);
    if ('error' in parsed) {
      setNotice(parsed.error);
      return;
    }
    const next = applyParsedConstraint(doc, parsed);
    commit({ ...next, explanation: parsed.summary }, 'constraint');
    setNotice(parsed.summary);
  };

  const publish = () => {
    const result = publishTimetable(doc, stamp(), actor.uid || 'timetabler');
    setBundle(saveDoc(result.doc, bundleOptions));
    writeTimetableFeed(result.feed, { sample: doc.sample === true, institutionId: doc.institutionId || actor.institutionId });
    setFeed(result.feed);
    setNotice(TIMETABLE_COPY.published);
  };

  const downloadIcal = () => {
    const ics = (feed ?? buildFeed(doc)).ical;
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'timetable.ics';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (surface === 'institution' && edition === 'locked') {
    return <Locked />;
  }
  if (surface === 'personal' && !personalEditor) {
    return <Locked />;
  }

  const tabs: Tab[] = editing || (surface === 'teacher' && privateMode && personalEditor)
    ? ['setup', 'options', 'generate', 'grid', 'cover', 'publish']
    : surface === 'student' || surface === 'parent'
      ? ['options', 'grid', 'publish']
      : surface === 'institution'
        ? ['grid', 'cover', 'publish']
        : ['grid', 'publish'];

  return (
    <div className="mx-auto max-w-6xl space-y-5 bg-white p-4 text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2] md:p-6" data-timetable={surface} data-timetable-ready={ready ? '1' : '0'} data-generated={generated === null ? undefined : String(generated)} data-edition={privateMode ? 'personal' : edition} data-sample={sample ? '1' : '0'} data-editing={editing || privateMode ? '1' : '0'} data-place={surface === 'institution' ? 'institution' : surface}>
      <header className="tt-no-print">
        {surface === 'institution' ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E6A83] dark:text-[#3FE0D0]">{TIMETABLE_COPY.institutionPlace}</p> : null}
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E6A83] dark:text-[#3FE0D0]">{TIMETABLE_COPY.title}</p>
        <h1 className="mt-1 text-3xl font-semibold">{TIMETABLE_COPY.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#1E6A83] dark:text-[#3FE0D0]">
          {surface === 'personal' || privateMode ? TIMETABLE_COPY.personalLede : editing ? TIMETABLE_COPY.schoolLede : surface === 'parent' ? TIMETABLE_COPY.parentWeek : surface === 'student' ? TIMETABLE_COPY.studentWeek : TIMETABLE_COPY.viewLede}
        </p>
        {sample ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#1E6A83] dark:text-[#3FE0D0]">
            <span className="rounded-full bg-[#3FE0D0] px-2 py-0.5 font-bold text-[#203337]">{TIMETABLE_COPY.sampleBadge}</span>
            {TIMETABLE_COPY.sampleNote}
          </p>
        ) : null}
      </header>

      <GoogleCalendarSync
        source="timetable"
        audience={surface === 'parent' ? 'parent' : surface === 'student' ? 'student' : surface === 'institution' ? 'admin' : 'teacher'}
        events={eventsFromTimetable(doc, surface === 'institution' || privateMode ? doc.lessons : lessons, { covers: doc.covers, planner: feed?.planner })}
        ics={(feed ?? buildFeed(doc)).ical}
        manageWorkspace={surface === 'institution'}
        institutionId={doc.institutionId}
        periods={doc.periods}
        rooms={doc.rooms.map(room => ({ id: room.id, name: room.name }))}
        anchorMonday={doc.anchorMonday}
        onConstraints={slots => {
          const teacherId = doc.staff.find(person => person.userId === actor.uid)?.id ?? doc.staff[0]?.id;
          if (!teacherId || slots.length === 0) return;
          commit(applyAvailability(doc, teacherId, slots), 'constraint');
        }}
        onAbsences={items => {
          const first = items[0];
          if (!first) return;
          setNotice(GOOGLE_CALENDAR_COPY.absenceQueued);
          setCoverDate(first.date);
          setCoverReason(first.reason);
        }}
        onWorkspace={imported => commit(applyWorkspace(doc, imported), 'constraint')}
      />

      {surface === 'teacher' && personalEditor ? (
        <div className="tt-no-print flex gap-2">
          <button type="button" className={privateMode ? button : ghost} onClick={() => setPrivateMode(false)}>{TIMETABLE_COPY.schoolTab}</button>
          <button type="button" className={privateMode ? ghost : button} onClick={() => { setPrivateMode(true); setBundle(current => current.personal?.id ? current : { ...current, personal: blankTimetable('personal', actor.uid || '') }); }}>{TIMETABLE_COPY.privateTab}</button>
        </div>
      ) : null}

      <div className="tt-no-print">
        <FlowTrail
          steps={tabs.map(item => ({
            id: item,
            label: item === 'setup' ? TIMETABLE_COPY.tabSetup : item === 'options' ? TIMETABLE_COPY.tabOptions : item === 'generate' ? TIMETABLE_COPY.tabGenerate : item === 'grid' ? TIMETABLE_COPY.tabGrid : item === 'cover' ? TIMETABLE_COPY.tabCover : TIMETABLE_COPY.tabPublish,
          }))}
          currentId={tab}
          allowAhead
          onSelect={(id) => setTab(id as Tab)}
          label={TIMETABLE_COPY.steps}
          dataAttr="data-tab"
        />
      </div>

      {tab === 'setup' ? <Setup doc={doc} csv={csv} setCsv={setCsv} multi={multi} onCommit={commit} /> : null}
      {tab === 'options' ? <Options doc={doc} actor={actor} onCommit={commit} /> : null}
      {tab === 'generate' ? (
        <section className={card}>
          <button type="button" className={button} data-action="generate" onClick={generate}>{TIMETABLE_COPY.generate}</button>
          <label className="block text-sm font-semibold">{TIMETABLE_COPY.constraintLabel}
            <input className={`${field} mt-1`} value={constraint} onChange={event => setConstraint(event.target.value)} />
          </label>
          <button type="button" className={ghost} data-action="constraint" onClick={applyConstraint}>{TIMETABLE_COPY.constraintButton}</button>
          <p className="text-sm" data-explanation="1">{doc.explanation || notice}</p>
          <p className="text-xs text-[#1E6A83] dark:text-[#E7F4F2]">{TIMETABLE_COPY.modelNote}</p>
          <Quality doc={doc} fixes={fixes} />
        </section>
      ) : null}
      {tab === 'grid' ? (
        <section className="space-y-3">
          {multi && doc.campusIds.length > 1 ? (
            <label className="tt-no-print block max-w-xs text-sm font-semibold">{TIMETABLE_COPY.campus}
              <select className={`${field} mt-1`} value={campus} onChange={event => setCampus(event.target.value)}>
                <option value="">{TIMETABLE_COPY.allCampuses}</option>
                {doc.campusIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
          ) : null}
          <TimetableGrid doc={doc} lessons={lessons} selectedId={selected} onSelect={setSelected} onMove={editing || privateMode ? move : () => undefined} />
          <aside className={`${card} tt-no-print`} data-clash-panel="1">
            <h2 className="font-semibold">{TIMETABLE_COPY.clashTitle}</h2>
            {attempt.length === 0 && clashes.length === 0 ? <p className="mt-2 text-sm">{TIMETABLE_COPY.noClash}</p> : null}
            {attempt.length > 0 ? <p className="mt-2 text-sm" data-blocked="1">{TIMETABLE_COPY.blocked}</p> : null}
            <ul className="mt-2 space-y-1 text-sm">
              {[...attempt, ...clashes.map(item => item.message)].map(line => <li key={line}>{line}</li>)}
            </ul>
            {attempt.length > 0 ? <button type="button" className={`${button} mt-3`} data-action="fix" onClick={applyFix}>{TIMETABLE_COPY.fix}</button> : null}
          </aside>
          <Quality doc={doc} fixes={fixes} />
        </section>
      ) : null}
      {tab === 'cover' ? (
        <CoverPanel
          doc={doc}
          coverTeacher={coverTeacher}
          coverDate={coverDate}
          coverReason={coverReason}
          proposals={proposals}
          queued={queued}
          setCoverTeacher={setCoverTeacher}
          setCoverDate={setCoverDate}
          setCoverReason={setCoverReason}
          editing={editing}
          onAddStaff={() => setTab('setup')}
          onImport={(text) => {
            const imported = importCsv(doc, text);
            commit(imported.doc, 'import');
          }}
          onPropose={() => {
            const day = weekdayOf(coverDate);
            if (!day && coverReason !== 'leave') {
              setNotice(TIMETABLE_COPY.absent);
              return;
            }
            const next = setStaffStatus(doc, coverTeacher, coverReason === 'new_hire' ? 'new_hire' : coverReason);
            commit(next, coverReason);
            setProposals(proposeCover(next, coverTeacher, coverDate, coverReason));
          }}
          onApprove={async () => {
            const approved = approveCover(doc, proposals, stamp(), actor.uid || 'timetabler');
            commit(approved);
            const notices = coverNotices(doc, proposals);
            setQueued(notices);
            try {
              const { createNotification } = await import('@/lib/db');
              for (const item of notices) {
                await createNotification(item).catch(() => undefined);
              }
            } catch { /* The queued list is the record when notifications are offline. */ }
          }}
        />
      ) : null}
      {tab === 'publish' ? (
        <section className={card}>
          <p data-status={doc.status}>{doc.status === 'published' ? TIMETABLE_COPY.published : TIMETABLE_COPY.draft} · {TIMETABLE_COPY.version} {doc.publishedVersion ?? doc.version}</p>
          {editing || privateMode ? <button type="button" className={button} data-action="publish" onClick={publish} disabled={doc.lessons.length === 0}>{TIMETABLE_COPY.publish}</button> : null}
          <button type="button" className={ghost} data-action="ical" onClick={downloadIcal}>{TIMETABLE_COPY.ical}</button>
          <button type="button" className={ghost} data-action="print" onClick={() => window.print()}>{TIMETABLE_COPY.print}</button>
          {doc.lessons.length === 0 ? <p>{TIMETABLE_COPY.emptyWeek}</p> : null}
          <FeedSummary feed={feed} />
          <ul className="space-y-2 text-sm">
            {doc.versions.map(version => (
              <li key={version.version}>
                {TIMETABLE_COPY.version} {version.version} · {version.status}
                {editing || privateMode ? <button type="button" className={`${ghost} ms-2`} data-action="rollback" onClick={() => commit(rollbackTimetable(doc, version.version, stamp(), actor.uid || 'timetabler'))}>{TIMETABLE_COPY.rollback}</button> : null}
              </li>
            ))}
          </ul>
          <TimetableGrid doc={doc} lessons={lessons} selectedId="" onSelect={() => undefined} onMove={() => undefined} />
        </section>
      ) : null}

      <div className="tt-no-print">
        <FlowNav
          backDisabled={tabs.indexOf(tab) <= 0}
          nextDisabled={tabs.indexOf(tab) >= tabs.length - 1}
          onBack={() => {
            const previous = tabs[tabs.indexOf(tab) - 1];
            if (previous) setTab(previous);
          }}
          onNext={() => {
            const next = tabs[tabs.indexOf(tab) + 1];
            if (next) setTab(next);
          }}
        />
      </div>
      <section className={`tt-no-print ${card}`}>
        <h2 className="font-semibold">{TIMETABLE_COPY.audit}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {doc.audit.slice(0, 8).map(entry => <li key={entry.id}>{entry.action}: {entry.detail}</li>)}
        </ul>
        {notice ? <p className="mt-2 text-sm text-[#1E6A83]" data-notice="1">{notice}</p> : null}
      </section>
      <style>{'@media print { .tt-no-print { display: none !important; } }'}</style>
    </div>
  );
}

function Locked() {
  return (
    <div className="mx-auto max-w-xl p-6" data-timetable-locked="1">
      <h1 className="text-2xl font-semibold text-[#203337]">{TIMETABLE_COPY.title}</h1>
      <p className="mt-2 text-sm text-[#1E6A83]">{TIMETABLE_COPY.locked}</p>
    </div>
  );
}

function Quality({ doc, fixes }: { doc: TimetableDoc; fixes: string[] }) {
  return (
    <div data-quality={doc.quality}>
      <p className="text-sm font-semibold">{TIMETABLE_COPY.quality} {doc.quality}</p>
      {doc.lessons.length > 0 ? <p className="text-sm">{TIMETABLE_COPY.noHard}</p> : null}
      <p className="mt-1 text-sm font-semibold">{TIMETABLE_COPY.unmet}</p>
      {doc.unmet.length === 0 ? <p className="text-sm">{TIMETABLE_COPY.noneUnmet}</p> : (
        <ul className="text-sm">{doc.unmet.map(line => <li key={line}>{line}</li>)}</ul>
      )}
      {fixes.length > 0 ? <ul className="text-sm text-[#1E6A83] dark:text-[#E7F4F2]">{fixes.map(line => <li key={line}>{line}</li>)}</ul> : null}
    </div>
  );
}

function FeedSummary({ feed }: { feed: TimetableFeed | null }) {
  if (!feed) return null;
  return (
    <div className="grid gap-2 text-sm md:grid-cols-2" data-feed="1">
      <p>{TIMETABLE_COPY.calendarFeed}: {feed.calendar.length}</p>
      <p>{TIMETABLE_COPY.plannerFeed}: {feed.planner.length}</p>
      <p>{TIMETABLE_COPY.registers}: {feed.registers.length}</p>
      <p>{TIMETABLE_COPY.classrooms}: {feed.classrooms.length}</p>
      <ul>{feed.classrooms.map(room => <li key={room.id}>{room.name}</li>)}</ul>
      <p><Link href="/dashboard/teacher/assignments">{TIMETABLE_COPY.assignmentLink}</Link></p>
      <p><Link href="/dashboard/teacher/exams">{TIMETABLE_COPY.examLink}</Link></p>
      <p><Link href="/dashboard/teacher/attendance">{TIMETABLE_COPY.attendanceLink}</Link></p>
    </div>
  );
}

function Options({ doc, actor, onCommit }: { doc: TimetableDoc; actor: TimetableActor; onCommit: (doc: TimetableDoc, detail?: string) => void }) {
  const studentId = actor.role === 'parent' ? (actor.childIds?.[0] ?? 's-noor') : (actor.uid && doc.people.some(person => person.id === actor.uid) ? actor.uid : 's-noor');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const wishes = doc.people.filter(person => person.role === 'student' && person.id.startsWith('s-')).map(person => ({
    studentId: person.id,
    studentName: person.name,
    subjectIds: doc.choices.filter(choice => choice.studentId === person.id).flatMap(choice => choice.subjectIds),
  })).filter(wish => wish.subjectIds.length > 0);
  const plan = wishes.length ? suggestBlocks(doc.optionSubjects, wishes, 3) : null;
  return (
    <section className={card} data-options="1">
      {doc.blocks.map(block => (
        <fieldset key={block.id}>
          <legend className="text-sm font-semibold">{block.name}</legend>
          {block.subjectIds.map(subjectId => {
            const subject = doc.optionSubjects.find(item => item.id === subjectId);
            return (
              <label key={subjectId} className="mr-4 text-sm">
                <input
                  type="radio"
                  name={block.id}
                  className="me-1"
                  checked={picks[block.id] === subjectId}
                  onChange={() => setPicks(current => ({ ...current, [block.id]: subjectId }))}
                />
                {subject ? `${subject.name} — ${subject.level}` : subjectId}
              </label>
            );
          })}
        </fieldset>
      ))}
      <button
        type="button"
        className={button}
        data-action="save-choice"
        onClick={() => {
          let next = doc;
          for (const [blockId, subjectId] of Object.entries(picks)) {
            if (subjectId) next = saveChoice(next, { studentId, blockId, subjectIds: [subjectId] });
          }
          onCommit(next, 'choice');
        }}
      >
        {TIMETABLE_COPY.saveChoice}
      </button>
      <button
        type="button"
        className={ghost}
        data-action="suggest"
        onClick={() => {
          const suggested = suggestBlocks(doc.optionSubjects, wishes.length ? wishes : [{
            studentId: 's-noor', studentName: 'Noor Adeyemi', subjectIds: ['opt-physics', 'opt-history'],
          }], 3);
          onCommit({ ...doc, blocks: suggested.blocks }, 'suggest');
        }}
      >
        {TIMETABLE_COPY.suggest}
      </button>
      {plan ? (
        <p className="text-sm" data-satisfied={plan.satisfied}>{TIMETABLE_COPY.satisfied}: {plan.satisfied}/{plan.total}</p>
      ) : null}
      {plan && plan.clashes.length > 0 ? (
        <div>
          <p className="text-sm font-semibold">{TIMETABLE_COPY.optionClash}</p>
          <ul className="text-sm">{plan.clashes.map(clash => <li key={clash.studentId}>{clash.studentName}</li>)}</ul>
        </div>
      ) : null}
      <button type="button" className={button} data-action="approve-options" onClick={() => onCommit(approveOptions(doc, stamp(), actor.uid || 'timetabler'))}>{TIMETABLE_COPY.approveOptions}</button>
      <ul className="text-sm" data-sets="1">
        {doc.groups.filter(group => group.kind === 'option').map(group => <li key={group.id}>{group.name}: {group.studentIds.length}</li>)}
      </ul>
    </section>
  );
}

function CoverPanel({
  doc, coverTeacher, coverDate, coverReason, proposals, queued, editing,
  setCoverTeacher, setCoverDate, setCoverReason, onPropose, onApprove, onAddStaff, onImport,
}: {
  doc: TimetableDoc;
  coverTeacher: string;
  coverDate: string;
  coverReason: 'absent' | 'leave' | 'new_hire';
  proposals: ReturnType<typeof proposeCover>;
  queued: ReturnType<typeof coverNotices>;
  editing: boolean;
  setCoverTeacher: (value: string) => void;
  setCoverDate: (value: string) => void;
  setCoverReason: (value: 'absent' | 'leave' | 'new_hire') => void;
  onPropose: () => void;
  onApprove: () => void;
  onAddStaff: () => void;
  onImport: (text: string) => void;
}) {
  const load = coverLoad(doc);
  const [importText, setImportText] = useState('');
  return (
    <section className={card} data-cover="1">
      <label className="block text-sm font-semibold">{TIMETABLE_COPY.publish}
        <input type="date" className={`${field} mt-1`} value={coverDate} onChange={event => setCoverDate(event.target.value)} />
      </label>
      {doc.staff.length === 0 ? (
        <div className="space-y-3" data-staff-empty="1">
          <p className="text-sm">{TIMETABLE_COPY.staffEmpty}</p>
          {editing ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={button} data-action="add-staff" onClick={onAddStaff}>{TIMETABLE_COPY.addStaff}</button>
              </div>
              <label className="block text-sm font-semibold">{TIMETABLE_COPY.importCsv}
                <textarea className={`${field} mt-1 h-28`} value={importText} onChange={event => setImportText(event.target.value)} />
              </label>
              <button type="button" className={ghost} data-action="import-csv" onClick={() => onImport(importText)}>{TIMETABLE_COPY.importCsv}</button>
            </>
          ) : null}
        </div>
      ) : editing ? (
        <>
          <label className="block text-sm font-semibold">{TIMETABLE_COPY.setupStaff}
            <select className={`${field} mt-1`} value={coverTeacher} onChange={event => setCoverTeacher(event.target.value)}>
              {doc.staff.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">{TIMETABLE_COPY.absent}
            <select className={`${field} mt-1`} value={coverReason} onChange={event => setCoverReason(event.target.value as 'absent' | 'leave' | 'new_hire')}>
              <option value="absent">{TIMETABLE_COPY.absent}</option>
              <option value="leave">{TIMETABLE_COPY.leave}</option>
              <option value="new_hire">{TIMETABLE_COPY.newHire}</option>
            </select>
          </label>
          <button type="button" className={button} data-action="propose-cover" onClick={onPropose}>{TIMETABLE_COPY.propose}</button>
        </>
      ) : (
        <ul className="text-sm">{doc.staff.map(staff => <li key={staff.id}>{staff.name}</li>)}</ul>
      )}
      <ul className="text-sm" data-proposals={proposals.length}>
        {proposals.map(proposal => {
          const cover = doc.staff.find(staff => staff.id === proposal.coverTeacherId);
          return <li key={proposal.lessonId}>{cover?.name}: {proposal.note}</li>;
        })}
      </ul>
      {editing ? <button type="button" className={button} data-action="approve-cover" disabled={proposals.length === 0} onClick={onApprove}>{TIMETABLE_COPY.approveCover}</button> : null}
      <h2 className="font-semibold">{TIMETABLE_COPY.notices}</h2>
      {queued.length === 0 ? <p className="text-sm" data-notices-empty="1">{TIMETABLE_COPY.noticesEmpty}</p> : null}
      <ul className="text-sm" data-notices={queued.length}>{queued.map((item, index) => <li key={`${item.userId}-${index}`}>{item.message}</li>)}</ul>
      <h2 className="font-semibold">{TIMETABLE_COPY.fairness}</h2>
      {load.length === 0 ? <p className="text-sm">{TIMETABLE_COPY.coverEmpty}</p> : (
        <ul className="text-sm">{load.map(row => <li key={row.teacherId}>{row.name}: {row.count}</li>)}</ul>
      )}
    </section>
  );
}

function Setup({
  doc, csv, setCsv, multi, onCommit,
}: {
  doc: TimetableDoc;
  csv: string;
  setCsv: (value: string) => void;
  multi: boolean;
  onCommit: (doc: TimetableDoc, detail?: string) => void;
}) {
  const [room, setRoom] = useState({ name: '', type: 'classroom' as RoomType, capacity: '30', campusId: doc.campusIds[0] ?? 'main' });
  const [staff, setStaff] = useState({ name: '', subjects: 'Maths', levels: 'IGCSE', maxPerDay: '4', maxPerWeek: '16' });
  const [subject, setSubject] = useState({ name: '', level: 'IGCSE', periods: '2', roomType: 'classroom' as RoomType, groupId: doc.groups[0]?.id ?? '' });
  return (
    <section className={`${panel} space-y-4`} data-setup="1">
      <p className="text-sm">{TIMETABLE_COPY.setupDays}: {doc.days.map(day => DAY_LABEL[day]).join(', ')}</p>
      <div>
        <h2 className="font-semibold">{TIMETABLE_COPY.setupPeriods}</h2>
        <ul className="text-sm">{doc.periods.map(period => <li key={period.id}>{period.label} {period.start}–{period.end}</li>)}</ul>
      </div>
      <div>
        <h2 className="font-semibold">{TIMETABLE_COPY.setupTerms}</h2>
        <ul className="text-sm">{doc.terms.map(term => <li key={term.id}>{term.name} {term.start} {term.end}</li>)}</ul>
      </div>
      <div>
        <h2 className="font-semibold">{TIMETABLE_COPY.setupHolidays}</h2>
        <ul className="text-sm">{doc.holidays.map(holiday => <li key={holiday.id}>{holiday.name} {holiday.date}</li>)}</ul>
      </div>
      <div>
        <h2 className="font-semibold">{TIMETABLE_COPY.setupRooms}</h2>
        <ul className="mb-2 text-sm">{doc.rooms.map(item => <li key={item.id}>{item.name} · {ROOM_TYPE_LABEL[item.type]} · {item.capacity} · {item.campusId}</li>)}</ul>
        <div className="grid gap-2 md:grid-cols-4">
          <input className={field} aria-label={TIMETABLE_COPY.roomName} placeholder={TIMETABLE_COPY.roomName} value={room.name} onChange={event => setRoom({ ...room, name: event.target.value })} />
          <select className={field} value={room.type} onChange={event => setRoom({ ...room, type: event.target.value as RoomType })}>
            {ROOM_TYPES.map(type => <option key={type} value={type}>{ROOM_TYPE_LABEL[type]}</option>)}
          </select>
          <input className={field} aria-label={TIMETABLE_COPY.capacity} value={room.capacity} onChange={event => setRoom({ ...room, capacity: event.target.value })} />
          {multi ? <input className={field} aria-label={TIMETABLE_COPY.campus} value={room.campusId} onChange={event => setRoom({ ...room, campusId: event.target.value })} /> : null}
        </div>
        <button type="button" className={`${button} mt-2`} onClick={() => {
          if (!room.name.trim()) return;
          onCommit({ ...doc, rooms: [...doc.rooms, { id: `room-${doc.rooms.length + 1}`, name: room.name.trim(), type: room.type, capacity: Number(room.capacity) || 1, campusId: room.campusId }] }, 'edit');
        }}>{TIMETABLE_COPY.add}</button>
      </div>
      <div>
        <h2 className="font-semibold">{TIMETABLE_COPY.setupStaff}</h2>
        <ul className="mb-2 text-sm">{doc.staff.map(person => <li key={person.id}>{person.name} · {person.subjects.join(', ')} · {person.levels.join(', ')} · {person.status}</li>)}</ul>
        <div className="grid gap-2 md:grid-cols-3">
          <input className={field} aria-label={TIMETABLE_COPY.staffName} placeholder={TIMETABLE_COPY.staffName} value={staff.name} onChange={event => setStaff({ ...staff, name: event.target.value })} />
          <input className={field} aria-label={TIMETABLE_COPY.subjectName} value={staff.subjects} onChange={event => setStaff({ ...staff, subjects: event.target.value })} />
          <input className={field} aria-label={TIMETABLE_COPY.levelName} value={staff.levels} onChange={event => setStaff({ ...staff, levels: event.target.value })} />
        </div>
        <button type="button" className={`${button} mt-2`} onClick={() => {
          if (!staff.name.trim()) return;
          const id = `staff-${doc.staff.length + 1}`;
          onCommit({
            ...doc,
            staff: [...doc.staff, {
              id, name: staff.name.trim(), userId: id,
              subjects: staff.subjects.split(',').map(item => item.trim()).filter(Boolean),
              levels: staff.levels.split(',').map(item => item.trim()).filter(Boolean),
              maxPerDay: Number(staff.maxPerDay) || 4,
              maxPerWeek: Number(staff.maxPerWeek) || 16,
              worksDays: [...WEEKDAYS],
              unavailable: [], prefer: '', status: 'new_hire', campusId: doc.campusIds[0] ?? 'main',
            }],
          }, 'edit');
        }}>{TIMETABLE_COPY.addStaff}</button>
      </div>
      <div>
        <h2 className="font-semibold">{TIMETABLE_COPY.setupSubjects}</h2>
        <ul className="mb-2 text-sm">{doc.subjects.map(item => <li key={item.id}>{item.name} — {item.level} · {item.periodsPerWeek}</li>)}</ul>
        <div className="grid gap-2 md:grid-cols-4">
          <input className={field} aria-label={TIMETABLE_COPY.subjectName} value={subject.name} onChange={event => setSubject({ ...subject, name: event.target.value })} />
          <input className={field} aria-label={TIMETABLE_COPY.levelName} value={subject.level} onChange={event => setSubject({ ...subject, level: event.target.value })} />
          <input className={field} aria-label={TIMETABLE_COPY.periodsWeek} value={subject.periods} onChange={event => setSubject({ ...subject, periods: event.target.value })} />
          <select className={field} value={subject.groupId} onChange={event => setSubject({ ...subject, groupId: event.target.value })}>
            {doc.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </div>
        <button type="button" className={`${button} mt-2`} onClick={() => {
          if (!subject.name.trim() || !subject.groupId) return;
          const group = doc.groups.find(item => item.id === subject.groupId);
          onCommit({
            ...doc,
            subjects: [...doc.subjects, {
              id: `subject-${doc.subjects.length + 1}`,
              name: subject.name.trim(),
              level: subject.level.trim() || 'IGCSE',
              periodsPerWeek: Number(subject.periods) || 1,
              roomType: subject.roomType,
              groupId: subject.groupId,
              teacherIds: [],
              campusId: group?.campusId || doc.campusIds[0] || 'main',
            }],
          }, 'edit');
        }}>{TIMETABLE_COPY.add}</button>
      </div>
      <div>
        <h2 className="font-semibold">{TIMETABLE_COPY.setupGroups}</h2>
        <ul className="text-sm">{doc.groups.map(group => <li key={group.id}>{group.name} · {group.level} · {group.kind}</li>)}</ul>
      </div>
      <div>
        <h2 className="font-semibold">{TIMETABLE_COPY.setupBlocks}</h2>
        <ul className="text-sm">{doc.blocks.map(block => <li key={block.id}>{block.name} · {block.level}</li>)}</ul>
      </div>
      <label className="block text-sm font-semibold">{TIMETABLE_COPY.importCsv}
        <textarea className={`${field} mt-1 h-28`} value={csv} onChange={event => setCsv(event.target.value)} />
      </label>
      <button type="button" className={button} data-action="import-csv" onClick={() => {
        const imported = importCsv(doc, csv);
        onCommit(imported.doc, 'import');
      }}>{TIMETABLE_COPY.importCsv}</button>
      <button type="button" className={ghost} onClick={() => setCsv(exportCsv(doc))}>{TIMETABLE_COPY.exportCsv}</button>
    </section>
  );
}
