'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { deskCopy as t } from '@/lib/school-desk/copy';
import {
  LEVELS, addEnrolment, approveEnrolment, attendanceRate, bulkCreateClasses, createClass, gradeSetLabel, importRoster, postAnnouncement, roster, setTeachingMode, termResult, updateClass,
  type DeskRole, type JoinMethod, type LevelName,
} from '@/lib/school-desk/model';
import { GoalRoster } from './goals';
import { DeskFrame, DeskLinks, deskHref, deskStyles, resetToDemo, useDesk } from './ui';

export function ClassDesk({ base = 'dashboard', role = 'teacher' }: { base?: 'dashboard' | 'preview'; role?: DeskRole }) {
  const { state, setState } = useDesk();
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [term, setTerm] = useState('');
  const [campus, setCampus] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'name' | 'level'>('name');
  const [selected, setSelected] = useState('class-maths');
  const [tab, setTab] = useState<'roster' | 'attendance' | 'assignments' | 'goals' | 'gradebook' | 'news'>('roster');
  const [form, setForm] = useState({
    name: 'IGCSE Biology',
    subject: 'Biology',
    level: 'IGCSE' as LevelName,
    programme: 'Cambridge IGCSE',
    term: 'Term 1',
    campus: 'Ipoh Garden',
    room: 'G-2',
    timetable: 'Tue and Thu, 10:00',
    coTeachers: 'Siti Aminah',
    capacity: '20',
  });
  const [csv, setCsv] = useState('name,under18,member\nNadia Chong,yes,yes\nGuest Student,yes,no');
  const [bulk, setBulk] = useState('name,subject,level,programme,term,campus,room,timetable,teacher,capacity\nIGCSE Physics,Physics,IGCSE,Cambridge IGCSE,Term 1,Falim,F-8,Thu 11:00,Siti Aminah,22');
  const [news, setNews] = useState('');
  const [error, setError] = useState('');
  const [visibility, setVisibility] = useState<'school' | 'private'>(state.institution.kind === 'independent' ? 'private' : 'school');
  const [autoApprove, setAutoApprove] = useState(false);
  const [inviteName, setInviteName] = useState('Hana Ibrahim');
  const [studentRecord, setStudentRecord] = useState('');
  const [consoleOn, setConsoleOn] = useState(role === 'institution_admin');
  const [edit, setEdit] = useState(form);

  const rows = useMemo(() => {
    return state.classes.filter((item) => {
      const blob = `${item.name} ${item.subject} ${item.level}`.toLowerCase();
      if (query && !blob.includes(query.toLowerCase())) return false;
      if (subject && item.subject !== subject) return false;
      if (level && item.level !== level) return false;
      if (term && item.term !== term) return false;
      if (campus && item.campus !== campus) return false;
      if (status && item.status !== status) return false;
      return true;
    }).sort((a, b) => (sort === 'level' ? a.level.localeCompare(b.level) : a.name.localeCompare(b.name)));
  }, [state.classes, query, subject, level, term, campus, status, sort]);

  const klass = state.classes.find((item) => item.id === selected) ?? rows[0];
  const people = klass ? roster(state, klass.id) : [];
  const subjects = [...new Set(state.classes.map((item) => item.subject))];
  const terms = [...new Set(state.classes.map((item) => item.term))];
  const campuses = [...new Set(state.classes.map((item) => item.campus))];

  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setEditField = (key: keyof typeof edit, value: string) => setEdit((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!klass) return;
    setEdit({
      name: klass.name,
      subject: klass.subject,
      level: klass.level,
      programme: klass.programme,
      term: klass.term,
      campus: klass.campus,
      room: klass.room,
      timetable: klass.timetable,
      coTeachers: klass.coTeachers.join(', '),
      capacity: String(klass.capacity),
    });
  }, [klass]);

  return (
    <DeskFrame title={t.classesTitle} lede={t.classesLede} state={state} onReset={() => resetToDemo(setState)} syncs="Assignments, gradebook, attendance, goals, report cards, parent view">
      <DeskLinks base={base} />
      <p className="rounded-3xl bg-white p-5 text-sm text-[#1E6A83]">{t.helpCreate}</p>
      <p className="text-sm">{state.institution.teachersCanCreateClasses ? t.teachersAllowed : t.teachersBlocked}</p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <input className={deskStyles.field} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t.filterSubject} placeholder={t.filterSubject} />
        <select className={deskStyles.field} value={subject} onChange={(event) => setSubject(event.target.value)} aria-label={t.filterSubject}>
          <option value="">{t.all}</option>
          {subjects.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={deskStyles.field} value={level} onChange={(event) => setLevel(event.target.value)} aria-label={t.filterLevel}>
          <option value="">{t.all}</option>
          {LEVELS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={deskStyles.field} value={term} onChange={(event) => setTerm(event.target.value)} aria-label={t.filterTerm}>
          <option value="">{t.all}</option>
          {terms.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={deskStyles.field} value={campus} onChange={(event) => setCampus(event.target.value)} aria-label={t.filterCampus}>
          <option value="">{t.all}</option>
          {campuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={deskStyles.field} value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t.filterStatus}>
          <option value="">{t.all}</option>
          <option value="active">{t.active}</option>
          <option value="archived">{t.archived}</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={deskStyles.ghost} onClick={() => setSort((current) => (current === 'name' ? 'level' : 'name'))}>{t.sortedBy} {sort === 'name' ? t.nameSort : t.levelSort}</button>
        <button type="button" className={deskStyles.ghost} onClick={() => setState(setTeachingMode(state, state.institution.kind === 'independent' ? 'school' : 'independent'))}>{state.institution.kind === 'independent' ? t.backToSchool : t.independent}</button>
        <button type="button" className={consoleOn ? deskStyles.btn : deskStyles.ghost} onClick={() => setConsoleOn((current) => !current)}>{t.institutionConsole}</button>
      </div>
      {consoleOn ? (
        <form className="space-y-2 rounded-3xl bg-white p-5" onSubmit={(event) => {
          event.preventDefault();
          const result = bulkCreateClasses(state, bulk);
          setError(result.error);
          setState(result.state);
        }}>
          <h2 className="font-heading text-2xl">{t.bulkClasses}</h2>
          <p className="text-sm text-[#1E6A83]">{t.bulkHelp}</p>
          <label className="block text-sm text-[#1E6A83]">{t.bulkFile}
            <input
              type="file"
              accept=".csv,text/csv"
              className="mt-1 block w-full text-sm"
              aria-label={t.bulkFile}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then(setBulk);
              }}
            />
          </label>
          <textarea className="h-24 w-full rounded-2xl border border-[#1E6A83]/30 p-3 text-sm" value={bulk} onChange={(event) => setBulk(event.target.value)} aria-label={t.bulkClasses} />
          <button type="submit" className={deskStyles.btn} data-action="bulk-classes">{t.bulkClasses}</button>
        </form>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <ul className="space-y-2">
          {rows.map((item) => (
            <li key={item.id}>
              <button type="button" className="w-full rounded-2xl bg-white px-3 py-3 text-left text-sm" onClick={() => setSelected(item.id)}>
                <span className="block font-semibold">{item.name}</span>
                <span className="text-[#1E6A83]">{item.level} · {item.campus} · {item.status}</span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? <li className="text-sm text-[#1E6A83]">{t.emptyClass}</li> : null}
        </ul>
        <div className="space-y-4">
          <form className="grid gap-2 rounded-3xl bg-white p-5 sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            const result = createClass(state, {
              name: form.name,
              subject: form.subject,
              level: form.level,
              programme: form.programme,
              term: form.term,
              campus: form.campus,
              room: form.room,
              timetable: form.timetable,
              coTeachers: form.coTeachers.split(',').map((item) => item.trim()).filter(Boolean),
              capacity: Number(form.capacity) || 20,
              ownerTeacherId: state.actorId,
              ownerTeacherName: state.actorName,
              createdByRole: role === 'institution_admin' ? 'institution_admin' : 'teacher',
              visibility,
              inviteAutoApprove: autoApprove,
            }, role);
            setError(result.error);
            if (!result.error) {
              setState(result.state);
              setSelected(result.state.classes[result.state.classes.length - 1]?.id ?? selected);
            }
          }}>
            <h2 className="font-heading text-2xl sm:col-span-2">{t.create}</h2>
            {(['name', 'subject', 'programme', 'term', 'campus', 'room', 'timetable', 'coTeachers', 'capacity'] as const).map((key) => (
              <input key={key} className={deskStyles.field} value={form[key]} onChange={(event) => setField(key, event.target.value)} aria-label={t.field[key]} />
            ))}
            <select className={deskStyles.field} value={form.level} onChange={(event) => setField('level', event.target.value)} aria-label={t.filterLevel}>
              {LEVELS.map((item) => <option key={item}>{item}</option>)}
            </select>
            <label className="text-sm text-[#1E6A83]">{t.visibility}
              <select className={`${deskStyles.field} mt-1 w-full`} value={visibility} data-class-visibility="1" aria-label={t.visibility} onChange={(event) => setVisibility(event.target.value === 'private' ? 'private' : 'school')}>
                <option value="school">{t.schoolClass}</option>
                <option value="private">{t.privateClass}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1E6A83]">
              <input type="checkbox" checked={autoApprove} data-class-auto="1" onChange={(event) => setAutoApprove(event.target.checked)} />
              {t.autoApprove}
            </label>
            <p className="text-sm text-[#1E6A83] sm:col-span-2">{t.privateHelp}</p>
            <button type="submit" className={deskStyles.btn} data-action="create-class">{t.create}</button>
            {error ? <p className="text-sm text-[#1E6A83] sm:col-span-2">{error}</p> : null}
          </form>
          {klass ? (
            <form className="grid gap-2 rounded-3xl bg-white p-5 sm:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              setState(updateClass(state, klass.id, {
                name: edit.name,
                subject: edit.subject,
                level: edit.level,
                programme: edit.programme,
                term: edit.term,
                campus: edit.campus,
                room: edit.room,
                timetable: edit.timetable,
                coTeachers: edit.coTeachers.split(',').map((item) => item.trim()).filter(Boolean),
                capacity: Number(edit.capacity) || klass.capacity,
              }, state.actorName));
            }}>
              <h2 className="font-heading text-2xl sm:col-span-2">{t.editClass}</h2>
              {(['name', 'subject', 'programme', 'term', 'campus', 'room', 'timetable', 'coTeachers', 'capacity'] as const).map((key) => (
                <input key={key} className={deskStyles.field} value={edit[key]} onChange={(event) => setEditField(key, event.target.value)} aria-label={t.field[key]} />
              ))}
              <select className={deskStyles.field} value={edit.level} onChange={(event) => setEditField('level', event.target.value)} aria-label={t.filterLevel}>
                {LEVELS.map((item) => <option key={item}>{item}</option>)}
              </select>
              <label className="text-sm text-[#1E6A83]">{t.assignTeacher}
                <select className={`${deskStyles.field} mt-1 w-full`} value={klass.ownerTeacherName} aria-label={t.assignTeacher} onChange={(event) => setState(updateClass(state, klass.id, { ownerTeacherName: event.target.value, ownerTeacherId: event.target.value === 'Aisha Rahman' ? 'teacher-aisha' : 'teacher-assigned' }, state.actorName))}>
                  {['Aisha Rahman', 'Daniel Ong', 'Siti Aminah'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <button type="submit" className={deskStyles.btn} data-action="save-class">{t.saveClass}</button>
            </form>
          ) : null}
          {klass ? (
            <section className="rounded-3xl bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-3xl">{klass.name}</h2>
                  <p className="text-sm text-[#1E6A83]">{klass.subject} · {klass.level} · {klass.programme} · {klass.term}</p>
                  <p className="text-sm text-[#1E6A83]">{klass.campus} · {klass.room} · {klass.timetable}</p>
                  <p className="text-sm text-[#1E6A83]">{t.coTeachers}: {klass.coTeachers.join(', ') || '—'} · {t.capacity} {klass.capacity}</p>
                  <p className="text-sm">{klass.visibility === 'private' ? t.privateClass : t.schoolClass}{klass.inviteAutoApprove ? ` · ${t.autoApprove}` : ''}</p>
                  <p className="text-sm">{t.joinCode} {klass.joinCode}</p>
                  <label className="mt-2 block text-sm text-[#1E6A83]">{t.inviteLink}
                    <input className={`${deskStyles.field} mt-1 w-full`} readOnly value={`https://poketschool.ai/join/class/${klass.joinCode}`} aria-label={t.inviteLink} />
                  </label>
                </div>
                <QRCodeSVG value={`https://poketschool.ai/join/class/${klass.joinCode}`} size={96} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={deskStyles.ghost} onClick={() => setState(updateClass(state, klass.id, { status: klass.status === 'archived' ? 'active' : 'archived' }, state.actorName))}>{t.archive}</button>
                {(['roster', 'attendance', 'assignments', 'goals', 'gradebook', 'news'] as const).map((item) => (
                  <button key={item} type="button" className={tab === item ? deskStyles.btn : deskStyles.ghost} onClick={() => setTab(item)}>{t.tabs[item]}</button>
                ))}
                <a className={deskStyles.ghost} href={deskHref(base, '/dashboard/teacher/exams')}>{t.examsTitle}</a>
                <a className={deskStyles.ghost} href={deskHref(base, '/dashboard/teacher/report-cards')}>{t.reportTitle}</a>
                <a className={deskStyles.ghost} href={deskHref(base, '/dashboard/teacher/planner')}>{t.plannerTitle}</a>
              </div>
              {tab === 'roster' && (
                <div className="mt-4 space-y-2">
                  {people.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#1E6A83]/15 px-3 py-2 text-sm">
                      <span>{item.studentName} · {item.joinMethod} · {item.status}{item.holdReason ? ` · ${item.holdReason}` : ''}</span>
                      {item.status === 'pending' ? (
                        <button type="button" data-action="approve-join" className={deskStyles.btn} onClick={() => setState(approveEnrolment(state, item.id, state.actorName))}>{t.approveJoin}</button>
                      ) : null}
                    </div>
                  ))}
                  <textarea className="h-20 w-full rounded-2xl border border-[#1E6A83]/30 p-3 text-sm" value={csv} onChange={(event) => setCsv(event.target.value)} aria-label={t.importCsv} />
                  <button type="button" className={deskStyles.ghost} onClick={() => setState(importRoster(state, klass.id, csv, state.actorName))}>{t.importCsv}</button>
                  <input className={deskStyles.field} value={inviteName} onChange={(event) => setInviteName(event.target.value)} aria-label={t.inviteStudent} />
                  <input className={deskStyles.field} value={studentRecord} onChange={(event) => setStudentRecord(event.target.value)} aria-label={t.studentRecord} />
                  <button type="button" data-action="invite-student" className={deskStyles.ghost} onClick={() => setState(addEnrolment(state, { classId: klass.id, studentName: inviteName || 'Invited student', studentId: studentRecord, under18: true, institutionMember: true, joinMethod: 'invite' as JoinMethod }, state.actorName))}>{t.sendInvite}</button>
                  <button type="button" className={deskStyles.ghost} onClick={() => setState(addEnrolment(state, { classId: klass.id, studentName: inviteName || 'Code student', under18: true, institutionMember: true, joinMethod: 'code' as JoinMethod }, state.actorName))}>{t.joinByCode}</button>
                  <button type="button" className={deskStyles.ghost} onClick={() => setState(addEnrolment(state, { classId: klass.id, studentName: 'Walk-in student', under18: true, institutionMember: false, joinMethod: 'code' as JoinMethod }, state.actorName))}>{t.addMinor}</button>
                  <p className="text-sm text-[#1E6A83]">{t.blockedMinor}</p>
                </div>
              )}
              {tab === 'attendance' && <a className={deskStyles.ghost} href={deskHref(base, '/dashboard/teacher/attendance')}>{t.attendanceTitle}</a>}
              {tab === 'assignments' && <a className={deskStyles.ghost} href={deskHref(base, '/dashboard/teacher/assignments')}>{t.assignmentsTitle}</a>}
              {tab === 'goals' && (
                <div className="mt-4">
                  <GoalRoster
                    state={state}
                    setState={setState}
                    classId={klass.id}
                    role={role === 'institution_admin' ? 'institution_admin' : 'teacher'}
                  />
                </div>
              )}
              {tab === 'gradebook' && (
                <ul className="mt-3 text-sm">
                  {people.filter((item) => item.status === 'active').map((item) => {
                    const result = termResult(state, klass.id, item.studentId);
                    return <li key={item.id}>{item.studentName}: {result.grade} · {gradeSetLabel(result.percent)}</li>;
                  })}
                  <a className={`${deskStyles.ghost} mt-3 inline-flex`} href={deskHref(base, '/dashboard/teacher/gradebook')}>{t.gradebookTitle}</a>
                </ul>
              )}
              {tab === 'news' && (
                <div className="mt-3 space-y-2">
                  {klass.announcements.map((item) => <p key={item} className="text-sm">{item}</p>)}
                  <input className={`${deskStyles.field} w-full`} value={news} onChange={(event) => setNews(event.target.value)} aria-label={t.tabs.news} />
                  <button type="button" className={deskStyles.btn} onClick={() => { if (news.trim()) setState(postAnnouncement(state, klass.id, news.trim(), state.actorName)); }}>{t.create}</button>
                </div>
              )}
              <p className="mt-4 text-sm text-[#1E6A83]">{t.attendanceTitle} {attendanceRate(state.attendance.filter((item) => item.classId === klass.id))}%</p>
            </section>
          ) : null}
        </div>
      </div>
    </DeskFrame>
  );
}
