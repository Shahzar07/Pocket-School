import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildXlsx } from './xlsx';
import { seedChecks, seedPlan, SEED_UNITS } from './planner-seed';
import {
  absenceCounts,
  composeTemplate,
  countryFromTimeZone,
  isSchoolDay,
  rebuildPlan,
  replan,
  subscribeTarget,
  teachingDays,
  YEAR_TEMPLATES,
} from './planner';
import {
  AI_CALENDAR_UNAVAILABLE,
  aiKeyPresent,
  calendarLink,
  importCalendarSheet,
  importCalendarText,
  importPastedDates,
} from './planner-import';

describe('planner navigation', () => {
  it('links /dashboard/planner for every role', () => {
    const layout = readFileSync(new URL('../../app/dashboard/layout.tsx', import.meta.url), 'utf8');
    assert.equal(layout.split("'/dashboard/planner'").length - 1, 5);
    assert.match(layout, /labelKey: 'nav.planner'/);
  });
});

describe('year planner seed', () => {
  for (const side of ['institution', 'teacher', 'parent', 'student'] as const) {
    it(`matches the ${side} preview`, () => {
      for (const check of seedChecks(side)) {
        assert.equal(check.actual, check.expected, check.label);
      }
    });
  }
});

describe('templates and holidays', () => {
  it('offers the school-year and exam-window templates', () => {
    const labels = YEAR_TEMPLATES.map(template => template.label);
    assert.ok(labels.includes('Malaysian school year'));
    assert.ok(labels.includes('UK three-term year'));
    assert.ok(labels.includes('IGCSE exam windows'));
    assert.ok(labels.includes('A-Level exam windows'));
  });

  it('fills Malaysian holidays into the school year and into IGCSE', () => {
    const school = composeTemplate('malaysia-school-2026', 'MY');
    assert.ok(school.some(event => event.title === 'Term 1' && event.kind === 'term'));
    assert.ok(school.some(event => event.title === 'National Day' && event.kind === 'holiday'));
    const igcse = composeTemplate('igcse-2026', 'MY');
    assert.ok(igcse.some(event => event.kind === 'exam' && event.title.includes('IGCSE')));
    assert.ok(igcse.some(event => event.title === 'National Day'));
  });

  it('fills UK bank holidays into the three-term year and A-Level windows', () => {
    const year = composeTemplate('uk-three-term-2026', 'GB');
    assert.ok(year.some(event => event.title === 'Autumn term'));
    assert.ok(year.some(event => event.title === 'Christmas Day'));
    const alevel = composeTemplate('alevel-2026', 'GB');
    assert.ok(alevel.some(event => event.kind === 'exam'));
    assert.ok(alevel.some(event => event.title === 'Christmas Day'));
  });

  it('keeps Chinese New Year off Malaysian teaching days', () => {
    const events = composeTemplate('malaysia-school-2026', 'MY');
    const days = teachingDays('2026-01-12', '2026-05-29', events);
    assert.equal(days.includes('2026-02-17'), false);
    assert.equal(days.includes('2026-01-13'), true);
    assert.equal(events.some(event => event.title === 'National Day'), true);
  });

  it('reads the country from the school time zone', () => {
    assert.equal(countryFromTimeZone('Asia/Kuala_Lumpur'), 'MY');
    assert.equal(countryFromTimeZone('Europe/London'), 'GB');
    assert.equal(countryFromTimeZone('Asia/Singapore'), 'SG');
    assert.equal(countryFromTimeZone('America/New_York'), 'UN');
  });
});

describe('imports stay drafts', () => {
  it('reads ICS and CSV without publishing', () => {
    const ics = importCalendarText('school.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260831',
      'DTEND;VALUE=DATE:20260901',
      'SUMMARY:National Day',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n'));
    assert.equal(ics.needsReview, true);
    assert.equal(ics.events[0]?.date, '2026-08-31');
    assert.equal(ics.events[0]?.endDate, undefined);
    assert.equal(ics.events[0]?.source, 'import');

    const csv = importCalendarText('dates.csv', 'title,date,type\nSports day,2026-10-16,event\n');
    assert.equal(csv.events[0]?.title, 'Sports day');
    assert.equal(csv.events[0]?.kind, 'event');
  });

  it('reads an xlsx sheet and skips the copyright line', () => {
    const book = buildXlsx(['title', 'date', 'type'], [['Deepavali', '2026-11-08', 'holiday']], 2026);
    const draft = importCalendarSheet(book);
    assert.equal(draft.events.length, 1);
    assert.equal(draft.events[0]?.title, 'Deepavali');
    assert.equal(draft.events[0]?.kind, 'holiday');
    assert.equal(draft.events.some(event => event.title.includes('PoketSchool')), false);
  });

  it('accepts Google and Outlook links and refuses other hosts', () => {
    assert.equal(subscribeTarget('webcal://calendar.google.com/calendar/ical/school/basic.ics').provider, 'google');
    assert.equal(
      calendarLink('https://calendar.google.com/calendar/ical/school/basic.ics').url?.startsWith('https://calendar.google.com/'),
      true,
    );
    assert.equal(
      calendarLink('https://outlook.office365.com/owa/calendar/school/calendar.ics').url?.includes('outlook.office365.com'),
      true,
    );
    assert.equal(calendarLink('https://example.com/secret.ics').url, null);
    assert.match(calendarLink('not a link').notice, /Google or Outlook/);
  });

  it('keeps pasted and model text as a draft', () => {
    const draft = importPastedDates('National Day 2026-08-31\nExam 05/10/2026');
    assert.equal(draft.needsReview, true);
    assert.equal(draft.events.length, 2);
    assert.ok(draft.events.every(event => event.source === 'ai_draft'));
  });

  it('explains a missing AI key instead of failing', () => {
    assert.equal(aiKeyPresent({}), false);
    assert.equal(aiKeyPresent({ GEMINI_API_KEY: 'MY_GEMINI_API_KEY' }), false);
    assert.equal(aiKeyPresent({ OPENROUTER_API_KEY: 'sk-test' }), true);
    assert.match(AI_CALENDAR_UNAVAILABLE, /ICS, CSV, or XLSX/);
  });
});

describe('pacing rebuild', () => {
  it('skips holidays and exam weeks, then moves releases when a holiday moves', () => {
    const plan = seedPlan();
    const built = rebuildPlan(SEED_UNITS, '2026-10-01', '2026-11-06', plan.events, { campusId: 'north', classId: '4A', yearGroup: 'Y4' });
    const releases = built.filter(event => event.id.startsWith('release-'));
    assert.equal(releases.length, 3);
    assert.ok(releases.every(event => isSchoolDay(event.date, plan.events)));
    assert.ok(releases.every(event => event.campusId === 'north' && event.classId === '4A' && event.yearGroup === 'Y4'));
    const assessment = built.find(event => event.id === 'milestone-assessment');
    const report = built.find(event => event.id === 'milestone-report');
    assert.equal(absenceCounts(assessment?.date ?? '', plan.events), true);
    assert.equal(absenceCounts(report?.date ?? '', plan.events), true);
    assert.equal(teachingDays('2026-10-26', '2026-10-30', plan.events).length, 0);

    const moved = plan.events.map(event => event.id === 'deepavali' ? { ...event, date: '2026-10-12' } : event);
    const again = rebuildPlan(SEED_UNITS, '2026-10-01', '2026-11-06', moved);
    const before = releases.map(event => event.date).join(',');
    const after = again.filter(event => event.id.startsWith('release-')).map(event => event.date).join(',');
    assert.notEqual(before, after);
  });
});
