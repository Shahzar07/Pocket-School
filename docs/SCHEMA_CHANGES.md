# Schema changes

Shared Firestore contract for the Poket School web app and the Poketschool app. Rules in `firestore.rules` still need an owner deploy before production enforces them.

Database: `ai-studio-5cdc1a69-b213-49e8-8c41-756df00d9e15` in project `ringed-sentinel-436615-c2`.

## deviceTokens (new)

The app writes one document per device.

| | |
|---|---|
| Path | `deviceTokens/{deviceId}` |
| Doc id | The device id. The `deviceId` field should match it. |

Fields the app writes:

| Field | Type | Notes |
|---|---|---|
| `userId` | string | Firebase Auth uid of the signed-in person. |
| `token` | string | Expo push token, or the Web Push endpoint URL when `provider` is `webpush`. |
| `platform` | string | Device platform, for example `ios`, `android`, or `web`. |
| `provider` | string | `expo` or `webpush`. |
| `deviceId` | string | Same id as the document id. |
| `keys` | map | Web Push subscription keys: `p256dh`, `auth`. Omit for Expo. |
| `prefs` | map | Optional booleans. A missing key stays on. `false` opts that device out. Keys: `goals`, `flags`, `attendance`, `digests`, `grades`, `assignments`, `general`. |
| `app` | string | Which client registered the device. |
| `updatedAt` | timestamp | Last registration write. |

Rules:

- Create: signed in, and `request.resource.data.userId == request.auth.uid`.
- Update: signed in, and both the existing document and the new document have `userId == request.auth.uid`. A token cannot be moved to another account.
- Delete: signed in, and the existing `userId == request.auth.uid`. Firestore does not provide a new document on delete, so the new-data check applies only when `request.resource` exists (updates).
- Get and list: denied for every client. The server reads and deletes with the Admin SDK.

Query the senders use:

```
deviceTokens where userId == recipientUid
```

That is a single-field equality. Firestore maintains that index automatically.

Senders (goals parent alerts, integrity flags, attendance, digests, and the inbox categories grades, assignments, and general) all load that query, skip a device whose `prefs[category] === false`, and post to Expo (`https://exp.host/--/api/v2/push/send`) or Web Push from `provider`. Web Push needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. The Admin SDK needs `FIREBASE_SERVICE_ACCOUNT` (JSON) or Application Default Credentials.

Invalid tokens are deleted by the server:

- Expo ticket `details.error` of `DeviceNotRegistered`, `InvalidCredentials`, or `MismatchSenderId`.
- Web Push HTTP 404 or 410.

`POST /api/push` is the browser entry. It requires a Firebase ID token. The body is `{ recipientUid, category, title, body, link? }`.

## daily_goals (goals)

Collection: `daily_goals`. The shared type is `DailyGoal` in `lib/db.ts`, normalised by `coerceDailyGoal` in `lib/goals.ts`.

Canonical document:

| Field | Type | Required on write | Notes |
|---|---|---|---|
| `studentId` | string | yes | Auth uid of the student. Rules compare this to `request.auth.uid` on create. |
| `studentName` | string | no | Display name copied at create time. |
| `dateKey` | string | yes | Local `YYYY-MM-DD`. |
| `title` | string | yes | |
| `category` | string | yes | `study`, `revision`, `practice`, `reading`, `other`. |
| `estimateMinutes` | number | yes | |
| `deadline` | string | yes | Local `HH:mm`. |
| `courseId` | string | no | |
| `courseLabel` | string | no | |
| `status` | string | yes | `not_started`, `in_progress`, `completed`, `overdue`, `excused`. |
| `startedAt` | timestamp | no | Set when the student starts. |
| `completedAt` | timestamp | no | Set when the student finishes. |
| `actualMinutes` | number | no | |
| `xpAwarded` | number | no | |
| `excuseReason` | string | no | Parent waiver. |
| `excusedBy` | string | no | |
| `notifiedNotStarted` | boolean | no | Stops a second “not started” parent alert. |
| `notifiedMissed` | boolean | no | Stops a second “missed” parent alert. |
| `createdAt` | timestamp | server | |
| `updatedAt` | timestamp | server | Set on create and on every update so the app can sort. |

Read aliases, used only when the canonical field is missing:

| Alias | Canonical |
|---|---|
| `userId` | `studentId` |
| `date` | `dateKey` |
| `due` | `deadline` |
| `minutes` | `estimateMinutes` |
| `completed: true` | `status: completed` |

Web writes always use the canonical names. New app writes should too. The live query is `where('studentId', '==', uid)` and the date is filtered in the client, so no composite index is required.

Rules (unchanged): the student creates their own goals; the student, a linked parent (`users.childIds`), or a teacher or admin can read and update; the student or an admin can delete.

Parent alerts from `checkGoalAlerts` write an in-app `notifications` row and send a push with category `goals` to each linked parent.

## users (field)

`users.shareBoard` is an optional boolean. Missing means the student still appears on the leaderboard. `false` removes them from the privacy-safe board. The board shows a short name (`Ada L.`) or `You` for the viewer, and never an email.

Signed-in clients can still read user documents under the existing rules. The short name is a display rule in `privacyBoard`. It is not a security rule. Hiding the full profile from other students needs a rules change.

## notifications (unchanged)

`notifications` stays the in-app inbox: `userId`, `title`, `message`, `type`, `link`, `read`, `createdAt`. Push category is not stored on the document. Creating a notification also asks `/api/push` to deliver it. `type: grade` maps to prefs `grades`, `type: assignment` maps to `assignments`, and other types map to `general` unless the caller sets a category (`goals`, `flags`, `attendance`, `digests`).

## Other senders

| Sender | Who is notified | Category |
|---|---|---|
| Goal parent alert | Each parent whose `childIds` contains the student | `goals` |
| Integrity flag | The student, when `integrity_reports.flags` is non-empty | `flags` |
| Attendance | The student, and each linked parent, when a mark is `absent` or `late` | `attendance` |
| Digest | The recipient passed to `sendDigest` | `digests` |
| Assignment graded | The student | `grades` |
| Parent due-date reminder | The signed-in parent | `assignments` |

Email digests are not sent from this change. The push digest sender is the hook a later scheduler can call.

## users/{userId}/deviceTokens (app subcollection)

The Poketschool app may also store a token under the signed-in user. Both stores are delivered.

| | |
|---|---|
| Path | `users/{userId}/deviceTokens/{tokenId}` |
| Doc id | A device or token id chosen by the app. |

Fields match the top-level `deviceTokens` document. `userId` may be omitted, because the path already names the owner. The server fills `userId` from the path when the field is missing.

Rules:

- Create, update, and delete: `isUser(userId)`. The signed-in user is the path owner. A `userId` field is not required.
- Get and list: denied for every client.

The senders read both stores:

```
deviceTokens where userId == recipientUid
users/{recipientUid}/deviceTokens
```

The same device id in both stores is sent once. The per-user document wins. A pruned token is deleted from both places. Rules still need an owner deploy.

## lessons.generationJobs

Optional map on a lesson. Keys are AI format ids (`problems`, `mindmap`, `audioScript`, and the other generator formats).

| Field | Type | Notes |
|---|---|---|
| `status` | string | `queued`, `generating`, `done`, or `failed`. |
| `error` | string | Present when `status` is `failed`. |
| `updatedAt` | number | Client timestamp in milliseconds. |

The editor shows queued and generating while the request is in flight, and writes `done` or `failed` with the lesson. A queued or generating job older than three minutes is shown as failed, so a reload does not spin forever.

`aiOutputs.mindmap` is a JSON string:

```
{ "center": "Topic", "centerIcon": "💡", "branches": [{ "keyword": "Branch", "icon": "📌", "children": [] }] }
```

One keyword per branch. The student view lays that JSON out as an SVG. Study-note prose is rejected and is not stored.

`aiOutputs.problems` is Markdown. Each item starts with `## Problem N` and includes `### Worked solution`. Study-note headings are rejected with HTTP 422 and are not stored.

`aiOutputs.infographic` keeps only figures that appear in the lesson text, with the label words taken from the sentence around that figure.

## courses.downloadsEnabled

Optional boolean on a course.

| Value | Who can download |
|---|---|
| absent | A student with tier 1 or higher, or an allocation for that course. Teachers, institution admins, and admins can download. |
| `true` | Downloads are on for every signed-in role, including tier 0. |
| `false` | Downloads are off, except for an admin. |

## POST /api/export

Server-side file export. Requires `Authorization: Bearer <Firebase ID token>`.

```
{
  "asset": "notes | glossary | flashcards | quiz | problems | slides | infographic | mindmap | image",
  "format": "pdf | docx | jpg | png | pptx",
  "title": "Lesson title",
  "content": "markdown, JSON, or { url } for an image",
  "answerKey": true,
  "courseId": "course id",
  "viewer": { "role": "student", "tier": 1, "permissions": [], "downloadsEnabled": null }
}
```

`pptx` is for slides. `jpg` and `png` are for images, infographics, and mind maps. `pdf` and `docx` are for the written assets and for slides. `answerKey: false` omits quiz answers and `### Worked solution` sections.

Every file includes `© {current year} PoketSchool.Ai. All rights reserved.` The year is `new Date().getFullYear()` at generation time. The file also carries the Poket School wordmark. The legal entity name stays in the terms, privacy policy, and creator agreement.

When `FIREBASE_SERVICE_ACCOUNT` is set, the route replaces `viewer` with the Firestore user and `courses.downloadsEnabled`. Without that credential, the route checks the ID token and applies `canDownload` to the posted viewer. That fallback is a limitation of this environment.

## media_assets (new)

Reusable picture metadata. The file itself is in Firebase Storage at `media/{scopeId}/{name}`, or a data URL when Storage rejects the upload.

| Field | Type | Notes |
|---|---|---|
| `scopeId` | string | Course id or book id. Pictures in one scope can be reused. |
| `ownerId` | string | Firebase uid of the uploader. |
| `src` | string | Download URL or data URL. |
| `alt` | string | Required before the picture is placed. May be empty in the library. |
| `caption` | string | Optional. |
| `width`, `height` | number | After resize. The long edge is at most 1600. |
| `storagePath` | string | Present when Storage accepted the file. |
| `fullBleed` | boolean | Optional. |
| `updatedAt` | number | Client timestamp in milliseconds. |

A signed-in user can create and update their own documents. Teachers and admins can read the library. Rules need an owner deploy.

## addon:cms

Permission string `addon:cms`. Priced in `seedPricing()` at 29 USD per month. `normalizePricing` merges that row into an existing pricing document, so the admin pricing screen shows it on the next load. Saving pricing writes it to `pricing_config/current`.

| Who | CMS editor, import, image library, illustrations, covers |
|---|---|
| `role == admin` | Always. |
| Teacher or institution admin | When `users.permissions` contains `addon:cms`. |
| Everyone else | The allocation screen can grant it. The Institution tier is the listed requirement. |

Grant and revoke use the existing add-on controls on Access allocation.

## Admin console

Staff stay on `users.role = admin` so the existing admin shell keeps working. The new field `users.adminRole` is the staff role: `super_admin`, `admin`, `content_editor`, `support`, or `finance`. Custom claims mirror it: `{ adminRole, role }`. Claims are written only when `FIREBASE_SERVICE_ACCOUNT` is set, by `POST /api/admin/console` with action `sync-claims`. The person signs out and back in before rules see the new claim.

`accountStatus` now also allows `banned` and `deleted`. `statusReason` stores the reason. `deletedAt` is a millisecond timestamp on soft-delete and `null` after restore. `country` is an optional profile string used by the directory filter.

| Collection | Who can read | Who can write |
|---|---|---|
| `admin_audit/{id}` | Super admin claim, or one of the owner emails | Create by a platform admin, `actorId` must be their uid. No update or delete. |
| `admin_invites/{email}` | Platform admins | Create or update a non-super invite as an admin. Super invites and deletes need the super claim or an owner email. |
| `platform_signals/{id}` | Platform admins | Nobody from the client. The Admin SDK records `health.generationFailures`, `health.quotaErrors`, and `health.sparksSpent`. |

Rules still need an owner deploy. Until that deploy, the API and the admin shell enforce the same role, suspension, ban, and soft-delete decisions. A blocked account is refused by `/api/admin/console` and `/api/export` when the service account can read the profile.

### Initial super admins

Three accounts are seeded as super admins. Each displays as Harry Seggu:

