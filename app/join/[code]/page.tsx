'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthSTORE } from '@/hooks/use-auth';
import { enrollStudent, incrementEnrollment } from '@/lib/db';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { StudentPassCard } from '@/components/student-pass-card';
import { isStudentNumber, studentCodeFromScan } from '@/lib/student-number';

function StudentNumberJoin({ code }: { code: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 bg-[#F6F1E7] px-4 py-12">
      <div className="rounded-3xl border border-[#C8922A]/40 bg-white p-6 shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C8922A]">Poket School</p>
        <h1 className="mt-2 font-heading text-3xl text-[#1A3C34]">Link with a student number</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#1A3C34]/75">
          Parents request a link with this code. The student confirms it. For a learner under 13, the institution admin confirms. Institution admins can also verify the student and approve membership.
        </p>
        <p className="mt-4 font-mono text-xl tracking-wider text-[#1A3C34]">{code}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/dashboard/parent" className="inline-flex h-11 items-center justify-center rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white">I&apos;m a parent</Link>
          <Link href="/dashboard/institution/verify" className="inline-flex h-11 items-center justify-center rounded-full bg-[#C8922A] px-5 text-sm font-semibold text-[#1A3C34]">I&apos;m an institution admin</Link>
        </div>
      </div>
      <StudentPassCard name="Student pass" level="Open this code in your dashboard" code={code} />
    </main>
  );
}

export default function JoinCodePage() {
  const params = useParams<{ code: string }>();
  const raw = decodeURIComponent(params.code ?? '');
  const studentCode = studentCodeFromScan(raw);
  if (isStudentNumber(studentCode)) return <StudentNumberJoin code={studentCode} />;
  return <JoinClassPage code={raw} />;
}

function JoinClassPage({ code }: { code: string }) {
  const { user, loading } = useAuthSTORE();
  const router = useRouter();
  const [message, setMessage] = useState('Looking up that class…');
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    getDocs(query(collection(db, 'courses'), where('joinCode', '==', code.toUpperCase())))
      .then((snap) => {
        const docSnap = snap.docs[0];
        if (!docSnap) { setMessage('That join code does not match a class.'); return; }
        setCourseId(docSnap.id);
        setMessage(`Join ${docSnap.data().title || 'this class'}?`);
      })
      .catch(() => setMessage('Could not look up that code. Sign in and try again.'));
  }, [code]);

  const join = async () => {
    if (!user || !courseId) { router.push(`/login?next=/join/${code}`); return; }
    await enrollStudent(user.uid, courseId);
    await incrementEnrollment(courseId);
    router.push(`/dashboard/student/courses/${courseId}`);
  };

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-border bg-card p-8 text-center space-y-4">
        <h1 className="font-heading text-3xl">Join a class</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {courseId && <Button onClick={join} disabled={loading} className="rounded-full">Join class</Button>}
      </div>
    </div>
  );
}
