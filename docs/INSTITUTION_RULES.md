# Institution membership rules

These rules are in `firestore.rules`. They are not deployed from this change. Deploy them with the usual Firebase rules release after the emulator tests pass.

The diff against `main` is `docs/firestore-institution.rules.diff`.

## Who can join

`institutions/{id}/join_requests/{userId}`

- A signed-in student, parent, or teacher may create one pending request for themselves.
- The academy document must already have `status == active` and `listedForSelfJoin == true`.
- The requester cannot set `status` to `approved`.
- The institution admin of that academy, or a platform admin, may approve or reject it and may set `level`, `classIds`, and `courseIds`.
- Another signed-in person cannot read the request.

## Attaching the account

An institution admin may set `institutionId` on a user only when:

- the field was empty
- the new value is that admin's own institution
- `institutions/{institution}/join_requests/{userId}` is `approved`
- the write does not change `role` or any other privileged field

An institution admin cannot change `listedForSelfJoin` or `state`. Those stay with the platform admin.

## Sparks, billing, partners

| Path | Read | Write |
| --- | --- | --- |
| `sparks_config/{id}` | signed in | platform admin |
| `institutions/{id}/sparks_pool/{id}` | academy members | platform admin |
| `institutions/{id}/sparks_allocations/{id}` | the student, their parent, their class teacher, the institution admin | institution admin, amount 0–20000 |
| `institutions/{id}/billing/{id}` | academy members | platform admin |
| `subscriber_billing/{userId}` | that user, platform admin | platform admin |
| `partner_orgs/{id}` | signed in | platform admin |
| `partner_revenue/{id}` | platform admin | create only, no edits |
| `core_programmes/{id}` | signed in | platform admin |

## Courses, invoices, report cards

- A teacher creating a course for an institution must leave it private: `publishScope == institution`, `isPublic == false`, `marketplaceApproved == false`, co-brand off.
- Only a platform admin can turn on `marketplaceApproved` or the co-brand toggle.
- A student whose profile has `institutionId` cannot create their own invoice. An independent student still can. Marketplace purchases stay on the payment routes.
- A report card is readable by the student, a linked parent, the teacher named on the card, a teacher of that class, and the institution admin of that academy. Another teacher in the same academy cannot open it.