| Email | Why |
|---|---|
| `harry.seggu@gmail.com` | Harry Seggu |
| `shahzarrayyan123@gmail.com` | Firebase owner account |
| `harry@poketschool.ai` | Poket School address |

`resolveStaffRole` treats all three as `super_admin` before a custom claim exists. `callerIsSuper()` in `firestore.rules` allows the same three emails.

Set the claims with the bootstrap script. `ADMIN_BOOTSTRAP_EMAILS` is optional. When it is unset, the script still seeds these three addresses. When it is set, those addresses are added as well, and the three above are kept.

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
export ADMIN_BOOTSTRAP_EMAILS='harry.seggu@gmail.com,shahzarrayyan123@gmail.com,harry@poketschool.ai'
npx tsx scripts/bootstrap-super-admins.ts
```

The script looks each email up in Firebase Auth, writes `users/{uid}.role = admin` and `adminRole = super_admin`, and sets the custom claim `{ adminRole: 'super_admin', role: 'admin' }`. Each person signs out and in again so the ID token picks up the claim. An email with no Auth user is reported and the script exits non-zero.

Signing in at `/admin/login` also writes that profile when the rules allow it, then calls `sync-claims` if `FIREBASE_SERVICE_ACCOUNT` is on the server. Set `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` so the admin code can be emailed. Other `role: admin` accounts resolve as regular admins unless `adminRole` is set.

A super admin cannot remove the last super admin, and cannot demote or block their own super admin account. Another super admin has to do that.

## Teacher course studio

Teachers build a course in the studio at `/dashboard/teacher/courses/build`. The course document gains two optional fields:

| Field | Type | Notes |
|---|---|---|
| `subtitle` | string | Short line under the title. Omitted when blank. |
| `language` | string | Language code such as `en` or `ms`. |

`currency` on a studio course is `USD`. The price the student is charged is that USD amount. Local currency on the pricing step uses the existing admin pricing rates.

Allocation is a `targets` array. Any matching target can see the item. A target is a role (`students`, `teachers`, `parents`, `institutions`, `all`, `marketplace`) or a specific person, class, parent, or school (`user:{id}`, `class:{id}`, `parent:{id}`, `institution:{id}`). `classIds` repeats the class ids so security rules can match a cohort. `accessPolicy`, `audiences`, and `allocatedInstitutionIds` are written from that same list. `publishScope` is still stored as `institution`, `public`, or `marketplace` for older screens; a document that only has `publishScope` is treated as the matching target list. Book rows keep `allocateLibrary` and `allocateMarketplace` in step with the list. Announcements and calendar events store `targets` and still write the single `audience` field for older readers.

`users` plus `userIds` is a named student. `cohorts` is a class. `parents` is linked parents. `institutions` is a school. `all` is every signed-in person. `marketplace` is the public catalogue. A teacher publish that includes `marketplace` is stored as `pending_approval` with `isPublic: false`. An admin approval sets `published` and `isPublic: true`, and writes `courses/{id}/access_audit` plus `admin_audit` with action `course.approve`. A private allocation can be `published` without `isPublic`.

`createCourse` and `updateCourse` omit `undefined` before the write. Firestore rejects a document that still contains `undefined`.

### Ownership

A teacher or institution admin may create a course only when `ownerId` is their uid, and may update or delete it only while `ownerId` stays theirs. They cannot set a marketplace listing to `published`. An admin can edit any course. Enrolment, view, completion, and revenue counters still move by one without being the owner. Modules, lessons, grants, and the access audit on that course follow the same owner check.

### Questions

`courses/{courseId}/questions/{questionId}` holds a student question and the instructor reply.

| Field | Type | Notes |
|---|---|---|
| `authorId` | string | Must be the signed-in uid on create. |
| `authorName` | string | Display name. |
| `text` | string | The question. |
| `reply` | string | Written by the course owner. |
| `repliedBy` | string | Owner uid. |

An enrolled student can create a question. The course owner can read and reply. Rules need an owner deploy.

### Coupons

`coupon_codes/{code}` can be created by the course owner as well as an admin. `createdBy` must be the owner's uid, `code` must match the document id, and `discountPct` is from 1 to 100. The owner can set `active` or delete their own code. Redemption still only bumps `usedCount` and `redeemedBy`.

## modules.title

`createModule` strips a leading `Unit N:`, `Module N:`, or `Chapter N:` when `N` is that module's `unitNumber`, including a repeated prefix. The course tree still prints `Unit N:` once. Opening a course repairs stored titles that still have the duplicate.

## Poket Reads

Books are products on the same allocator as courses. A purchase writes the existing `alloc:marketplace:{bookId}` permission. A Reads plan writes `plan:reads` or `plan:reads-family` and sets the subscription through the existing Stripe apply path.

### library/{uid}/books/{bookId}

Written by the Stripe webhook when `checkout.session.completed` has `metadata.kind = book`.

| Field | Type | Notes |
|---|---|---|
| `bookId` | string | Same id as the document id. |
| `source` | string | `purchase` for a wallet checkout. |
| `purchasedAt` | timestamp | Server time of the grant. |

The parent path `library/{uid}` is the signed-in student. Clients do not write this collection. The Admin SDK does, from the webhook.

### Book targets

A book document (seeded in the app today, stored with the catalogue when that collection lands) may include `targets`, an array of `students`, `teachers`, `parents`, `institutions`, `all`, `marketplace`. That is the multi-select the allocator already uses for audiences. An empty list falls back to students and parents, plus institutions when the book is on the subscription shelf, plus marketplace when it is sold.

### daily_goals (reading)

Reading uses the shared `daily_goals` contract. `category` is `reading`. The focus timer in the reader is the source of `estimateMinutes` progress. Canonical fields stay `studentId`, `dateKey`, `title`, `category`, `estimateMinutes`, `deadline`, `status`. PR #55 returns that shape from `POST /api/reads/sessions`. It does not write the collection until the Admin SDK ledger is on.

### Parent reading report

Not a new collection. A parent report reads minutes already counted for a student and books whose stored progress is 100. The shape is `{ studentId, period, readingMinutes, booksFinished }`. Quiet hours stay out of `readingMinutes`, which is the existing session rule.

### Discussion spaces

A book gets one space id `book:{bookId}`. Age rating `18+` is the adult room. Every younger rating is the minor room. The two rooms are not mixed. Finishing a book or a reading streak suggests a win post. Community posts live in `posts` and stay unpublished until moderation is `allow`.

### Offline

The PWA cache name is `poket-reads-v1`. It stores the book page and the reader page in the Cache API on this device. There is no Firestore download record.

### media_assets

Book Studio writes the shared `media_assets` documents from `components/media` when a signed-in author adds a picture. `scopeId` is the book id. See the media section above for the fields.

### Push

A reading notice uses the shared push body: `recipientUid`, `category` (`goals` for a reading goal), `title`, `body`, optional `link`. `POST /api/push` verifies the signed-in caller and sends through `deviceTokens` (Expo and Web Push). Clients cannot read those documents. A missing sender configuration returns an error with `{ sent: 0, pruned: [] }`.

## Community, tutors, exams, and the creator store

The section below is the contract from `cursor/community-tutor-exam-de9a`. Signup may store `dateOfBirth` once. After that it is privileged. `ageTier` is never client-writable, including when the account is created. Direct messages in `messages` are adult-only. `deviceTokens` on this tip stay unreadable by clients; delivery uses the Admin SDK. The user document itself is still readable by any signed-in person so class dashboards can load a name. Age walls are enforced on `community_profiles`, `spaces`, `posts`, and `messages`.

# Schema changes — community, messaging, tutors, exams, store

Shared by the Next.js app and the Expo app. The mobile feed reads these collections directly, so the names and the rules below are the contract: `spaces`, `posts`, `comments`, `reactions`, `follows`, `reports`, `moderation_queue`, and `messages` (adult-only direct messages).

Both clients also call the HTTP routes under `/api`. The Admin SDK bypasses rules, so every route repeats the same checks as `lib/community/policy.ts`.

`users.ageTier` is server-set from `users.dateOfBirth`. Signup may store `dateOfBirth` when the account is created. Clients cannot change it afterwards, and they cannot write `ageTier` at all. A missing tier fails closed as `under13`. `yearGroup` and `subjects` stay on the profile and only narrow teen Explore. They cannot move someone into another band.

| `ageTier` | Who | Wall |
| --- | --- | --- |
| `under13` | under 13 | `class` and `school` spaces they are on. No Explore. No DMs. |
| `teen` | 13 to 17 | Own `class` and `school` spaces, plus Explore of a `year` space matching `yearGroup` or a `subject` space listed in `subjects`. No DMs. |
| `adult` | 18 and over | Open Explore (`visibility: tier`) and adult DMs in `messages`. |

Adults and minors cannot see, search, follow, or message each other. `under13` and `teen` are separate bands too. The only cross-band exception is a teacher or institution admin listed in `staffIds` on a **class** space or **class** channel. That exception does not cover search, follows, profiles, or direct messages.

Parents get `parent_controls` only. They cannot read the wall (`community_profiles`, `spaces`, `posts`, `comments`, `reactions`, `follows`), including their child's class. A parent who is an adult can still direct-message a teacher.

`platform_settings/feature_flags` turns each surface on or off. Missing keys default to on so a review build works; set a key to `false` to hide it. Flags: `community`, `messagingHub`, `tutorMarketplace`, `examCentre`, `creatorStore`, `snapAndSolve`, `lessonQa`.

## users (existing)

| Field | Who writes it | Notes |
| --- | --- | --- |
| `dateOfBirth` | server only (`POST /api/community/dob`) | `YYYY-MM-DD` |
| `ageTier` | server only | `under13` under 13, `teen` from 13 to 17, `adult` from 18 |
| `yearGroup` | the student, on their profile | string, for example `Year 10`. Teens explore a `year` space only when this matches. It does not change `ageTier` |
| `subjects` | the student, on their profile | string list. Teens explore a `subject` space only when it contains `spaces.subject` |

Also copied onto `public_profiles.ageTier` and `community_profiles.ageTier`. A public profile with no `ageTier` stays readable (legacy leaderboard). Once the field is set, only the same tier can read it, and the owner can always read their own. Community profiles are same-tier only, and parents cannot read them.

## users/{uid}/deviceTokens/{tokenId}

Owned by the notification sender. This change only reads the collection.

| Field | Notes |
| --- | --- |
| `token` | device push token |
| `platform` | `ios`, `android`, or `web` |
| `updatedAtMs` | client clock |

In-app notifications stay in `notifications`, with `push: true` when a token exists. This module does not call FCM.

## community_profiles/{uid}

| Field | Notes |
| --- | --- |
| `ageTier` | mirror of the user doc, server-written |
| `displayName`, `bio` | owner |
| `isPublic` | adults only; ignored for minors |
| `adultDmOptIn` | adults only; both people must opt in for a student-to-student DM |

## spaces/{spaceId}

| Field | Notes |
| --- | --- |
| `kind` | `class`, `school`, `year`, `subject`, `adult` |
| `ageTier` | `under13`, `teen`, or `adult`. The band that may read the space |
| `visibility` | `members` for class and school. `tier` for year, subject, and adult Explore |
| `year` | set on `kind: year`. Must equal the viewer's `yearGroup` |
| `subject` | set on `kind: subject`. Must be in the viewer's `subjects` |
| `memberIds`, `staffIds` | staff exception applies only when `kind == class` |
| `title`, `institutionId`, `classId` | |

Mobile queries that the rules allow as a list (every returned doc is readable):

- under-13: `ageTier == under13`, `kind in [class, school]`, `memberIds array-contains uid`
- teen class or school: `ageTier == teen`, `kind in [class, school]`, `memberIds array-contains uid`
- teen year: `ageTier == teen`, `kind == year`, `year == yearGroup`
- teen subject: `ageTier == teen`, `kind == subject`, `subject == <one subject>`
- adult Explore: `ageTier == adult`, `visibility == tier`
- class staff: `kind == class`, `staffIds array-contains uid`

A broader query fails closed, because Firestore rejects the whole list if one doc is unreadable. Parents must not run these queries.

## posts/{postId}

`spaceId`, `authorId`, `ageTier` (denormalised from the space: `under13`, `teen`, or `adult`), `kind` (`win` or `question`), `body`, `moderation` (`allow`, `hold`, `block`), `bestAnswerId`, `createdAtMs`.

Feed query: `spaceId == <id>` and `moderation == allow`, ordered by `createdAtMs`. Held or blocked posts are visible to the author and admins, not the room.

## comments/{commentId}

`postId`, `spaceId`, `authorId`, `ageTier`, `body`, `moderation`, `createdAtMs`.

Query: `postId == <id>` and `moderation == allow`. Readable when the viewer can see the space.

## reactions/{postId}_{uid}

`postId`, `userId`, `emoji` (one of `clap`, `thanks`, `idea`), `ageTier`.

Query: `postId == <id>`. Readable by someone who can see that post's space, and by the person who reacted. Class staff can read reactions on their class.

## follows/{followerId}_{targetId}

`followerId`, `targetId`, `followerAgeTier`, `targetAgeTier`. Create is rejected unless the tiers match, both match the stored user tiers, and the follower is not a parent. `under13` cannot follow a `teen` or an `adult`.

## reports/{reportId}

`reporterId`, `reporterAgeTier`, `targetType` (`post`, `comment`, `message`, `profile`, `resource`), `targetId`, `reason`, `status` (`open`, `resolved`), `createdAtMs`.

## moderation_queue/{id}

One queue for community, messages, lesson Q&A, and snap. `surface`, `authorId`, `ageTier`, `text`, `decision`, `reasons`, `status` (`open`, `approved`, `rejected`), `subjectId`, `createdAtMs`.

## parent_controls/{studentId}

Written by a linked parent. This is the parent surface, not the wall. `communityEnabled`, `messagingEnabled`, `snapEnabled`, `quietStart`, `quietEnd` (`HH:MM`), `timeZone`. Explore stays off for under-13 accounts even if a parent asks for it. Teen Explore stays inside year and subject.

## channels/{channelId}

| Field | Notes |
| --- | --- |
| `kind` | `class`, `parent`, `announcement`, `dm` |
| `ageTier` | |
| `memberIds`, `staffIds` | staff read a `class` channel across tiers |
| `title`, `classId`, `institutionId` | |
| `quietHoursEnforced` | true for minors |

`dm` channels are adult-only, same rules as `messages`. Under-13 and teen students have no direct messages. Adult student DMs require `adultDmOptIn` on both profiles.

## channels/{channelId}/messages/{messageId}

Class, parent, and announcement traffic. Not the mobile DM inbox.

`senderId`, `body`, `bodyTranslated`, `language`, `moderation`, `createdAtMs`, `visibleAtMs` (quiet hours delay delivery to under-13 and teen members).

## messages/{messageId}

Adult-only direct messages. The Expo app reads this collection. Both `fromId` and `toId` must be `adult`. A minor cannot create or read a document here, including a message a teacher tried to send them. Teachers reach a class through the class channel.

`fromId`, `toId`, `body`, `read`. Create also requires staff, a parent, or `adultDmOptIn` on both community profiles when both people are students.

## tutor_profiles/{uid}

Adults only. `verificationStatus` (`pending`, `verified`, `rejected`), `bio`, `subjects`, `hourlyCents`, `currency`, `commissionBps` (default 2000), `ageTier`, `slots` (`{ startAtMs, minutes }`, up to 14 future times). Editing a verified profile keeps `verified`. Bookings from minors are refused. When slots exist, the start time must match one and must not clash with another open booking.

## tutor_bookings/{id}

`tutorId`, `studentId`, `kind` (`one_to_one`, `group`), `seats`, `startAtMs`, `minutes`, `status` (`pending_payment`, `booked`, `completed`, `cancelled`), `liveClassId` (group bookings create a `live_classes` doc), `amountCents`, `commissionCents`, `tutorCents`, `paymentId`.

Payment goes through `WalletPort` in `lib/wallet.ts`. The stub records a pending charge until the wallet agent replaces it.

## tutor_reviews/{id}

`bookingId`, `tutorId`, `reviewerId`, `rating` (1–5), `body`, `reviewerLabel` (minors are stored as "Student").

## exam_papers/{id}

`board`, `subject`, `year`, `title`, `license` (`licensed` or `teacher_upload` only), `uploadedBy`, `minutes`, `questions` (`{ id, prompt, marks, answer }`), `status`.

Clients may upload `teacher_upload` only. Licensed papers are inserted by the server.

## mock_attempts/{id}

`studentId`, `paperId`, `startedAtMs`, `endsAtMs`, `submittedAtMs`, `answers`, `score`, `maxScore`, `predictedGrade`. The clock is server-side. Late submits are rejected.

## guidance_profiles/{uid}

`interests`, `predictedGrades`, `suggestions` (university and career cards from `lib/community/guidance.ts`).

## creator_resources/{id}

`kind` (`note`, `worksheet`, `template`), `title`, `body` (markdown from the shared editor), `authorId`, `status` (`draft`, `pending`, `approved`, `rejected`), `priceCents`, `audiences`.

`audiences` stores the shared allocation targets: role chips (`students`, `teachers`, `parents`, `institutions`, `all`, `marketplace`) and specific tokens (`user:{id}`, `class:{id}`, `parent:{id}`, `institution:{id}`). An empty list leaves an approved resource visible. A named student still gets `alloc:resource:{id}` via `allocResource()` in `lib/entitlements.ts`. Drafts stay with the author and admins. Marketplace listing requires `approved`.

## snap_sessions/{id}

`userId`, `context` (`study` or `assessment`), `blocked`, `blockReason`, `ocrText`, `steps`, `similar`, `createdAtMs`.

Always written, including blocked attempts. Blocked when the caller is in an assessment, has an open mock, or a parent turned snap off. No explanation is returned in those cases.

## lesson_questions/{id}

`courseId`, `lessonId`, `authorId`, `body`, `aiSuggestedReply`, `publishedReply`, `moderation`, `status` (`open`, `answered`, `rejected`), `createdAtMs`.

## Routes

| Method | Path | Flag |
| --- | --- | --- |
| POST | `/api/community/dob` | community |
| POST | `/api/community/moderate` | community |
| GET | `/api/community/spaces` | community |
| POST | `/api/community/spaces` | community |
| GET | `/api/community/feed` | community |
| POST | `/api/community/post` | community |
| POST | `/api/community/comment` | community |
| POST | `/api/community/react` | community |
| POST | `/api/community/follow` | community |
| POST | `/api/community/report` | community |
| POST | `/api/community/best-answer` | community |
| GET | `/api/community/search` | community |
| GET/POST | `/api/community/parent-controls` | community |
| GET | `/api/messaging/channels` | messagingHub |
| POST | `/api/messaging/channels` | messagingHub |
| POST | `/api/messaging/send` | messagingHub |
| POST | `/api/messaging/announce` | messagingHub |
| GET/POST | `/api/tutors/profile` | tutorMarketplace |
| POST | `/api/tutors/verify` | tutorMarketplace |
| GET | `/api/tutors/list` | tutorMarketplace |
| GET | `/api/tutors/mine` | tutorMarketplace |
| GET | `/api/tutors/pending` | tutorMarketplace |
| POST | `/api/tutors/book` | tutorMarketplace |
| POST | `/api/tutors/review` | tutorMarketplace |
| GET/POST | `/api/exam-centre/papers` | examCentre |
| POST | `/api/exam-centre/start` | examCentre |
| POST | `/api/exam-centre/submit` | examCentre |
| GET/POST | `/api/exam-centre/guidance` | examCentre |
| GET/POST | `/api/store/resources` | creatorStore |
| POST | `/api/store/submit` | creatorStore |
| POST | `/api/store/moderate` | creatorStore |
| POST | `/api/store/allocate` | creatorStore |
| POST | `/api/snap/solve` | snapAndSolve |
| GET/POST | `/api/lessons/qa` | lessonQa |
| GET | `/api/moderation/queue` | community |
| POST | `/api/moderation/resolve` | community |

## Payments

Collections written by the unified checkout. Clients cannot read or write the money collections. The Admin SDK bypasses the rules.

| Collection | Purpose |
| --- | --- |
| `platform_settings/payments` | Gateway vendor, SST rate, supplier TIN and BRN, teacher and affiliate share in basis points. |
| `platform_settings/feature_flags` | Community switches live on the document. Payment overrides live in `overrides` so a payments save does not wipe `community` or `tutorMarketplace`. |
| `platform_settings/ai_spend` | Monthly caps and estimated spend for OpenRouter and Gemini. |
| `platform_secrets/{slotId}` | `{ value, masked }`. Admin API returns `masked` only. |
| `checkouts/{checkoutId}` | Server quote, method, provider mode, status. Id is `chk_` plus a hash of the idempotency key. |
| `payment_events/{provider:eventId}` | Webhook claim. A processed event is not applied twice. |
| `payment_links/{paymentIntentId}` | Maps a Stripe payment intent back to a checkout. |
| `transactions/{checkoutId}` | Receipt row: subtotal, discount, tax, total, invoice id, status. |
| `wallets/{uid}` | `{ balances: { USD, MYR } }` in minor units. |
| `wallets/{uid}/ledger/{entryId}` | One entry per checkout. The id is the checkout id, so a retry cannot debit twice. |
| `invoices/{checkoutId}` | SST invoice and a MyInvois document. Status is `ready` or `missing_supplier`. Nothing is submitted. |
| `subscriptions/{uid}` | Active plan, MRR on the buyer, family status on a sibling seat, Reads sku. |
| `coupons/{code}` | Percent off, affiliate id, revenue share, redemption count. |
| `affiliate_ledger/{id}` | Commission earned or reversed. |
| `payouts/{id}` | Teacher share of a course, ebook, or tutoring checkout. |
| `refund_requests/{checkoutId}` | Live gateway refund requested. Entitlements stay until the gateway confirms. |
| `disputes/{disputeId}` | Stripe dispute. |
| `library/{uid}/books/{bookId}` | Reads purchase. `{ bookId, source: 'purchase' }`. The buyer also receives `alloc:marketplace:{bookId}`. |
| `books/{bookId}` | Optional shelf price override: `title`, `status`, `priceUsd`, `priceRM`. |
| `tutor_offers/{id}` | Teacher-listed session. Checkout kind `booking`. |
| `bookings/{checkoutId}` | Paid tutoring session. |
| `resource_purchases` | Paid resource. The file URL on the resource stays as it is today. |

User fields written by the server: `permissions` (`alloc:marketplace:{id}`, `plan:reads`, `plan:reads-family`) and `stripeAccountId` (Connect). Both are privileged and rejected on client writes.

Reads plans are `reads` at $9 a month and `reads-family` at $15. Annual is ten times the monthly price and is billed in USD on a card. Ringgit books use the admin FX quote (`quoteCheckout`) when present, otherwise the shelf RM price. Touch 'n Go is gateway method `tng`, not a Stripe metadata flag. Book and Reads purchases share `POST /api/stripe/create-checkout` and `POST /api/payments/checkout`. FPX and GrabPay stay on the one-time MYR Stripe session.

## Account modes

`users/{uid}.roles` is the list of roles one login holds: `student`, `teacher`, and `parent`. `role` stays the original primary value so older readers keep working. A teacher or parent document also includes `student`, which is their personal learner space. Admin and `institution_admin` are not added to that list and are not offered in the switch.

The open dashboard is `poket-active-mode` in the browser (`student`, `teacher`, or `parent`). Firestore rules do not read it. `hasRole(name)` is true when `role` is that name or `roles` contains it. `isAdmin()` still requires `role == 'admin'`, so the array cannot grant the admin console. Admin sign-in stays on `/admin/login` with the verification code.

A teacher or parent may write `roles` to add `student`. A learner may add `teacher`. The write cannot add `admin` or `institution_admin`, and it cannot drop a role they already hold. Marketplace course publishing is unchanged: a teacher still cannot set a public marketplace listing.

Learning mode reads that person's own enrolments, progress, certificates, and Sparks. It does not render classes they own or children they monitor. Those stay on the teaching and parent dashboards.

Rules still need an owner deploy.

## Profile and settings

`/dashboard/profile` is My profile & settings for every role. The account menu in each dashboard opens it.

A person may update only the fields in `selfServiceFields()` in `firestore.rules` (the same names as `SELF_SERVICE_FIELDS` in `lib/account-settings.ts`). That list includes name, display name, bio, photo, country, timezone, phone, language, currency, notification preferences, privacy, a teacher instructor profile, two-factor on/off, session revocation, and a deletion request. It does not include role, staff role, entitlements, wallet balance, XP, age tier, or date of birth.

`users/{uid}/private/payout` holds payout method, email, account name, bank, and the last four digits. Only that user can read or write it. The user document stays readable by any signed-in person so class screens can show a name.

`deletionRequest` is `{ requestedAt, scheduledFor }` with a 14-day gap. `sessionsRevokedAt` is a millisecond timestamp. Devices that started earlier sign out. `twoFactorEnabled` asks for the existing email code at password sign-in, and at Google sign-in when it is on. Admin MFA is unchanged.

Profile photos use the shared media helpers and Firebase Storage at `media/{uid}/{fileName}`. `storage.rules` allows that user to write an image under 5 MB. Rules still need an owner deploy.

Lesson rewards still update `sparksBalance` and `xp` through `walletProgressUpdate()`. A profile save cannot change those fields in the same write.

`childIds` is not in `selfServiceFields()`. A parent can only remove ids from their own list. A student can add only their own id, and only after `parent_links/{parentId}_{studentId}` is `approved`.

## Parent links and child controls

| Path | Who can write |
|---|---|
| `parent_links/{parentId}_{studentId}` | The parent creates `pending` (email request). The student sets `approved` or `rejected`. An accepted invite lets the student create the row already `approved`. |
| `parent_invites/{code}` | The parent creates `open`. Any signed-in person can get one code. Only the parent can list their codes. The student sets `accepted` and their own id. The parent can set `revoked`. |
| `users/{parentId}/child_controls/{childId}` | The linked parent writes weekly report email, weekly in-app alert, screen-time minutes (0–1440), Sparks daily limit, purchase approval, and teacher messages (`all`, `digest`, `off`). The child can read. |
| `users/{parentId}/private/billing` | The parent only. Brand, last four digits, expiry, and the name on the card. A full card number is never stored. |
| `purchase_requests/{id}` | A linked child creates `pending`. That parent sets `approved` or `rejected`. |

A parent may update a child's user document only when `ageTier` is exactly `under13` and the child is already in `childIds`. The allowed fields are name, display name, bio, avatar, and photo path. A missing age tier is not editable. The photo file is stored at `media/{parentUid}/…`, because storage rules follow the signed-in user.

Invoice reads include a parent whose `childIds` contain `studentId`. Other students' invoices stay closed.

Rules still need an owner deploy.

## Scope B additions

These fields and collections sit on top of the contract above. Mobile DailyGoal documents stay in `daily_goals`. New fields are optional. An older app ignores fields it does not know. Push for these events uses the shared sender and the categories `goals`, `flags`, `attendance`, and `digests`.

## `daily_goals`

Required fields stay: `studentId`, `dateKey` (local `YYYY-MM-DD`), `title`, `category` (`study|revision|practice|reading|other`), `estimateMinutes`, `deadline` (`HH:mm`), `status` (`not_started|in_progress|completed|overdue|excused`).

Optional additions:

| Field | Meaning |
| --- | --- |
| `targetKind` | `free_text`, `unit`, `lessons`, `revision`, `quiz_score`, or `studio` |
| `unitId`, `unitTitle`, `lessonIds`, `freeTextTarget` | What the goal covers |
| `startDate`, `endDate`, `recurrence` | Planner window. Recurrence is `none`, `daily`, `weekdays`, or `weekly` |
| `checklist` | `{ id, label, done }[]` |
| `reminderMinutes`, `reflection`, `progress`, `focusMinutes` | Reminder, reflection, 0–100 progress, logged focus |
| `source` | `student`, `parent`, or `ai` |
| `suggestedBy`, `suggestedByName`, `parentNote` | Parent suggestion |
| `cosignedBy`, `cosignedAt` | Parent co-sign. Students cannot write these |
| `sparksBonus`, `sparksAwarded` | Server-only award. Students cannot write `sparksAwarded` |
| `completedLessonIds`, `quizScore` | Auto progress inputs |
| `courseId`, `courseLabel` | Already optional on the mobile shape |

Parents may set `status` only to `excused`, plus `excuseReason`, `excusedBy`, `notifiedMissed`, co-sign fields, `parentNote`, and `reactions` (`{ parentId, emoji, at }[]`). Students cannot write reactions.

Further optional fields: `priority` (`low|medium|high`), `reminderTime` (`HH:mm`), `quizTarget`, `studioTask`, `pomodoroWork`, `pomodoroBreak`, `reflectionPrompt`, `reward`, `lessonTitles`, `shareWithTeachers`, and `teacherIds`. A goal is readable by the student, a linked parent, an admin, or a teacher whose id is in `teacherIds` while `shareWithTeachers` is not false. `deviceTokens.provider` may be `expo`, `webpush`, or `fcm`. The document shape is unchanged. FCM HTTP v1 sends when `FCM_SERVICE_ACCOUNT` is set (JSON with `client_email`, `private_key`, and `project_id`). If that is unset, a legacy `FCM_SERVER_KEY` still sends. If neither is set, that token is skipped and Expo or Web Push on other devices still go out. A 404 from FCM prunes the token.

`users/{parentId}/child_controls/{childId}` may include optional `goalPush` (bool) and `digestCadence` (`off|daily|weekly`). Older saves that omit them still pass the rules.

`analytics_snapshots/student_{id}` may also store chart series (`studySeries`, `topics`, `bloomTopics`, `courseProgress`), `sparksSpent`, `summary`, `dropOffs`, and `teacherIds`. `assignments.bloom` and lesson `aiOutputs` flashcard, quiz, and assignment prompts may include a Bloom level. Older documents that omit these fields still read. The weekly parent digest appends headline metrics from the snapshot when one exists.

## New collections

| Collection | Who writes | Notes |
| --- | --- | --- |
| `focus_sessions` | The student | Planned and actual minutes for a goal |
| `study_events` | The student, create only | Minutes, weekday, hour, source |
| `mood_checkins/{studentId_dateKey}` | The student | Mood 1–5 |
| `goal_suggestions` | A linked parent creates `pending`. The student sets `accepted` or `declined` | |
| `analytics_snapshots` | Admin SDK only | Client read is scoped. Document id `student_{id}` includes `subjectStudentId`. Optional `teacherIds` lets those teachers read the same aggregate. Clients still cannot write it. |
| `integrity_cases` | A teacher, with `automaticPenalty == false` | Students may add only `appealNote`, `appealAt`, `appealStatus: submitted`. `audit` is append-only |
| `academic_calendars`, `calendar_drafts` | Teachers | Drafts are reviewed before they become `calendar_events` |
| `bloom_tags` | Teachers | Bloom level on a prompt or lesson |
| `report_schedules` | Teacher or parent owner | |
| `published_reports/{token}` | Teacher | Public `get` for the QR. `list` is denied. Comments stay off this document |
| `report_cards` | Teacher creates. A linked parent may set `acknowledgement` to `acknowledged` | |

`attendance` records may include `note` and `source` (`automatic` or `manual`). Holidays are excluded from the attendance rate.

`attendance_records` also store `studentIds`, `parentIds`, `dateKey`, and `institutionId` so a student, a linked parent, the marking teacher, and that school's institution admin can read the register. Older rows that omit `studentIds` no longer appear in the student query. `absence_notes` are created by a linked parent (`status: submitted`, reason 1–500 characters) and a teacher may set `status` to `accepted`. `report_exports` is an append-only audit of PDF, CSV, and XLSX downloads (`actorId`, `role`, `format`, `metricIds`, `scopeId`, `at`). `grades` are readable by a linked parent. `report_schedules.cadence` may be `daily`, `weekly`, or `term`.

`analytics_snapshots/student_{id}` may include `behaviourBoard` (streak calendar, session buckets, funnel, moods, badges, timeline, and teacher notes) plus `institutionId` and `behaviourAlertedOn`. The nightly job writes that board and notifies parents and teachers when study time drops or cramming is flagged. `behaviour_records` are readable by the student, a linked parent, the teacher who wrote the note, a listed teacher, an admin, or the institution admin for `institutionId`. `mood_checkins` may include `effort` (1–5). A mood is readable by the student, a linked parent, an admin, a listed teacher, or that school's institution admin.

`concern_flags` are review signals (`at_risk`, `study_drop`, `missed_goals`, `chronic_absence`, `wellbeing`) with `automaticPenalty: false`. A linked parent, the student, and the listed teacher can read them. An institution admin can read every kind except `wellbeing`. `reexam_responses` are created by the student and read by that student, a linked parent, and the teacher on the case. `notify_settings/{userId}` stores quiet hours for that person. `notify_settings/school_{institutionId}` is written by that school's institution admin. `report_templates` belong to one institution. A confirmed integrity case may add `integrityNote` on the private `report_cards` document. The public `published_reports` card still omits comments and integrity notes. Report-card acknowledgement may include `reply` and `signatureName`. Assignment and exam submissions may include `integritySignals` (paste count, large insertion size, focus losses, seconds to answer).

Rules still need an owner deploy.

Sparks amounts for goals live only in `lib/sparks.ts` (`GOAL_ON_TIME_BONUS`, `GOAL_STREAK_BONUS`). The ledger type is `earn`.

## Institutions

`institutions/{id}` is the academy. The mobile app reads it. It does not invent a second school record.

| Field | Meaning |
| --- | --- |
| `name`, `domain`, `adminId` | Display name, email domain, and the institution admin |
| `studentCount`, `teacherCount` | Counts shown on the academy |
| `status` | `active`, `pending`, or `suspended` |
| `type` | `school`, `university`, `corporate`, or `government` |
| `country`, `state` | ISO country and the subdivision used by self-join |
| `listedForSelfJoin` | Super admin lists the academy for Independent vs institution signup |
| `plan` | `starter`, `team`, `enterprise`, or `oem` |
| `parentInstitutionId`, `isolateData` | A sub-academy. Its data stays in its own subcollections |
| `subdomain`, `previousSubdomains`, `customDomain`, `customDomainStatus`, `customDomainMessage` | Host label and an optional school-owned hostname |
| `branding` | White-label name, logo, colours, certificate issuer, invite copy, and mobile icon. Absent values fall back to Poket School |
| `signupPolicy`, `allowedEmailDomains` | `open`, `invite`, or `domain` |
| `catalogueVisibility`, `publicCatalogueIds` | `private`, `curated`, or `public` |
| `defaultLocale`, `require2fa`, `passwordMinLength`, `passwordRequireSymbol`, `sessionTimeoutMinutes` | Academy sign-in policy |
| `features` | Optional flag map |
| `leaderboardVisible` | `academy`, `group`, or `off`. `leaderboard` is a small display list |
| `publishedPages` | `{ slug, title, body }[]` for the academy site |

`users.yearGroup` and `courses.yearGroup` stay the stored field names. The app shows them as a level (Primary, Lower Secondary, IGCSE, A-Level). They are not a year number.

`institutions/{id}/email_templates/{kind}` holds the institution’s letters. `kind` is `otp`, `notification`, `invoice`, or `welcome`. Fields are `subject` and `body`, with `{{name}}` style placeholders. The institution admin saves them through `POST /api/institution/email-templates`. Clients do not write this subcollection. WhatsApp uses its own Cloud API templates (`poket_otp`, `poket_notice`) and falls back to this email when WhatsApp is unset or fails.

`institutions/{id}/billing/current` is the subscription state. `institutions/{id}/sparks_pool/current` is below.

`activity_log` may include optional `institutionId`. The institution screen reads `GET /api/audit?scope=institution`. The query is a single equality on `institutionId` (no composite index). Clients cannot write `activity_log`.

`courses.placement` is optional: `marketplace` (`hidden|pending|approved|rejected`), `featured`, `core`, `levels` (`primary_secondary`, `igcse_alevel`, `professional`), and `institutionIds`. `featured` on the course is the featured-spot flag. `allocatedInstitutionIds` lists the same institutions. A core programme needs a level. An institution course is not listed on the public marketplace until that institution has approved it for the library. The super admin sets this on `/dashboard/admin/placement`.

Rules for these paths are unchanged. Email templates, the activity log, and help articles are written with the Admin SDK.

## Sparks pools

`institutions/{id}/sparks_pool/current` stores `topUps` and `allocated`, both numbers. The pool is shared by that school. A missing document reads as zeros.

Sparks are learning credits. They cannot buy a marketplace course. Goal bonuses stay in `lib/sparks.ts`. This note does not change how Sparks are earned.

## AI teachers

The catalogue is code in `lib/ai-teachers.ts`, not a Firestore collection. Routes are `/ai-teachers` and `/ai-teachers/{teacherId}/session`. Studio uses `/dashboard/studio/teachers` and `/dashboard/studio/teachers/{teacherId}`.

| Field | Meaning |
| --- | --- |
| `id`, `name`, `title`, `subjects`, `category` | Who the teacher is |
| `status` | `live` or `coming-soon` |
| `iframeUrl`, `avatarUrl`, `accentColor`, `iconKey` | Session frame and portrait |
| `voice`, `voiceStyle` | Gemini TTS voice and delivery |
| `tagline`, `bio`, `education`, `teachingStyle`, `languages`, `specialties`, `sampleQuestions`, `trainedOn` | Profile copy |
| `yearsExperience` | Years spent teaching. Show it as experience. The level names stay Primary, Lower Secondary, IGCSE, and A-Level |

## Translation

`content_translations/{id}` is written by the server. The id is the first 40 hex characters of the sha256 of the cache key. Fields:

| Field | Meaning |
| --- | --- |
| `contentId` | Source content id |
| `language` | Target language code |
| `fields` | Map of string field name to translated string |
| `updatedAt` | Milliseconds |

Clients do not read or write this collection. The app asks the server, which returns the translated strings. Quiz scoring uses option ids (`lib/quiz.ts`), not the translated label, so a language change cannot change a mark.

## Studio tools

ET AI Studio desk tools are requested at `POST /api/ai/studio-desk`. There is no new client-writable studio collection. Sparks are spent on the user’s `sparksBalance` and recorded in `users/{uid}/spark_transactions`.

| Tool | Sparks |
| --- | --- |
| `teacher-toolkit` | 15 |
| `parent-explainer` | 8 |
| `research-helper` | 10 |

Toolkit kinds are `pack`, `lesson-plan`, `worksheet`, `rubric`, `differentiated`, and `exit-ticket`. Research Helper summarises sources. It does not write the assignment, the essay, or the answers.

Desk routes live under `/dashboard/studio` (including ET Maths, exam prep, and essays). Those existing collections are unchanged.

## Help articles and MyInvois

`help_articles/{id}` is Admin SDK only. Fields are `title`, `body`, `published`, `updatedAt`, and `updatedBy`. The public site reads published articles through `GET /api/help`. ET AI answers from those articles at `POST /api/help/ask` and does not call a model. A weak match tells the person to open the existing `support_tickets` helpdesk ticket. Clients do not write `help_articles`.

`myinvois_queue/{invoiceId}` is Admin SDK only. A paid invoice is queued from the payment engine. Status is `not_configured`, `queued`, `submitted`, `retry`, or `failed`. `not_configured` is the clear no-op when `MYINVOIS_CLIENT_ID`, `MYINVOIS_CLIENT_SECRET`, or `TIN` (or `MYINVOIS_TIN`) is unset: nothing is sent to LHDN. `MYINVOIS_ENV=production` uses the live host. Anything else uses the sandbox. The daily insights cron retries `retry` rows, up to five attempts. Clients cannot write this collection.

WhatsApp Cloud API uses `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. OTP and notifications try the template first and fall back to email. Push adds the FCM v1 path above beside Expo and Web Push. None of these collections need a new client rule. Rules still need an owner deploy only for changes that already said so. This note does not deploy rules or indexes.

