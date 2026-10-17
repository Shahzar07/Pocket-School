/**
 * Product event names. The server writes these. Clients must not post them.
 * There is no route that accepts an event name.
 */
export const LESSON_FIRST_COMPLETE = 'lesson.first_complete' as const;

export type ProductEventName = typeof LESSON_FIRST_COMPLETE;
