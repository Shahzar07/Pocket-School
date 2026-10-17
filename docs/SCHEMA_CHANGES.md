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
| `category` | `academic`, `attendance`, `fees`, `transport`, `wellbeing`, `bullying`, `safeguarding`, `technical`, `feedback`, `other`. Fees and billing use `fees`. |
| `priority` | `low`, `medium`, `high`. Maps onto the shared severity in `lib/alerts/model.ts` (`low`, `medium`, `high`). Hotline has no critical priority. |
| `status` | `pending`, `in_progress`, `kiv`, `solved`, `closed`. |
| `kivReason`, `kivFollowUpAt` | Required together when status is `kiv`. |
| `slaDueAt` | Working hours in the institution timezone. High is 4 working hours, medium is 1 working day, low is 3 working days. Default window is Monday to Friday, 08:00 to 17:00, `Asia/Kuala_Lumpur`, plus `institutions/{id}.holidays`. |
| `escalationLevel` | `GET /api/cron/hotline` with `Authorization: Bearer CRON_SECRET` moves an overdue ticket to teacher, then academic lead, then principal. Bullying and safeguarding never leave the safeguarding lead and the principal. |
| `reopenUntil`, `solvedAt` | A parent can reopen within 7 days of `solved`. |
| `satisfaction` | `{ rating: 1–5, comment }` after the parent rates. |
| `body`, `safeguardingCaseId` | Sensitive categories open `safeguarding_cases/{id}` with `source: hotline`. Other staff cannot read those tickets. |
| `createdAt`, `updatedAt` | Milliseconds. |

`hotline_tickets/{id}/comments/{commentId}`: `authorId`, `authorName`, `body`, `internal` (staff-only when true), `parentId` for a thread, `at`.

`hotline_tickets/{id}/events/{eventId}`: `kind` is `created`, `assigned`, `status_change`, `escalated`, `reopened`, or `rated`. `actorId`, `at`, `detail`.

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
| GET | `/api/hotline/analytics` |
| GET | `/api/cron/hotline` |

Analytics hide any group under 5: category counts, SLA compliance, average resolution time, satisfaction, and the overdue count. The parent desk is `/dashboard/parent/hotline`. Staff queues are `/dashboard/teacher/hotline`, `/dashboard/admin/hotline`, and `/dashboard/institution/hotline`.

Push category `hotline`. It can be muted with `notificationPrefs.hotline`.

## Emergency alerts

Amber and other emergency alerts. Publishing is server-only. A verified principal or admin creates a draft. A different verified staff member confirms it, and only then is it public. Do not deploy these rules from this branch.

`emergency_alerts/{id}`

| Field | Notes |
| --- | --- |
| `institutionId` | School that owns the alert. |
| `type` | `missing_child`, `lockdown`, `weather`, `medical`, `general`. Severity uses `lib/alerts/model.ts`: missing child, lockdown, and medical are `critical`; weather is `high`; general is `medium`. |
| `title`, `description`, `subjectName` | `subjectName` is removed when the alert is resolved. |
| `region` | `{ country, state, city }` copied from `institutions/{id}`. A home address is never stored. |
| `photoUrl`, `guardianConsent`, `consentId` | The photo is stored only when `guardianConsent` is true and `consentId` is set. |
| `authoritiesInformed` | `{ agency, referenceNumber, informedAt }`. Required before public share, and required before a missing-child draft is saved. |
| `status` | `draft` until the second staff member confirms, then `active`, `updated`, `resolved`, or `closed`. Closed alerts are archived. |
| `publishedBy`, `publishedAt` | The creator. `publishedAt` is set at confirmation. |
| `confirmedBy`, `confirmedAt` | Must be a different verified staff member. |
| `resolved` | `{ by, at, outcome, authoritiesClosed }`. |
| `publicShareEnabled` | Stays false without an authority record. Cleared on resolve. |
| `ogVersion` | Incremented on resolve so share URLs can drop a cached card (`?v=`). |
| `counts` | `{ views, shares }`. |
| `createdAt` | Milliseconds. |

`emergency_alerts/{id}/updates/{updateId}`: `body`, `actorId`, `at`.

`emergency_alerts/{id}/audit/{auditId}`: `created`, `confirmed`, `updated`, `resolved`, `closed`.

`emergency_rate/{uid}_{YYYY-MM-DD}`: at most 3 drafts a day.

A confirmed alert writes a pinned `network_posts` document (`kind: emergency`) for the school page and the feed. Resolve updates that post, clears the name and photo from the public view and the OG image, disables share buttons, sets the page to `noindex`, and increments `ogVersion`.

Public page: `/alerts/[id]`. OG image: `/alerts/[id]/opengraph-image`. The card is a brand frame with type, region, and time. A photo is named on the card only when consent is on and the alert is still open. The page shows `If you have information, contact {agency} {reference}` and the public emergency number (999 in Malaysia). It does not show school staff numbers. It is not a replacement for emergency services.

| Method | Path |
| --- | --- |
| POST | `/api/emergency/create` |
| POST | `/api/emergency/confirm` |
| POST | `/api/emergency/update` |
| POST | `/api/emergency/resolve` |
| POST | `/api/emergency/close` |
| GET | `/api/emergency/public?id=` |
| POST | `/api/emergency/share` |
| GET | `/api/emergency/stats?id=` |

Push category `emergency`. It is targeted to institution members and to profiles whose country, state, and city match `region`. Delivery sets `force` and `sound: emergency`, so quiet hours and a muted preference do not apply. There is no mute toggle for it.

Admin desks: `/dashboard/admin/emergency` and `/dashboard/institution/emergency`.

Retention: on resolve, the name and photo are cleared from the public document. The audit subcollection remains for the school. Closed alerts stay archived and are not indexed.

## Push categories added

`hotline` and `emergency`, on both `lib/push.ts` and `lib/platform/push.ts`. The reject string is `category must be goals, flags, attendance, digests, grades, assignments, general, achievements, network, safety, hotline, or emergency.`

Account toggle: `notificationPrefs.hotline`. Emergency alerts are not a preference.
