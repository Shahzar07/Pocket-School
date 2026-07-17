'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { createInvoice, getInvoicesForTeacher, getAllInvoices, updateInvoiceStatus, deleteInvoice, Invoice, getUserByEmail } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, CreditCard, CheckCircle2, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { Timestamp } from 'firebase/firestore';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/10 text-blue-700',
  paid: 'bg-emerald-500/10 text-emerald-700',
  overdue: 'bg-red-500/10 text-red-700',
  cancelled: 'bg-muted text-muted-foreground/60',
};

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', MYR: 'RM ' };

function totalsByCurrency(list: Invoice[]): string {
  const totals: Record<string, number> = {};
  for (const inv of list) totals[inv.currency] = (totals[inv.currency] ?? 0) + inv.amount;
  const parts = Object.entries(totals)
    .filter(([, amount]) => amount > 0)
    .map(([currency, amount]) => `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${amount.toLocaleString()}`);
  return parts.length ? parts.join(' · ') : '$0';
}

export default function TeacherBillingPage() {
  const { user, profile } = useAuthSTORE();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ studentEmail: '', description: '', amount: '', currency: 'USD', dueDate: '', status: 'sent' as Invoice['status'] });

  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    if (!user || !profile) return;
    setLoadError(false);
    try {
      const data = profile.role === 'admin' ? await getAllInvoices() : await getInvoicesForTeacher(user.uid);
      setInvoices(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user, profile]);

  async function handleCreate() {
    if (!user || !profile) return;
    if (!form.studentEmail.trim() || !form.description || !form.amount || !form.dueDate) {
      toast.error('All fields are required'); return;
    }
    setSaving(true);
    try {
      const student = await getUserByEmail(form.studentEmail.trim());
      if (!student) { toast.error('No user found with that email'); setSaving(false); return; }
      await createInvoice({
        studentId: student.id, studentName: student.data.name,
        description: form.description, amount: Number(form.amount),
        currency: form.currency, status: form.status,
        dueDate: Timestamp.fromDate(new Date(form.dueDate)),
        createdBy: user.uid,
      });
      toast.success('Invoice created!');
      setForm({ studentEmail: '', description: '', amount: '', currency: 'USD', dueDate: '', status: 'sent' });
      setShowCreate(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create invoice.');
    } finally { setSaving(false); }
  }

  async function markPaid(id: string) {
    try {
      await updateInvoiceStatus(id, 'paid', new Date());
      toast.success('Marked as paid');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update invoice.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this invoice?')) return;
    try {
      await deleteInvoice(id);
      setInvoices(prev => prev.filter(i => i.id !== id));
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete invoice.');
    }
  }

  function handlePrint(inv: Invoice) {
    const dueDate = (inv.dueDate as any)?.toDate?.()?.toLocaleDateString() ?? '';
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!doctype html><html><head><title>Invoice — ${esc(inv.studentName)}</title>
      <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 24px;color:#111}
      h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:16px}
      td{padding:8px 0;border-bottom:1px solid #e5e5e5}td:last-child{text-align:right;font-weight:600}</style></head>
      <body><h1>Pocket School — Invoice</h1>
      <table>
        <tr><td>Student</td><td>${esc(inv.studentName)}</td></tr>
        <tr><td>Description</td><td>${esc(inv.description)}</td></tr>
        <tr><td>Amount</td><td>${esc(inv.currency)} ${inv.amount.toFixed(2)}</td></tr>
        <tr><td>Status</td><td>${esc(inv.status)}</td></tr>
        <tr><td>Due date</td><td>${esc(dueDate)}</td></tr>
      </table></body></html>`;
    const win = window.open('', '_blank', 'width=720,height=800');
    if (!win) { toast.error('Pop-up blocked — allow pop-ups to print invoices.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const totalStr = totalsByCurrency(invoices);
  const collectedStr = totalsByCurrency(invoices.filter(i => i.status === 'paid'));
  const outstandingStr = totalsByCurrency(invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled'));

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10 pt-10">
      <div className="space-y-4">
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
      </div>
    </div>
  );

  if (loadError) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-10">
      <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-4 card-glow">
        <CreditCard className="w-10 h-10 mx-auto text-amber-500" />
        <p className="font-heading text-2xl text-foreground">Couldn&apos;t load invoices</p>
        <p className="text-sm text-muted-foreground">Something went wrong while fetching your billing data. Please try again.</p>
        <Button variant="outline" className="rounded-full h-11 px-5 font-semibold" onClick={() => { setLoading(true); load(); }}>Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Header */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 mb-2">
            Billing &amp; Invoices
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
            Billing &amp; <span className="gradient-text italic">Invoices</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Create and track student invoices and payments
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(s => !s)}
          className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 gap-2"
        >
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          { label: 'Total Invoiced', value: totalStr, accent: 'bg-emerald-500' },
          { label: 'Collected', value: collectedStr, accent: 'bg-green-500' },
          { label: 'Outstanding', value: outstandingStr, accent: 'bg-amber-500' },
        ].map((s, idx) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow text-center"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 ${s.accent}`} />
            <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
              {s.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Create form */}
      {showCreate && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="bg-card border border-border rounded-3xl p-6 sm:p-8 card-glow space-y-5"
        >
          <h2 className="font-heading text-xl font-semibold text-foreground">New Invoice</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Student Email *</label>
              <Input value={form.studentEmail} onChange={e => setForm(f => ({ ...f, studentEmail: e.target.value }))} placeholder="student@example.com" type="email" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description *</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Tuition fee, exam fee, etc." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount *</label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min={0} step={0.01} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Currency</label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v ?? 'USD' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="MYR">MYR</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date *</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Invoice['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="sent">Send to Student</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create Invoice
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="rounded-full h-11 px-5 font-semibold"
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Invoice list */}
      <div className="space-y-2">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 mb-1">
            Invoices
          </p>
          <h2 className="font-heading text-3xl text-foreground tracking-tight mb-4">
            All Invoices
          </h2>
        </motion.div>

        <div className="space-y-3">
          {invoices.length === 0 && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={4}
              className="relative flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
              </div>
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40 relative z-10" />
              <p className="font-heading text-2xl text-foreground relative z-10">No invoices yet</p>
              <p className="text-sm text-muted-foreground mt-1 relative z-10">
                Create your first invoice to get started
              </p>
            </motion.div>
          )}
          {invoices.map((inv, idx) => (
            <motion.div
              key={inv.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={idx + 4}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">{inv.studentName}</p>
                  <Badge className={STATUS_STYLES[inv.status]}>{inv.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{inv.description}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Due: {(inv.dueDate as any)?.toDate?.().toLocaleDateString() ?? inv.dueDate}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-lg font-bold text-foreground">{inv.currency} {inv.amount.toFixed(2)}</p>
                {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markPaid(inv.id)}
                    className="rounded-full gap-1 font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Mark Paid
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleDelete(inv.id)} className="text-red-500 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handlePrint(inv)} className="text-muted-foreground">
                  <Printer className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
