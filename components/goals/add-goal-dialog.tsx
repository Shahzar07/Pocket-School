'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  checklistId, POMODORO_BREAK, POMODORO_WORK,
  type GoalCategory, type GoalDraft, type GoalPriority, type GoalRecurrence, type GoalTargetKind,
} from '@/lib/insights/goals';
import { GOAL_ON_TIME_BONUS, GOAL_STREAK_BONUS } from '@/lib/sparks';
import { isoDateKey } from '@/lib/insights/dates';

const CATEGORIES: GoalCategory[] = ['study', 'revision', 'practice', 'reading', 'other'];
const KINDS: { id: GoalTargetKind; label: string }[] = [
  { id: 'free_text', label: 'Free text' },
  { id: 'lessons', label: 'Course lessons' },
  { id: 'revision', label: 'Revision' },
  { id: 'quiz_score', label: 'Quiz score' },
  { id: 'studio', label: 'AI Studio' },
];

export interface GoalCourseOption {
  id: string;
  title: string;
  teacherId?: string;
  units: { id: string; title: string; lessons: { id: string; title: string }[] }[];
}

function defaultDeadline(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AddGoalDialog({
  open, onClose, onCreate, courses = [],
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: GoalDraft) => Promise<void>;
  courses?: GoalCourseOption[];
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GoalCategory>('study');
  const [estimateMinutes, setEstimateMinutes] = useState(25);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [dateKey, setDateKey] = useState(isoDateKey);
  const [endDate, setEndDate] = useState('');
  const [recurrence, setRecurrence] = useState<GoalRecurrence>('none');
  const [targetKind, setTargetKind] = useState<GoalTargetKind>('free_text');
  const [freeTextTarget, setFreeTextTarget] = useState('');
  const [courseId, setCourseId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [quizTarget, setQuizTarget] = useState(80);
  const [studioTask, setStudioTask] = useState('');
  const [checkText, setCheckText] = useState('');
  const [reflectionPrompt, setReflectionPrompt] = useState('');
  const [priority, setPriority] = useState<GoalPriority>('medium');
  const [reminderTime, setReminderTime] = useState('16:00');
  const [sparksOn, setSparksOn] = useState(true);
  const [reward, setReward] = useState('');
  const [pomodoroMode, setPomodoroMode] = useState<'classic' | 'custom'>('classic');
  const [workMinutes, setWorkMinutes] = useState(POMODORO_WORK);
  const [breakMinutes, setBreakMinutes] = useState(POMODORO_BREAK);
  const [saving, setSaving] = useState(false);

  const course = useMemo(() => courses.find(item => item.id === courseId), [courses, courseId]);
  const unit = course?.units.find(item => item.id === unitId);

  if (!open) return null;

  const needsCourse = targetKind === 'lessons' || targetKind === 'revision' || targetKind === 'quiz_score' || targetKind === 'unit';

  const toggleLesson = (id: string) => {
    setLessonIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const selectedLessons = (unit?.lessons ?? []).filter(lesson => lessonIds.includes(lesson.id));
      const wholeUnit = targetKind === 'lessons' && unit && selectedLessons.length === unit.lessons.length;
      await onCreate({
        title: title.trim(),
        category: targetKind === 'revision' ? 'revision' : category,
        estimateMinutes,
        deadline,
        dateKey,
        endDate: endDate || undefined,
        recurrence,
        targetKind: wholeUnit ? 'unit' : targetKind,
        freeTextTarget: freeTextTarget.trim() || undefined,
        courseId: course?.id,
        courseLabel: course?.title,
        unitId: unit?.id,
        unitTitle: unit?.title,
        lessonIds: selectedLessons.map(lesson => lesson.id),
        lessonTitles: selectedLessons.map(lesson => lesson.title),
        quizTarget: targetKind === 'quiz_score' ? quizTarget : undefined,
        studioTask: targetKind === 'studio' ? studioTask.trim() : undefined,
        checklist: checkText.split('\n').map(line => line.trim()).filter(Boolean).map(label => ({ id: checklistId(), label, done: false })),
        reminderMinutes: 30,
        reminderTime,
        priority,
        reflectionPrompt: reflectionPrompt.trim() || undefined,
        sparksBonus: sparksOn ? GOAL_ON_TIME_BONUS : 0,
        reward: reward.trim() || undefined,
        pomodoroWork: pomodoroMode === 'custom' ? workMinutes : POMODORO_WORK,
        pomodoroBreak: pomodoroMode === 'custom' ? breakMinutes : POMODORO_BREAK,
        shareWithTeachers: true,
        teacherIds: course?.teacherId ? [course.teacherId] : [],
      });
      setTitle('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-goal-title">
      <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4" data-add-goal>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">New goal</p>
          <h2 id="add-goal-title" className="font-heading text-2xl text-foreground">Add a goal</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Finish on time and the server adds {GOAL_ON_TIME_BONUS} Sparks, plus {GOAL_STREAK_BONUS} when the streak reaches three days.
          </p>
        </div>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What will you finish?" aria-label="Goal title" />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(item => (
            <button key={item} type="button" onClick={() => setCategory(item)}
              className={`h-8 px-3 rounded-full text-xs font-semibold capitalize ${category === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" data-goal-kinds>
          {KINDS.map(kind => (
            <button key={kind.id} type="button" onClick={() => setTargetKind(kind.id)}
              className={`h-8 px-3 rounded-full text-xs font-semibold ${targetKind === kind.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
              {kind.label}
            </button>
          ))}
        </div>
        {targetKind === 'free_text' && (
          <Input value={freeTextTarget} onChange={e => setFreeTextTarget(e.target.value)} placeholder="Describe the target" aria-label="Free text target" />
        )}
        {targetKind === 'studio' && (
          <Input value={studioTask} onChange={e => setStudioTask(e.target.value)} placeholder="AI Studio task, for example a mind map" aria-label="AI Studio task" />
        )}
        {needsCourse && (
          <div className="space-y-2" data-course-picker>
            <label className="text-xs text-muted-foreground">Course
              <select value={courseId} onChange={e => { setCourseId(e.target.value); setUnitId(''); setLessonIds([]); }} className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-sm" aria-label="Course">
                <option value="">Choose a course</option>
                {courses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            {course && (
              <label className="text-xs text-muted-foreground">Unit
                <select value={unitId} onChange={e => { setUnitId(e.target.value); setLessonIds([]); }} className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-sm" aria-label="Unit">
                  <option value="">Choose a unit</option>
                  {course.units.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
            )}
            {unit && unit.lessons.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Lessons</p>
                {unit.lessons.map(lesson => (
                  <label key={lesson.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={lessonIds.includes(lesson.id)} onChange={() => toggleLesson(lesson.id)} />
                    {lesson.title}
                  </label>
                ))}
              </div>
            )}
            {targetKind === 'revision' && (
              <Input value={freeTextTarget} onChange={e => setFreeTextTarget(e.target.value)} placeholder="Topic to revise, if it is not a lesson" aria-label="Revision target" />
            )}
            {targetKind === 'quiz_score' && (
              <label className="text-xs text-muted-foreground">Target score %
                <Input type="number" min={1} max={100} value={quizTarget} onChange={e => setQuizTarget(Number(e.target.value) || 80)} className="mt-1" aria-label="Quiz score target" />
              </label>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">Target date
            <Input type="date" value={dateKey} onChange={e => setDateKey(e.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-muted-foreground">Deadline
            <Input type="time" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-muted-foreground">Study minutes
            <Input type="number" min={5} max={180} value={estimateMinutes} onChange={e => setEstimateMinutes(Number(e.target.value) || 25)} className="mt-1" aria-label="Planned study minutes" />
          </label>
          <label className="text-xs text-muted-foreground">Repeats
            <select value={recurrence} onChange={e => setRecurrence(e.target.value as GoalRecurrence)} className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-sm" aria-label="Recurrence">
              <option value="none">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="weekdays">Weekdays</option>
            </select>
          </label>
        </div>
        {recurrence !== 'none' && (
          <label className="text-xs text-muted-foreground">Repeat until
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
          </label>
        )}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Focus timer</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setPomodoroMode('classic')} className={`h-8 px-3 rounded-full text-xs font-semibold ${pomodoroMode === 'classic' ? 'bg-foreground text-background' : 'bg-muted'}`}>25 / 5</button>
            <button type="button" onClick={() => setPomodoroMode('custom')} className={`h-8 px-3 rounded-full text-xs font-semibold ${pomodoroMode === 'custom' ? 'bg-foreground text-background' : 'bg-muted'}`}>Custom</button>
          </div>
          {pomodoroMode === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">Work minutes
                <Input type="number" min={1} max={90} value={workMinutes} onChange={e => setWorkMinutes(Number(e.target.value) || 25)} className="mt-1" aria-label="Work minutes" />
              </label>
              <label className="text-xs text-muted-foreground">Break minutes
                <Input type="number" min={0} max={30} value={breakMinutes} onChange={e => setBreakMinutes(Number(e.target.value) || 0)} className="mt-1" aria-label="Break minutes" />
              </label>
            </div>
          )}
        </div>
        <textarea value={checkText} onChange={e => setCheckText(e.target.value)} placeholder="Checklist, one step per line" rows={3} className="w-full rounded-lg border border-border bg-background p-2 text-sm" aria-label="Checklist" />
        <Input value={reflectionPrompt} onChange={e => setReflectionPrompt(e.target.value)} placeholder="Reflection prompt (optional)" aria-label="Reflection prompt" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">Priority
            <select value={priority} onChange={e => setPriority(e.target.value as GoalPriority)} className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-sm" aria-label="Priority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Reminder
            <Input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className="mt-1" aria-label="Reminder time" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sparksOn} onChange={e => setSparksOn(e.target.checked)} />
          Sparks bonus when this is finished on time
        </label>
        <Input value={reward} onChange={e => setReward(e.target.value)} placeholder="Optional reward, for example a film night" aria-label="Reward" />
        <p className="text-sm text-[#1E6A83]">Teachers and linked parents can see this goal.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save goal'}</Button>
        </div>
      </div>
    </div>
  );
}
