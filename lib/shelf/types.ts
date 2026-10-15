export type ShelfKind = 'book' | 'course';

export type BadgeTone = 'free' | 'included' | 'buy' | 'owned' | 'locked' | 'preview';

export interface ShelfBadge {
  label: string;
  tone: BadgeTone;
}

export interface CoverStyle {
  from: string;
  to: string;
  accent: string;
  /** Composed tile, with crisp title text. Absent while the cover is still a gradient. */
  image?: string;
  hero?: string;
  thumb?: string;
}

export interface ShelfItem {
  id: string;
  kind: ShelfKind;
  href: string;
  title: string;
  subtitle: string;
  description: string;
  /** Wide cover image. Courses use this; books usually use `cover`. */
  image?: string;
  cover?: CoverStyle;
  badge: ShelfBadge;
  extra?: string;
  tags: string[];
  subject?: string;
  level?: string;
  category?: string;
  /** fiction | non-fiction, books only. */
  form?: string;
  /** Minimum recommended age. Absent means unrestricted. */
  age?: number;
  weekly: number;
  releasedAt: string;
  seriesId?: string;
  seriesName?: string;
  seriesIndex?: number;
  progress?: number;
}
