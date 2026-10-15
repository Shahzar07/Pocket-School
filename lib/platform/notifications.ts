/**
 * Reading notices in the same shape the notifications centre already renders:
 * a title and a message. The parent updates page appends these.
 * Swap this for a server fan-out when the centre owns delivery.
 */
export interface ShelfNotice {
  id: string;
  title: string;
  message: string;
  href: string;
}

export function readingNotices(progress: Record<string, { percent: number }>): ShelfNotice[] {
  return Object.entries(progress)
    .filter(([, item]) => item.percent > 0 && item.percent < 100)
    .slice(0, 4)
    .map(([id, item]) => ({
      id: `read:${id}`,
      title: 'Continue',
      message: `${Math.round(item.percent)}% of the way through`,
      href: id.startsWith('seed:') ? `/courses/catalogue/${id.slice(5)}` : `/reads/read/${id}`,
    }));
}
