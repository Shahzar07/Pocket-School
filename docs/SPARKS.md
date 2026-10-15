# Sparks — a plain explanation

Sparks are learning credits. They are not a score and they are not money. A student spends Sparks to open extra versions of a curriculum lesson (the quiz, the slides, the audio, and so on). Marketplace courses do not charge Sparks.

The numbers live in one place: `lib/entitlements.ts` (the plan) and `lib/sparks.ts` (the costs and rewards). The pricing page, the Sparks page, and the monthly grant all read those files. If a number changes, change it there and nowhere else.

## What a student sees

- A Sparks balance in the header.
- The first time they see it, a short “What are Sparks?” tip. The full explanation is on **Sparks** in the student menu (`/dashboard/student/sparks`).
- Before any spend, the lesson shows the cost and the balance and asks them to confirm.
- A history of grants and spends on the Sparks page (the ledger under their profile).
- A link to **Pricing** when they want a larger monthly allowance.

## What things cost

| Format | Sparks |
| --- | --- |
| Lesson text, video script, infographic | 15 |
| Mind map, audio summary, slides | 10 |
| Flashcards, quiz, practice, glossary, revision notes | 5 |

## How students earn them

| Event | Sparks |
| --- | --- |
| Finishing sign-up (once) | 50 |
| Finishing a curriculum lesson | 10 |
| Passing a module quiz | 50 |
| Monthly plan allowance | see below |

Passing a module quiz pays the 50. It does not also pay the 10 lesson reward for the same quiz.

The **first published lesson** of a curriculum course is free. No Sparks are spent and every format on that lesson opens.

## Monthly allowance (same numbers as the pricing page)

Prices are one flat rate in US dollars. Sparks stay on the access-tier table from the access brief.

| Plan | Price | Monthly Sparks | How many can roll into next month |
| --- | --- | --- | --- |
| Free preview | $0 | 0 | 0 |
| Primary & Lower Secondary | $49 / month | 300 | 100 |
| IGCSE & A-Level | $79 / month | 800 | 300 |
| Micro Degree, Professional Certification, Independent Learning | $19 / month | 2,000 | 700 |
| LLB Law & MBBS Medicine | $99 / month | 2,000 | 700 |
| Institution | Custom | 10,000 shared pool | 0 |
| Marketplace purchase | per course | 0 | 0 |

The $19 plan receives 2,000 Sparks because that is the tier 3 allowance in the access brief. The master brief later priced that tier at $19 and did not publish a new Sparks number. The allowance is unchanged on purpose, and Harry can change it in `lib/entitlements.ts` if 2,000 is too high for a $19 plan. The $19 plan does **not** open Primary, Lower Secondary, IGCSE or A-Level courses. The $99 plan does, including the IGCSE and A-Level library.

ET Maths is described as 1 Spark per snapped problem. That meter is not built yet. Practice problems inside a lesson still cost 5 Sparks.

Teachers, institution admins, and Poket admins are on the institution allowance so they can open lessons while they teach. A custom `sparksMonthlyAllowance` on a profile is used only when it is **higher** than the plan (an institution deal). It cannot quietly shrink a paid plan.

Once every 30 days the server keeps up to the rollover amount and then adds the monthly allowance. Subscribing or changing plan starts that grant immediately.

Yearly billing is 25% off, which is **3 months free**. The price shown on yearly billing is the discounted monthly rate ($49 becomes $36.75) plus the amount billed for the year ($441). The sentence is built from the same discount.

## Who is allowed to change a balance

The student’s browser cannot write `sparksBalance`, XP, plan, or enrolment progress. Those fields are locked in `firestore.rules`. Grants and spends go through `/api/platform/*`, which uses the Firebase Admin SDK and writes a row in `users/{id}/spark_transactions`.

If the Admin credentials are not set, those routes answer “not configured”. They do not fall back to a client write.

## Get more Sparks

Students open **Pricing**, choose a plan, and pay with Stripe. The Stripe webhook (not the browser) sets the plan and starts the monthly grant.
