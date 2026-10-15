'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthSTORE } from '@/hooks/use-auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { enrollStudent, incrementEnrollment } from '@/lib/db';
import { Button } from '@/components/ui/button';

export default function JoinClassPage() {
  const { code } = useParams<{ code: string }>();
  const { user, profile, loading } = useAuthSTORE();
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
