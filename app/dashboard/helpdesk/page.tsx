'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { createSupportTicket, getSupportTickets, updateSupportTicket, SupportTicket } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { HelpCircle, Plus, MessageSquare, CheckCircle2, X, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  in_progress: 'bg-primary/10 text-primary border border-primary/20',
  resolved: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  closed: 'bg-muted text-muted-foreground',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-primary/10 text-primary border border-primary/20',
  high: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  urgent: 'bg-destructive/10 text-destructive border border-destructive/20',
};

export default function HelpdeskPage() {
  const { user, profile } = useAuthSTORE();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');
  const [form, setForm] = useState<{ subject: string; description: string; priority: SupportTicket['priority'] }>({ subject: '', description: '', priority: 'normal' });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = async () => {
    if (!user) return;
    const data = isAdmin
      ? await getSupportTickets(user.uid, 'admin')
      : await getSupportTickets(user.uid, profile?.role ?? 'student');
    setTickets(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, profile]);

  const handleCreate = async () => {
    if (!user || !form.subject.trim() || !form.description.trim()) {
      toast.error('Fill in all fields.');
      return;
    }
    setSaving(true);
    try {
      await createSupportTicket({
        userId: user.uid,
        userName: profile?.name ?? 'User',
        userRole: profile?.role ?? 'student',
        subject: form.subject.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: 'general',
        status: 'open',
        createdAt: Timestamp.now(),
      });
      toast.success('Ticket submitted! We\'ll get back to you soon.');
      setForm({ subject: '', description: '', priority: 'normal' });
      setShowCreate(false);
      await load();
    } catch { toast.error('Failed to submit ticket.'); }
    finally { setSaving(false); }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    await updateSupportTicket(selected.id!, { response: reply.trim(), status: 'in_progress' });
    toast.success('Reply sent.');
    setReply('');
    setSelected(null);
    await load();
  };

  const handleResolve = async (id: string) => {
    await updateSupportTicket(id, { status: 'resolved' });
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
    toast.success('Marked as resolved.');
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      {[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary flex items-center gap-2">
            <span className="w-5 h-px bg-primary inline-block" /> Support center
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            {isAdmin ? 'Support' : 'Help &'} <span className="gradient-text italic">{isAdmin ? 'tickets' : 'support'}</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">
            {isAdmin ? 'Manage student and parent support requests.' : 'Submit a ticket and our team will help you.'}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setShowCreate(true)}
            className="rounded-full h-11 px-5 gap-2 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] hover:opacity-90 text-white shrink-0"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        )}
      </motion.header>

      {/* Create form */}
      {showCreate && !isAdmin && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-3xl p-6 sm:p-7 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-foreground">New Support Ticket</h2>
            <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject *" className="rounded-xl h-11 bg-muted/50" />
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your issue in detail *" className="rounded-xl text-sm resize-none min-h-28 bg-muted/50" />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: (v ?? 'normal') as SupportTicket['priority'] }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full rounded-full h-11 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            Submit Ticket
          </Button>
        </motion.div>
      )}

      {/* Tickets */}
      {tickets.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[80px]" />
          <HelpCircle className="w-12 h-12 mx-auto mb-4 text-primary/40" />
          <h3 className="font-heading text-2xl text-foreground mb-1.5">
            {isAdmin ? 'No tickets to manage' : 'No tickets yet'}
          </h3>
          <p className="text-sm text-muted-foreground">{isAdmin ? 'All clear!' : 'Need help? Submit a ticket!'}</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket, i) => (
            <motion.div key={ticket.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3 card-glow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-foreground">{ticket.subject}</h3>
                    <Badge className={`rounded-full text-[10px] ${STATUS_STYLES[ticket.status]}`}>{ticket.status.replace('_', ' ')}</Badge>
                    <Badge className={`rounded-full text-[10px] ${PRIORITY_STYLES[ticket.priority]}`}>{ticket.priority}</Badge>
                  </div>
                  {isAdmin && <p className="text-xs text-muted-foreground">From: {ticket.userName}</p>}
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{ticket.description}</p>
                  {ticket.response && (
                    <div className="mt-3 bg-primary/5 border border-primary/20 rounded-2xl p-3">
                      <p className="text-xs font-bold text-primary mb-1">Support Reply:</p>
                      <p className="text-sm text-foreground">{ticket.response}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {ticket.status !== 'resolved' && (
                    <>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => setSelected(ticket)} className="rounded-xl text-xs gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> Reply
                        </Button>
                      )}
                      {(isAdmin || ticket.userId === user?.uid) && (
                        <Button size="sm" variant="ghost" onClick={() => handleResolve(ticket.id!)} className="rounded-xl text-xs gap-1 text-emerald-600 hover:text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reply modal */}
      {selected && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-3xl p-7 max-w-md w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-2xl text-foreground">Reply to Ticket</h3>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="bg-muted/50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{selected.subject}</p>
              <p className="text-sm text-foreground">{selected.description}</p>
            </div>
            <Textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write your reply…"
              className="rounded-xl text-sm resize-none min-h-24 bg-muted/50"
            />
            <Button onClick={handleReply} disabled={!reply.trim()} className="w-full rounded-full h-11 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white gap-2">
              <MessageSquare className="w-4 h-4" /> Send Reply
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