## Unit tests and visual blocks

For the mobile app. Rules and indexes are listed here and in `firestore.indexes.json`. They are not deployed by this change.

`courses.unitTestPassMark` is an optional number. Missing means 70. `courses/{courseId}/modules.unitTestPassMark` overrides that course mark for one module.

A unit test is a lesson with `lessonType: "unit_test"` and `isUnitQuiz: true`.

| Field | Type | Notes |
|---|---|---|
| `unitTest.versionA` / `unitTest.versionB` | array | Question papers. Attempt 1 uses A, attempt 2 uses B, then they alternate. |
| `unitTest.questions[].prompt` | string | |
| `unitTest.questions[].options` | array | `{ id: "opt:0", text }`. Grade on `answerId`, not the label. |
| `unitTest.questions[].marks` | number | Weighted. Missing or 0 counts as 1. |
| `unitTest.questions[].bloom` | string | Remember, Understand, Apply, Analyse, Evaluate, Create. |
| `unitTest.questions[].lessonId` | string | Lesson to review when this question is missed. |
| `unitTest.intelligence` | string | Optional. Linguistic, Logical-Mathematical, Spatial, Bodily-Kinaesthetic, Musical, Interpersonal, Intrapersonal, Naturalistic. |

`unit_quiz_attempts` gains optional fields. Older mastery rows omit them.

