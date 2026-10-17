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
| `prefs` | map | Optional booleans. A missing key stays on. `false` opts that device out. Keys: `goals`, `flags`, `attendance`, `digests`, `grades`, `assignments`, `general`, `achievements`. |
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

Senders (goals parent alerts, integrity flags, attendance, digests, grades, assignments, general, and achievements) all load that query, skip a device whose `prefs[category] === false`, and post to Expo (`https://exp.host/--/api/v2/push/send`) or Web Push from `provider`. Web Push needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. The Admin SDK needs `FIREBASE_SERVICE_ACCOUNT` (JSON) or Application Default Credentials.

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

`notifications` stays the in-app inbox: `userId`, `title`, `message`, `type`, `link`, `read`, `createdAt`. Push category is not stored on the document. Creating a notification also asks `/api/push` to deliver it. `type: grade` maps to prefs `grades`, `type: assignment` maps to `assignments`, and other types map to `general` unless the caller sets a category (`goals`, `flags`, `attendance`, `digests`, `achievements`). Badges, level-ups, and quests use `achievements`, not `grades`.

## Other senders

| Sender | Who is notified | Category |
|---|---|---|
| Goal parent alert | Each parent whose `childIds` contains the student | `goals` |
| Integrity flag | The student, when `integrity_reports.flags` is non-empty | `flags` |
| Attendance | The student, and each linked parent, when a mark is `absent` or `late` | `attendance` |
| Digest | The recipient passed to `sendDigest` | `digests` |
| Assignment graded | The student | `grades` |
| Parent due-date reminder | The signed-in parent | `assignments` |
| Badge, level-up, or quest | The learner | `achievements` |

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

Further optional fields: `priority` (`low|medium|high`), `reminderTime` (`HH:mm`), `quizTarget`, `studioTask`, `pomodoroWork`, `pomodoroBreak`, `reflectionPrompt`, `reward`, `lessonTitles`, `shareWithTeachers`, and `teacherIds`. A goal is readable by the student, a linked parent, an admin, or a teacher whose id is in `teacherIds` while `shareWithTeachers` is not false. `deviceTokens.provider` may be `expo`, `webpush`, or `fcm`. The document shape is unchanged. FCM sends only when `FCM_SERVER_KEY` is set.

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

## Badges and gamification

The mobile app can read awards and boards. It should not invent XP. Send the shared event names in `lib/events.ts` to `POST /api/gamification/event` with a Firebase ID token. A repeated `eventId` is a no-op. `lesson.first_complete` is the exception: the server emits it from `completeLesson` when a lesson is finished for the first time, and the gamification listener applies it. Clients that post that name receive HTTP 400 `SERVER_EVENT`. Badge document ids stay `badges/{userId}_{badgeId}`.

`badges/{userId}_{badgeId}` (existing collection, extra fields):

| Field | Type | Notes |
|---|---|---|
| `userId` | string | Auth uid. |
| `type` | string | Same as the badge id, for example `first-lesson` or `first_steps`. |
| `name` | string | Display name. |
| `description` | string | |
| `icon` | string | Image key such as `flame` or `book`. Older rows may say `art`. Reads accept `art` when `icon` is missing. The next award or catalogue save writes `icon` and drops `art`. |
| `tier` | string | `bronze`, `silver`, or `gold`. |
| `audience` | string | `student`, `parent`, `teacher`, or `institution`. |
| `awardedAt` | timestamp | Server time. Missing on older star badges. |

Query the app already uses: `badges where userId == uid`. That single-field index is automatic. Do not deploy a new index for it.

`gamification/{userId}` is server-written progress: `xp`, `awarded` (badge ids), `counts`, `dailyXp`, `weeklyXp`, `passedUnits`, `streak`, `freezes`, `quests`, `questsDone`. Clients do not write it. `GET /api/gamification/state` returns those fields: `xp`, `awarded`, `counts`, `dailyXp`, `weeklyXp`, `passedUnits`, `streak`, `freezes`, `quests`, `questsDone`.

`gamification_config/settings` is the super-admin catalogue (`badges`) and Sparks rewards (`sparks.enabled`, `sparks.amount` clamped to 0–5, `sparks.badgeIds`). The default is off and zero.

`leaderboard_entries/{userId}_{scope}_{period}`:

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `scope` | string | `class`, `institution`, or `house`. |
| `scopeId` | string | Class id, institution id, or house id. |
| `period` | string | `all`, or an ISO week such as `2026-W42`. A new week is a new row, which is the weekly reset. |
| `xp` | number | All-time XP, or XP earned in that week. |
| `label` | string | First name, last initial, and school name. |
| `schoolName` | string | |
| `shareBoard` | boolean | Rows are omitted when the student opts out. |

Listed index, not deployed:

```
leaderboard_entries: scope ASC, scopeId ASC, period ASC, xp DESC
```

Optional user fields the board reads: `classId` or the first `cohortIds` entry, `institutionId`, `houseId`, `schoolName`, `shareBoard`. House competitions stay off until `institutions/{institutionId}/classes/{classId}.competitionsEnabled` is true. `leaderboardEnabled` defaults on. Teachers and institution admins set both through `POST /api/gamification/class`.

Level names from XP are Seedling, Explorer, Pathfinder, Scholar, Mentor, Luminary, and Steward. Programme names stay separate.

`GET /api/gamification/export?badge={id}` returns an Open Badges 3.0 credential. It is signed only when `OPEN_BADGE_PRIVATE_KEY` is set. Sharing does not need that key. `GET /badges/{awardId}` is a public page (`awardId` is `{userId}_{badgeId}`) with an Open Graph image at `/badges/{awardId}/opengraph-image`. LinkedIn share-offsite uses that page URL. Add to Profile uses the same URL as `certUrl` and the award id as `certId`. `GET /api/gamification/card` still returns an SVG card.

Account `notificationPrefs.achievements` is the web toggle for badge, level-up, and quest pushes. A missing value stays on. `false` skips the push. Device `prefs.achievements` does the same for that device. Assignment grades stay on `grades`.

Parent Explainer reads `badges` for the linked child and names them in the weekly note. No rules or index deploy is part of this change.

## Professional network

Poket School's verified network. The mobile app calls the HTTP routes. It does not publish by writing Firestore from the device. ET AI screens every post, comment, message, and profile first. Rules and indexes below are in the repo and are not deployed.

`platform_settings/network` holds the super-admin switches. Missing document uses these defaults: `networkOn` true, `recruiterTierOn` false, `foundersOn` false, `foundersProOn` false, `studentGroupsOn` true, `groupApprovalMode` `school`, `groupDuesOn` false, `orgVerificationMode` `domain_and_admin`, placeholder prices `recruiterFreeCents` `recruiterProCents` `foundersProCents` at 0, `inmailCreditsFree` 0, `inmailCreditsPro` 20. Paid charges are sandbox records in `recruiter_charges` and `group_dues`. Nothing captures a live card.

Under-18 profiles are `visibility: school`, `searchable: false`, and never appear in recruiter or public founder search. A missing `users.ageTier` still fails closed as `under13`.

### network_profiles/{uid}

`handle`, `headline`, `about`, `selfReported` (owner text), `visibility` (`public`, `network`, `private`, `school`), `searchable`, `ageTier`, `role`, `institutionId`, `openToWork` (`no`, `everyone`, `recruiters`), `availability` (`open`, `internship`, `part_time`, `closed`), `location`, `shareContact`, `recruiterOptIn`, `verified` (badges and skills passport entries, shown or hidden, never edited by the member), `showVerified`, `consent` (`pdpa`, `gdpr`, `child`, `atMs`), `moderation`.

Public URL is `/u/{handle}`.

TODO(institutions): `verified.skills` reads `skills_passport/{uid}.entries` when that collection exists. Until then the list is empty. Badges are read from `gamification/{uid}.badges`.

### network_posts/{id}

`authorId`, `authorName`, `ageTier`, `institutionId`, `classId`, `orgId`, `kind` (`text`, `image`, `link`, `project`, `achievement`), `body`, `imageUrl`, `linkUrl`, `hashtags`, `mentions`, `skillIds`, `achievement` (badge or certificate card), `space` (`network`, `school`, `class`), `moderation` (`allow`, `hold`, `block`), `createdAtMs`.

Under-18 posts must use `school` or `class`. Feed query: `moderation == allow`, then ranked in the API from connections, followed organisations, school or class, and skills.

### network_comments/{id}

`postId`, `authorId`, `authorName`, `ageTier`, `body`, `moderation`, `createdAtMs`.

### network_reactions/{postId}_{uid}

`postId`, `userId`, `emoji` (`clap`, `thanks`, `idea`, `support`), `createdAtMs`.

### network_reposts/{postId}_{uid}

`postId`, `userId`, `createdAtMs`.

### network_connections/{uidA}_{uidB}

Sorted ids. `userIds`, `fromId`, `toId`, `status` (`pending`, `accepted`, `declined`), `createdAtMs`. Adults connect across the platform. Under-18 members connect with classmates and teachers in the same institution only.

Index, not deployed: `userIds` CONTAINS, `status` ASC.

### network_follows/{followerId}_{target}

`followerId`, `targetId`, `orgId`, `createdAtMs`. Under-18 members follow organisations, not people outside class.

### network_blocks/{uid}_{targetId}

`userId`, `targetId`, `createdAtMs`.

### network_messages/{id}

Adults who are connected, or an accepted recruiter InMail to an opted-in adult. `fromId`, `toId`, `body`, `kind` (`dm` or `inmail`), `moderation`, `createdAtMs`. No direct message from or to an under-18 member.

### network_reports/{id}

`reporterId`, `targetType`, `targetId`, `reason`, `status`, `createdAtMs`. Also copied onto `moderation_queue`.

