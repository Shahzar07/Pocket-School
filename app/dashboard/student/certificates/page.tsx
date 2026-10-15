'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { Award, Loader2 } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getCertificatesForStudent, type Certificate } from '@/lib/db';
import { authedFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { CertificateDocument } from '@/components/certificate-document';
import { CertificateCelebration } from '@/components/certificate-celebration';
import type { CertificateAward, CertificateFace } from '@/lib/certificates';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

function toFace(cert: Certificate): CertificateFace {
  const issued = cert.issuedAt instanceof Timestamp ? cert.issuedAt.toDate() : cert.issuedAt;
  return {
    id: cert.id ?? '',
    studentName: cert.studentName,
    courseTitle: cert.courseTitle,
    moduleTitle: cert.moduleTitle,
    moduleId: cert.moduleId,
    courseId: cert.courseId,
    issuedAt: issued,
    issuedByName: cert.issuedByName,
  };
}

export default function StudentCertificatesPage() {
  const { user } = useAuthSTORE();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState<CertificateAward | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const synced = await authedFetch('/api/platform/sync-certificates', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        const issued = Array.isArray(synced.issued) ? synced.issued as CertificateAward[] : [];
        if (!cancelled && issued[0]?.fresh) setCelebration(issued[0]);
      } catch {
        // The list below still shows certificates that were already saved.
      }
      try {
        const rows = await getCertificatesForStudent(user.uid);
        if (!cancelled) setCerts(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking finished modules
      </div>
      <div className="grid gap-5">
        {[1, 2].map((i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-3xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <CertificateCelebration award={celebration} onClose={() => setCelebration(null)} />
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Recognition</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">
          My <span className="gradient-text italic">Certificates</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Poket School awards one certificate for each module once every published lesson in it is complete.
        </p>
      </motion.div>

      {certs.length === 0 ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="relative flex flex-col items-center justify-center text-center py-24"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <Award className="w-14 h-14 text-muted-foreground/30 mb-4" />
          <h2 className="font-heading text-2xl text-foreground">No certificates yet</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Finish every published lesson in a module. Draft lessons do not count, and they do not hold the certificate back.
          </p>
          <Link href="/dashboard/student/courses">
            <Button className="mt-6 rounded-full h-11 px-5 font-bold bg-gradient-to-r from-[#2786A4] to-[#1E6A83] text-white border-0 hover:opacity-90 transition-opacity">
              Browse Courses
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="grid gap-6">
          {certs.map((cert, i) => (
            <motion.div key={cert.id} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}>
              <CertificateDocument certificate={toFace(cert)} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
