import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Buy-to-own is not granted from the browser.
 *
 * TODO: when PR #52 (cursor/clarity-security-sparks-f0ff) lands, the Stripe
 * webhook should grant `alloc:book:{bookId}` on the user server-side and
 * write the library document with the Admin SDK. This route must stay a
 * stub until that grant exists. A purchased book then stays after the plan ends.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Book purchase is not wired yet. The Stripe webhook has to grant alloc:book on the server before this can charge a card.',
      todo: 'PR #52 webhook → library write via Admin SDK',
    },
    { status: 501 },
  );
}
