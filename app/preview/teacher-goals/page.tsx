import { ClassAdherence } from '@/components/goals/class-adherence';
import { EscalationLadder } from '@/components/goals/escalation-ladder';

export default function TeacherGoalsPreview() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Rochford demo · Leah Tan, teacher</p>
        <EscalationLadder missed={3} />
        <ClassAdherence
          classRate={67}
          rows={[
            { studentId: 'amina', name: 'Amina Rahman', assigned: 3, onTime: 2, rate: 67 },
            { studentId: 'wei', name: 'Wei Lin', assigned: 3, onTime: 3, rate: 100 },
          ]}
        />
      </div>
    </main>
  );
}
