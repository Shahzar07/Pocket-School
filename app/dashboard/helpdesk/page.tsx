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
import { HelpCircle, Plus, MessageSquare, CheckCircle2, Clock, AlertCircle, X, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            {isAdmin ? 'Support Tickets' : 'Help & Support'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? 'Manage student and parent support requests.' : 'Submit a ticket and our team will help you.'}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        )}
      </div>

      {showCreate && !isAdmin && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">New Support Ticket</h2>
            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject *" className="rounded-xl h-11" />
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your issue in detail *" className="rounded-xl text-sm resize-none min-h-28" />
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
          <Button onClick={handleCreate} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            Submit Ticket
          </Button>
        </motion.div>
      )}

      {tickets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">{isAdmin ? 'No tickets to manage.' : 'No tickets yet. Need help? Submit a ticket!'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket, i) => (
            <motion.div key={ticket.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3"
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
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-xs font-bold text-blue-700 mb-1">Support Reply:</p>
                      <p className="text-sm text-blue-800">{ticket.response}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {ticket.status !== 'resolved' && (
                    <>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => setSelected(ticket)} className="rounded-lg text-xs gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> Reply
                        </Button>
                      )}
                      {(isAdmin || ticket.userId === user?.uid) && (
                        <Button size="sm" variant="ghost" onClick={() => handleResolve(ticket.id!)} className="rounded-lg text-xs gap-1 text-green-600 hover:text-green-700">
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Reply to Ticket</h3>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{selected.subject}</p>
              <p className="text-sm text-foreground">{selected.description}</p>
            </div>
            <Textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write your reply…"
              className="rounded-xl text-sm resize-none min-h-24"
            />
            <Button onClick={handleReply} disabled={!reply.trim()} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
              <MessageSquare className="w-4 h-4" /> Send Reply
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
