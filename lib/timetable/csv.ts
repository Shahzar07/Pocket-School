import { ROOM_TYPES, WEEKDAYS, type RoomType, type TimetableDoc, type Weekday } from './types';

function cells(line: string): string[] {
  return line.split(',').map(cell => cell.trim());
}

function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value);
}

function isRoomType(value: string): value is RoomType {
  return (ROOM_TYPES as readonly string[]).includes(value);
}

/** CSV with a kind column: day, period, term, holiday, room, staff, subject, group, block, choice. */
export function importCsv(doc: TimetableDoc, text: string): { doc: TimetableDoc; errors: string[] } {
  const next: TimetableDoc = {
    ...doc,
    days: [],
    periods: [],
    terms: [],
    holidays: [],
    rooms: [],
    staff: [...doc.staff],
    subjects: [],
    groups: [],
    blocks: [],
    choices: [],
  };
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('kind,'));
  for (const line of lines) {
    const [kind, id, a, b, c, d, e, f] = cells(line);
    if (!kind || !id) {
      errors.push(`Skipped a row without a kind and id.`);
      continue;
    }
    if (kind === 'day' && isWeekday(id)) next.days.push(id);
    else if (kind === 'period') next.periods.push({ id, label: a || id, start: b || '08:30', end: c || '09:15' });
    else if (kind === 'term') next.terms.push({ id, name: a || id, start: b || '', end: c || '' });
    else if (kind === 'holiday') next.holidays.push({ id, name: a || id, date: b || '' });
    else if (kind === 'room' && isRoomType(c || '')) next.rooms.push({ id, name: a || id, type: c as RoomType, capacity: Number(d) || 1, campusId: e || doc.campusIds[0] || 'main' });
    else if (kind === 'staff') {
      const works = (f || '').split('|').filter(isWeekday);
      next.staff = next.staff.filter(person => person.id !== id).concat({
        id,
        name: a || id,
        userId: id,
        subjects: (b || '').split('|').filter(Boolean),
        levels: (c || '').split('|').filter(Boolean),
        maxPerDay: Number(d) || 4,
        maxPerWeek: Number(e) || 16,
        worksDays: works,
        unavailable: [],
        prefer: '',
        status: 'active',
        campusId: doc.campusIds[0] || 'main',
      });
    } else if (kind === 'group') next.groups.push({ id, name: a || id, level: b || 'IGCSE', studentIds: (c || '').split('|').filter(Boolean), kind: d === 'set' || d === 'option' ? d : 'class', campusId: e || doc.campusIds[0] || 'main' });
    else if (kind === 'subject' && isRoomType(d || '')) next.subjects.push({ id, name: a || id, level: b || 'IGCSE', periodsPerWeek: Number(c) || 1, roomType: d as RoomType, groupId: e || '', teacherIds: (f || '').split('|').filter(Boolean), campusId: doc.campusIds[0] || 'main' });
    else if (kind === 'block') next.blocks.push({ id, name: a || id, level: b || 'IGCSE', subjectIds: (c || '').split('|').filter(Boolean), pick: Number(d) || 1 });
    else if (kind === 'choice') next.choices.push({ studentId: id, blockId: a || '', subjectIds: (b || '').split('|').filter(Boolean) });
    else errors.push(`Could not read ${kind} ${id}.`);
  }
  if (next.days.length === 0) next.days = doc.days;
  if (next.periods.length === 0) next.periods = doc.periods;
  return { doc: next, errors };
}

export function exportCsv(doc: TimetableDoc): string {
  const rows = ['kind,id,a,b,c,d,e,f'];
  for (const day of doc.days) rows.push(`day,${day}`);
  for (const period of doc.periods) rows.push(`period,${period.id},${period.label},${period.start},${period.end}`);
  for (const term of doc.terms) rows.push(`term,${term.id},${term.name},${term.start},${term.end}`);
  for (const holiday of doc.holidays) rows.push(`holiday,${holiday.id},${holiday.name},${holiday.date}`);
  for (const room of doc.rooms) rows.push(`room,${room.id},${room.name},${room.type},${room.capacity},${room.campusId}`);
  for (const staff of doc.staff) rows.push(`staff,${staff.id},${staff.name},${staff.subjects.join('|')},${staff.levels.join('|')},${staff.maxPerDay},${staff.maxPerWeek},${staff.worksDays.join('|')}`);
  for (const group of doc.groups) rows.push(`group,${group.id},${group.name},${group.level},${group.studentIds.join('|')},${group.kind},${group.campusId}`);
  for (const subject of doc.subjects) rows.push(`subject,${subject.id},${subject.name},${subject.level},${subject.periodsPerWeek},${subject.roomType},${subject.groupId},${subject.teacherIds.join('|')}`);
  for (const block of doc.blocks) rows.push(`block,${block.id},${block.name},${block.level},${block.subjectIds.join('|')},${block.pick}`);
  for (const choice of doc.choices) rows.push(`choice,${choice.studentId},${choice.blockId},${choice.subjectIds.join('|')}`);
  return rows.join('\n');
}