### network_orgs/{id}

`name`, `kind` (`institution`, `employer`, `university`, `training`), `about`, `domain`, `domainChecked`, `verified`, `verification` (`pending`, `domain`, `approved`), `ownerId`, `createdAtMs`.

`network_org_members/{orgId}_{uid}`: `orgId`, `userId`, `role` (`admin` or `editor`).

### recruiter_seats/{uid}

Verified through an employer org. `tier` (`free` or `pro`), `verified`, `inmailUsed`.

### recruiter_searches/{id}

`userId`, `query`, `alert`, `createdAtMs`.

### talent_lists/{id}

`userId`, `name`, `memberIds`, `updatedAtMs`.

### job_openings/{id} and job_applications/{id}

TODO(institutions): the job board UI should read these. `job_openings` has `orgId`, `startupId`, `title`, `level`, `location`, `kind`, `status`, `postedBy`. Applications store `userId`, `openingId`, `cvVersionId`, `source`, `status`. TODO(institutions): `cv_versions/{uid}` is the CV the member applies with.

### Routes

| Method | Path |
| --- | --- |
| POST | `/api/network/profile` |
| GET | `/api/network/profile?handle=` |
| GET | `/api/network/feed` |
| POST | `/api/network/post` |
| POST | `/api/network/comment` |
| POST | `/api/network/react` |
| POST | `/api/network/repost` |
| POST | `/api/network/connect` |
| POST | `/api/network/connect-reply` |
| POST | `/api/network/follow` |
| POST | `/api/network/message` |
| POST | `/api/network/report` |
| POST | `/api/network/block` |
| POST | `/api/network/org` |
| POST | `/api/network/org-approve` |
| GET | `/api/network/search` |
| POST | `/api/network/search-save` |
| POST | `/api/network/talent` |
| POST | `/api/network/inmail` |
| POST | `/api/network/upgrade` |
| POST | `/api/network/apply` |
| POST | `/api/network/opening` |
| GET | `/api/network/export` |
| POST | `/api/network/delete` |
| GET | `/api/network/insights` |
| POST | `/api/network/settings` |

Insights omit any school group with fewer than 5 profiles. Recruiters receive `email` and `phone` only when `shareContact` is true.

Push category `network` covers connections, comments, mentions, messages, recruiter messages, and group activity. Account `notificationPrefs.network` defaults on. `notificationPrefs.networkDigest` defaults off (email digest opt-in). Device `prefs.network` works the same way.

Share-out links are built by the client: LinkedIn share-offsite, WhatsApp, and copy link. They point at the public post or profile URL.

## ET AI moderation

Shared by the professional network, class spaces, channel messages, lesson questions, the alumni wall, and the yearbook signing wall. `POST /api/community/post` and `POST /api/community/comment` call it for class spaces. `POST /api/messaging/send` calls it for class channels. `POST /api/community/alumni-post` writes `alumni_wall_posts`. `POST /api/community/yearbook` writes `yearbook_notes`. TODO(institutions): those two walls should keep calling these routes instead of writing the collections from the device.

Provider: OpenRouter when `OPENROUTER_API_KEY` is set, otherwise Gemini when `GEMINI_API_KEY` is set, otherwise the keyword and pattern list. A model can only make a decision stricter. Images the model did not see are held.

Decisions stay `allow`, `hold`, `block`. Categories: `hate`, `harassment`, `sexual`, `sexual_minor`, `violence`, `self_harm`, `scam`, `spam`, `personal_data`, `grooming`, `investment_solicitation`, `image_unseen`, `borderline`. Severity: `low`, `medium`, `high`, `critical`.

The author message is short, neutral, and links to `/community-guidelines`. Self-harm adds a supportive note. Under-18s are told their school safeguarding contact was notified. Adults are pointed at a local helpline.

`platform_settings/moderation` thresholds: `adultMildInsult` (`hold` or `block`), `personalData`, `imageWithoutVision`. Under-18 spaces ignore a looser insult or personal-data setting and stay at block.

### moderation_strikes/{userId}

`count`, `action` (`warning`, `mute_24h`, `mute_7d`, `suspend`), `mutedUntilMs`, `suspended`, `updatedAtMs`.

### moderation_actions/{id}

`userId`, `action`, `category`, `severity`, `surface`, `atMs`. Admins read the strike log here.

### moderation_audit/{id}

Removed text. `authorId`, `surface`, `text`, `category`, `severity`, `institutionId`, `createdAtMs`, `purgeAtMs` (90 days). `POST /api/moderation/purge` deletes expired rows.

### moderation_appeals/{id}

`queueId`, `userId`, `note`, `status` (`open`, `restored`, `upheld`), `resolvedBy`, `resolvedAtMs`.

`POST /api/moderation/appeal` and `POST /api/moderation/appeal-resolve`.

`moderation_queue` gains `category`, `severity`, `institutionId`, `authorMessage`. Institution admins see their school's open rows.

### moderation_events/{id}

`authorId`, `targetIds`, `category`, `severity`, `surface`, `atMs`. Used for repeat targeting, pile-ons, and mood change. Index, not deployed: `authorId` ASC, `atMs` DESC.

## Safeguarding alerts

Push category `safety`. Critical alerts set `force: true` and are delivered even when `notificationPrefs.safety` or device `prefs.safety` is false. Other safety alerts respect the toggle. A missing toggle stays on.

Severity timing: `low` weekly digest only, `medium` same day, `high` and `critical` immediate. Critical also sets `escalateAtMs` 15 minutes out. `POST /api/moderation/escalate` marks an unacknowledged critical alert `escalated`.

Under-18 routing, per `safeguarding_settings/{institutionId}`: safeguarding lead (`leadIds`) always, class teacher when `tellTeacher` is not false, linked parents from `users.childIds`. `parentLevel` is `all`, `medium`, or `high`. High and critical cannot be switched off for minors. Parents are not told about adults. Parent copy names only their own child. Schools see the redacted excerpt; full text stays in the case file. Push text never includes graphic words.

High and critical also queue `safety_mail` (`status: queued`) for email. Flagged content is stored with `trainingUse: false` and is not used to train models.

### safeguarding_cases/{id}

`institutionId`, `authorId`, `authorName`, `targetIds`, `category`, `severity`, `surface`, `space`, `status` (`open`, `monitoring`, `resolved`), `outcome`, `assignees`, `patterns` (`repeat_target`, `pile_on`, `mood_change`), `timeline` (`atMs`, `kind`, `note`, `actorId`), `createdAtMs`, `trainingUse`.

### safeguarding_alerts/{id}

`caseId`, `userId`, `audience` (`safeguarding_lead`, `teacher`, `author_parent`, `victim_parent`, `admin`, `moderator`), `severity`, `category`, `timing` (`digest`, `same_day`, `immediate`), `title`, `body`, `excerpt`, `fullTextVisible`, `actionTaken`, `guide` (ET AI conversation guide), `status` (`open`, `acknowledged`, `escalated`), `ackAtMs`, `escalateAtMs`, `institutionId`, `channels` (`inbox`, `push`, `email`), `createdAtMs`.

Buttons the app should render: acknowledge (`POST /api/moderation/acknowledge`), view (`GET /api/moderation/case?id=`), contact the school (open the case), mark resolved (`POST /api/moderation/case-status`).

`GET /api/moderation/case-pdf?id=` returns `pdfBase64`. `POST /api/moderation/false-positive` records `safety_feedback` and can hold adult mild-insult thresholds at `hold`. `POST /api/moderation/case-note` appends a timeline note.

### safeguarding_settings/{institutionId}

`leadIds`, `tellTeacher`, `parentLevel`, `quietStart`, `quietEnd`, `thresholds`. Critical alerts ignore quiet hours.

## Founders hub

Poket School Founders. Off until `platform_settings/network.foundersOn` is true. Public matching is adults with `optIn: true` only.

### founder_profiles/{uid}

`optIn`, `hasIdea`, `idea`, `roles` (`technical`, `business`, `design`, `domain`), `commitment` (`full_time`, `part_time`, `exploring`), `location`, `remote`, `timezone`, `industries`, `skills` (`name`, `verified`), `lookingFor`, `looking`, `stage` (`idea`, `building`, `launched`, `growing`), `links`, `ageTier`, `institutionId`, `verifiedIdentity`, `moderation`, `disclaimer`.

Index, not deployed: `optIn` ASC, `ageTier` ASC.

### founder_swipes/{fromId}_{toId}

`fromId`, `toId`, `choice` (`skip` or `interested`), `createdAtMs`.

### founder_matches/{pair}

Written when both choices are `interested`. `userIds`, `createdAtMs`. Messages in `founder_messages` require this row.

### startups/{id}

`name`, `problem`, `solution`, `stage`, `ownerId`, `hiring`, `moderation`, `disclaimer`. `startup_members/{startupId}_{uid}` role `founder`. Hiring also writes `job_openings`.

### startup_applications/{id}

`startupId`, `userId`, `note`, `status`, `moderation`.

### founder_programmes/{id}

Run by a school or organisation. `orgId`, `name`, `kind`, `form` (question strings), `ownerId`, `institutionId`, `status`.

### programme_applications/{id}

`programmeId`, `userId`, `answers`, `status`, `moderation`. Review pipeline is the `status` field.

### school_founder_teams/{pair}

Under-18 classmates in the same institution. `userIds`, `institutionId`, `advisorRequired`. Not part of public matching.

TODO(institutions): programme mentors should read the alumni mentoring collection when it exists. Until then mentor ids are not invented.

Weekly suggestions: `POST /api/founders/digest` sends push category `network` and queues an email. The email is opt-in through `notificationPrefs.networkDigest` on the account; the digest route queues the mail row for the app to honour that flag.

