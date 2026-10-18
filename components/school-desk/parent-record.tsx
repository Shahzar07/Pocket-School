'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { deskCopy as t } from '@/lib/school-desk/copy';
import { gradeSetLabel } from '@/lib/school-desk/model';

interface MarkRow {
  id: string;
  title: string;
  points: string;
  name: string;
  scale: string;
  scales: string;
}

interface ReportRow {
  id: string;
  name: string;
  comment: string;
  className: string;
}

function publishedMarks(snap: { docs: Array<{ id: string; data: () => DocumentData }> }): MarkRow[] {
  return snap.docs.flatMap((item) => {
    const data = item.data();
    if (data.state !== 'published') return [];
    const points = typeof data.points === 'number' ? data.points : null;
    const max = typeof data.maxPoints === 'number' ? data.maxPoints : 0;
    const percent = points != null && max > 0 ? (points / max) * 100 : Number.NaN;
    return [{
      id: item.id,
      title: typeof data.assessmentTitle === 'string' && data.assessmentTitle ? data.assessmentTitle : 'Mark',
      points: points == null ? '—' : String(points),
      name: typeof data.studentName === 'string' ? data.studentName : '',
      scale: typeof data.scaleId === 'string' ? data.scaleId : '',
      scales: gradeSetLabel(percent),
    }];
  });
}

function publishedReports(snap: { docs: Array<{ id: string; data: () => DocumentData }> }): ReportRow[] {
  return snap.docs.flatMap((item) => {
    const data = item.data();
    if (data.status !== 'published') return [];
    return [{
      id: item.id,
      name: typeof data.studentName === 'string' ? data.studentName : '',
      comment: typeof data.subjectComment === 'string' ? data.subjectComment : '',
      className: typeof data.className === 'string' ? data.className : '',
    }];
  });
}

/** Published class marks and report cards for the children linked to this parent. */
export function ParentClassRecord({ childIds }: { childIds: string[] }) {
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const key = childIds.join('|');

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    if (!ids.length) {
      setMarks([]);
      setReports([]);
      return undefined;
    }
    const markMap = new Map<string, MarkRow[]>();
    const reportMap = new Map<string, ReportRow[]>();
    const stops = ids.flatMap((studentId) => [
      onSnapshot(query(collection(db, 'school_marks'), where('studentId', '==', studentId)), (snap) => {
        markMap.set(studentId, publishedMarks(snap));
        setMarks([...markMap.values()].flat());
      }),
      onSnapshot(query(collection(db, 'school_reports'), where('studentId', '==', studentId)), (snap) => {
        reportMap.set(studentId, publishedReports(snap));
        setReports([...reportMap.values()].flat());
      }),
    ]);
    return () => {
      for (const stop of stops) stop();
    };
  }, [key]);

  if (!key) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5" data-parent-record="yes">
      <h2 className="font-heading text-2xl text-foreground">{t.parentMarks}</h2>
      {marks.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t.parentEmpty}</p> : (
        <ul className="mt-3 space-y-2 text-sm">
          {marks.map((item) => (
            <li key={item.id} data-parent-mark={item.id}>{item.name} · {item.title} · {item.points} · {item.scale} · {item.scales}</li>
          ))}
        </ul>
      )}
      <h2 className="mt-5 font-heading text-2xl text-foreground">{t.parentReports}</h2>
      {reports.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t.parentEmpty}</p> : (
        <ul className="mt-3 space-y-2 text-sm">
          {reports.map((item) => (
            <li key={item.id} data-parent-report={item.id}>{item.name} · {item.className} · {item.comment}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
