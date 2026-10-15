export interface ReadingAwardState {
  xp: number;
  badges: string[];
  streak: number;
  finished: string[];
}

export interface ReadingAward {
  xp: number;
  badges: string[];
  streak: number;
  granted: boolean;
}

const EMPTY: ReadingAwardState = { xp: 0, badges: [], streak: 0, finished: [] };

function key(profileId: string): string {
  return `poket-reads-awards:${profileId}`;
}

export function readAwards(profileId: string): ReadingAwardState {
  if (typeof localStorage === 'undefined') return { ...EMPTY, badges: [], finished: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(key(profileId)) ?? '') as Partial<ReadingAwardState>;
    return {
      xp: typeof raw.xp === 'number' ? raw.xp : 0,
      badges: Array.isArray(raw.badges) ? raw.badges.filter(item => typeof item === 'string') : [],
      streak: typeof raw.streak === 'number' ? raw.streak : 0,
      finished: Array.isArray(raw.finished) ? raw.finished.filter(item => typeof item === 'string') : [],
    };
  } catch {
    return { ...EMPTY, badges: [], finished: [] };
  }
}

/** Pure award step. Finishing a book grants 50 XP and `book-finished` once. A streak grants 10 XP and `streak` from the third day. */
export function applyAward(state: ReadingAwardState, event: 'finish' | 'streak', bookId?: string): { state: ReadingAwardState; award: ReadingAward } {
  const badges = [...state.badges];
  const finished = [...state.finished];
  let xp = state.xp;
  let streak = state.streak;
  let granted = false;

  if (event === 'finish' && bookId && !finished.includes(bookId)) {
    finished.push(bookId);
    xp += 50;
    granted = true;
    if (!badges.includes('book-finished')) badges.push('book-finished');
    streak = Math.max(streak, 1);
  }

  if (event === 'streak') {
    streak += 1;
    xp += 10;
    granted = true;
    if (streak >= 3 && !badges.includes('streak')) badges.push('streak');
  }

  const next = { xp, badges, streak, finished };
  return { state: next, award: { xp, badges, streak, granted } };
}

export function awardReading(profileId: string, event: 'finish' | 'streak', bookId?: string): ReadingAward {
  const current = readAwards(profileId);
  const { state, award } = applyAward(current, event, bookId);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key(profileId), JSON.stringify(state));
  }
  return award;
}
