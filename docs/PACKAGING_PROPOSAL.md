# Sparks and Poket Reads packaging

This note answers two product questions. It does not change prices or allowances. Those still live in `lib/entitlements.ts`, `lib/sparks.ts`, and `lib/payments/reads.ts`.

## Does 300 Sparks a month suit Primary & Lower Secondary?

**Keep 300 as the included allowance.** It fits a learner who opens the lesson and one or two extra formats. It does not fit a learner who generates every format on every lesson. Offer top-up packs for that second case, and raise the included allowance to 600 only if the product should cover every format.

### How a lesson spends Sparks

A curriculum lesson can unlock eleven formats. Marketplace lessons do not charge Sparks. The costs in `lib/sparks.ts` are:

| Formats | Sparks each | Count | Subtotal |
| --- | ---: | ---: | ---: |
| Lesson text, video script, infographic | 15 | 3 | 45 |
| Mind map, audio summary, slides | 10 | 3 | 30 |
| Flashcards, quiz, practice, glossary, revision notes | 5 | 5 | 25 |
| **Every format on one lesson** |  | **11** | **100** |

Primary & Lower Secondary (`primary_secondary`, tier 1) includes **300 Sparks a month** and **100 that roll over**.

| Way of studying | Sparks | What 300 covers |
| --- | ---: | --- |
| Every format on a lesson | 100 | 3 lessons, with nothing left over |
| Lesson text only | 15 | 20 lessons |
| Text, quiz, and revision notes | 25 | 12 lessons |
| Text plus one richer format (video, infographic, or slides) | 25–30 | about 10 lessons |

Three hundred Sparks is the right included amount for the common path: the lesson, plus a quiz or notes, plus an occasional video or slides. A learner who generates the full set every time will run out after three lessons. Rollover of 100 covers one extra full lesson the next month, not a second study style.

Rewards give a little back (10 for finishing a lesson, 50 for passing a unit, 15 for an on-time goal) but they are not the allowance.

### Recommendation

1. Leave tier 1 at 300 Sparks and 100 rollover.
2. Sell Spark top-up packs (for example 100, 300, and 600) from the wallet, so a heavy month does not force a plan upgrade.
3. If Primary should include every format on a typical school week, change `sparks` for tier 1 from 300 to 600 in `lib/entitlements.ts`. That is about six full lessons, or a month of text plus two formats. Do that as its own pricing change, with the pricing page updated in the same change.

IGCSE & A-Level stays at 800. That plan already covers about eight full lessons.

## Should Poket Reads be free for subscribers, with a standalone plan?

**Yes to both.** Include Poket Reads in every paid subscription (tier 1 and above), and keep the standalone Reads plans for someone who only wants books.

### What the code does today

- A single book is content type `BOOK` with minimum tier **0**. Opening a book is not gated by a paid school plan.
- The shelf still sells a subscription: **Poket Reads at $4.99 a month** (`plan:reads`, $49.99 a year) and **Poket Reads Family at $7.99 a month** (`plan:reads-family`, $79.99 a year).
- Individual books stay for sale. The default is $1.99 (The Harbour Light uses that default). A Firestore book document can override the shelf price.

So books are already reachable without a school plan, but the Reads library subscription is a separate product. A Primary subscriber does not automatically receive `plan:reads`.

### Recommendation

1. **Paid school plans include Reads.** Tier 1 and above should grant `plan:reads`. Tier 5 (institution) and the family-shaped plans should grant `plan:reads-family` where the seat is a household. Do not grant Reads on the free preview tier.
2. **Keep the a-la-carte plans.** Someone who does not want Primary, IGCSE, or Professional can still buy Poket Reads at $4.99 or Reads Family at $7.99. That is the right product for a reader who is not taking a course.
3. **Keep selling single books.** A person with no subscription can buy one title. A Reads subscriber should not be charged again for a title that is inside the library; a title marked as a separate purchase stays paid.
4. Make the change in the entitlement check that grants `plan:reads` from tier ≥ 1, and on the pricing page copy. Leave `READS_PLANS` prices where they are until that copy ships with it.

## What this proposal does not do

- It does not edit `lib/entitlements.ts` or `lib/payments/reads.ts`.
- It does not compare Poket School with other course sites.
- Levels stay levels. The tier names already in the product (Primary & Lower Secondary, IGCSE & A-Level) are unchanged.
