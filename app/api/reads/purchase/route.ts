import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Buy-to-own is not granted from the browser.
 *
 * TODO: the Stripe webhook should grant `alloc:marketplace:{bookId}` (or
 * `alloc:paid:{bookId}`) with the Admin SDK and write the library document.
 * `decideBook` already treats those strings as ownership. This route stays
 * a stub until that grant exists. A purchased book then stays after the plan ends.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Book purchase is not wired yet. The Stripe webhook has to grant alloc:marketplace on the server before this can charge a card.',
      todo: 'Stripe webhook → alloc:marketplace:{bookId} and a library write via Admin SDK',
    },
    { status: 501 },
  );
}
