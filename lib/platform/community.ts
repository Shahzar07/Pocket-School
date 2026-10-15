export type DiscussionAudience = 'adult' | 'minor';

export interface DiscussionSpace {
  id: string;
  bookId: string;
  title: string;
  audience: DiscussionAudience;
}

export interface WinPost {
  kind: 'finish' | 'streak';
  audience: DiscussionAudience;
  title: string;
  body: string;
}

/** 18+ stays in the adult room. Every younger rating stays with minors. */
export function discussionAudience(ageRating: string): DiscussionAudience {
  return ageRating === '18+' ? 'adult' : 'minor';
}

export function discussionSpace(book: { id: string; title: string; ageRating: string }): DiscussionSpace {
  const audience = discussionAudience(book.ageRating);
  return {
    id: `book:${book.id}`,
    bookId: book.id,
    title: book.title,
    audience,
  };
}

export function suggestWinPost(input: {
  kind: 'finish' | 'streak';
  title: string;
  audience: DiscussionAudience;
  days?: number;
}): WinPost {
  if (input.kind === 'streak') {
    const days = input.days ?? 1;
    return {
      kind: 'streak',
      audience: input.audience,
      title: `${days}-day reading streak`,
      body: input.audience === 'minor'
        ? `A reader kept a ${days}-day streak. Share it in the under-18 room.`
        : `A reader kept a ${days}-day streak. Share it in the adult room.`,
    };
  }
  return {
    kind: 'finish',
    audience: input.audience,
    title: `Finished ${input.title}`,
    body: input.audience === 'minor'
      ? `You finished ${input.title}. This suggestion stays in the under-18 room.`
      : `You finished ${input.title}. This suggestion stays in the adult room.`,
  };
}
