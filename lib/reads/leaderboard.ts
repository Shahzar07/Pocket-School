export type BoardScope = 'global' | 'country' | 'city' | 'school' | 'friends';
export type BoardPeriod = 'week' | 'month' | 'all';

export interface BoardEntry {
  id: string;
  nickname: string;
  under18: boolean;
  country: string;
  city: string;
  school: string;
  friend: boolean;
  week: number;
  month: number;
  all: number;
  /** Finished reading days in a row. A flame shows from three. */
  streak: number;
}

/** Fictional readers. Under-18s are nicknames only. No street, no school on the wide boards. */
export const BOARD: BoardEntry[] = [
  { id: 'river', nickname: 'River', under18: true, country: 'Malaysia', city: 'Kuala Lumpur', school: 'Sri Kuala', friend: true, week: 186, month: 640, all: 2410, streak: 12 },
  { id: 'amina', nickname: 'Amina', under18: true, country: 'Malaysia', city: 'George Town', school: 'Sri Kuala', friend: true, week: 154, month: 510, all: 1980, streak: 9 },
  { id: 'jun', nickname: 'Jun', under18: true, country: 'Singapore', city: 'Singapore', school: 'East Harbour', friend: false, week: 142, month: 470, all: 1760, streak: 7 },
  { id: 'hafiz', nickname: 'Hafiz', under18: true, country: 'Malaysia', city: 'Kuala Lumpur', school: 'Sri Kuala', friend: true, week: 128, month: 390, all: 1540, streak: 4 },
  { id: 'lighthouse', nickname: 'Lighthouse', under18: true, country: 'Malaysia', city: 'Kuala Lumpur', school: 'Sri Kuala', friend: false, week: 96, month: 280, all: 860, streak: 3 },
  { id: 'hannah', nickname: 'Hannah Cole', under18: false, country: 'Malaysia', city: 'Ipoh', school: '', friend: false, week: 88, month: 240, all: 1320, streak: 0 },
  { id: 'mei', nickname: 'Mei', under18: true, country: 'Malaysia', city: 'Johor Bahru', school: 'South Court', friend: false, week: 77, month: 260, all: 990, streak: 2 },
  { id: 'arun', nickname: 'Arun', under18: true, country: 'Malaysia', city: 'Kuala Lumpur', school: 'Sri Kuala', friend: true, week: 64, month: 210, all: 740, streak: 1 },
];

export function boardRows(scope: BoardScope, period: BoardPeriod, hideHafiz: boolean): { entry: BoardEntry; place: string; minutes: number }[] {
  const rows = BOARD.filter(entry => {
    if (hideHafiz && entry.id === 'hafiz') return false;
    if (scope === 'country') return entry.country === 'Malaysia';
    if (scope === 'city') return entry.city === 'Kuala Lumpur';
    if (scope === 'school') return entry.school === 'Sri Kuala';
    if (scope === 'friends') return entry.friend;
    return true;
  });
  rows.sort((a, b) => b[period] - a[period]);
  return rows.map(entry => ({
    entry,
    minutes: entry[period],
    place: scope === 'global' || scope === 'friends'
      ? ''
      : scope === 'school'
        ? entry.school
        : scope === 'city'
          ? entry.city
          : entry.country,
  }));
}
