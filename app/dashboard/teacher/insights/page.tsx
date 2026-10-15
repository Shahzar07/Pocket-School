'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getGradesForCourse, getTeacherCourses, type Course, type Grade } from '@/lib/db';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { GlossaryTip } from '@/components/insights/boards';
import { cohortBenchmark, tagBloom } from '@/lib/insights/analytics';

export default function TeacherInsightsPage() {
  const { user } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(list => {
      setCourses(list);
      setCourseId(current => current || list[0]?.id || '');
    }).catch(() => setCourses([]));
  }, [user]);

  useEffect(() => {
    if (!courseId) return;
    getGradesForCourse(courseId).then(setGrades).catch(() => setGrades([]));
  }, [courseId]);

  const percents = grades.map(grade => (grade.maxScore ? (100 * grade.score) / grade.maxScore : 0));
  const average = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null;
  const cohort = cohortBenchmark(percents, average);
  const bloom = tagBloom(grades.map(grade => grade.label).join(' '));

  return (
    <DashPage>
      <DashHeader
        eyebrow="Class"
        title="Insights"
        accent="without names in the cohort"
        description="Quiz trends for a class you teach. A cohort percentile appears only when at least eight scores are in the set."
      />
      <label className="text-sm font-semibold block max-w-sm">
        Class
        <select className="mt-1 w-full h-10 rounded-xl border border-border bg-card px-3" value={courseId} onChange={event => setCourseId(event.target.value)}>
          {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </label>
      <div className="grid sm:grid-cols-3 gap-3">
        <Panel>
          <p className="text-xs text-muted-foreground flex items-center gap-1">Quiz average <GlossaryTip id="quiz_average" /></p>
          <p className="text-3xl font-semibold mt-1">{average ?? '—'}{average != null ? '%' : ''}</p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Scores</p>
          <p className="text-3xl font-semibold mt-1">{percents.length}</p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Bloom hint from titles</p>
          <p className="text-3xl font-semibold mt-1 capitalize">{bloom}</p>
        </Panel>
      </div>
      <Panel>
        {cohort ? (
          <p className="text-sm">Anonymous cohort: a score of {average}% sits near the {cohort.percentile}th percentile of {cohort.size} scores. Student names are not listed here.</p>
        ) : (
          <p className="text-sm text-muted-foreground">The cohort stays hidden until this class has at least eight scores.</p>
        )}
      </Panel>
    </DashPage>
  );
}
