'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CALENDAR_TEMPLATES, dripDates, extractDatesFromText, mapUnitsToWeeks, moveItem,
  parseCsv, parseIcs, teachingMondays, type CalendarItem,
} from '@/lib/insights/calendar';

export function CalendarTools({
  onPublish,
}: {
  onPublish: (items: CalendarItem[]) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<CalendarItem[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [text, setText] = useState('');
  const [units, setUnits] = useState('Unit 1\nUnit 2\nUnit 3');
  const [start, setStart] = useState('2026-10-12');
  const [end, setEnd] = useState('2026-11-06');
  const [lessons, setLessons] = useState(5);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const holidayDates = useMemo(
    () => drafts.filter(item => item.type === 'holiday').map(item => item.date),
    [drafts],
  );

  const stage = (items: CalendarItem[], sourceNote: string) => {
    setDrafts(items);
    setSelected(Object.fromEntries(items.map((_, index) => [index, true])));
    setNote(sourceNote);
  };

  const publish = async () => {
    const chosen = drafts.filter((_, index) => selected[index]);
    if (!chosen.length || saving) return;
    setSaving(true);
    try {
      await onPublish(chosen);
      setDrafts([]);
      setNote('Published. Holidays stay off the attendance rate.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-3xl p-6 space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Academic calendar</p>
        <h2 className="font-heading text-2xl text-foreground">Import, pace, then publish</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Templates, ICS, CSV, and pasted text stay as drafts until you publish them. A PDF or photo is pasted as text first so you can correct the dates.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CALENDAR_TEMPLATES.map(template => (
          <Button key={template.id} type="button" variant="outline" className="rounded-full" onClick={() => stage(template.items, template.note)}>
            {template.label}
          </Button>
        ))}
      </div>
      <label className="block text-sm">
        <span className="font-semibold">ICS or CSV file</span>
        <input
          type="file"
          accept=".ics,.csv,text/calendar,text/csv"
          className="mt-1 block text-sm"
          onChange={async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const body = await file.text();
            const items = file.name.toLowerCase().endsWith('.csv') || body.includes('title,date') ? parseCsv(body) : parseIcs(body);
            stage(items, items.length ? `${items.length} dates ready to review.` : 'No dates found. Use columns title,date,type.');
          }}
        />
      </label>
      <label className="block text-sm space-y-1">
        <span className="font-semibold">Pasted timetable, PDF text, or a calendar URL note</span>
        <textarea
          value={text}
          onChange={event => setText(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-border bg-muted/40 p-3 text-sm"
          placeholder="National Day 2026-08-31&#10;Exam 05/10/2026"
        />
        <Button type="button" variant="outline" onClick={() => stage(extractDatesFromText(text), 'Draft only. Check every date before publishing.')}>
          Extract dates for review
        </Button>
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm space-y-1">
          <span className="font-semibold">Units, one per line</span>
          <textarea value={units} onChange={event => setUnits(event.target.value)} rows={4} className="w-full rounded-xl border border-border bg-muted/40 p-3 text-sm" />
        </label>
        <div className="space-y-2">
          <label className="text-sm block">Term start <Input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
          <label className="text-sm block">Term end <Input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
          <label className="text-sm block">Lessons to drip <Input type="number" min={1} max={20} value={lessons} onChange={event => setLessons(Number(event.target.value) || 1)} /></label>
          <Button type="button" variant="outline" onClick={() => {
            const weeks = teachingMondays(start, end, holidayDates);
            const mapped = mapUnitsToWeeks(
              units.split('\n').map(line => line.trim()).filter(Boolean).map((title, index) => ({ id: `u${index + 1}`, title })),
              weeks,
            );
            const drip = dripDates(weeks[0] ?? start, lessons, holidayDates);
            stage([
              ...mapped.map(unit => ({ title: unit.title, date: unit.weekStart, type: 'class' as const, description: 'Teaching week', source: 'template' as const })),
              ...drip.map((date, index) => ({ title: `Lesson ${index + 1}`, date, type: 'class' as const, description: 'Drip release', source: 'template' as const })),
            ], 'Weekends and staged holidays are skipped.');
          }}>
            Map units and drip lessons
          </Button>
        </div>
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {drafts.length > 0 && (
        <ul className="space-y-2">
          {drafts.map((item, index) => (
            <li key={`${item.title}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="checkbox" checked={selected[index] !== false} onChange={event => setSelected(current => ({ ...current, [index]: event.target.checked }))} aria-label={`Publish ${item.title}`} />
              <span className="font-medium">{item.title}</span>
              <span className="text-muted-foreground">{item.type}{item.source === 'ai_draft' ? ' · needs review' : ''}</span>
              <Input
                type="date"
                className="w-40"
                value={item.date}
                onChange={event => setDrafts(current => current.map((row, i) => i === index ? moveItem(row, event.target.value) : row))}
              />
            </li>
          ))}
        </ul>
      )}
      <Button type="button" disabled={saving || drafts.length === 0} onClick={publish} className="rounded-full">
        {saving ? 'Publishing…' : 'Publish selected'}
      </Button>
    </section>
  );
}
