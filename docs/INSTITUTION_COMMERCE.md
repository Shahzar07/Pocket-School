# Institution commerce

Poket School charges people and institutions on different paths. Sparks stay a learning allowance. They do not buy marketplace courses.

## Who pays

| Account | Path | Bill |
| --- | --- | --- |
| Student | Independent | Their level plan: core programmes for that level, plus monthly Sparks |
| Student | Institution | Nothing from Poket School. The institution pays per student seat |
| Parent | Either | Free. A parent sees only their own children |
| Second and later independent child | Parent invoice | 30% off that child's plan |
| Teacher | Independent | Teacher plan (course builder and Sparks). Marketplace sales pay the teacher through Stripe Connect |
| Teacher or institution admin | Institution | Free staff account. Sparks come from the institution pool |

Marketplace courses are paid separately. An individual pays with a card or the wallet. An institution may add the same course to its invoice and then assign it. A subscription course closes when that subscription lapses, including an institution subscription. An a la carte purchase stays for life. A course marked Both lets the buyer choose at checkout. A la carte is only offered when the course is flagged eligible and has a price. A creator's change waits for a super admin.

## Publishing

1. An institution teacher submits a course.
2. The institution admin approves it before it appears in the institution library.
3. Listing on the public marketplace needs a super admin. The super admin also sets featured, core programme, levels, and which institutions receive it.

## Operations

- Seat count follows active students. Added or removed seats are priced for the days left in the period.
- The institution home reports cost per student, per lesson, and per certificate, plus attendance and Sparks used.
- A spending cap refuses Sparks past the cap. Usage at or below 20% remaining raises an alert.
- One wallet records top-ups, purchases, gifts, and refunds. It does not go below zero.
- Signup still requires Terms, Privacy, and a verified parent for anyone under 18 (Malaysian PDPA). Export returns profile, consents, wallet, and children. Deletion erases the profile and wallet. Invoices stay 7 years with the name removed.

The Teacher plan seed is USD 29 a month, the same figure as the course-builder add-on. A super admin can replace it. Stripe Connect uses the existing 70% teacher share (`teacherShareBps` 7000).
