/** Local hours that do not earn leaderboard credit. 22:00–05:59. */
export function isQuietHour(date = new Date()): boolean {
  const h = date.getHours();
  return h >= 22 || h < 6;
}

export const QUIET_LABEL = 'Quiet hours are 22:00–06:00. Reading still works; it is not added to the board.';
