'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { getPendingVerifications, updateVerificationStatus, ParentVerification } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShieldCheck, CheckCircle2, XCircle, Users, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<ParentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    const data = await getPendingVerifications();
    setVerifications(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handle = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    try {
      await updateVerificationStatus(id, status);
      toast.success(status === 'approved' ? 'Verification approved!' : 'Verification rejected.');
      setVerifications(prev => prev.filter(v => v.id !== id));
    } catch { toast.error('Failed to update verification.'); }
    finally { setProcessing(null); }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0} className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600 flex items-center gap-2">
          <span className="w-5 h-px bg-violet-600 inline-block" /> Identity verification
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
          Parent <span className="gradient-text italic">verifications</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">Review and approve parent-student account linking requests.</p>
      </motion.header>

      {/* Stat */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow max-w-xs"
      >
        <span className="absolute top-0 left-6 right-6 h-[3px] rounded-b-full bg-amber-500 opacity-80" />
        <ShieldCheck className="w-5 h-5 text-amber-600" />
        <p className="font-heading text-4xl sm:text-5xl text-foreground mt-3 leading-none">{verifications.length}</p>
        <p className="text-xs text-muted-foreground mt-2 font-semibold uppercase tracking-wider">Pending</p>
      </motion.div>

      {/* List */}
      <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={2}>
        {verifications.length === 0 ? (
          <div className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden">
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/8 blur-[80px]" />
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-emerald-600/40" />
            <h3 className="font-heading text-2xl text-foreground mb-1.5">All clear</h3>
            <p className="text-sm text-muted-foreground">No pending verifications — you're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {verifications.map((v, i) => {
              const date = v.createdAt instanceof Timestamp ? v.createdAt.toDate() : new Date(v.createdAt as any);
              return (
                <motion.div key={v.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                  className="bg-card border border-border rounded-2xl p-5 card-glow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-md">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-bold text-foreground">{v.parentName}</p>
                        <p className="text-xs text-muted-foreground">{v.parentEmail}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className="rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20">Child: {v.studentEmail}</Badge>
                          {v.studentId && <Badge className="rounded-full text-[10px] bg-muted text-muted-foreground">ID: {v.studentId}</Badge>}
                          <Badge className="rounded-full text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20">Pending</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Submitted {date.toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => handle(v.id!, 'approved')} disabled={processing === v.id}
                        className="rounded-full px-4 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        {processing === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handle(v.id!, 'rejected')} disabled={processing === v.id}
                        className="rounded-full px-4 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 font-bold"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.section>
    </div>
  );
}
