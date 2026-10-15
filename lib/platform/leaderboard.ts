import { boardRows, type BoardPeriod, type BoardScope } from '@/lib/reads/leaderboard';

/**
 * Privacy-safe board. No email and no school name outside the school scope.
 * `privacyBoard` is the function the shared leaderboard should replace.
 * Under-18 nicknames come from the seed and are not rewritten here.
 */
export function privacyBoard(scope: BoardScope, period: BoardPeriod, hideChild: boolean) {
  return boardRows(scope, period, hideChild).map(row => ({
    ...row,
    entry: {
      ...row.entry,
      school: scope === 'school' ? row.entry.school : '',
    },
  }));
}
