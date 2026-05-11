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

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function TeacherBillingPage() {
  const { user, profile } = useAuthSTORE();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ studentEmail: '', description: '', amount: '', currency: 'USD', dueDate: '', status: 'sent' as Invoice['status'] });

  const load = async () => {
    if (!user || !profile) return;
    const data = profile.role === 'admin' ? await getAllInvoices() : await getInvoicesForTeacher(user.uid);
    setInvoices(data);
    setLoading(false);
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
    } finally { setSaving(false); }
  }

  async function markPaid(id: string) {
    await updateInvoiceStatus(id, 'paid', new Date());
    toast.success('Marked as paid');
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this invoice?')) return;
    await deleteInvoice(id);
    setInvoices(prev => prev.filter(i => i.id !== id));
    toast.success('Deleted');
  }

  const total = invoices.reduce((sum, i) => sum + i.amount, 0);
  const collected = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + i.amount, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#202124]">Billing & Invoices</h1>
          <p className="text-sm text-[#5F6368] mt-0.5">Create and track student invoices and payments</p>
        </div>
        <Button onClick={() => setShowCreate(s => !s)} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Invoiced', value: total, color: 'text-[#202124]' },
          { label: 'Collected', value: collected, color: 'text-green-700' },
          { label: 'Outstanding', value: outstanding, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#DADCE0] p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>${s.value.toLocaleString()}</p>
            <p className="text-xs text-[#5F6368] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-[#DADCE0] p-6 space-y-4">
          <h2 className="font-semibold text-[#202124]">New Invoice</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Student Email *</label>
              <Input value={form.studentEmail} onChange={e => setForm(f => ({ ...f, studentEmail: e.target.value }))} placeholder="student@example.com" type="email" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Description *</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Tuition fee, exam fee, etc." />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Amount *</label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min={0} step={0.01} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Currency</label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v ?? 'USD' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="MYR">MYR</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Due Date *</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5F6368] mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Invoice['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="sent">Send to Student</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCreate} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create Invoice
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div className="space-y-3">
        {invoices.length === 0 && (
          <div className="text-center py-16 text-[#5F6368]">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No invoices yet</p>
          </div>
        )}
        {invoices.map(inv => (
          <div key={inv.id} className="bg-white rounded-xl border border-[#DADCE0] p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-[#202124]">{inv.studentName}</p>
                <Badge className={STATUS_STYLES[inv.status]}>{inv.status}</Badge>
              </div>
              <p className="text-xs text-[#5F6368] mt-0.5 truncate">{inv.description}</p>
              <p className="text-xs text-gray-400 mt-1">Due: {(inv.dueDate as any)?.toDate?.().toLocaleDateString() ?? inv.dueDate}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <p className="text-lg font-bold text-[#202124]">{inv.currency} {inv.amount.toFixed(2)}</p>
              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                <Button size="sm" variant="outline" onClick={() => markPaid(inv.id)} className="gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Mark Paid
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleDelete(inv.id)} className="text-red-500 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => window.print()} className="text-gray-500">
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