| Method | Path |
| --- | --- |
| POST | `/api/founders/profile` |
| GET | `/api/founders/suggestions` |
| POST | `/api/founders/swipe` |
| POST | `/api/founders/message` |
| POST | `/api/founders/startup` |
| POST | `/api/founders/startup-apply` |
| POST | `/api/founders/programme` |
| POST | `/api/founders/programme-apply` |
| POST | `/api/founders/school-team` |
| POST | `/api/founders/digest` |

Founders Pro is `foundersProOn` plus `foundersProCents`, sandbox only, default off.

## Groups and associations

`groups/{id}`: `name`, `kind` (`interest`, `club`, `study`, `association`, `alumni`, `professional`), `visibility` (`public`, `private`, `secret`), `description`, `rules`, `institutionId`, `schoolOnly`, `advisorId`, `ownerId`, `status` (`pending`, `active`, `archived`), `interests`, `skills`, `classIds`, `inviteCode`, `moderation`, `createdAtMs`.

A student can create a group only inside their institution, with `advisorId` set. `groupApprovalMode: school` leaves `status: pending` until `POST /api/groups/moderate` with `action: approve`. `auto` activates it. Members who are under 18 must share a `classIds` entry or be staff. Secret groups are invite only.

`group_members/{groupId}_{uid}`: `role` (`founder`, `president`, `officer`, `moderator`, `member`, `advisor`), `posts`.

`group_posts/{id}`: `kind` (`post`, `poll`, `file`, `announcement`, `chat`), `body`, `poll`, `fileName`, `moderation`. Chat for minors requires an active school group with an advisor. The message is stored, which is the log.

`group_events/{id}`: `title`, `whenLabel`, `groupId`. `group_rsvps/{eventId}_{uid}`: `going`.

`group_requests/{id}`: private groups. `groupId`, `userId`, `status`.

`group_badges/{uid}_{badge}`: `founder`, `officer`, `active_member`.

`group_leadership/{uid}_{groupId}`: `title`, `verified`. Verified only after the advisor or the school confirms. TODO(institutions): copy the verified line onto `cv_items/{uid}` when the CV PR lands.

`group_dues/{id}`: sandbox, refused while `groupDuesOn` is false.

| Method | Path |
| --- | --- |
| POST | `/api/groups/create` |
| POST | `/api/groups/join` |
| POST | `/api/groups/post` |
| POST | `/api/groups/event` |
| POST | `/api/groups/rsvp` |
| POST | `/api/groups/appoint` |
| POST | `/api/groups/confirm` |
| POST | `/api/groups/moderate` |
| POST | `/api/groups/invite` |
| POST | `/api/groups/dues` |
| GET | `/api/groups/discover` |

Discovery ranks by shared school, skills, and interests. Institution admins approve, archive, and transfer ownership from `/dashboard/institution/groups`.

Push for group activity reuses `network`. Critical safety on a group post uses `safety`.

## Push categories added

`network` and `safety`, on both `lib/push.ts` and `lib/platform/push.ts`. The reject string is `category must be goals, flags, attendance, digests, grades, assignments, general, achievements, network, or safety.`

Account toggles: `notificationPrefs.network`, `notificationPrefs.safety`, `notificationPrefs.networkDigest`.

## Hotline

Parent-to-school tickets. The website shape here is canonical. Client writes are denied. Do not deploy these rules from this branch.

`hotline_tickets/{id}`

