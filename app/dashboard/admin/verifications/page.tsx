'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { getPendingVerifications, updateVerificationStatus, ParentVerification } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShieldCheck, CheckCircle2, XCircle, Users, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Parent Verifications</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and approve parent-student account linking requests.</p>
      </div>

      {verifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No pending verifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map((v, i) => {
            const date = v.createdAt instanceof Timestamp ? v.createdAt.toDate() : new Date(v.createdAt as any);
            return (
              <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-foreground">{v.parentName}</p>
                      <p className="text-xs text-muted-foreground">{v.parentEmail}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className="rounded-full text-[10px] bg-blue-100 text-blue-700">Child email: {v.studentEmail}</Badge>
                        {v.studentId && <Badge className="rounded-full text-[10px] bg-gray-100 text-gray-700">Student ID: {v.studentId}</Badge>}
                        <Badge className="rounded-full text-[10px] bg-amber-100 text-amber-700">Pending</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Submitted {date.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => handle(v.id!, 'approved')} disabled={processing === v.id}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-1.5 text-xs"
                    >
                      {processing === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handle(v.id!, 'rejected')} disabled={processing === v.id}
                      className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl gap-1.5 text-xs"
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
    </div>
  );
}
