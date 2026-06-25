'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getCertificatesForStudent, Certificate } from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Award, Printer, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

export default function StudentCertificatesPage() {
  const { user, profile } = useAuthSTORE();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getCertificatesForStudent(user.uid).then(c => { setCerts(c); setLoading(false); });
  }, [user]);

  const handlePrint = (cert: Certificate) => {
    const date = cert.issuedAt instanceof Timestamp
      ? cert.issuedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date(cert.issuedAt as any).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificate — ${cert.courseTitle}</title>
        <style>
          body { margin: 0; font-family: Georgia, serif; background: #fff; }
          .cert { width: 900px; margin: 40px auto; border: 12px double #1a56db; padding: 60px; text-align: center; }
          .logo { font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: #1a56db; margin-bottom: 20px; }
          h1 { font-size: 42px; color: #1e3a5f; margin: 20px 0 10px; }
          .subtitle { font-size: 16px; color: #555; margin-bottom: 40px; }
          .name { font-size: 36px; font-style: italic; color: #1a56db; border-bottom: 2px solid #1a56db; display: inline-block; padding-bottom: 6px; margin-bottom: 30px; }
          .course { font-size: 22px; color: #333; margin-bottom: 8px; }
          .detail { font-size: 14px; color: #777; margin-top: 40px; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; font-size: 13px; color: #555; }
          .seal { font-size: 48px; margin-bottom: -10px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="cert">
          <div class="seal">🎓</div>
          <div class="logo">Pocket School</div>
          <h1>Certificate of Achievement</h1>
          <div class="subtitle">This is to certify that</div>
          <div class="name">${cert.studentName}</div>
          <div class="course">has successfully completed</div>
          <div class="course"><strong>${cert.courseTitle}</strong></div>
          <div class="detail">Issued on ${date} · Awarded by ${cert.issuedByName}</div>
          <div class="footer">
            <div>Certificate ID: <strong>${cert.id}</strong></div>
            <div>Verify at: pocketschool.app/verify/${cert.id}</div>
          </div>
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-muted animate-pulse rounded-full" />
        <div className="h-10 w-64 bg-muted animate-pulse rounded-2xl" />
      </div>
      <div className="grid gap-5">
        {[1, 2].map(i => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          Recognition
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1.5">
          My <span className="gradient-text italic">Certificates</span>
        </h1>
      </motion.div>

      {certs.length === 0 ? (
        /* Empty State */
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="relative flex flex-col items-center justify-center text-center py-24"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <Award className="w-14 h-14 text-muted-foreground/30 mb-4" />
          <h2 className="font-heading text-2xl text-foreground">
            No certificates yet
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Complete a course to earn your first certificate.
          </p>
          <Link href="/dashboard/student/courses">
            <Button className="mt-6 rounded-full h-11 px-5 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white border-0 hover:opacity-90 transition-opacity">
              Browse Courses
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="grid gap-5">
          {certs.map((cert, i) => {
            const date = cert.issuedAt instanceof Timestamp
              ? cert.issuedAt.toDate()
              : new Date(cert.issuedAt as any);
            return (
              <motion.div
                key={cert.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={i + 1}
                className="bg-card border border-border rounded-3xl p-6 card-glow relative overflow-hidden"
              >
                <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] opacity-80" />

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0 shadow-md">
                      <Award className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-heading text-lg text-foreground">{cert.courseTitle}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Issued by {cert.issuedByName}</p>
                      <p className="text-xs text-muted-foreground">{date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      onClick={() => handlePrint(cert)}
                      size="sm"
                      variant="outline"
                      className="rounded-full font-bold gap-2"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </Button>
                    <Link href={`/verify/${cert.id}`} target="_blank">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full font-bold gap-2 w-full"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Verify
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Certificate ID: <span className="font-mono text-foreground">{cert.id}</span>
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