| Field | Type | Notes |
|---|---|---|
| `kind` | string | `unit_test` |
| `version` | string | `A` or `B` |
| `score` | number | Marks awarded. |
| `maxScore` | number | Marks available. |
| `percentage` | number | Rounded percent. |
| `marksAwarded` / `marksMax` | number | Same marks as `score` and `maxScore`. `total` matches `maxScore`. |
| `responses[].marks` / `marksAwarded` / `bloom` / `lessonId` | | Per question. `sourceLessonId` is still set to the same lesson. |
| `timeTakenSeconds` | number | Already stored. |
| `recommendedLessonIds` | string[] | Lessons to show as Review these lessons. |

A fail keeps the unit test locked until each id in `recommendedLessonIds` has `enrollments.lessonCompletedAt[lessonId]` greater than that attempt's `completedAt`. Completing a lesson again updates that map. A pass still unlocks the next module.

`lesson.visualBlocks[]` holds Mind Map image (`mindmapImage`), comic (`comic` with `panels`), infographic (`infographicImage`), unit revision poster (`revisionPoster`), gallery (`gallery` with `items`), and audio chant (`audioChant` with `transcript`). Each block has required `alt`. Comic panels and gallery items have their own `alt`. `intelligence` is optional. Publish is refused while alt text is blank.

