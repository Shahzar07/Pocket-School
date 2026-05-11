'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getCertificatesForStudent, Certificate } from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Award, Printer, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">My Certificates</h1>
        <p className="text-muted-foreground text-sm mt-1">Certificates earned by completing courses.</p>
      </div>

      {certs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Award className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No certificates yet.</p>
          <p className="text-sm mt-1">Complete a course to earn your first certificate.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {certs.map((cert, i) => {
            const date = cert.issuedAt instanceof Timestamp
              ? cert.issuedAt.toDate()
              : new Date(cert.issuedAt as any);
            return (
              <motion.div key={cert.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0 shadow-md">
                      <Award className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{cert.courseTitle}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Issued by {cert.issuedByName}</p>
                      <p className="text-xs text-muted-foreground">{date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button onClick={() => handlePrint(cert)} size="sm" variant="outline" className="rounded-xl gap-2">
                      <Printer className="w-3.5 h-3.5" /> Print
                    </Button>
                    <Link href={`/verify/${cert.id}`} target="_blank">
                      <Button size="sm" variant="outline" className="rounded-xl gap-2 w-full">
                        <ExternalLink className="w-3.5 h-3.5" /> Verify
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">Certificate ID: <span className="font-mono text-foreground">{cert.id}</span></p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
