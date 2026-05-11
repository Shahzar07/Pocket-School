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

const TYPE_COLORS: Record<string, string> = {
  assignment: 'bg-blue-500',
  exam: 'bg-purple-500',
  event: 'bg-green-500',
  holiday: 'bg-amber-500',
};

const TYPE_BADGE: Record<string, string> = {
  assignment: 'bg-blue-100 text-blue-700',
  exam: 'bg-purple-100 text-purple-700',
  event: 'bg-green-100 text-green-700',
  holiday: 'bg-amber-100 text-amber-700',
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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
      <div className="h-96 bg-muted animate-pulse rounded-2xl" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">Stay on top of deadlines and school events.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
            <Plus className="w-4 h-4" /> Add Event
          </Button>
        )}
      </div>

      {showCreate && canCreate && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">New Event</h2>
            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title *" className="rounded-xl h-11" />
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-xl h-11" />
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
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="rounded-xl h-11" />
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Create Event
          </Button>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="font-bold text-foreground">{MONTHS[month]} {year}</h2>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-bold text-muted-foreground bg-muted/30">{d}</div>
            ))}
            {cells.map((day, i) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday = day && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
              return (
                <div key={i} className={`min-h-[80px] border-t border-r border-border p-1 ${!day ? 'bg-muted/20' : 'hover:bg-muted/30 cursor-pointer'}`}>
                  {day && (
                    <>
                      <p className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-blue-600 text-white' : 'text-foreground'}`}>
                        {day}
                      </p>
                      {dayEvents.slice(0, 2).map(e => (
                        <div key={e.id} onClick={() => setSelected(e)}
                          className={`text-[10px] text-white px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer ${TYPE_COLORS[e.type]}`}
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
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Upcoming</h3>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          ) : (
            upcomingEvents.map((e, i) => (
              <motion.div key={e.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/30 transition-colors"
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
      </div>

      {/* Event detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge className={`rounded-full text-[10px] mb-2 ${TYPE_BADGE[selected.type]}`}>{selected.type}</Badge>
                <h3 className="text-xl font-extrabold text-foreground">{selected.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selected.startDate?.toDate?.().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            {selected.description && <p className="text-sm text-foreground">{selected.description}</p>}
            {canCreate && (
              <Button onClick={() => handleDelete(selected.id!)} variant="destructive" className="w-full gap-2 rounded-xl">
                <Trash2 className="w-4 h-4" /> Delete Event
              </Button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
