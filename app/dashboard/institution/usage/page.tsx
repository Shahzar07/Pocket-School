'use client';

import { useMemo, useState } from 'react';
import { DashHeader, DashPage, Panel, StatCard } from '@/components/dash-ui';
import { Input } from '@/components/ui/input';
import { usageRoi } from '@/lib/institution-commerce';
import { GraduationCap, Award, BookOpen, Sparkles } from 'lucide-react';

export default function InstitutionUsagePage() {
  const [invoice, setInvoice] = useState(580.99);
  const [students, setStudents] = useState(40);
  const [lessons, setLessons] = useState(800);
  const [certificates, setCertificates] = useState(12);
  const [attendance, setAttendance] = useState(0.92);
  const [spent, setSpent] = useState(9000);
  const [allowance, setAllowance] = useState(32000);
  const roi = useMemo(() => usageRoi({
    currency: 'USD', invoiceUsd: invoice, activeStudents: students, lessonsCompleted: lessons,
    certificatesIssued: certificates, attendanceRate: attendance, sparksSpent: spent, sparksAllowance: allowance,
  }), [invoice, students, lessons, certificates, attendance, spent, allowance]);

  return (
    <DashPage>
      <DashHeader eyebrow="Institution" title="Usage" accent="and cost" description={roi.headline} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={GraduationCap} label="Per student" value={`USD ${roi.costPerStudent.toFixed(2)}`} index={0} />
        <StatCard icon={BookOpen} label="Per lesson" value={`USD ${roi.costPerLesson.toFixed(2)}`} index={1} />
        <StatCard icon={Award} label="Per certificate" value={`USD ${roi.costPerCertificate.toFixed(2)}`} index={2} />
        <StatCard icon={Sparkles} label="Sparks used" value={`${roi.sparksUsedPercent}%`} badge={`${roi.attendancePercent}% attendance`} index={3} />
      </div>
      <Panel>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Invoice USD" value={invoice} onChange={setInvoice} />
          <Field label="Active students" value={students} onChange={setStudents} />
          <Field label="Lessons completed" value={lessons} onChange={setLessons} />
          <Field label="Certificates" value={certificates} onChange={setCertificates} />
          <Field label="Attendance 0–1" value={attendance} onChange={setAttendance} />
          <Field label="Sparks spent" value={spent} onChange={setSpent} />
          <Field label="Sparks allowance" value={allowance} onChange={setAllowance} />
        </div>
      </Panel>
    </DashPage>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-sm">{label}
      <Input className="mt-1 h-11 rounded-xl" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