New composite indexes, not deployed: `unit_quiz_attempts` on `courseId + unitId + completedAt`, and `courseId + completedAt`. Current class and parent reads stay single-field on `courseId` or `studentId`.

Import shape for the curriculum upload: `docs/unit-test-schema.md`.

## Unit test marking, unlocks, and certificates

For the Poket School mobile app. Mirror these fields and routes. Rules are unchanged and are not deployed. Do not deploy the indexes in `firestore.indexes.json`.

### Unit test paper

A unit test is a lesson (`courses/{courseId}/modules/{unitId}/lessons/{lessonId}`) with `lessonType: "unit_test"` and `isUnitQuiz: true`.

| Field | Type | Notes |
|---|---|---|
| `finalAssessment` | boolean | Course final. Optional. An assessment with `assessmentConfig.certificateOnPass: true` or `assessmentConfig.kind: "mock_exam"` is also a final. |
| `unitTest.versionA` / `unitTest.versionB` | array | Attempt 1 is A, attempt 2 is B, then they alternate. Further versions would be added as `versionC` and so on; the marker currently serves A and B. |
| `unitTest.questions[].prompt` | string | |
| `unitTest.questions[].options` | array | `{ id: "opt:0", text }` |
| `unitTest.questions[].answerId` | string | Option id. Grade this, not the label. |
| `unitTest.questions[].marks` | number | Missing or 0 counts as 1. |
| `unitTest.questions[].bloom` | string | Remember, Understand, Apply, Analyse, Evaluate, Create. |
| `unitTest.questions[].lessonId` | string | Lesson to review when the question is missed. |

`courses.unitTestPassMark` is the course pass mark. Missing means 70. `modules.unitTestPassMark` overrides it for that unit's test only. The certificate uses the course pass mark, not the unit override.

### Attempts

Collection `unit_quiz_attempts`. Written by the server. A client score is ignored.

| Field | Type | Notes |
|---|---|---|
| `studentId`, `courseId`, `unitId`, `lessonId` | string | |
| `kind` | string | `unit_test` |
| `version` | string | `A` or `B` |
| `attemptNumber` | number | |
| `score` | number | Marks awarded. |
| `maxScore` | number | Marks available. |
| `percentage` | number | Rounded percent (`score` / `maxScore`). |
| `total`, `marksAwarded`, `marksMax` | number | Same marks. `total` and `marksMax` match `maxScore`. `marksAwarded` matches `score`. |
| `passed` | boolean | `percentage` against that unit's pass mark. |
| `timeTakenSeconds` | number | |
| `responses[]` | array | `question`, `selected` (option id), `correct`, `marks`, `marksAwarded`, `bloom`, `lessonId` |
| `recommendedLessonIds` | string[] | Distinct lesson ids from missed questions. |
| `completedAt` | timestamp | |

Read attempts with `studentId` + `lessonId` (existing index). Do not query the new `courseId` composites until they are deployed.

### Unit progress and unlocks

On a pass, the server updates `courses/{courseId}/enrollments/{studentId}`:

| Field | Type | Notes |
|---|---|---|
| `completedLessons` | string[] | The unit test lesson id is added. |
| `lessonCompletedAt.{lessonId}` | number | Millis. A later review writes a newer millis and can unlock a retake. |
| `unitProgress.{unitId}` | object | `{ passed: true, score, lessonId, passedAt }`. `score` is the percentage. |
| `unlockedUnitIds` | string[] | The next module id, when there is one. |

There is no unlock route. A pass returns the next module id as `unlockedUnitId` on `POST /api/unit-tests/mark`. A fail does not unlock the next unit. The unit test stays locked until each id in `recommendedLessonIds` has `lessonCompletedAt` greater than that attempt's `completedAt`. The next attempt then uses the other version.

`unitProgress.{unitId}.score` is the percentage. Attempt `score` is marks awarded. They are different fields.

Passing a unit does not award a certificate.

### Certificates

Collection `certificates`. One course certificate per student, keyed in `certificate_keys` as `{studentId}__{courseId}__course`.

Issuance is server-only. The Admin SDK writes a certificate after the final assessment and every unit are passed. Clients only read issued certificates. They never create, update, or delete one.

`firestore.rules` already says so. That rule is listed in the repo and is not deployed by this change:

```
match /certificates/{certId} {
  allow get: if true;
  allow list: if isSignedIn() && (
    resource.data.studentId == request.auth.uid
    || isTeacherOrAdmin()
    || linkedTo(resource.data.studentId)
  );
  allow create, update, delete: if false;
}
```

Public `get` is what makes `/verify/[certificateId]` work without a login. `list` is the signed-in student, a teacher or admin, or a linked parent.

Issued only when both are true:

1. A final assessment attempt has `percentage` greater than or equal to the course pass mark (default 70).
2. Every unit that has a unit test has an attempt with `passed: true`.

Finishing lessons does not issue one. Passing a unit that is not the final does not issue one, unless the final was already passed and this pass is the last unit still outstanding.

Fields on `certificates/{id}`:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Document id. This is the certificate ID. |
| `verifyUrl` | string | Public verify page. Path only: `/verify/{id}`. Clients prefix the public site origin (`NEXT_PUBLIC_SITE_URL`, fallback `https://poketschool.ai`). The page is `app/verify/[uuid]`. |
| `qr` | string | Data the QR encodes. The same path as `verifyUrl`. Not an image and not an absolute URL. |
| `studentNumber` | string | Institution student number, when the server has one on the user profile. Omitted when there is none. |
| `name` | string | Student name printed on the certificate. Also stored as `studentName`. |
| `course` | string | Course title. Also stored as `courseTitle`. |
| `level` | string | Level name only. Primary, Lower Secondary, IGCSE, A-Level, and the other named levels. Never a year number. |
| `score` | number | Best final-assessment percentage. |
| `issuedAt` | timestamp | When the server issued it. |

Also stored for the web app: `studentId`, `courseId`, `passMark`, `kind` (`course`), `status` (`valid` or `revoked`). PDF download is `GET /api/certificates/{id}/pdf`.

API responses that return a certificate also include `absoluteVerifyUrl`, the origin plus `verifyUrl`. That absolute URL is not stored.

Older rows with `kind: "module"` were issued for a finished module. They may have `studentName` and `courseTitle` and no `verifyUrl`, `qr`, `name`, or `course`. New issuance does not create those rows. Read `name` then `studentName`, and `course` then `courseTitle`.

