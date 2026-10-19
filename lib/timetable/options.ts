import type { OptionBlock, OptionSubject, StudentChoice, TeachingGroup, TimetableDoc } from './types';

export interface ChoiceWish {
  studentId: string;
  studentName: string;
  subjectIds: string[];
  parentId?: string;
}

export interface BlockPlan {
  blocks: OptionBlock[];
  satisfied: number;
  total: number;
  clashes: { studentId: string; studentName: string; subjectIds: string[] }[];
}

function colourOf(blocks: OptionBlock[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of blocks) {
    for (const subjectId of block.subjectIds) map.set(subjectId, block.id);
  }
  return map;
}

function clashesFor(wishes: ChoiceWish[], colours: Map<string, string>): BlockPlan['clashes'] {
  const clashes: BlockPlan['clashes'] = [];
  for (const wish of wishes) {
    const seen = new Map<string, string[]>();
    for (const subjectId of wish.subjectIds) {
      const colour = colours.get(subjectId) ?? 'none';
      const list = seen.get(colour) ?? [];
      list.push(subjectId);
      seen.set(colour, list);
    }
    const stuck = [...seen.values()].filter(list => list.length > 1).flat();
    if (stuck.length > 0) clashes.push({ studentId: wish.studentId, studentName: wish.studentName, subjectIds: stuck });
  }
  return clashes;
}

/**
 * Put co-chosen subjects in different blocks so a student can take all of them.
 * Block count is the longest wishlist, unless the caller sets it.
 */
export function suggestBlocks(subjects: OptionSubject[], wishes: ChoiceWish[], blockCount?: number): BlockPlan {
  const ids = subjects.map(subject => subject.id).sort();
  const weight = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const wish of wishes) {
    const unique = [...new Set(wish.subjectIds)].sort();
    for (let left = 0; left < unique.length; left += 1) {
      for (let right = left + 1; right < unique.length; right += 1) {
        const pair = key(unique[left]!, unique[right]!);
        weight.set(pair, (weight.get(pair) ?? 0) + 1);
      }
    }
  }
  const degree = (id: string) => ids.reduce((sum, other) => sum + (other !== id && weight.has(key(id, other)) ? weight.get(key(id, other))! : 0), 0);
  const ordered = ids.slice().sort((a, b) => degree(b) - degree(a) || a.localeCompare(b));
  const colours = Math.max(1, blockCount ?? Math.max(1, ...wishes.map(wish => new Set(wish.subjectIds).size), 1));
  const assigned = new Map<string, number>();
  for (const id of ordered) {
    const used = new Map<number, number>();
    for (const other of ids) {
      if (!assigned.has(other) || !weight.has(key(id, other))) continue;
      const colour = assigned.get(other)!;
      used.set(colour, (used.get(colour) ?? 0) + (weight.get(key(id, other)) ?? 0));
    }
    let best = 0;
    let bestCost = used.get(0) ?? 0;
    for (let colour = 0; colour < colours; colour += 1) {
      const cost = used.get(colour) ?? 0;
      if (cost < bestCost || (cost === bestCost && colour < best)) {
        best = colour;
        bestCost = cost;
      }
    }
    assigned.set(id, best);
  }
  const level = subjects[0]?.level ?? 'IGCSE';
  const blocks: OptionBlock[] = [];
  for (let colour = 0; colour < colours; colour += 1) {
    const subjectIds = ids.filter(id => assigned.get(id) === colour);
    if (subjectIds.length === 0) continue;
    blocks.push({
      id: `block-${colour + 1}`,
      name: `Block ${String.fromCharCode(65 + colour)}`,
      level,
      subjectIds,
      pick: 1,
    });
  }
  const clashes = clashesFor(wishes, colourOf(blocks));
  return { blocks, satisfied: wishes.length - clashes.length, total: wishes.length, clashes };
}

export function wishesFromChoices(doc: TimetableDoc, extra: ChoiceWish[] = []): ChoiceWish[] {
  if (extra.length > 0) return extra;
  const byStudent = new Map<string, string[]>();
  for (const choice of doc.choices) {
    const list = byStudent.get(choice.studentId) ?? [];
    list.push(...choice.subjectIds);
    byStudent.set(choice.studentId, list);
  }
  return [...byStudent.entries()].map(([studentId, subjectIds]) => ({
    studentId,
    studentName: doc.people.find(person => person.id === studentId)?.name ?? studentId,
    subjectIds,
  }));
}

/** Admin approval creates one set per chosen subject and enrols the students. */
export function approveOptions(doc: TimetableDoc, at: string, actorId: string): TimetableDoc {
  const groups: TeachingGroup[] = doc.groups.filter(group => group.kind !== 'option');
  const made: TeachingGroup[] = [];
  for (const subject of doc.optionSubjects) {
    const studentIds = [...new Set(doc.choices.filter(choice => choice.subjectIds.includes(subject.id)).map(choice => choice.studentId))].sort();
    if (studentIds.length === 0) continue;
    made.push({
      id: `set-${subject.id}`,
      name: `${subject.name} — ${subject.level}`,
      level: subject.level,
      studentIds,
      kind: 'option',
      campusId: doc.campusIds[0] ?? 'main',
    });
  }
  return {
    ...doc,
    groups: [...groups, ...made],
    audit: [{ id: `audit-${doc.audit.length + 1}`, at, actorId, action: 'options-approve', detail: `Created ${made.length} sets.` }, ...doc.audit],
  };
}

export function saveChoice(doc: TimetableDoc, choice: StudentChoice): TimetableDoc {
  const choices = doc.choices.filter(item => !(item.studentId === choice.studentId && item.blockId === choice.blockId));
  return { ...doc, choices: [...choices, choice] };
}
