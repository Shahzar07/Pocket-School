'use client';

import { useState } from 'react';
import { deskCopy as t } from '@/lib/school-desk/copy';
import { bulkGoals, deleteGoal, roster, upsertGoal, type GoalStatus } from '@/lib/school-desk/model';
import { ClassSelect, DeskFrame, DeskLinks, deskStyles, resetToDemo, useDesk } from './ui';

export function GoalsDesk({ base = 'dashboard' }: { base?: 'dashboard' | 'preview' }) {
  const { state, setState } = useDesk();
  const [classId, setClassId] = useState('class-maths');
  const [studentId, setStudentId] = useState('stu-priya');
  const [title, setTitle] = useState('Practise ratio questions');
  const [due, setDue] = useState('2026-10-24');
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const klass = state.classes.find((item) => item.id === classId) ?? state.classes[0];
  const activeId = klass?.id ?? '';
  const pupils = roster(state, activeId).filter((item) => item.status === 'active');
  const goals = state.goals.filter((item) => item.classId === activeId);
  const done = goals.filter((item) => item.status === 'completed').length;
  const overdue = goals.filter((item) => item.status === 'overdue').length;

  return (
    <DeskFrame title={t.goalsTitle} lede={t.goalsLede} state={state} onReset={() => resetToDemo(setState)} syncs="Student goals, report cards, ET AI planner when a published mark is weak">
      <DeskLinks base={base} />
      <p className="text-sm text-[#1E6A83]">{t.goalRule}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <ClassSelect state={state} classId={activeId} onChange={setClassId} />
        <p className="rounded-2xl bg-white p-4 text-sm">{t.completed} {done}/{goals.length}</p>
        <p className="rounded-2xl bg-white p-4 text-sm">{t.overdue} {overdue}</p>
      </div>
      <form className="grid gap-2 rounded-3xl bg-white p-5 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        const pupil = pupils.find((item) => item.studentId === studentId) ?? pupils[0];
        if (!pupil) return;
        setState(upsertGoal(state, {
          id: editing || undefined,
          studentId: pupil.studentId,
          studentName: pupil.studentName,
          classId: activeId,
          title,
          source: 'teacher',
          assignedBy: state.actorId,
          assignedByName: state.actorName,
          due,
          topic: title,
          status: 'not_started',
        }, state.actorName));
        setEditing('');
      }}>
        <select className={deskStyles.field} value={studentId} onChange={(event) => setStudentId(event.target.value)} aria-label={t.drill}>
          {pupils.map((item) => <option key={item.studentId} value={item.studentId}>{item.studentName}</option>)}
        </select>
        <input className={deskStyles.field} value={title} onChange={(event) => setTitle(event.target.value)} aria-label={t.titleLabel} />
        <input className={deskStyles.field} type="date" value={due} onChange={(event) => setDue(event.target.value)} aria-label={t.due} />
        <button type="submit" className={deskStyles.btn}>{editing ? t.save : t.addGoal}</button>
        <button type="button" className={deskStyles.ghost} onClick={() => setState(bulkGoals(state, activeId, title, due, state.actorId, state.actorName))}>{t.bulkGoal}</button>
      </form>
      <div className="flex gap-2">
        <button type="button" className={role === 'teacher' ? deskStyles.btn : deskStyles.ghost} onClick={() => setRole('teacher')}>{t.asTeacher}</button>
        <button type="button" className={role === 'student' ? deskStyles.btn : deskStyles.ghost} onClick={() => setRole('student')}>{t.asStudent}</button>
      </div>
      <ul className="space-y-2">
        {goals.map((goal) => (
          <li key={goal.id} className="rounded-2xl bg-white p-3 text-sm">
            <p className="font-semibold">{goal.studentName} · {goal.title}</p>
            <p className="text-[#1E6A83]">{goal.source} · {goal.status} · {goal.due} · {goal.assignedByName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={deskStyles.ghost} onClick={() => { setEditing(goal.id); setTitle(goal.title); setDue(goal.due); setStudentId(goal.studentId); }}>{t.save}</button>
              <select className={deskStyles.field} value={goal.status} aria-label={goal.title} onChange={(event) => setState(upsertGoal(state, { ...goal, status: event.target.value as GoalStatus }, state.actorName))}>
                {(['not_started', 'in_progress', 'completed', 'overdue'] as const).map((item) => <option key={item} value={item}>{t.goalStatus[item]}</option>)}
              </select>
              <button type="button" data-action="delete-goal" className={deskStyles.ghost} onClick={() => {
                const actor = role === 'student' ? goal.studentId : state.actorId;
                const result = deleteGoal(state, goal.id, actor, role);
                setError(result.error);
                setState(result.state);
              }}>{t.deleteGoal}</button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-[#1E6A83]">{error}</p> : null}
    </DeskFrame>
  );
}