If SMTP is configured (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`), the server emails the PDF link. If it is not configured, issuance still succeeds and the email is skipped.

### `POST /api/unit-tests/mark`

This is the only marker. Signed-in student. The server loads the paper and grades it. Unlock is `unlockedUnitId` on this response. There is no separate unlock route.

`POST /api/platform/unit-quiz` is deprecated for unit tests. If a unit test is posted there, the server delegates to this same marker and returns this same shape. Mastery quizzes that are not unit tests still use `/api/platform/unit-quiz`. Those do not award a certificate and do not return `unlockedUnitId`.

Request:

```json
{
  "courseId": "course-id",
  "unitId": "module-id",
  "lessonId": "lesson-id",
  "answers": [{ "questionId": "q1", "selected": "opt:1" }],
  "timeTakenSeconds": 120
}
```

`score`, `passed`, and `percentage` on the request are ignored. `selected` is the option id.

Response:

```json
{
  "attemptId": "attempt-id",
  "score": 8,
  "maxScore": 10,
  "percentage": 80,
  "passed": true,
  "lessonIds": ["lesson-to-review"],
  "version": "A",
  "attemptNumber": 1,
  "unlockedUnitId": "next-module-id",
  "certificate": null
}
```

`score` is marks awarded. `maxScore` is marks available. `percentage` is the rounded percent. The stored attempt uses those same three fields. `lessonIds` are the lessons behind missed questions. `unlockedUnitId` is the next module id, or null when there is no next module or the attempt failed.

`certificate` is null unless this pass awards the course certificate. When it does, the object is:

```json
{
  "id": "11111111-2222-4333-8444-555555555555",
  "studentNumber": "PS-1042",
  "name": "Amina Yusuf",
  "course": "Biology",
  "level": "IGCSE",
  "score": 82,
  "issuedAt": "2026-10-17T09:00:00.000Z",
  "verifyUrl": "/verify/11111111-2222-4333-8444-555555555555",
  "qr": "/verify/11111111-2222-4333-8444-555555555555",
  "absoluteVerifyUrl": "https://poketschool.ai/verify/11111111-2222-4333-8444-555555555555"
}
```

`studentNumber` is omitted when the server has none. `verifyUrl` and `qr` are the path `/verify/{id}`. `absoluteVerifyUrl` is `NEXT_PUBLIC_SITE_URL` (fallback `https://poketschool.ai`) plus that path, and is only on the response. `score` here is the final-assessment percentage, not the unit-test marks. `issuedAt` on the response is an ISO string. The stored certificate `issuedAt` is a timestamp.

A locked retake returns HTTP 400 with `code: "LOCKED"` and the message `Review these lessons before the unit test unlocks.`

### `lesson.first_complete`

The name is `lesson.first_complete`, exported from `lib/events.ts` as `LESSON_FIRST_COMPLETE`.

The server writes one `events` document when a lesson is first completed on the server (`completeLesson`, including the first pass of a unit test):

| Field | Type | Notes |
|---|---|---|
| `name` | string | `lesson.first_complete` |
| `studentId` | string | |
| `courseId` | string | |
| `lessonId` | string | |
| `at` | timestamp | |

Completing the same lesson again does not write another event. Clients must not post `lesson.first_complete`. There is no route that accepts an event name. Firestore's default deny already blocks client writes to `events`. That rule is not changed or deployed by this change.

## Learning progress alerts

Early-warning alerts for learning progress. Severity is `low`, `medium`, `high`, or `critical`. The shared shape lives in `lib/alerts/model.ts` (`type` is `safety` or `progress`). Safeguarding work on the network branch should import that module and set `type: 'safety'` rather than declaring a second severity enum.

The web app computes progress alerts on the server. Clients do not write them. Rules and indexes below are in the repo only. This change does not deploy them.

### `progress_alerts/{alertId}`

Concern id: `progress_{studentId}_{courseId}`. Positive id: `progress_positive_{studentId}_{kind}_{yyyy-mm-dd}`. One concern document per student and course is updated in place.

| Field | Type | Notes |
|---|---|---|
| `type` | string | Always `progress`. |
| `polarity` | string | `concern` or `positive`. |
| `severity` | string | `low`, `medium`, `high`, or `critical`. |
| `status` | string | `open`, `acknowledged`, `assigned`, or `resolved`. |
| `studentId` | string | |
| `studentName` | string | |
| `adult` | bool | Independent adults and adult learners. Parents are never notified, and parent reads are denied when this is true. |
| `independent` | bool | Adult with no institution. Self-alerts only. |
| `level` | string | Named level: Primary, Lower Secondary, IGCSE, or A-Level. |
| `courseId` | string | `general` when the learner has no course on record. |
| `courseTitle` | string | |
| `institutionId` | string or null | |
| `teacherIds` | string[] | |
| `title` | string | |
| `summary` | string | Staff and parent copy. The student view uses `plan.studentIntro`. |
| `signals` | array | `{ id, severity, detail }`. Signal ids include `failed_unit_test`, `failed_retake`, `score_drop`, `behind_pace`, `inactivity`, `broken_streak`, `overdue_assignment`, `low_mastery`, `time_anomaly`, `repeated_lesson_failure`, `final_at_risk`, `engagement_collapse`. |
| `plan` | map | ET AI recovery plan from recorded lessons only: `studentIntro`, `review`, `targeted`, `visuals` (`revisionPoster` or `mindmapImage`), `retake`, `parentGuide`, `teacherActions`. |
| `safeguardingCaseId` | string or null | Set when an open `safeguarding_cases` row exists, otherwise an open wellbeing `concern_flags` row. |
| `assigneeId` | string or null | |
| `notes` | array | `{ at, authorId, authorName, text }`. |
| `audit` | array | `{ at, actorId, action, detail }`. Actions: `opened`, `acknowledged`, `assigned`, `note`, `resolved`, `auto_resolved`, `notified`. |
| `badge` | string or null | `comeback` on a positive alert. This is not a gamification badge. |
| `positive` | string or null | `recovered`, `streak_restored`, `improvement`, or `comeback`. |
| `createdAt` | number | Milliseconds. |
| `updatedAt` | number | Milliseconds. |
| `resolvedAt` | number or null | |
| `autoResolved` | bool | True when the metrics recover. |
| `lastNotifiedSeverity` | string or null | Stops a repeat push at the same severity. |
| `held` | bool | True when a non-critical notice is waiting for quiet hours to end. Critical is never held. |

Read: the student, a linked parent when `adult != true`, a teacher in `teacherIds`, the assignee, the institution admin for that institution, or a platform admin. Create, update, and delete: denied for clients.

Indexes (not deployed by this change):

- `progress_alerts`: `institutionId` ASC, `status` ASC, `updatedAt` DESC
- `progress_alerts`: `studentId` ASC, `updatedAt` DESC
- `events`: `studentId` ASC, `name` ASC (used to find courses after `lesson.first_complete`)

### `progress_alert_settings/{id}`

`platform` holds the super-admin defaults. `{institutionId}` overrides them for one institution when the document exists.

| Field | Type | Notes |
|---|---|---|
| `thresholds` | map | Day counts for inactivity (`inactiveLowDays` 3, `inactiveMediumDays` 7, `inactiveHighDays` 14, `inactiveCriticalDays` 30), `scoreDropPercent` 15, `finalAtRiskPercent` 70, `paceBehindRatio` 0.5, `bloomLowPercent` 50, `timeAnomalyRatio` 3, `repeatedFails` 2, `multipleUnitsFailed` 2. |
| `parentAlertLevel` | string | Parents of non-adult learners are notified from this severity upward. |
| `quietStart` | string | `HH:MM`, default `21:00`. Compared in UTC. |
| `quietEnd` | string | `HH:MM`, default `07:00`. Critical bypasses the window. |
| `automationEnabled` | bool | When false, alerts are still recorded and no push or email is sent. |
| `academicLeadIds` | string[] | Extra recipients beside users with role `institution_admin` for that institution. |
| `updatedAt` | number | |
| `updatedBy` | string | |

Read: platform admin, or the institution admin for their own id and for `platform`. Writes: denied for clients. `GET` and `POST /api/progress-alerts/settings`.

### `progress_alert_trends/{institutionId}_{yyyy-mm-dd}`

Daily counts `{ institutionId, day, low, medium, high, critical, total, at }`. The platform row uses institution id `platform`. Aggregate level tables hide a level with fewer than five open alerts. Client writes denied.

### `progress_alert_state/{studentId}`

Server-only streak memory: `streakDays`, `lastPositiveKind`, `lastPositiveAt`, `updatedAt`. Client read and write denied.

### Events that recompute an alert

| Trigger | Where |
|---|---|
| Unit test marked | `POST /api/unit-tests/mark` after the attempt is stored. Version A and Version B both count. |
| Lesson first completed | `lesson.first_complete` from `completeLesson`. |
| Sign-in | `POST /api/audit` with `auth.login` when the actor role is `student`. Inactivity is days since the last lesson, so a sign-in does not clear it. |
| Daily job | `GET /api/cron/insights` with `Authorization: Bearer CRON_SECRET`. The JSON adds `progress: { checked, opened, resolved }`. |

### Workflow

`POST /api/progress-alerts` with `{ id, action, assigneeId?, note? }`. `action` is `acknowledge`, `assign`, `note`, or `resolve`. The student may acknowledge their own alert. A parent of a non-adult learner may add a note. Assign and resolve are staff (teacher, assignee, institution admin, platform admin). The same actions are written to `activity_log` as `progress.acknowledge`, `progress.assign`, `progress.note`, `progress.resolve`, and `progress.settings`.

`GET /api/progress-alerts?scope=student|child|class|institution|platform`. `scope=child` also takes `childId`. An adult learner is omitted from the parent scope.

### Push category `progress`

`deviceTokens.prefs.progress` follows the other categories: a missing key stays on, `false` opts that device out. Senders pass category `progress`. In-app `notifications` still use `type: "general"` and `link` `/dashboard/student/progress`, `/dashboard/parent/progress`, `/dashboard/teacher/progress`, or `/dashboard/institution/progress`.

Routing:

- Low: weekly parent digest on Monday, plus an ET AI nudge to the student. Quiet hours hold the digest.
- Medium: same-day push to parent and teacher.
- High: immediate push to parent, teacher, and the institution academic lead.
- Critical: push and email to the academic lead, teacher, and parents. Quiet hours do not hold it. The alert stores `safeguardingCaseId` when a case file exists.
- Independent adult learners: student nudge only.
- Parents are never told about adult learners.

### Accountability

The same ownership block is the shared model for safeguarding alerts (`type: 'safety'`). Import `lib/alerts/accountability.ts` and `lib/alerts/model.ts` on the network branch. Do not declare a second checklist or due-time rule.

`progress_alerts.accountability`:

| Field | Type | Notes |
|---|---|---|
| `ownerId` / `ownerName` | string | Teacher by default for medium, high, and critical. |
| `coOwnerId` / `coOwnerName` | string | A linked parent for a minor. Empty for an adult learner. |
| `delegateId` | string or null | Another linked guardian. Parent workflow `delegate`. |
| `dueAt` | number or null | Acknowledgement due time. Medium 48 hours, high 24 hours, critical 2 hours. Null for low. |
| `acknowledgedAt` | number or null | Owner acknowledgement. |
| `actedAt` / `staffAction` | number / string | Checklist: `spoke_to_student`, `contacted_parent`, `assigned_recovery_plan`, `scheduled_extra_session`, `referred_to_academic_lead`. |
| `parentSeenAt` | number or null | Family confirmed “I've seen this”. |
| `parentActedAt` / `parentAction` | number / string | `talked_with_child`, `set_study_time`, `will_attend_meeting`. |
| `teacherStep` | number | 0 owner, 1 academic lead, 2 institution admin. |
| `parentStep` | number | 0 waiting, 1 reminder push, 2 email, 3 teacher asked to call. |
| `teacherPausedMs` / `teacherPauseFrom` | number | Teacher `users.leaveUntil` or `users.onLeaveUntil` pauses the clock. Critical does not pause. |
| `parentPausedMs` / `parentPauseFrom` | number | Parent quiet hours pause the family clock. Critical does not pause. |
| `tasks` | array | Shared plan. `{ id, who: student\|parent\|teacher, text, dueAt, doneAt }`. Text is taken from lessons already on the record. |
| `agenda` | string | ET AI meeting agenda from the course, level, signals, and projected result on record. |
| `meeting` | map or null | `{ provider: zoom\|meet\|teams, url, at, agenda }`. The url is an existing `live_classes.joinUrl` or a link the teacher saves. Other hosts are refused. |
| `checkIns` | array | `{ at, authorName, text }`. |
| `recognition` | string[] | `rapid_responder` or `engaged_parent`. Shown to the person and the institution, not to the student. |

Audit actions added on the same `audit` array: `acted`, `parent_seen`, `parent_acted`, `escalated`, `delegated`, `check_in`, `meeting`. Each entry has `at`, `actorId`, `action`, and `detail`.

`progress_alert_settings.sla`: `mediumHours` 48, `highHours` 24, `criticalHours` 2, `criticalEscalationMinutes` 15. Institutions can replace these numbers.

Workflow `POST /api/progress-alerts` also accepts `act`, `seen`, `parent_act`, `delegate`, `check_in`, and `meeting`. `act` and `parent_act` send `checklist`. `meeting` sends `meetingUrl`. `delegate` sends `assigneeId` of another guardian whose `childIds` include the learner.

`progress_alert_recognition/{userId}` stores `{ userId, institutionId, badges, updatedAt }`. The person, a platform admin, or the institution admin can read it. Clients cannot write it.

`progress_alert_wins/{institutionId}_{week}` stores `{ institutionId, week, lines, sent }`. The Monday cron sends one supportive summary and sets `sent`.

`GET /api/progress-alerts` adds `stats` (open, overdue, average response, recovered, parent engagement, intervention success) and `levelStats`. Engagement and success rates are omitted when the group has fewer than five learners. The institution and Insights screens can filter the named list by class and level.

## Dashboard home

The role homes (student, parent, teacher, institution admin, super admin, alumni, recruiter) share `components/dashboard` and the category map in `lib/dashboard/home.ts`. The layout, icons, colours, and navigation rules are written up in `docs/DASHBOARD_UX.md`. The mobile app should follow that file rather than inventing a second home.

Tile order is a preference. The web app keeps it in `localStorage` (`poket-dash-tiles:{role}`, a JSON array of tile ids). When the app stores it, use the signed-in user document:

| Field | Type | Notes |
|---|---|---|
| `dashboardTileOrder` | map | Keys are the role names in `DASH_ROLES`. Each value is a string array of tile ids from `roleHome(role).tiles`. Unknown ids are ignored. New tiles are appended. |
| `dashboardCoachSeen` | map | Role name to `true` once the person dismisses the onboarding note. The note links to the onboarding course. |

`firestore.rules` adds both names to `selfServiceFields()`, so a person can update only their own copy. That rules change is in the repo and is not deployed by this work. The web home still keeps the order in the browser until a client writes the field. These fields do not grant access to another role’s data. Alumni and recruiter shells do not add a collection. Talent lists stay with the school that shares them.

## Subscriptions & renewals

Reconciled with the app payments schema (test mode). The website owns Stripe (`POST /api/stripe/create-checkout`, `POST /api/payments/checkout`, and the Stripe webhook). Touch ’n Go is gateway method `tng`, not a Stripe flag. The iOS and Android apps use RevenueCat and do not write entitlements. Prices live in `pricing_config/current` (fallback `seedPricing()`). That path is website canonical. The app’s `platform_settings/pricing` name is not used.

Primary (`primary_secondary`) and Professional (`professional`) `monthlyUsd` and `annualUsd` stay null until a super admin sets them. IGCSE & A-Level stays monthly USD 79 and annual USD 708. Poket Reads stays $9 and Poket Reads Family $15, on the same document as `reads[]`, and a super admin can change them. A null plan price makes `quotePlan` return null and checkout refuses it. The public pricing page shows “Not set” and does not treat that as free. Preview stays $0. A `pricing_config/current` document that already stored 19 or 99 keeps those numbers until a super admin clears the field.

`familyBundleDiscount` on that document is null until a super admin saves `{ secondChildOff, furtherChildOff }` as fractions from 0 to 1. Null charges list price. Ten percent and fifteen percent are an example, not the seed.

### Entitlement fields

Server-written. Clients cannot write them. `subscriptions/sub_{payerUid}` is the paying record. `entitlements/{uid}` is what each person reads. The document id stays `sub_{payerUid}`.

| Field | Type | Notes |
|---|---|---|
| `plan` | string | Tier id from config. `tierId` is the same string, also written. |
| `tier` | number | Numeric TIERS value. `accessTier` is the same number, also written, and `users.accessTier` is still what the Stripe path updates. |
| `status` | string | `active`, `grace`, `billing_retry`, `expired`, or `cancelled`. |
| `currentPeriodEnd` | number or null | Unix milliseconds. |
| `cancelAtPeriodEnd` | boolean | Access stays until `currentPeriodEnd`. |
| `source` | string | `stripe`, `apple`, or `google`. |
| `externalId` | string | Stripe subscription id or RevenueCat event / store transaction id. |
| `payerUid` | string | Account that pays. |
| `beneficiaryUids` | string[] | Learners covered by this payment. |
| `stripeCustomerId` | string | Present for Stripe portal sessions. Website field. |
| `spendingCapUsd` | number or null | Parent cap. Null means no cap. Website field. |
| `reminderSentFor` | number | `currentPeriodEnd` once the 3-day reminder has been sent. |

`users.subscriptionTier` and `users.sparksMonthlyAllowance` stay the fields the Stripe webhook already writes. The app does not write them.

### RevenueCat webhook

`POST /api/webhooks/revenuecat`. Server only. `Authorization` must equal `REVENUECAT_WEBHOOK_SECRET` or `Bearer <secret>`. Compared with a hash so a timing leak on the length is avoided. Optional `REVENUECAT_API_KEY` is not required for the webhook.

`app_user_id` is the Firebase uid of the payer. The subscriber attribute `beneficiary_uids` is a comma-separated list of child uids. The previous name `beneficiaries` is still read if `beneficiary_uids` is absent. Product ids map to tiers in `REVENUECAT_PRODUCTS`. That map has no prices. Unknown product ids do not guess a tier. Unsuffixed ids (`poket_igcse_alevel`, `poket_primary_secondary`, `poket_professional`) and the monthly/annual suffixed ids both map.

| RevenueCat `type` | Status | Audit |
|---|---|---|
| `INITIAL_PURCHASE`, `RENEWAL` | `active` | `renewal` |
| `BILLING_ISSUE` | `billing_retry` | `renewal_failed` |
| `CANCELLATION` | `cancelled`, `cancelAtPeriodEnd` true, access kept | `cancelled` |
| `UNCANCELLATION` | `active`, `cancelAtPeriodEnd` false | `uncancelled` |
| `EXPIRATION` | `expired`, learner tier dropped to 0 | `expired` |
| `PRODUCT_CHANGE` | `active`, new tier from the product map | `product_change` |
| `TRANSFER` | `active`, `payerUid` becomes `transferred_to` | `transfer` |
| `REFUND` | `expired`, access dropped | `refunded` |

A distinct `grace` status and `grace_period` audit exist for a later grace signal. `BILLING_ISSUE` does not write them. Store `APP_STORE` → `apple`, `PLAY_STORE` → `google`, anything else → `stripe`. Idempotency key is `billing_events/revenuecat:{eventId}`.

Stripe writes the same fields from `legacy_subscription`, `customer.subscription.created/updated`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, and `charge.refunded`. A Stripe subscription whose status is `canceled`, `unpaid`, or `incomplete_expired` becomes entitlement `expired`. `cancel_at_period_end` becomes `cancelled` and keeps access. A failed invoice becomes `billing_retry`.

### Renewal reminders and failed payments

`GET /api/cron/insights` (Bearer `CRON_SECRET`) adds `renewals: { checked, reminded }`. A subscription in `active`, `grace`, `billing_retry`, or `cancelled` is reminded once when `now` is inside the 3 days before `currentPeriodEnd`. Older rows in `past_due` or `canceled` are included in that scan. The push category is `general`.

The payer gets the renewal or failed-payment notice. Apple opens `https://apps.apple.com/account/subscriptions`. Google opens `https://play.google.com/store/account/subscriptions`. Stripe opens `/pay/fix`, which calls `POST /api/billing/portal`. Email uses `lib/mail.ts` (`RESEND_API_KEY` and `RESEND_FROM`). If those are unset the send is skipped and the webhook still succeeds.

`billing_audit/{id}` is append-only and hash-chained. `billing_audit_head/current` stores `{ seq, hash, at }`. Each row has `seq`, `prevHash`, `hash`, `type`, `payerUid`, `beneficiaryUids`, `subscriptionId`, `at`, `detail`, `source`, `actorUid`. The app’s audit types are `renewal`, `renewal_failed`, `grace_period`, `expired`, `refunded`, and `cancelled`. The website also writes `uncancelled`, `product_change`, `transfer`, `ask`, `decline`, `cap`, and `purchase` for the parent web checkout. Nothing deletes these rows.

### Manage subscription

`POST /api/billing/portal` with the signed-in user’s token. `return_url` is a dashboard path (`returnPath` must start with `/dashboard`). An institution admin may pass `institutionId` for that academy’s customer. Apple and Google return the store links above and do not open a Stripe portal. The button is on the student, parent, teacher, and institution billing pages, and on `/pay/fix`.

Restore purchases, proration previews, and `externalPurchaseEnabled` are app-only. A null config price already refuses a website quote. The website does not collect a cancel reason.

Environment: `REVENUECAT_WEBHOOK_SECRET`, optional `REVENUECAT_API_KEY`, existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Rules for `entitlements`, `subscriptions`, `billing_audit`, `billing_audit_head`, and `billing_events` are in the repo and are not deployed by this work.

## Parent-paid plans

A parent pays. The child studies. Course access is written on the child’s account, not the parent’s, unless the adult is the only beneficiary.

### Fields

On every entitlement in the family: `payerUid`, `beneficiaryUids`.

On the child only:

| Field | Type | Notes |
|---|---|---|
| `sponsoredBy.payerUid` | string | Paying guardian. |
| `sponsoredBy.subscriptionId` | string | Same `externalId` as the payer subscription. Not the Firestore document id. |
| `sponsoredBy.source` | string | `stripe`, `apple`, or `google`. |

Taking over billing at 18 clears `sponsoredBy`. Moving sponsorship to another guardian sets `sponsoredBy` to that guardian and keeps `subscriptionId` equal to the existing `externalId`.

`subscriptions/sub_{payerUid}.lines[]` is `{ uid, tierId, accessTier, listUsd, chargeUsd, off, seat }` for web checkout, one plan per child.

### Who may pay

An approved `parent_links/{parentId}_{childId}` is the verified guardian on the website. `parent_links` does not store a numeric verification tier. If a row does store `guardianTier` and it is below 2, payment is refused. Pending or rejected links cannot be paid for, added, removed, or used as a transfer target.

Under-18s cannot start checkout (`POST /api/stripe/checkout`, `POST /api/payments/checkout`, family checkout, or a RevenueCat purchase with no child beneficiaries). A missing age on a student fails closed. Parents, teachers, and admins can pay. Children never receive card fields.

### Web checkout

`POST /api/billing/family` with `action: "checkout"`, `lines: [{ uid, tierId }]`, `method` `card`, `fpx`, or `tng`, and `interval` `month` or `year`. Card uses a Stripe subscription. FPX uses a Stripe one-time payment. Touch ’n Go uses the Malaysian gateway (`POST /api/payments/checkout` for other one-time charges). The result is still the entitlement fields above. A null plan price is refused. `familyBundleDiscount` is applied only when a super admin has saved it. `spendingCapUsd` blocks a checkout above the cap.

### App checkout

The parent purchases in RevenueCat under their `app_user_id`. Set the subscriber attribute `beneficiary_uids` to a comma-separated list of child uids. The webhook grants or revokes those children’s entitlements after checking each approved parent link. One RevenueCat product applies one tier to every beneficiary on that event. The web’s per-child lines and this attribute write the same `entitlements` documents.

### Family dashboard

`/dashboard/parent/billing` uses the dashboard kit. `GET /api/billing/family` returns each child’s plan, renewal, and status, pending requests, the discount label, and invoices with `receiptNumber` and `myInvois` (`version`, `status`, `typeCode`, supplier and buyer). Actions on `POST /api/billing/family`: `quote`, `checkout`, `cap`, `transfer`, `takeover`, `remove`, `ask`, `respond`. Manage subscription uses the portal route or the store link. A public preview is at `/preview/billing`.

### Ask a parent

A child posts `action: "ask"` with `parentUid` and either `kind: "plan"` plus `tierId` or `kind: "course"` plus `courseId`. The row is `purchase_requests/{id}` with `status: pending`. The parent gets a `general` push to `/pay/ask` and an email with no card data. `action: "respond"` with `decision: "approved"` starts the parent checkout. `rejected` notifies the child that nothing was charged.

### School seats and graduation

If the child’s `enrolPath` or `membership` is `institution` and the academy `billingPhase` is `active` or `grace`, and that seat’s plan tier is at least the requested tier, checkout returns `409 DUPLICATE_SEAT`. A higher plan returns `400 DUPLICATE_WARN` until `acknowledgeWarning` is true. `graduating: true` on the quote allows the parent to switch the learner onto an individual plan. Entitlement history and `billing_audit` are kept. Access is not wiped before the new period is written. Institution `billingPhase: grace` is the academy seat clock. It is not the entitlement status `grace`.

### Notices and transfers

Renewal and failed-payment pushes go to the payer, with the fix link above. Each child gets a soft `general` notice titled “Access may pause”, with no amount, card, or receipt. The child link is `/home`, which redirects to `/dashboard`.

`action: "transfer"` moves one child to `nextPayerUid` after both guardian links are approved. `action: "takeover"` lets the learner do that for themselves when `ageTier` is `adult` or their date of birth says 18, and clears `sponsoredBy`. Removing a child (`action: "remove"`) sets that child’s status to `cancelled` and drops their access immediately. A store `CANCELLATION` keeps access until `currentPeriodEnd`.

Every renewal, failure, expiry, refund, cancellation, ask, decline, cap change, and transfer is an audit row with `payerUid` and `beneficiaryUids`.

### Still different from the app schema

These stay website canonical. Relay them to the app:

- Price document path is `pricing_config/current`, not `platform_settings/pricing`.
- Entitlements write `tier` and `accessTier` (same number) and `plan` and `tierId` (same id). The website also writes `users.accessTier`, `users.subscriptionTier`, and `users.sparksMonthlyAllowance`. The app must not write those user fields.
- Firestore subscription document id is `sub_{payerUid}`. `sponsoredBy.subscriptionId` equals `externalId`.
- Extra audit types: `uncancelled`, `product_change`, `transfer`, `ask`, `decline`, `cap`, `purchase`.
- Extra routes: `POST` and `GET /api/billing/family`, `/pay/fix`, `/pay/ask`, `/home` (redirect to `/dashboard`), `/preview/billing`.
- Older `subscriptions/{userId}` rows still use status `canceled` and `family`. New entitlement documents use `cancelled`.
- `guardianTier` is not required. An approved `parent_links` row is the verified guardian. A stored `guardianTier` below 2 is rejected.
- Removing a child drops that child’s access immediately. A store cancellation keeps access until `currentPeriodEnd`.
- There is no cancel-reason field. `CANCELLATION` audit `detail` is the event type.
- `externalPurchaseEnabled`, restore purchases, and proration previews are not website features.
- `familyBundleDiscount` is `{ secondChildOff, furtherChildOff } | null`. The 10% / 15% example is not stored.
- `spendingCapUsd` is the cap field on `subscriptions/sub_{payerUid}`.
- One web checkout can assign a different plan per child. One RevenueCat product applies one tier to every `beneficiary_uids` entry.
- FPX on a family plan is a one-time Stripe payment. Card is a Stripe subscription. `tng` is the Malaysian gateway.
- Translated FAQ drafts outside English may still quote the old $19 and $99 amounts. English copy and `pricing_config` do not. Checkout uses the config.

## Student ID and member card

The digital card is free for every account. It is a marketing surface. Server code for the card does not read a plan, an access tier, or a paid feature.

`PLAN-superapp.md` is not in this repo. The issued number is stored on `users/{uid}.studentNumber`. There is no `memberNumber` field. `PSM-` is the member form of `studentNumber`. A person with `institutionId` keeps the existing school format `PS-` (for example `PS-1042`). A person with no institution gets `PSM-` plus a zero-padded sequence (for example `PSM-0042`). Sequences start at 1000 in `number_sequences/member` and `number_sequences/student`. Each issued value is reserved in `student_numbers/{number}` as `{ uid, at }`.

The server writes the number at signup (`POST /api/card` with `action: "issue"`) and backfills existing users. `GET /api/cron/member-cards` (Bearer `CRON_SECRET`, schedule `30 2 * * *`) issues up to 40 missing numbers per run, paging `users` by document id from `number_sequences/backfill`. If a number is already stored, it is kept. A later school link does not rewrite `PSM-` into `PS-`.

Clients cannot create or update `studentNumber`, `referralCode`, `cardShareId`, `cardIndexed`, or `cardSharing`. Those names are on the privileged profile list and are denied in Firestore rules for client creates and admin-client updates.

A person with no school sees the title **Poket School member card**. A person with `institutionId` sees **Student card**. The owner page `/dashboard/card` shows the number. The public card does not.

## Card share

`card_shares/{shareId}` is `{ uid, createdAt, revoked, revokedAt?, viewCount }`. `shareId` is a random base64url string of 16 to 64 URL-safe characters. The user field `cardShareId` points at the live share. Creating a new share revokes the previous document. Revoke sets `revoked` and deletes `cardShareId`. Regenerate issues a new id. The public page is `/card/[shareId]`. Two images sit on that route and both use the same public card: `opengraph-image.tsx` (1200×630) and `/card/[shareId]/story` (1080×1920). Each shows the branded blue gradient, first name, level name, and badges or streak, plus **Join Poket School**. Neither image reads a plan. The page link is `/signup?ref={code}`. A preview that does not need the server account is `/preview/card`.

The public card never includes the student number, a QR code, or a date of birth. `schoolName` is sent only when the person is an adult and has an institution. Under-18 cards omit the school name.

Age rules:

- Under 13: initials only (`avatarUrl` is cleared, no photo). Sharing stays off until a verified parent sets `cardSharing`. The parent link is `parent_links/{parentId}_{studentId}` with `status: approved`. The page is `noindex`.
- Under 18 (teen and under 13): `noindex`, even if `cardIndexed` is true.
- Adults: `cardIndexed` defaults to false, so the page stays `noindex` until they opt in. Indexing also requires the share to be visible.

`GET /api/card` returns the owner card and linked under-13 children. `POST /api/card` actions are `issue`, `share`, `regenerate`, `revoke`, `channel`, `index`, and `parent-share`.

Every share is an append-only hash-chain row in `card_audit`, headed by `card_audit_head/current`. Types are `created`, `revoked`, `regenerated`, `channel`, and `view`. The payload is sequence, previous hash, type, uid, share id, time, actor, channel, and view count. It does not store the student number or the date of birth. Create, revoke, regenerate, and channel also write `activity_log` (`card.created`, `card.revoked`, `card.regenerated`, `card.channel`). A view increments `card_shares.viewCount` and writes a `view` chain row only, so view traffic does not flood the activity log. Clients cannot write the chain. Activity retention does not purge it.

## Referrals

`referrals/{code}` is `{ inviterUid, createdAt, redeemedBy: [{ uid, at }] }`. The code is 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The same code is stored on the user as `referralCode`. The server writes both. This collection is separate from affiliate `coupons` and `referralState`. It does not pay a reward.

Signup reads `?ref=code`, keeps it in `sessionStorage` for the OTP steps, and sends it with `action: "issue"`. A known code appends `{ uid, at }` to `redeemedBy`. Signing up with your own code is rejected. A second redeem is `already`. An unknown code does not fail signup. There is no rewards logic yet.

## Student ID for partner discounts

The free digital card is also a student ID that partner businesses can scan. It is never paywalled. Issuing a QR or a checkout code does not read a plan in order to refuse the card. `CARD_TOKEN_SECRET` (at least 16 characters) signs the token. It is in `.env.example`. Rules and indexes for the collections below are in the repo only.

### Verification

`GET /api/student-id` returns a stateless HMAC token, `ps1.{payload}.{sig}`, and a 6-digit checkout code. The token payload is the uid and a 30-second window. It does not contain the student number or a date of birth. The previous window still resolves as expired so a slow scan can show that state. The code is valid for two minutes. Five issues per minute, and five failed checks, lock the caller for 15 minutes. Only a hash of the code is stored.

`student_codes/{hash}` is `{ uid, validUntil, attempts, lockedUntil }`. `student_code_limits/{uid}` stores issue times. `student_code_attempts/{actor}` stores failures. Clients cannot read or write them.

`/verify/[token]` is `noindex` and `no-store` when the token starts with `ps1.`. It shows only a photo or an avatar (avatar only for under-13s), the first name, **Verified Poket School student** or **Member**, active or expired, `validUntil`, and an age band (`<18` or `18+`). It never shows a date of birth, and it does not show a school name or a student number. Certificate checks stay on the same route for ids that are not `ps1.` tokens.

### Student status

`users/{uid}.studentStatus` is `{ status, verifiedAt, validUntil }`. `status` is `verified` or `member`. The server writes it when a proof is issued. **Verified student** requires access tier at least 1 and either an active school seat or a course enrolment. Otherwise the face says **Member**. Clients cannot write `studentStatus` or `partnerId`.

### Partners, offers, redemptions

`partners/{id}` is `{ name, logo, categories, countries, verified, contact, ownerUid, status }`. `status` is `pending`, `approved`, or `rejected`.

`offers/{id}` is `{ partnerId, title, discount, terms, codeType, ageMin, countries, cities, startsAt, endsAt, status, category, staticCode }`. `codeType` is `static`, `unique`, or `scan`. `status` is `review`, `live`, or `rejected`. `category` is the perk group. A partner creates an offer in `review`. An admin approves it before it is `live`.

`redemptions/{id}` is `{ offerId, uid, partnerId, at, method }`. It is append-only. Each redemption also appends `perk_audit`, headed by `perk_audit_head/current`, using the same SHA-256 `chainHash` as the card audit. The chain payload is sequence, previous hash, type `redeemed`, offer, uid, partner, time, and method. Clients cannot read redemption rows. The partner portal returns counts only.

Offers with `ageMin` above 0 are hidden on the server from anyone who is not an adult. Alcohol, vape, tobacco, gambling, and adult categories are hidden from under-18s, and admin review rejects them unless `ageMin` is at least 18. A new live perk sends a push with category `general` and title **New perk**.

### Partner merchants

`partner_merchant` is a role of its own. It is not the tier-4 police or NGO partner, and `canPublishAmberAlerts` is false for it. Onboarding is `/partner`. Admin review is `/dashboard/admin/partners`. The portal is `/dashboard/partner`. Students use `/dashboard/student/perks`. Approval sets `users.role` to `partner_merchant` and `partnerId`.

## Sticky notes

`users/{uid}/notes/{noteId}` is `{ text, colour, pinned, order, board, linkedTo, remindAt, checklist, createdAt, updatedAt, deletedAt }`. `text` is at most 2000 characters. `colour` is `cyan`, `sky`, `coral`, `success`, `lilac`, or `white`. `board` defaults to `My board`. `linkedTo` is `{ type, id }` where `type` is `lesson`, `course`, `assignment`, `exam`, or `none`. `checklist` is an optional list of `{ id, text, done }`. `remindAt` is optional. `remindedAt` is `0` until the reminder cron sends it.

Only the owner can read or write a note. Clients cannot set `share`, cannot set `remindedAt` to anything except `0`, and cannot hard-delete. A delete sets `deletedAt`. The note stays in trash for 30 days. `GET /api/cron/notes` (every 15 minutes, `CRON_SECRET`) sends due reminders and then deletes trash older than 30 days. A reminder push uses category `general`. It waits while `notify_settings/{uid}` quiet hours are in effect (default 21:00–07:00).

The web client and the app use the same documents. The web Firestore client turns on offline persistence so an edit made offline syncs on reconnect.

Sharing is off until the owner asks. `POST /api/notes` with `action: "share"` checks the study group, then runs the note through ET AI moderation (`moderateText` plus the model). A live share is copied to `note_shares/{uid}_{noteId}` as `{ ownerId, noteId, spaceId, status, text, colour, authorFirstName, at }`. Held or blocked notes are not readable by the group and land on `moderation_queue` with surface `note`. Under-18s can share only to a `class` or `school` space whose `institutionId` matches their own. A space without `institutionId` is refused for minors. Adults can share to a study group they belong to. `action: "unshare"` removes the copy.

`action` `flashcards`, `summarise`, or `plan` reads only the owner's selected notes and sends them to ET AI. Nothing is sent until the student presses one of those actions.

Indexes for the reminder query and the trash query are in `firestore.indexes.json`. They are not deployed from this change.

