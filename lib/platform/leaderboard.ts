import { boardRows, type BoardPeriod, type BoardScope } from '@/lib/reads/leaderboard';

/**
 * Privacy-safe board. Names stay short. The school line is the verified
 * institution or the self-reported school, and it is text only.
 * Under-18 nicknames come from the seed and are not rewritten here.
 */
export function privacyBoard(scope: BoardScope, period: BoardPeriod, hideChild: boolean) {
  return boardRows(scope, period, hideChild);
}
