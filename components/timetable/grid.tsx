'use client';

import { DAY_LABEL, TIMETABLE_COPY } from '@/lib/timetable/copy';
import type { Lesson, TimetableDoc } from '@/lib/timetable/types';

export function TimetableGrid({
  doc,
  lessons,
  selectedId,
  onSelect,
  onMove,
}: {
  doc: TimetableDoc;
  lessons: Lesson[];
  selectedId: string;
  onSelect: (id: string) => void;
  onMove: (lessonId: string, day: Lesson['day'], periodId: string) => void;
}) {
  return (
    <div className="overflow-x-auto" data-print-root="1">
      <table className="w-full min-w-[720px] border-collapse text-sm text-[#203337] dark:text-[#E7F4F2]">
        <thead>
          <tr>
            <th className="border border-[#1E6A83]/20 bg-[#E9F7FA] p-2 text-left dark:border-[#3FE0D0]/25 dark:bg-[#122226]">{TIMETABLE_COPY.setupPeriods}</th>
            {doc.days.map(day => (
              <th key={day} className="border border-[#1E6A83]/20 bg-[#E9F7FA] p-2 text-left dark:border-[#3FE0D0]/25 dark:bg-[#122226]">{DAY_LABEL[day]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.periods.map(period => (
            <tr key={period.id}>
              <th className="border border-[#1E6A83]/15 p-2 text-left font-semibold">
                {period.label}
                <span className="mt-1 block text-xs font-normal text-[#1E6A83]">{period.start}</span>
              </th>
              {doc.days.map(day => {
                const cell = lessons.filter(lesson => lesson.day === day && lesson.periodId === period.id);
                return (
                  <td key={`${day}:${period.id}`} className="border border-[#1E6A83]/15 align-top p-1">
                    <div
                      data-slot={`${day}:${period.id}`}
                      className="min-h-16 rounded-xl"
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => {
                        const lessonId = event.dataTransfer.getData('text/lesson');
                        if (lessonId) onMove(lessonId, day, period.id);
                      }}
                    >
                      {cell.map(lesson => {
                        const subject = doc.subjects.find(item => item.id === lesson.subjectId);
                        const teacher = doc.staff.find(item => item.id === lesson.teacherId);
                        const room = doc.rooms.find(item => item.id === lesson.roomId);
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            draggable
                            data-lesson={lesson.id}
                            data-teacher={lesson.teacherId}
                            data-slot={`${day}:${period.id}`}
                            onDragStart={event => event.dataTransfer.setData('text/lesson', lesson.id)}
                            onClick={() => {
                              if (selectedId && selectedId !== lesson.id) onMove(selectedId, day, period.id);
                              else onSelect(lesson.id);
                            }}
                            className={`mb-1 w-full rounded-xl px-2 py-1 text-left text-[#203337] ${selectedId === lesson.id ? 'bg-[#3FE0D0]' : 'bg-[#E9F7FA] dark:bg-[#1A3338] dark:text-[#E7F4F2]'}`}
                          >
                            <span className="block font-semibold">{subject ? `${subject.name} — ${subject.level}` : lesson.subjectId}</span>
                            <span className="block text-xs text-[#1E6A83] dark:text-[#E7F4F2]">{teacher?.name} · {room?.name}</span>
                          </button>
                        );
                      })}
                      {cell.length === 0 ? (
                        <button
                          type="button"
                          data-empty-slot={`${day}:${period.id}`}
                          aria-label={`${DAY_LABEL[day]} ${period.label}`}
                          className="h-16 w-full rounded-xl text-xs text-[#1E6A83]"
                          onClick={() => { if (selectedId) onMove(selectedId, day, period.id); }}
                        >
                          {period.start}
                        </button>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
