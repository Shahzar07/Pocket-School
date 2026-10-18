'use client';

import { useEffect, useState } from 'react';
import { deskCopy as t } from '@/lib/school-desk/copy';
import {
  bulkGoals, canEditGoal, deleteGoal, goalSourceGroup, goalsForRoster, roster, upsertGoal,
  type DeskRole, type DeskState, type GoalSourceGroup, type GoalStatus,
} from '@/lib/school-desk/model';
import { ClassSelect, DeskFrame, DeskLinks, deskStyles, resetToDemo, useDesk } from './ui';

const SOURCE_FILTERS: GoalSourceGroup[] = ['self', 'et_ai', 'teacher', 'parent', 'institution'];

export function GoalRoster({
  state,
  setState,
  classId,
  role,
  showRoleToggle = false,
}: {
  state: DeskState;
  setState: (next: DeskState) => void;
  classId: string;
  role: DeskRole;
  showRoleToggle?: boolean;
}) {
  const [studentId, setStudentId] = useState('stu-priya');
  const [title, setTitle] = useState('Practise ratio questions');
  const [due, setDue] = useState('2026-10-24');
  const [dueTime, setDueTime] = useState('16:00');
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');
  const [actorRole, setActorRole] = useState<DeskRole>(role);
  const [view, setView] = useState<'all' | GoalStatus>('all');
  const [source, setSource] = useState<'all' | GoalSourceGroup>('all');
  const acting = showRoleToggle ? actorRole : role;
  const pupils = roster(state, classId).filter((item) => item.status === 'active');
  const classGoals = goalsForRoster(state, classId);
  const goals = classGoals.filter((item) => {
    if (view !== 'all' && item.status !== view) return false;
    if (source !== 'all' && goalSourceGroup(item.source) !== source) return false;
    return true;
  });
  const done = classGoals.filter((item) => item.status === 'completed').length;
  const overdue = classGoals.filter((item) => item.status === 'overdue').length;
  const school = acting === 'institution_admin';

  useEffect(() => {
    if (pupils.some((item) => item.studentId === studentId)) return;
    if (pupils[0]) setStudentId(pupils[0].studentId);
  }, [pupils, studentId]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#1E6A83]">{t.goalRule}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <p className="rounded-2xl bg-white p-4 text-sm">{t.completed} {done}/{classGoals.length}</p>
        <p className="rounded-2xl bg-white p-4 text-sm">{t.overdue} {overdue}</p>
        <p className="rounded-2xl bg-white p-4 text-sm">{t.goalSources.all} {classGoals.length}</p>
      </div>
      {acting === 'teacher' || acting === 'institution_admin' ? (
        <form className="grid gap-2 rounded-3xl bg-white p-5 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          const pupil = pupils.find((item) => item.studentId === studentId) ?? pupils[0];
          if (!pupil) return;
          const existing = editing ? state.goals.find((item) => item.id === editing) : undefined;
          setState(upsertGoal(state, {
            id: editing || undefined,
            studentId: pupil.studentId,
            studentName: pupil.studentName,
            classId: existing?.classId || classId,
            title,
            source: existing?.source ?? (school ? 'institution' : 'teacher'),
            assignedBy: existing?.assignedBy ?? (school ? state.institution.id : state.actorId),
            assignedByName: existing?.assignedByName ?? (school ? state.institution.name : state.actorName),
            due,
            dueTime,
            topic: existing?.topic || title,
            status: existing?.status ?? 'not_started',
            focusMinutes: existing?.focusMinutes,
            rescheduleCount: existing?.rescheduleCount,
            rescheduleLog: existing?.rescheduleLog,
          }, state.actorName, { actorId: state.actorId, role: acting }));
          setEditing('');
          setError('');
        }}>
          <select className={deskStyles.field} value={studentId} onChange={(event) => setStudentId(event.target.value)} aria-label={t.drill}>
            {pupils.map((item) => <option key={item.studentId} value={item.studentId}>{item.studentName}</option>)}
          </select>
          <input className={deskStyles.field} value={title} onChange={(event) => setTitle(event.target.value)} aria-label={t.titleLabel} />
          <input className={deskStyles.field} type="date" value={due} onChange={(event) => setDue(event.target.value)} aria-label={t.due} />
          <input className={deskStyles.field} type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} aria-label={t.due} />
          <button type="submit" data-action={editing ? 'save-goal' : 'add-goal'} className={deskStyles.btn}>{editing ? t.saveGoal : t.addGoal}</button>
          <button type="button" className={deskStyles.ghost} onClick={() => setState(bulkGoals(state, classId, title, due, school ? state.institution.id : state.actorId, school ? state.institution.name : state.actorName, school ? 'institution' : 'teacher'))}>{t.bulkGoal}</button>
        </form>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={view === 'all' ? deskStyles.btn : deskStyles.ghost} onClick={() => setView('all')}>{t.viewAll}</button>
        <button type="button" className={view === 'completed' ? deskStyles.btn : deskStyles.ghost} data-action="view-completed" onClick={() => setView('completed')}>{t.viewCompleted}</button>
        <button type="button" className={view === 'overdue' ? deskStyles.btn : deskStyles.ghost} data-action="view-overdue" onClick={() => setView('overdue')}>{t.viewOverdue}</button>
        <button type="button" className={view === 'in_progress' ? deskStyles.btn : deskStyles.ghost} onClick={() => setView('in_progress')}>{t.viewProgress}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={source === 'all' ? deskStyles.btn : deskStyles.ghost} data-action="source-all" onClick={() => setSource('all')}>{t.goalSources.all}</button>
        {SOURCE_FILTERS.map((item) => (
          <button key={item} type="button" className={source === item ? deskStyles.btn : deskStyles.ghost} data-action={`source-${item}`} onClick={() => setSource(item)}>{t.goalSources[item]}</button>
        ))}
      </div>
      {showRoleToggle ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={acting === 'teacher' ? deskStyles.btn : deskStyles.ghost} onClick={() => setActorRole('teacher')}>{t.asTeacher}</button>
          <button type="button" className={acting === 'institution_admin' ? deskStyles.btn : deskStyles.ghost} onClick={() => setActorRole('institution_admin')}>{t.asSchool}</button>
          <button type="button" className={acting === 'student' ? deskStyles.btn : deskStyles.ghost} onClick={() => setActorRole('student')}>{t.asStudent}</button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {goals.map((goal) => {
          const actorId = acting === 'student' ? goal.studentId : acting === 'institution_admin' ? state.institution.id : state.actorId;
          const editable = canEditGoal(goal, acting === 'institution_admin' ? state.actorId : actorId, acting);
          const move = goal.rescheduleLog[goal.rescheduleLog.length - 1];
          return (
            <li key={goal.id} className="rounded-2xl bg-white p-3 text-sm" data-source={goalSourceGroup(goal.source)}>
              <p className="font-semibold">{goal.studentName} · {goal.title}</p>
              <p className="text-[#1E6A83]">
                {t.goalSources[goalSourceGroup(goal.source)]} · {t.goalStatus[goal.status]} · {t.due} {goal.due} {goal.dueTime} · {t.focusLabel} {goal.focusMinutes} {t.focusUnit} · {t.reschedules} {goal.rescheduleCount}
              </p>
              <p className="text-[#1E6A83]">{goal.assignedByName}</p>
              {move ? <p className="text-[#1E6A83]">{t.lastMove} {move.fromDate} {move.fromTime ?? ''} {move.toDate} {move.toTime ?? ''}</p> : null}
              {editable ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" data-action="edit-goal" className={deskStyles.ghost} onClick={() => { setEditing(goal.id); setTitle(goal.title); setDue(goal.due); setDueTime(goal.dueTime); setStudentId(goal.studentId); }}>{t.editGoal}</button>
                  <select className={deskStyles.field} value={goal.status} aria-label={goal.title} onChange={(event) => setState(upsertGoal(state, { ...goal, status: event.target.value as GoalStatus }, state.actorName, { actorId: state.actorId, role: acting }))}>
                    {(['not_started', 'in_progress', 'completed', 'overdue'] as const).map((item) => <option key={item} value={item}>{t.goalStatus[item]}</option>)}
                  </select>
                  <button type="button" data-action="delete-goal" className={deskStyles.ghost} onClick={() => {
                    const result = deleteGoal(state, goal.id, acting === 'student' ? goal.studentId : state.actorId, acting);
                    setError(result.error);
                    setState(result.state);
                  }}>{t.deleteGoal}</button>
                </div>
              ) : (
                <p className="mt-2 text-[#1E6A83]">{t.readOnlyGoal}</p>
              )}
            </li>
          );
        })}
      </ul>
      {error ? <p className="text-sm text-[#1E6A83]">{error}</p> : null}
    </div>
  );
}

export function GoalsDesk({ base = 'dashboard' }: { base?: 'dashboard' | 'preview' }) {
  const { state, setState } = useDesk();
  const [classId, setClassId] = useState('class-maths');
  const klass = state.classes.find((item) => item.id === classId) ?? state.classes[0];
  const activeId = klass?.id ?? '';

  return (
    <DeskFrame title={t.goalsTitle} lede={t.goalsLede} state={state} onReset={() => resetToDemo(setState)} syncs="Student goals, report cards, ET AI planner when a published mark is weak">
      <DeskLinks base={base} />
      <ClassSelect state={state} classId={activeId} onChange={setClassId} />
      <GoalRoster state={state} setState={setState} classId={activeId} role="teacher" showRoleToggle={base === 'preview'} />
    </DeskFrame>
  );
}