| Field | Notes |
| --- | --- |
| `institutionId`, `studentId`, `parentUid` | The parent must have `studentId` in `users.childIds`. |
| `addressedTo` | `teacher`, `academic_lead`, `principal`, `safeguarding_lead`. |
| `assigneeUid` | Staff member, or empty. |
| `category` | `academic`, `attendance`, `fees`, `transport`, `wellbeing`, `bullying`, `safeguarding`, `technical`, `feedback`, `other`. Fees and billing are stored as `fees`. `POST /api/hotline/create` accepts the app alias `fees_billing` and stores `fees`. |
| `priority` | `low`, `medium`, `high`. Maps onto the shared severity in `lib/alerts/model.ts` (`low`, `medium`, `high`). Hotline has no critical priority. |
| `status` | `pending`, `in_progress`, `kiv`, `solved`, `closed`. |
| `kivReason`, `kivFollowUpAt` | Required together when status is `kiv`. |
| `slaDueAt` | Working hours in the institution timezone. High is 4 working hours, medium is 1 working day, low is 3 working days. Default window is Monday to Friday, 08:00 to 17:00, `Asia/Kuala_Lumpur`, plus `institutions/{id}.holidays`. |
| `escalationLevel` | `GET /api/cron/hotline` with `Authorization: Bearer CRON_SECRET` moves an overdue ticket to teacher, then academic lead, then principal. Bullying and safeguarding never leave the safeguarding lead and the principal. |
| `reopenUntil`, `solvedAt` | A parent can reopen within 7 days of `solved`. |
| `satisfaction` | `{ rating: 1–5, comment }` after the parent rates. |
| `body`, `safeguardingCaseId` | Sensitive categories open `safeguarding_cases/{id}` with `source: hotline`. Other staff cannot read those tickets. |
| `source` | Empty for a parent hotline ticket. `student_safety_report` and `danger_now` are student safeguarding tickets. See [Student safety reports](#student-safety-reports). |
| `reporterUid`, `reporterName`, `safetyType` | Set on student reports. The API returns the reporter only to a super admin, the principal, or the safeguarding lead at that school. Peers, teachers, and institution admins receive neither the id nor the name, except the danger notice which carries the student's name to the form teacher and to parents who were actually notified. |
| `flagged`, `throttled`, `flagReason` | A soft cap flags a report. It never refuses one. |
| `authorities` | `{ required: yes \| no \| unsure, reason, status, informed }`. `no` needs a reason. `status` is `not_required`, `to_be_informed`, `informed`, `acknowledged`, or `closed_by_authority`. `informed` is `{ agency, contact, reference, at, by }`. Create accepts `authoritiesRequired` and `authoritiesReason`, and also the app object `authority.required` / `authority.reason`. The stored field stays `authorities`. |
| `authoritiesRemindedAt` | A ticket in `to_be_informed` is reminded after 4 hours. It cannot be solved or closed while the status is still `to_be_informed`. |
| `createdAt`, `updatedAt` | Milliseconds. |
| `chainSeq`, `chainHead` | Next event is `chainSeq + 1`. `chainHead` is the hash of the latest event, or 64 zeroes before the first event. |
| `legalHold` | `{ on, by, at, reason }`. Only `role: admin` (super admin) or `staffPost: principal` can set or clear it. Both actions are audited. While `on` is true, internal redaction is blocked. |
| `internalRedacted` | A separate staff action may blank `body` only when no legal hold is on. The previous body stays in the event diff. |

`hotline_tickets/{id}/comments/{commentId}`: `authorId`, `authorName`, `body`, `internal` (staff-only when true), `parentId` for a thread, `at`.

`hotline_tickets/{id}/attachments/{fileId}`: `label` is `evidence`, `mc`, `report`, `photo`, or `other`. `internal` hides the file from the parent. `kind` is `photo`, `mc`, `pdf`, `screenshot`, or `video`. `mime`, `bytes`, `storagePath`, `commentId`, `uploadedBy`, `at`, `scanEngine`, `scanDetail`, `exifStripped`. Medical certificates (`mc`) and safeguarding evidence are returned only to the assigned staff. The server strips EXIF and GPS even when the client already did, checks the MIME against the bytes, and runs the malware scan hook. Limits are 10 MB for images, 15 MB for PDF, and 50 MB for video.

Storage path: `institutions/{institutionId}/hotline/{ticketId}/{fileId}-{name}`. Clients cannot read or write it. `GET /api/hotline/file` returns a signed URL and writes a `viewed` event.

`hotline_tickets/{id}/events/{eventId}` is append-only. See [Tamper-evident logs](#tamper-evident-logs). Actions include `created`, `assigned`, `status_change`, `escalated`, `reopened`, `rated`, `uploaded`, `viewed`, `authorities`, `authority_reminder`, `legal_hold_set`, `legal_hold_cleared`, `internal_redacted`, `exported`, and `delivery`.

| Method | Path |
| --- | --- |
| POST | `/api/hotline/create` |
| GET | `/api/hotline/list` |
| GET | `/api/hotline/get?id=` |
| POST | `/api/hotline/comment` |
| POST | `/api/hotline/assign` |
| POST | `/api/hotline/status` |
| POST | `/api/hotline/reopen` |
| POST | `/api/hotline/rate` |
| POST | `/api/hotline/attach` |
| POST | `/api/hotline/authorities` |
| GET | `/api/hotline/file?ticketId=&attachmentId=` |
| GET | `/api/hotline/analytics` |
| GET | `/api/hotline/verify?id=` |
| GET | `/api/hotline/export?id=&format=csv\|pdf` |
| POST | `/api/hotline/legal-hold` |
| POST | `/api/hotline/redact-internal` |
| GET, POST | `/api/hotline/share` refuses. Hotline tickets cannot be shared. |
| GET | `/api/cron/hotline` |

Analytics hide any group under 5: category counts, SLA compliance, average resolution time, satisfaction, and the overdue count. The parent desk is `/dashboard/parent/hotline`. Staff queues are `/dashboard/teacher/hotline`, `/dashboard/admin/hotline`, and `/dashboard/institution/hotline`.

Push category `hotline`. It can be muted with `notificationPrefs.hotline`. Student safety reports, danger alerts, high safeguarding tickets, and published emergency alerts also notify staff by push and email. See [Staff case notices](#staff-case-notices).

## Emergency alerts

Amber and other emergency alerts. Publishing is server-only. A verified principal or admin creates a draft. A different verified staff member confirms it, and only then is it public. Do not deploy these rules from this branch.

`emergency_alerts/{id}`

| Field | Notes |
| --- | --- |
| `institutionId` | School that owns the alert. |
| `type` | `missing_child`, `lockdown`, `weather`, `medical`, `general`. Severity uses `lib/alerts/model.ts`: missing child, lockdown, and medical are `critical`; weather is `high`; general is `medium`. Create accepts the app alias `missing` and stores `missing_child`. |
| `title`, `description`, `subjectName` | Resolve, retract, and withdrawn consent keep `subjectName` on the document. Public and OG views hide it. |
| `region` | `{ country, state, city }` copied from `institutions/{id}`. A home address is never stored. |
| `photoUrl`, `guardianConsent`, `consentId`, `consentWithdrawn`, `publicRedacted` | A public photo is `attachment:{fileId}` only when guardian consent is true and that consent record id is set. Withdrawing consent sets `consentWithdrawn` and `publicRedacted`, turns sharing off, and sets each public attachment to `public: false`. The stored name, photo URL, and file bytes stay. |
| `authorities` | Same shape as a hotline ticket. Public share needs `informed`, `acknowledged`, or `closed_by_authority`. A missing-child draft needs that record before it is saved. |
| `authoritiesInformed` | Legacy mirror of `authorities.informed`: `{ agency, referenceNumber, informedAt }`. |
| `authoritiesRemindedAt` | Staff are reminded after 1 hour while the status is `to_be_informed`. |
| `status` | `draft` until the second staff member confirms, then `active`, `updated`, `resolved`, `closed`, or `retracted`. Closed alerts are archived. |
| `publishedBy`, `publishedAt` | The creator. `publishedAt` is set at confirmation. |
| `confirmedBy`, `confirmedAt` | Must be a different verified staff member. |
| `resolved` | `{ by, at, outcome, authoritiesClosed }`. |
| `publicShareEnabled`, `sharePaused` | Sharing stays off until the authorities are informed. It pauses when the review window lapses, on retract, and when consent is withdrawn. |
| `reviewEveryMs`, `reviewDueAt`, `lastReviewBy`, `lastReviewAt` | Default review is 24 hours. The interval is configurable and capped at 48 hours. Create accepts `reviewEveryMs`, or the app number `reconfirmHours`, which is converted to milliseconds and then clamped. `GET /api/cron/emergency` pauses public sharing and notifies admins when the review is overdue. |
| `retractedReason` | Required for `retracted`. The public page is noindex, the OG version increments, share is disabled, a correction is posted on the wall and the feed, and a correction push goes to the stored recipient list. |
| `ogVersion` | Incremented on resolve, retract, review pause, and consent withdrawal so share URLs can drop a cached card (`?v=`). |
| `counts` | `{ views, shares }`. A share count increases only after a logged share of an active public alert. |
| `chainSeq`, `chainHead` | One chain covers `audit`, `updates`, and `consent`. |
| `legalHold` | `{ on, by, at, reason }`. Only a super admin or the principal can set or clear it. Public redaction still happens while a hold is on. Internal redaction does not. |
| `internalRedacted` | Staff may blank `subjectName` and `photoUrl` on the parent only when no legal hold is on, after those values are written into the chain diff. |
| `createdAt` | Milliseconds. |

`emergency_alerts/{id}/updates/{updateId}` is an append-only chain entry with `action: updated` and `body`.

`emergency_alerts/{id}/attachments/{fileId}`: same file shape as a hotline attachment, plus `updateId`, `guardianConsent`, `consentRecordId`, and `public`. Only a photo with guardian consent and a consent record can be public. Storage path: `institutions/{institutionId}/alerts/{alertId}/{fileId}-{name}`, served by a signed URL.

`emergency_alerts/{id}/recipients/{uid}`: the people who received the original push. A retraction notifies this list.

`emergency_alerts/{id}/consent/{consentId}` is an append-only chain entry (`action: consent`). Fields: `details`, `photo`, `regions`, `channels`, `disclaimer`, `guardianName`, `relation`, `signature`, `signatureKind` (`drawn` or `typed`), `at`, `ip`, `clientDevice` (the user agent), `version`. The chain `device` object is separate and stores only `platform`, `appVersion`, and `ipHash`. A missing-child alert cannot be published without one. The server creates a version and never updates it.

`emergency_alerts/{id}/audit/{auditId}` is an append-only chain entry. Actions include `created`, `confirmed`, `resolved`, `closed`, `uploaded`, `viewed`, `authorities`, `authority_reminder`, `consent_withdrawn`, `reviewed`, `review_paused`, `retracted`, `reported`, `shared`, `legal_hold_set`, `legal_hold_cleared`, `internal_redacted`, `exported`, and `delivery`. An update lives on `updates`, and a consent version lives on `consent`. They share `chainSeq` with `audit`.

`alert_reports/{id}`: `alertId`, `reporterId` (empty for an anonymous visitor, and visible to staff only), `reason`, `falseReport`, `flaggedBy`, `at`, `day`. Three reports per user or anonymous visitor per day. A second false report sets `alert_report_bans/{uid}.banned`. Anonymous reports are rate limited, and they require a captcha when `CAPTCHA_SECRET` is set. Each report is copied to `moderation_queue` with `surface: emergency_alert`.

`alert_report_rate/{id}` and `alert_report_bans/{uid}` back the limits. Do not deploy these rules from this branch.

`emergency_rate/{uid}_{YYYY-MM-DD}`: at most 3 drafts a day.

A confirmed alert writes a pinned `network_posts` document (`kind: emergency`) for the school page and the feed. Resolve updates that post. The public view and the OG image hide the name and photo, sharing turns off, the page is `noindex`, and `ogVersion` increments. The stored name and photo stay on the alert.

Public page: `/alerts/[id]`. OG image: `/alerts/[id]/opengraph-image`. The card is a brand frame with type, region, and time. A photo is named on the card only when consent is on and the alert is still open. The page shows `If you have information, contact {agency} {reference}` and the public emergency number (999 in Malaysia). It does not show school staff numbers. It is not a replacement for emergency services.

| Method | Path |
| --- | --- |
| POST | `/api/emergency/create` |
| POST | `/api/emergency/confirm` |
| POST | `/api/emergency/update` |
| POST | `/api/emergency/resolve` |
| POST | `/api/emergency/close` |
| POST | `/api/emergency/authorities` |
| POST | `/api/emergency/review` |
| POST | `/api/emergency/retract` |
| POST | `/api/emergency/attach` |
| POST | `/api/emergency/consent` |
| POST | `/api/emergency/withdraw-consent` |
| POST | `/api/emergency/report` |
| POST | `/api/emergency/report-false` |
| GET | `/api/emergency/public?id=` |
| GET | `/api/emergency/public-file?id=&attachmentId=` |
| GET | `/api/emergency/share?id=&channel=whatsapp\|facebook\|x\|copy` |
| POST | `/api/emergency/share` |
| GET | `/api/emergency/verify?id=` |
| GET | `/api/emergency/export?id=&format=csv\|pdf` |
| POST | `/api/emergency/legal-hold` |
| POST | `/api/emergency/redact-internal` |
| GET | `/api/emergency/stats?id=` |
| GET | `/api/emergency/reports?id=` |
| GET | `/api/emergency/file?alertId=&attachmentId=` |
| GET | `/api/cron/emergency` |

Push category `emergency`. It is targeted to institution members and to profiles whose country, state, and city match `region`. Delivery sets `force` and `sound: emergency`, so quiet hours and a muted preference do not apply. There is no mute toggle for it.

A student's **I'm in danger now** action is not one of these published alerts. It is a `hotline_tickets` document with `source: danger_now` and a linked `safeguarding_cases` document at severity `critical`. Parents who are not excluded still get an `emergency` push with `force`, `sound: emergency`, the student's name, and the time. Staff get the lock-screen push and the confidential case card in [Staff case notices](#staff-case-notices). The parent-exclusion rule still removes every parent link from that parent push.

Admin desks: `/dashboard/admin/emergency` and `/dashboard/institution/emergency`.

The public page has a report-this-alert button. Storage rules deny client access to `institutions/{id}/hotline/...` and `institutions/{id}/alerts/...`. `docs/HOTLINE_ALERTS_SCHEMA.md` is not on a branch, so this website section is canonical.

## Student safety reports

A student can send a safety report, or tap **I'm in danger now**, without a parent opening a hotline ticket. The website shape here is canonical. `docs/HOTLINE_ALERTS_SCHEMA.md` is not on a branch. Client writes are denied. Do not deploy these rules from this branch.

The shield is one tap on the student home (`/dashboard/student`) and in Community. The form is `/dashboard/student/safety`. A parent or staff notice is `/dashboard/safety/{ticketId}`.

### Report

`POST /api/safety/report`. The type alone is enough. Optional fields are `description`, `who`, `where`, `when`, and evidence through the existing hotline attachment rules (`label: evidence`). Types: `bullying`, `cyberbullying`, `harassment`, `abuse`, `self_harm_concern`, `discrimination`, `unsafe_other`.

`where` is empty or one of `in_school`, `online`, `transport`, `other`. Anything else is `BAD_REQUEST` with `Choose where this happened.`

Each report is a `hotline_tickets` document:

| Field | Notes |
| --- | --- |
| `source` | `student_safety_report`. |
| `category`, `priority`, `addressedTo` | `safeguarding`, `high`, `safeguarding_lead`. |
| `authorities.required` | `unsure`. |
| `reporterUid`, `studentId` | The signed-in student. `parentUid` stays empty. |
| `chainSeq`, `chainHead`, `legalHold` | Same append-only hash chain and legal hold as other tickets. |

It also opens `safeguarding_cases/{id}` with `source: student_safety_report` and `category: safeguarding`. Firestore rules deny client reads of that case, of the ticket, and of its `events` and `comments`, including for a super admin using the client SDK. The Admin SDK is the writer. API responses are projected:

| Viewer | Response |
| --- | --- |
| Super admin, principal, or safeguarding lead at the school | Full ticket, including the reporter. |
| The reporter | Tracker only: `received`, `being_looked_at`, `action_taken`, `closed`. No staff notes, events, comments, or assignee. |
| Anyone else | Hidden. |

`users.ageTier` or a computed tier from `users.dateOfBirth` decides whether a safety-report push uses `force`. A missing tier is not treated as under 13. Every student safety report notifies the form teacher, the safeguarding lead, and the principal. When the reporter is under 13 the push category stays `safety` and `force` is true, so a muted preference does not delay it. The email is the same confidential case card as every other staff notice, and it includes the report. See [Staff case notices](#staff-case-notices). The report still exists when mail cannot be sent. The chain records a failed delivery instead of skipping the email.

The third report from the same student on a UTC day, and every report after it, sets `throttled` and `flagged` with `flagReason: rate`, and the chain records `safety_report_flagged`. `POST /api/safety/report` and `POST /api/safety/danger` do not use the generic API rate limit, so a burst cannot return 429. Nothing in this path returns a refusal because of volume.

`GET /api/safety/tracker` is the student's list. `GET /api/safety/helplines` returns the lines for the student's country, or Malaysia when the country has none. Defaults are Talian Kasih `15999` (24 hours) and Befrienders KL `+603-7627 2929` (24 hours, free and confidential). A super admin (`role: admin`) replaces the catalogue with `POST /api/safety/helplines`. Stored at `safety_helplines/catalog` as `{ lines: [{ country, name, number, note }] }`. There is no second per-institution helpline collection. Signed-in clients may read the catalogue. They cannot write it.

### I'm in danger now

`POST /api/safety/danger`. The screen shows the country's emergency number immediately (999 in Malaysia) from `emergencyNumber`. The server then creates a `danger_now` ticket and a safeguarding case with `source: danger_now`, `category: safeguarding`, `severity: critical`, and `dangerId` equal to the ticket id. Hotline priority stays `high`, because hotline has no critical priority. The case source stays `danger_now` so client rules can keep excluding it.

Place is optional and typed. The student opts in once. The server stores `{ place, at }` only when `shareLocation` is true and the trimmed place is at least 2 characters (maximum 160). There is no GPS, no `lat` or `lng`, no later update, and no continuous tracking.

Parent exclusion is `dangerFanOut` in `lib/safety/policy.ts`. Parents are left out when the type is `abuse`, `concernRole` is `parent` or `guardian`, `who` names a parent or guardian, or `dontTellParents` is true. The fan-out result then contains no `parent_links` uid. Only the safeguarding lead, the principal, and the form teacher are pushed. `lib/safety/policy.test.ts` covers that exclusion.

The lead records `familyDecision: { contact: now | later | not_now, when, reason, by, at }` with `POST /api/safety/family`. Input accepts `contact` as `now` and `do_not_contact` as `not_now`. The stored values stay `now`, `later`, and `not_now`. That action is an audit entry. It does not message parents.

`users.formTeacherUid` is the form teacher. If it is empty, the server looks for a teacher at the school whose `classId` or `classIds` matches the student's `classId`.

`POST /api/safety/ack` writes `acknowledged` on the chain and sets `staffAckAt` or `parentAckAt`. A parent can acknowledge only when they are in `notifiedParentUids`. `GET /api/cron/hotline` calls `escalateUnackedDanger`. If `now - createdAt` is strictly greater than five minutes and `staffAckAt` is still empty, it sets `dangerEscalatedAt` once, writes chain action `danger_escalated`, and pushes the stored `staffUids` again (lead, principal, and form teacher). Exactly five minutes does not escalate. It is not a new cron entry.

`POST /api/safety/false-danger` increments `safety_flags/{uid}.falseDanger`. Two earlier false triggers flag the next danger alert with `flagReason: repeat_false`. The alert is still created and still sent. Clients cannot read or write `safety_flags`.

### Rules and indexes

Not deployed.

`hotline_tickets` get stays available to the parent or a super admin only when `source` is neither `student_safety_report` nor `danger_now`. List stays false. `events` and `comments` on those sources are not client-readable. `safeguarding_cases` with those sources are not client-readable. `safety_helplines` is signed-in read, write false. `safety_flags`, `safety_rate`, and `mail_deliveries` are read and write false.

Indexes, not deployed:

- `hotline_tickets`: `reporterUid` ASC, `createdAt` DESC
- `hotline_tickets`: `source` ASC, `status` ASC
- `users`: `institutionId` ASC, `staffPost` ASC

| Method | Path |
| --- | --- |
| POST | `/api/safety/report` |
| POST | `/api/safety/danger` |
| GET | `/api/safety/tracker` |
| GET | `/api/safety/helplines` |
| POST | `/api/safety/helplines` |
| GET | `/api/safety/notice?id=` |
| POST | `/api/safety/ack` |
| POST | `/api/safety/family` |
| POST | `/api/safety/false-danger` |
| POST | `/api/safety/notify` |
| POST | `/api/mail/resend` |

The parent desk, staff queue, and emergency desk use the dashboard kit from PR #131 (`StatCard`, `AlertCard`, `EmptyState`) inside the existing dashboard chrome. Routes: `/dashboard/parent/hotline`, `/dashboard/teacher/hotline`, `/dashboard/admin/hotline`, `/dashboard/institution/hotline`, `/dashboard/admin/emergency`, `/dashboard/institution/emergency`, `/dashboard/student/safety`, and the public page `/alerts/[id]`. A staff case link for an alert opens `/dashboard/admin/emergency?id={alertId}` and fills the alert id.

## Staff case notices

Staff are notified when a student files a safety report, taps **I'm in danger now**, a parent opens a high-priority safeguarding hotline ticket, or a second staff member confirms an emergency alert. The form teacher, the head, and the principal each get a push and an email. Parents are not on this list. Do not deploy the `mail_deliveries` rule from this branch.

### Who is notified

The recipient list is [Alert recipients matrix](#alert-recipients-matrix). This section describes the lock-screen copy, the confidential case card, and the delivery log. Amber and emergency alerts are not emailed as a staff case card. They use the community push from that matrix.

The confidential card still goes to the staff uids from the resolver, not to parents. The card lists approved guardian names, phone numbers, and email addresses even when those parents were excluded, and it says `Parents were not notified.`

`POST /api/safety/report`, `POST /api/safety/danger`, a high safeguarding `POST /api/hotline/create`, and `POST /api/emergency/confirm` call the notifier after the document is written. A mail failure does not fail the ticket or the alert. The public region push from `notifyRegion` still runs. A person who is both a region recipient and a staff recipient can receive both.

### Push

Lock-screen text only. Title is the short type (`Danger now`, `Bullying`, `Missing child`, and the other labels in `lib/staff-notice/copy.ts`). Body is `{first} {LastInitial}. · {class} · {HH:MM Asia/Kuala_Lumpur}. Open case.` A single name stays as that name. An empty name and class become `School`. The body has no description, phone, or email.

| Kind | Category | Force | Sound |
| --- | --- | --- | --- |
| `student_safety_report` | `safety` | `true` only when the student is under 13 | none |
| `danger_now`, high safeguarding ticket, `emergency_alert` | `emergency` | `true` | `emergency` |

Under 13 is `users.ageTier === 'under13'` or `ageTierFromDob`. A missing tier is not under 13. The five-minute danger escalation re-push uses this same lock-screen copy. It does not send a second email.

### Email

`POST /api/safety/notify` is server-only. It runs before any user session check. `Authorization: Bearer $SAFETY_NOTIFY_SECRET` must match with a constant-time compare. A missing secret, a wrong secret, or a Firebase user token is `401`. Firebase admin not configured is `503` after the secret check. The body is exactly one of `{ "ticketId": "..." }` or `{ "alertId": "..." }`. The id matches `^[A-Za-z0-9_-]{1,128}$`. Anything else is `400`. The server loads the document. Client fields are not trusted as the child's name, contacts, or description. A ticket that is not a safety report, a danger alert, or a high safeguarding ticket returns `{ "skipped": true }`.

The message is a confidential staff case card (`lib/staff-notice/template.ts`):

| Field | Source |
| --- | --- |
| Subject | `Confidential: {type}`. The child's name and the description are not in the subject. |
| Opening line | Open this message on a private screen. |
| Child | `users.name`, or the alert `subjectName`. |
| Student number | Optional `users.studentNumber`. Missing values render as `Not on file`. |
| Class | `className`, then `classId`, then `yearGroup`. |
| Photo | `users.avatarUrl` or the alert `photoUrl`, and only when the URL is `https`. |
| Parents or guardians | Approved `parent_links` for the student: name, phone, and email. Staff see these even when parents were excluded from notification. |
| Description | Ticket body, or the alert description. |
| Location | Ticket `location.place` when it was shared. Alert `region.city` and `region.state`. Omitted when empty. |
| Time | ISO time from `createdAt` or `publishedAt`. |
| Case | The ticket or alert id. |
| Link | `{origin}/dashboard/safety/{ticketId}` or `{origin}/dashboard/admin/emergency?id={alertId}`. Origin is `NEXT_PUBLIC_APP_URL`, then `APP_URL`, then `https://poketschool.ai`. |
| Footer | `Confidential, do not forward`. |

HTML uses the blue palette (`#1E6A83`, `#2786A4`, `#6FBBCE`, page `#F3F7F8`, ink `#17343C`). The same card has a plain-text part.

### Mail provider

`lib/mail/` picks one adapter:

| Mode | When |
| --- | --- |
| Resend | `RESEND_API_KEY` is set. `POST https://api.resend.com/emails`. From is `MAIL_FROM`, or `Poket School <safety@poketschool.ai>`. |
| SMTP | No Resend key, and `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set. The existing nodemailer path. |
| Console | Neither is set and `NODE_ENV` is not `production`. The message is logged and treated as sent. The provider id starts with `console-` and is not stored for webhooks. |
| Failed | Neither is set and `NODE_ENV` is `production`. The send returns `Email is not configured.` The institution admin is notified. |

Resend needs a verified sender domain for `poketschool.ai`. Add the SPF and DKIM TXT records from the Resend dashboard for that domain, and keep `MAIL_FROM` on it. Do not send from an unverified domain. The API key is not written to logs. Production logs do not include the email body.

Each send retries inline with delays `0`, `400`, and `1600` milliseconds (`MAIL_BACKOFF_MS`), up to three attempts. The same helper retries push. A push with `sent === 0` is a failure, including when the user has no device token. There is no new cron. `vercel.json` still schedules only `/api/cron/insights`.

### Delivery log

Each recipient and each channel appends chain action `delivery`. Ticket entries go to `hotline_tickets/{id}/events`. Alert entries go to `emergency_alerts/{id}/audit`. A status change is a new entry. Entries are never updated. `diff` is `{ before: { status }, after: { status, channel, recipientUid } }`. Extra fields, all strings:

| Field | Values |
| --- | --- |
| `channel` | `push` or `email`. |
| `recipientUid` | Staff uid. Empty only when no institution admin exists. |
| `status` | `queued`, then `sent` or `failed`. A webhook later appends `delivered`, `opened`, or `failed`. |
| `provider` | `push`, `resend`, `smtp`, `console`, or `none`. |
| `providerId` | Provider message id. Empty for push and for the console adapter. |
| `error` | Short failure text. Empty when the send was accepted. |
| `fallback` | `email` when push failed and email was sent. `push` when email failed and push was sent. Otherwise empty. |

The chain does not store the description, a phone number, or an email address. Both channels are always tried. When one fails and the other is sent, a further `delivery` entry is appended on the surviving channel with `fallback` set. If either channel fails, or nobody was eligible, the institution admin (`role: institution_admin` at that school) gets a minimal push: title `Staff notice failed`, body `Open case.`, category `safety`, `force: true`. If that push fails, one email is sent with subject `Confidential: a staff notice failed`, the case link, and no child description or parent phone. That email does not start another full staff notice. If the school has no institution admin, one failed `delivery` entry records `No institution admin is on file.`

`mail_deliveries/{id}` is a create-only pointer so a webhook can find the chain. The id is the provider id with characters outside `[A-Za-z0-9_.-]` removed. Fields: `providerId`, `parentPath`, `collection` (`events` or `audit`), `recipientUid`, `channel: email`, `caseId`, `createdAt`. Clients cannot read or write it. Console provider ids are not stored. A repeated create is ignored.

`POST /api/mail/resend` verifies the Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`) with `RESEND_WEBHOOK_SECRET`. The secret is `whsec_` plus the base64 key. The signed payload is `{id}.{timestamp}.{raw body}` and the digest is HMAC-SHA256. Signatures older than five minutes are rejected. A missing secret is `401`, including in development. `email.delivered` appends `delivered`, `email.opened` appends `opened`, and `email.bounced` or `email.complained` appends `failed`. The webhook entry's `before` status is `sent`. Unknown event types are acknowledged and ignored. Firebase admin not configured is `503` after the signature check.

After a ticket notice, the ticket stores `staffUids` and `formTeacherUid` with a merge. An alert does not gain those fields. The emergency desk reads `?id=` so the email link opens the matching alert.

## App reconciliation

The app proposal in the attached `HOTLINE_ALERTS_SCHEMA` was compared with this file. Website names stay stored. Compatible, safer app choices are adopted above: typed place instead of GPS, the `where` enum, Befrienders KL `+603-7627 2929`, strict five-minute escalation, input aliases, `safety_report_flagged`, and `category: safeguarding` plus `dangerId` on the danger case. The catalogue at `safety_helplines/catalog` is the only helpline store. A per-institution list does not replace it.

These differences remain. The app should follow the website value.

### Hotline

| Topic | Website | App proposal |
| --- | --- | --- |
| Category | Stored `fees`. Input alias `fees_billing` is accepted. | Stored `fees_billing`. |
| Authorities field | Stored `authorities`. Input alias `authority.required` / `authority.reason` is accepted. | Stored `authority`. |
| Deleted flag | No `deleted` flag. Tickets are not soft-deleted. | Soft `deleted`. |
| Legal hold | `{ on, by, at, reason }`. | `{ byUid, role, at, reason }` or null. |
| SLA calendar | `timezone`, `workStartMinutes`, `workEndMinutes`, `holidays`. Default Monday to Friday 08:00–17:00 `Asia/Kuala_Lumpur`. | `utcOffsetMinutes`, `workStartHour`, `workEndHour`, `openWeekdays`, `closedDates`, and 08:00–16:00. |
| Comments | Not soft-removed. No `removed` flag. | Soft-removed comments. |
| Share | `GET` and `POST /api/hotline/share` return 403 and write nothing. | The refusal is logged. |
| Events | Client create is denied. The server appends the hash chain. | `allow create: if isSignedIn()`. |

### Student safety

| Topic | Website | App proposal |
| --- | --- | --- |
| Under-13 push | Category `safety` with `force: true`. One send. | Category `hotline`, which can be muted. |
| Tracker updates | No `institution` push category. | An `institution` push for status updates. |
| Tracker comments | The tracker projection does not include staff or public follow-up comments. | The reporter sees public follow-up comments. |
| Identity | Super admin (`role === 'admin'`), the principal, and the safeguarding lead see the reporter. | Every admin sees only “A student”. |
| Peers | Hidden. The API is 403. | A redacted ticket that says “A student”. |
| Helplines | Super-admin catalogue `safety_helplines/catalog`. | An institution list that replaces the default. |
| Place | Typed `{ place, at }`. | GPS `{ lat, lng }`. Adopted: typed place. Do not send coordinates. |
| Family contact | Stored `now`, `later`, `not_now`. Input aliases `contact` and `do_not_contact` are accepted. | Stored `contact` / `do_not_contact`. |
| Danger case | `source: danger_now`, `dangerId` equals the ticket id, `category: safeguarding`. | `source: student_safety_report` without `dangerId`. |
| Escalation | Action `danger_escalated`. Comparison is strict `>`. Re-pushes every stored `staffUid`. | Action `escalated`. Comparison includes exactly five minutes. Re-pushes only the principal and an admin. |
| Rate flag | Also logs `safety_report_flagged`. | Flag fields only. |

### Emergency alerts

| Topic | Website | App proposal |
| --- | --- | --- |
| Type | Stored `missing_child`. Input alias `missing` is accepted. | Stored `missing`. |
| Status | `draft`, then `active`. There is no `review` status. | Status `review`. |
| Region | `{ country, state, city }`. No `radiusKm` and no `institutionName`. | `radiusKm` and `institutionName`. |
| Consent id | `consentId`. | `consentRecordId`. |
| Sharing pause | `sharePaused`. | `sharingPaused`. |
| Review window | `reviewEveryMs` and `reviewDueAt`. Input `reconfirmHours` is accepted and converted. | Stored `reconfirmHours` and `reconfirmBy`. |
| OG | `publicShareEnabled` and `ogVersion`. | `ogValid`. |
| Recipients | Subcollection `emergency_alerts/{id}/recipients/{uid}`. | `original_recipients` on the alert. |
| Storage | `institutions/{id}/hotline/{ticketId}/{fileId}-{name}` and `institutions/{id}/alerts/{alertId}/{fileId}-{name}`. | `hotline_tickets` or `emergency_alerts` `.../attachments/{fileId}`. |
| Audit | `diff.{before,after}`, `serverTimestamp`, `device.{platform,appVersion,ipHash}`, `seq`, `stream`, `actorRole`. | Flattened before/after, and the chain tip used as the verification hash. |
| Export hash | SHA-256 of the export text prefix. The chain head is a separate line, and it is the head before the export entry. | The chain tip is the verification hash. |
| Audit create | Clients cannot create audit documents. | `allow create: if isSignedIn()`. |

## Tamper-evident logs

Hotline events and emergency `audit`, `updates`, and `consent` are permanent. Firestore rules set `allow update, delete: if false` on those subcollections for every role, admin included. Clients cannot create them either. The Admin SDK bypasses rules, so the server is the only writer, and it only creates these documents inside a transaction (`lib/server/ledger.ts`). It never updates or deletes them. `lib/ledger/chain.test.ts` fails if a server file updates, deletes, or `.add()`s those paths.

Nothing in hotline or emergency is hard-deleted. Resolve, retract, and withdrawn consent set flags (`publicRedacted`, `consentWithdrawn`, `publicShareEnabled: false`) and mark public attachments `public: false`. Public pages, OG cards, and share links hide the name and photo. The internal document, the file bytes, and the log stay. A separate redact-internal action may blank the parent fields only when `legalHold.on` is false, and only after the previous values are in the chain diff. That overrides any earlier retention or purge rule for these records. The 90-day purge in `purgeAudit` deletes `moderation_audit` only.

### Audit entry

| Field | Notes |
| --- | --- |
| `seq` | Starts at 1. One sequence per ticket (`events`) or per alert (`audit` + `updates` + `consent`). |
| `actorUid` | The signed-in user, `system`, or `public`. A share stores `sha256(uid)` or the marker `anonymous`. |
| `actorRole` | Account role, `system`, `public`, `member`, or `anonymous`. |
| `action` | What happened. |
| `diff` | `{ before, after }` for the fields that changed. JSON values only. |
| `serverTimestamp` | Milliseconds from `Date.now()` inside the transaction. This is not `FieldValue.serverTimestamp()`, because a sentinel cannot be hashed. `at` is the same number. |
| `device` | `{ platform, appVersion, ipHash }`. `ipHash` is SHA-256 of the forwarded IP, or of `server` for cron. |
| `prevHash` | Previous entry hash. The first entry uses 64 zeroes. |
| `hash` | See below. |
| `stream` | `events`, `audit`, `updates`, or `consent`. |

The transaction reads `chainSeq` and `chainHead` on the parent, creates the next entry, then updates only those two parent fields. A retry cannot fork the chain.

### Hash

Canonical JSON sorts object keys, keeps array order, omits `undefined`, and omits the `hash` field. Then:

`hash = SHA-256(prevHash + canonicalJson(entry))`

`verifyChain` sorts by `seq`, requires `1..n` with no gaps, checks `prevHash`, recomputes each hash, and checks the parent `chainHead`. Staff call `GET /api/hotline/verify` or `GET /api/emergency/verify`. The queue and the emergency desk show **Verify integrity**.

### Legal hold

`legalHold` is `{ on: boolean, by: uid, at: milliseconds, reason: string }` on the ticket and on the alert. It starts `{ on: false, by: '', at: 0, reason: '' }`. Only a super admin (`role === 'admin'`) or a principal (`staffPost === 'principal'`) can set or clear it. Setting and clearing are both chain entries (`legal_hold_set`, `legal_hold_cleared`) with the before and after object. While `on` is true, redact-internal returns forbidden. Public redaction still runs.

### Export

School leads (`admin`, `institution_admin`, or principal) download the full log:

- CSV columns: `seq,actorUid,actorRole,action,serverTimestamp,prevHash,hash,stream,diff,device`, then a `chainHead,<head>` line, then `verificationHash,<sha256>`.
- PDF is a text rendering of the same lines, with `verificationHash <sha256>` last.

The verification hash is SHA-256 of the export text before the `verificationHash` line. For a PDF, hash that text prefix. Do not hash the PDF xref bytes. The chain head in the file is the head before the export entry. The export itself is then logged as `exported`, including that verification hash.

### Shares

WhatsApp, Facebook, X, and copy link are logged with `channel`, time, and a hashed actor or `anonymous`. Sharing works only for an `active` or `updated` alert whose public share is enabled, through `/alerts/{id}`. `GET /api/emergency/share` writes the log and redirects. Copy link redirects back to the alert page. Hotline has no share control. `GET` and `POST /api/hotline/share` return 403 and write nothing.

### Off-site backup

`GET /api/cron/firestore-backup` is a scheduled-export stub. It is disabled unless `FIRESTORE_BACKUP_ENABLED=true` and `FIRESTORE_BACKUP_BUCKET` are both set. Neither is set. It is not listed in `vercel.json`. Enabling it needs the Firebase Blaze plan and a locked bucket with a retention policy. Pending Harry's approval. Until then the route returns 503 with `pendingApproval: true` and `plan: blaze`, and it does not call the Google export API.

Retention: closed alerts stay archived and are not indexed. Retracted alerts are noindex. Public views drop the name and photo. Internal copies and the hash chain stay.

## Push categories added

`hotline` and `emergency`, on both `lib/push.ts` and `lib/platform/push.ts`. The reject string is `category must be goals, flags, attendance, digests, grades, assignments, general, achievements, network, safety, hotline, or emergency.`

Account toggle: `notificationPrefs.hotline`. Emergency alerts are not a preference. `pushBypassesQuietHours` is true for category `emergency`, so an all-staff alert and every other emergency push are delivered during quiet hours and when the device has muted the category.

## Alert recipients matrix

`resolveRecipients` in `lib/alerts/recipients.ts` is the only recipient list. Safety reports, danger alerts, hotline tickets, amber alerts, emergency alerts, Safety Desk cases, and all-staff alerts call it. Server notify paths do not keep a second staff or parent list.

| Kind | Who is included |
| --- | --- |
| Student safety report and I'm in danger now | Safeguarding lead, principal, and form teacher at the school, plus approved `parent_links`, unless the parent-exclusion rule applies. No other staff. An academic lead, another teacher, or an institution admin is not added. |
| Hotline ticket | The addressed post, the addressed uid when one is set, and every post in the escalation chain. Sensitive tickets (`bullying`, `safeguarding`) are the safeguarding lead and the principal. Other tickets are the teacher, the academic lead, and the principal. |
| Amber (`missing_child`) or any other emergency | Every user whose `institutionId` is the school (students, parents, and staff), plus users with `emergencyOptIn: true` who match `region` (country, and state and city when the alert set them) or whose `homeCountry` is the same country. A region match without `emergencyOptIn` is not included. Institution members are included without that opt-in. |
| Safety Desk | Super admins (`role: admin`), the on-call primary, the backup only when the case has escalated, and linked guardians whose verification tier is 2 or higher. Parent exclusion removes those parent uids from the recipient list. The confidential card still lists the guardian contacts and says parents were not notified. |
| All-staff | Every staff member at the institution: teachers, institution admins, and users with a staff post. Students and parents are not included. |

Parent exclusion is unchanged: type `abuse`, `concernRole` of parent or guardian, `who` naming a parent or guardian, or `dontTellParents`. Excluded parents are not pushed. The form teacher is `users.formTeacherUid`, or a teacher at the school whose `classId` or `classIds` matches the student.

`users.emergencyOptIn` is the regional opt-in. It is not the founders `optIn` and not the recruiter `optedIn`. Missing means not opted in. `homeCountry` is compared with the alert country, including `MY` / `Malaysia`, `US` / `United States` / `USA`, and `GB` / `United Kingdom` / `UK`.

Safety and danger store `staffUids`, `notifiedParentUids`, `parentsExcluded`, and `formTeacherUid` from this resolver. Hotline tickets store `recipientUids`. A high safeguarding ticket still sends the confidential case card to the hotline staff set. Other hotline tickets get a `hotline` push. Danger parent pushes stay category `emergency` with `force` and sound `emergency`. A safety-report parent push is category `safety`, and `force` only when the student is under 13.

## All-staff alert

A principal or safeguarding lead at verification tier 3 or higher can widen one open case or emergency to every staff member at that school. Tier 0 is used when `users.verification.tier` is missing. A teacher, an academic lead, and a super admin without that post cannot widen it.

Types: `lockdown`, `intruder`, `missing_child_on_site`, `fire_evacuation`, `medical`.

`POST /api/all-staff/widen` requires `source` (`case` or `emergency`), `sourceId`, `type`, `location` (at least 2 characters), and `reason` (at least 3 characters). `missing_child_on_site` may include `publicDescription` (maximum 240 characters), which is the only description staff see. Other types store that field empty. One open all-staff alert per school. A second widen returns `An all-staff alert is already open. Send the all-clear first.`

The push category is `emergency`, with `force: true` and sound `emergency`. That bypasses quiet hours. The body is the location, the instruction in the staff member's language, and a prompt to check in. It does not include the report, the evidence, or the child's name.

Instructions are preset in English, Malay, Chinese, and Tamil. `zh-Hant` and `zh-TW` use Chinese. A tier-3 principal or safeguarding lead replaces a language with `POST /api/all-staff/instructions`. The document is `all_staff_instructions/{institutionId}` with `types.{type}.{en|ms|zh|ta}`. An edited language does not replace the other languages. Clients cannot read or write it.

The staff banner and roll-call use `staffAlertView`. The payload is `id`, `type`, `typeLabel`, `location`, `instruction`, `status`, `publicDescription`, and `checkIn`. Report body, evidence, and child identity are not copied onto it.

Check-in is `POST /api/all-staff/check-in` with `status` `safe` or `need_help`. Counts are safe, need help, and no response. Need help pushes the principal: title `Staff needs help`, with the type and location, and no child identity. A cleared alert rejects further check-ins with `Roll-call is closed.`

`POST /api/all-staff/clear` is the all-clear. The same tier-3 principal or safeguarding lead can send it. Staff receive a cancel push, title `All clear`, body `The all-staff alert is over. Roll-call is closed.` The pointer `all_staff_open/{institutionId}` moves to `cleared`.

Widening appends chain action `widened_all_staff` on the source ticket (`events`) or emergency alert (`audit`), and on `all_staff_alerts/{id}/audit`. The diff is type, location, reason, alert id, and the public description. All-clear appends `all_clear`. Entries are created with `appendChain`. They are not updated or deleted.

`all_staff_alerts/{id}` stores `institutionId`, `source`, `sourceId`, `type`, `location`, `publicDescription`, `reason`, `instructions`, `status` (`open` or `cleared`), `widenedBy`, `widenedAt`, `clearedBy`, `clearedAt`, `staffUids`, `chainSeq`, `chainHead`, and `legalHold`. Check-ins are `all_staff_alerts/{id}/checkins/{uid}` with `status` and `at`. Firestore rules deny client reads and writes, including update and delete on `audit`. Not deployed.

Web: the case page `/dashboard/safety/{id}` and an emergency desk opened with `?id=` have **Widen to all staff**. Staff at the school see the banner with **I am safe**, **Need help**, and **Roll-call**. The roll-call is `/dashboard/staff/roll-call`. It is a home tile, not a fourth task. A public sample is `/preview/all-staff`.

| Method | Path |
| --- | --- |
| POST | `/api/all-staff/widen` |
| POST | `/api/all-staff/check-in` |
| POST | `/api/all-staff/clear` |
| GET | `/api/all-staff/banner` |
| GET | `/api/all-staff/roll-call` |
| GET | `/api/all-staff/instructions` |
| POST | `/api/all-staff/instructions` |

Index, not deployed: `all_staff_alerts` on `institutionId` ASC, `status` ASC. The open pointer is the read the banner uses, so the desk works before that index is deployed.

## Amber alerts are free

Amber alerts are a public safety and marketing tool. Receiving, viewing, and sharing them is free for every account, including an account with no school. They are not gated by `accessTier`, `subscriptionTier`, or any other entitlement. `amberReceiveAllowed` is always true. Publishing is not free.

`users.emergencyOptIn` is the opt-in. Signup can set it, including when the person does not join a school. `POST /api/amber/opt-in` sets it for an existing account from a country (and optional state or city) with no institution and no subscription check. `homeCountry` is stored beside it. Both fields are self-service. A missing `emergencyOptIn` still means not opted in. Institution members of the school on the alert are included without this flag, as in the recipient matrix.

The public page is `/amber/{id}`. That URL is canonical: the page sets `<link rel="canonical">` to `/amber/{id}`. `/alerts/{id}`, `/alerts/{id}/opengraph-image`, and `/alerts/{id}/twitter-image` answer `301` to the matching `/amber` path and keep the query string. A missing-child alert uses the Amber projection. Another emergency type at the same URL keeps its own public details. It shows the approved public details only:

- No reporter, publisher, or confirmer identity.
- No hotline ticket, message, or category.
- For a child, the name, the photo, and the public description appear only when the publishing principal or partner set `publicApproval.name`, `publicApproval.photo`, or `publicApproval.description`. The photo also needs guardian consent on file. The internal `description` is not the public text. `publicDescription` is.
- Region, the authority agency, and the authority reference stay on an open alert so people know who to call. Staff phone numbers are not shown.

A resolved, closed, retracted, `publicRedacted`, or consent-withdrawn alert renders the word `resolved` and drops those details, including the region and the authority reference. The page is noindex and sharing is off. The free join line stays.

Open Graph and the Twitter share image use the blue hero gradient. Cyan `#3FE0D0` is a fill and an accent on that blue. The join line is a cyan button with `#203337` text and a 1px `#1E6A83` border. The card has no amber, gold, or mustard. On the page, text on the light background is `#1E6A83` or `#203337`. Both images carry `Get free Amber alerts on Poket School` and the referral code. The code is the document id `referrals/{code}`, the same collection a free card uses. The join link is `/signup?amber=1&ref={code}`. Signup stores `referredBy` and, when the Amber box is ticked, `emergencyOptIn` and `homeCountry`. Creating an Amber draft calls `ensureAmberReferral`, which reuses the owner's `referrals/{code}` or creates one. Clients cannot read or write `referrals`. Rules are not deployed.

Publishing an Amber alert (`missing_child`) requires verification tier 3 and staff post `principal`, or verification tier 4 (a partner). A missing `users.verification.tier` is 0, so a tier-0 principal cannot publish one. A super admin is not an exception. Other emergency types still use the existing verified principal or institution admin rule. The two-person confirm and the authority and consent gates are unchanged.

The community push for an Amber alert links to `/amber/{id}`. The body is the approved public description, or a place line when nothing was approved. It does not include the internal description or an unapproved name.

| Method | Path |
| --- | --- |
| GET | `/amber/{id}` |
| GET | `/amber/{id}/opengraph-image` |
| GET | `/amber/{id}/twitter-image` |
| POST | `/api/amber/opt-in` |

Samples: `/amber/sample` and `/amber/sample-resolved`. The sample referral code is `POKETAMBER` (`referrals/POKETAMBER`).

## Anti-bullying is free

Anti-bullying help is free for every account, including an account with no school. `bullyingReceiveAllowed` is always true. It does not read `accessTier` or `subscriptionTier`. Safety Report, I'm in danger, block, mute, restrict, ET AI moderation, the evidence locker, Get help near me, and the report tracker all use that gate.

Routing is still `resolveRecipients`. Kind `bullying` with an `institutionId` and `anonymous` not true uses the student safety report list (safeguarding lead, principal, form teacher, and approved parents unless parent exclusion applies). No school, or an anonymous report, uses the Safety Desk list: super admins (`role: admin`), the on-call primary on `safety_desk/rota`, the backup only when `escalate` is set, and linked guardians at verification tier 2 or higher unless parent exclusion applies. The reporter's real name stays on the ticket. Anonymous pushes say the name stays with Desk leads and do not call `notifyTicketStaff`. `safetyView` returns `full` for a super admin or `staffPost: safety_desk` only. The reporter gets `tracker`. Everyone else, including a guardian and a school principal, gets `hidden`.

Desk SLAs are config in `DESK_SLA_MS`: critical 15 minutes, high 1 hour, medium 24 hours, low 72 hours. A desk ticket stores `deskSeverity` and `slaDueAt` from that clock. Hotline `priority` still uses `low|medium|high`, so critical is stored as priority `high` plus `deskSeverity: critical`. The cron `GET /api/cron/hotline` calls `escalateCriticalDesk`. An unacknowledged critical desk ticket past 15 minutes sets `deskEscalatedAt` and pushes the backup and super admins. It appends `desk_escalated`.

Check-ins are `checkIns: [{ dueAt, sentAt }]` on the ticket, 24 hours and 7 days after `createdAt`. The same cron calls `sendDueCheckIns` and pushes "How are you doing?" to the reporter. Closed and resolved tickets are skipped. The event is `check_in_sent`.

On Poket School, `network_restricts/{postAuthorId}_{commenterId}` marks that person's comments on the post author's posts as `restricted`. `account_limits/{uid}.commentRestricted` does the same for every comment. `commentVisible` shows a restricted comment to its author, the post owner, and a Desk lead (`role: admin` or `staffPost: safety_desk`). Three or more open reports with the same `targetUid` set `account_limits.dmLimited` and `connectionLimited`. That blocks new DMs and connection requests. It does not suspend or mute. Adults still cannot DM under-18s. Block is `network_blocks/{uid}_{targetId}`. Mute is `network_mutes/{uid}_{targetId}` and hides that person's posts and comments from the muter.

Off-platform evidence is `evidence_locker/{id}`: `ownerId`, `note`, `platform`, `hash` (SHA-256 of timestamp, note, and screenshot bytes), `createdAt`, `guardianIds`, `parentsExcluded`, and `imageBase64`. `canSeeEvidence` allows the owner, a non-excluded guardian id, and the Desk. `GET /api/bullying/evidence-pdf` returns a PDF from `casePdf`. The hash chain event is `evidence_saved` on `evidence_locker/{id}/events`.

A Desk lead sends `school_referrals/{id}` only after consent and only when `institutions/{bullySchoolId}` exists. The document is `bullySchoolId`, `where`, `summary` (trimmed, no requirement to include a name), `reporterHidden: true`, `leadUids`, `sentBy`, and `createdAt`. It has no `reporterUid`. The school push does not link to the victim's ticket. The ticket audit event `school_referral` records the referral id. `GET /api/bullying/referral` returns the summary, the place, and `reporterHidden` only.

ET AI support is labelled `ET AI support is not a counsellor.` Risk phrases (`riskSeverity`) file a `self_harm_concern` report at critical severity and return helplines immediately. Outside Desk hours (`Asia/Kuala_Lumpur`, 08:00–22:00) the same response shows helplines and Get help near me. Numbers live in `OFFICIAL_HELPLINES` with `sourceUrl`. A line without an `https://` source is dropped. Unknown countries return no numbers. Malaysia is Talian Kasih 15999, Befrienders KL +603-7627 2929, and Talian HEAL 15555, each with the official page that was checked. Other countries are a TODO until an official page is opened. Do not invent a number. Get help near me for Malaysia is emergency 999 and the Befrienders "I need help right now" page.

Report rate flags at three reports in a UTC day and still accepts the report (`refused: false`). `markDangerFalse` increments `safety_flags/{uid}.falseDanger`. At two or more it sets `review: true` and `punish: false`. It does not write `account_limits`.

The public page is `/stand-up-to-bullying`. It is indexed, canonical, and lists no victim data. The join link is `/signup?help=bullying&ref=POKETSTAND`. The code is `referrals/POKETSTAND` with `kind: bullying`. Signup already stores `referredBy` from `ref`. Clients cannot read or write the new collections. Rules are not deployed.

| Method | Path |
| --- | --- |
| GET | `/stand-up-to-bullying` |
| GET | `/api/bullying/guide` |
| POST | `/api/bullying/support` |
| POST | `/api/bullying/evidence` |
| GET | `/api/bullying/evidence` |
| GET | `/api/bullying/evidence-pdf` |
| POST | `/api/bullying/block` |
| POST | `/api/bullying/mute` |
| POST | `/api/bullying/restrict` |
| POST | `/api/bullying/desk-restrict` |
| POST | `/api/bullying/referral` |
| GET | `/api/bullying/referral` |

Samples: `/preview/bullying` and `/preview/bullying?view=desk`. Platform report links: WhatsApp `https://www.whatsapp.com/safety`, Instagram `https://help.instagram.com/`, TikTok `https://www.tiktok.com/safety`.

Indexes, not deployed: `evidence_locker` on `ownerId`; `evidence_locker` on `guardianIds` (array); `hotline_tickets` on `targetUid`; `hotline_tickets` on `deskSeverity`; `network_mutes` on `userId`.
