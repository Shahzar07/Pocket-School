import { escalationFor, limitsForAge } from '@/lib/study/planner';

export function EscalationLadder({ missed }: { missed: number }) {
  const step = escalationFor(missed, limitsForAge('teen'));
  const rows = [
    { on: step.studentReminder, title: 'Student reminder', detail: 'The student sees the overdue goal first.' },
    { on: step.parentNotify, title: 'Parent push and email', detail: 'After the student reminder, a linked parent gets a goals notification. Email follows when mail is configured.' },
    { on: step.teacherFlag, title: 'Teacher flag', detail: 'Class adherence flags the miss after the parent step, once the age limit is reached.' },
  ];
  return (
    <section className="rounded-[28px] border border-[#e5ebf2] bg-white p-4" aria-label="Overdue escalation">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#096ab7]">Escalation</p>
      <h2 className="font-heading text-xl text-[#11131b]">{missed === 0 ? 'Nothing overdue' : `${missed} missed`}</h2>
      <ol className="mt-3 space-y-2">
        {rows.map((row, index) => (
          <li key={row.title} className="rounded-2xl bg-[#F7FBFC] px-3 py-2 text-sm">
            <p className="font-semibold text-[#11131b]">{index + 1}. {row.title} · {row.on ? 'On' : 'Waiting'}</p>
            <p className="text-[#096ab7]">{row.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
