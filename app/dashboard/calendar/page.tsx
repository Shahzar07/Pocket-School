'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent, CalendarEvent } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, ChevronLeft, ChevronRight, X, Calendar, Trash2, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const TYPE_COLORS: Record<string, string> = {
  assignment: 'bg-[#1A73E8]',
  exam: 'bg-violet-500',
  event: 'bg-emerald-500',
  holiday: 'bg-amber-500',
  class: 'bg-teal-500',
  payment: 'bg-rose-500',
};

const TYPE_BADGE: Record<string, string> = {
  assignment: 'bg-primary/10 text-primary border border-primary/20',
  exam: 'bg-violet-500/10 text-violet-600 border border-violet-500/20',
  event: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  holiday: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  class: 'bg-teal-500/10 text-teal-600 border border-teal-500/20',
  payment: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarPage() {
  const { user, profile } = useAuthSTORE();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', type: 'event' as CalendarEvent['type'], description: '' });
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const canCreate = profile?.role === 'teacher' || profile?.role === 'admin';

  const load = async () => {
    const data = await getCalendarEvents({});
    setEvents(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!user || !form.title.trim() || !form.date) { toast.error('Fill in title and date.'); return; }
    setSaving(true);
    try {
      await createCalendarEvent({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startDate: Timestamp.fromDate(new Date(form.date)),
        type: form.type,
        createdBy: user.uid,
        audience: 'all',
      });
      toast.success('Event created!');
      setForm({ title: '', date: '', type: 'event', description: '' });
      setShowCreate(false);
      await load();
    } catch { toast.error('Failed to create event.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteCalendarEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelected(null);
    toast.success('Event deleted.');
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    return dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null;
  });

  const getEventsForDay = (day: number) =>
    events.filter(e => {
      const d = e.startDate?.toDate?.();
      return d && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const upcomingEvents = events
    .filter(e => e.startDate?.toDate?.() && e.startDate.toDate() >= today)
    .sort((a, b) => (a.startDate?.toDate?.()?.getTime() ?? 0) - (b.startDate?.toDate?.()?.getTime() ?? 0))
    .slice(0, 8);

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      <div className="h-96 bg-muted animate-pulse rounded-3xl" />
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
            <span className="w-5 h-px bg-primary inline-block" /> Schedule
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            School <span className="gradient-text italic">calendar</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Stay on top of deadlines and school events.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}
            className="rounded-full h-11 px-5 gap-2 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] hover:opacity-90 text-white shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Event
          </Button>
        )}
      </motion.header>

      {/* Create form */}
      {showCreate && canCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-3xl p-6 sm:p-7 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-foreground">New Event</h2>
            <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title *" className="rounded-xl h-11 bg-muted/50" />
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-xl h-11 bg-muted/50" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: (v ?? 'event') as any }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
              </SelectContent>
            </Select>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="rounded-xl h-11 bg-muted/50" />
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full rounded-full h-11 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Create Event
          </Button>
        </motion.div>
      )}

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="grid lg:grid-cols-3 gap-6"
      >
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl overflow-hidden card-glow">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="font-heading text-xl text-foreground">{MONTHS[month]} {year}</h2>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">{d}</div>
            ))}
            {cells.map((day, i) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday = day && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
              return (
                <div key={i} className={`min-h-[80px] border-t border-r border-border p-1.5 ${!day ? 'bg-muted/10' : 'hover:bg-muted/20 cursor-pointer transition-colors'}`}>
                  {day && (
                    <>
                      <p className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white' : 'text-foreground'}`}>
                        {day}
                      </p>
                      {dayEvents.slice(0, 2).map(e => (
                        <div key={e.id} onClick={() => setSelected(e)}
                          className={`text-[10px] text-white px-1.5 py-0.5 rounded-md mb-0.5 truncate cursor-pointer ${TYPE_COLORS[e.type]}`}
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</p>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Coming up</p>
            <h3 className="font-heading text-xl text-foreground mt-1">Upcoming</h3>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          ) : (
            upcomingEvents.map((e, i) => (
              <motion.div key={e.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                className="bg-card border border-border rounded-2xl p-3.5 cursor-pointer hover:bg-muted/30 transition-colors card-glow"
                onClick={() => setSelected(e)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[e.type]}`} />
                  <p className="text-sm font-semibold text-foreground truncate">{e.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{e.startDate?.toDate?.().toLocaleDateString()}</p>
                <Badge className={`rounded-full text-[10px] mt-1.5 ${TYPE_BADGE[e.type]}`}>{e.type}</Badge>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Event detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-3xl p-7 max-w-md w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge className={`rounded-full text-[10px] mb-2 ${TYPE_BADGE[selected.type]}`}>{selected.type}</Badge>
                <h3 className="font-heading text-2xl text-foreground">{selected.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selected.startDate?.toDate?.().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            {selected.description && <p className="text-sm text-foreground">{selected.description}</p>}
            {canCreate && (
              <Button onClick={() => handleDelete(selected.id!)} variant="destructive" className="w-full gap-2 rounded-full h-11 font-bold">
                <Trash2 className="w-4 h-4" /> Delete Event
              </Button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
