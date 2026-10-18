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
| `prefs` | map | Optional booleans. A missing key stays on. `false` opts that device out. Keys: `goals`, `flags`, `attendance`, `digests`, `grades`, `assignments`, `general`, `alumni`, `institution`, `achievements`. `alumni` covers reunions, the alumni wall, yearbook release, and alumni messages. `grades` stays for unit-test pushes. |
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

## Lifelong learner record

One Poket School account follows the learner. The student number on `users/{uid}` does not change when they join another academy. Mobile clients do not write `studentNumber`, `institutionId`, or `role`.

Joining an academy adds a span and closes the previous open span. Graduation closes the span. Spans are not deleted. A transfer frees the previous academy’s used seat and does not send a graduation letter.

## `users/{uid}/education/{institutionId}`

| Field | Meaning |
| --- | --- |
| `institutionId` | Academy id. This is also the document id. |
| `institutionName` | Academy name at the time of the span |
| `level` | Level name |
| `from` | `YYYY-MM-DD` |
| `to` | `YYYY-MM-DD`, or empty while this academy is current |
| `studentNumber` | The same number on every span for this account |

The signed-in learner may read and list their own spans. Client creates, updates, and deletes are denied, so the number cannot be edited from the app. The server writes these documents with the Admin SDK.

## `users/{uid}/portfolio/profile`

| Field | Meaning |
| --- | --- |
| `publicPortfolio` | Ask for a public page. Default `false` |
| `parentApproved` | A linked parent sets this. The learner cannot |
| `sharePortfolioWithSchools` | Former schools may see sections marked for schools. Default `false` |
| `shareDestinationWithSchools` | Former schools may count the next step. Default `false` |
| `includeScores` | Unit and final scores on the CV. Default `false` |
| `template` | `deep`, `mid`, `bright`, or `classic`. Older rows may still say `forest`, `gold`, or `coral`. The server reads those as `deep`, `mid`, and `bright`. |
| `sections` | Map of section id to `private`, `schools`, or `public` |
| `summary`, `bullets` | Wording the learner saved after reviewing an ET AI draft |

Section ids: `education`, `courses`, `scores`, `certificates`, `badges`, `projects`, `endorsements`, `activities`, `awards`, `experience`, `skills`, `links`.

The learner may update the sharing toggles, template, section map, summary, and bullets. The learner cannot set `parentApproved`. A parent whose `childIds` contain this learner may set `parentApproved` only.

A public page stays off until `publicPortfolio` is true. If `ageTier` is `under13` or `teen`, it also stays off until `parentApproved` is true. A missing age tier is treated as under 13, so the public page stays off.

## `users/{uid}/portfolio_items/{id}`

Self-reported achievements. The learner may create, update, and delete. `source` is `self_reported`. Fields: `kind` (`activity`, `award`, `competition`, `volunteering`, `sport`, `leadership`, `work`, `skill`, `language`, `link`), `title`, `detail`, `when`, `evidenceLink`, `evidencePath`, `section`, `userId`.

`evidenceLink` is empty or an `https://` URL. `evidencePath` is empty or `media/{uid}/portfolio/{itemId}`. Storage rules already let that user write images under `media/{uid}/`. Keep files at or under 5 MB. Do not store a data URL in Firestore.

## Verified inputs the CV reads

These collections are reserved. The CV builder reads them when a document is present. It does not invent a project or an endorsement.

| Collection | Who writes | Notes |
| --- | --- | --- |
| `users/{uid}/studio_projects/{id}` | The signed-in learner, from Studio or Research Helper | `title`, `detail` |
| `users/{uid}/endorsements/{id}` | A teacher at the same academy | `title`, `detail`, `teacherId` |

Certificates stay in `certificates` where `studentId` matches. Badges stay in `badges` where `userId` matches. Scores are read from `grades` and `unit_quiz_attempts` only when `includeScores` is true, and only when a numeric score is already stored.

Verified lines are labelled `Verified by Poket School`. Self-reported lines are labelled `Self-reported`.

## `users/{uid}/destination/current`

The learner’s own next step: `kind` (`university`, `college`, `institution`, `work`, `other`), `name`, `course`, `country`, `source` (`stated` or `detected`), `shareWithSchools`, `shareName`, `testimonial`, `shareTestimonial`, and optional `destinationInstitutionId`. The learner may write this private copy. Sharing with a school is a separate consent flag.

## `learner_destinations/{fromInstitutionId}_{uid}`

One document per former school for this learner. The destination academy itself is not given a row about its own join.

| Field | Meaning |
| --- | --- |
| `fromInstitutionId` | The school that may see this row |
| `studentId` | Learner uid, used to remove the row |
| `learnerName` | First name and last initial, and only when `shareName` is true. Otherwise empty |
| `name`, `course`, `country`, `kind` | The next step |
| `source` | `stated` or `detected` |
| `shareWithSchools`, `shareName`, `shareTestimonial` | Consent flags |
| `testimonial` | Optional quote, empty unless the learner opts in |

A school reads with `where('fromInstitutionId', '==', institutionId)`. That is a single-field query. The index is automatic. It is not added to `firestore.indexes.json`. The same is true for `where('studentId', '==', uid)` when a deletion removes the rows.

Counts group by institution, country, and course. A bucket under 5 is omitted. An opted-in name or testimonial is not a count, so it can still be shown.

## `portfolio_public/{studentNumber}`

Public `get` by the student number. `list` is denied. The same pattern as `alumni_public`.

The document stores `name` (first name and last initial), `studentNumber`, `summary`, `qrUrl` (`https://poketschool.ai/portfolio/{studentNumber}`), and the items whose section is `public`. It does not store email, date of birth, or private sections. Certificate links on an item point at `https://poketschool.ai/verify/{id}`.

The server deletes this document when sharing is off, when a learner under 18 has no parent approval, or when account deletion is honoured. The private record remains until the existing 14-day deletion wait finishes. `honourHolderDeletion` turns off public sharing and destination sharing immediately. Certificate pages stay up with `revoked at holder's request`.

Rules still need an owner deploy. These rules are not deployed from this change.

## LinkedIn and job applications

Poket School uses LinkedIn’s own buttons and OpenID Connect. It does not scrape LinkedIn and it does not submit applications on LinkedIn.

Add to Profile uses `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME`. Share uses `https://www.linkedin.com/sharing/share-offsite/`. Neither needs a LinkedIn API product. `LINKEDIN_ORGANIZATION_ID` is optional. When it is unset, the button sends `organizationName` as Poket School.

Sign in with LinkedIn is hidden until `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are set. The requested scope is `openid profile email` only. The redirect is `/api/auth/linkedin/callback`. A person who is already signed in can link `linkedInSub` on `users/{uid}`. A signed-out LinkedIn sign-in works only when that `sub` is already linked. The server looks it up with `where('linkedInSub', '==', sub)`. That is a single-field query. The index is automatic.

A member post stays off. It needs LinkedIn approval for `w_member_social` and `LINKEDIN_MEMBER_SHARE=on`, and this server does not request or store that token. `POST /api/auth/linkedin/share` returns that explanation and does not call LinkedIn.

## `share_links/{token}`

The token is the document id. The learner creates one link per job application.

| Field | Meaning |
| --- | --- |
| `studentId` | Learner uid. Listed with `where('studentId', '==', uid)` |
| `label` | The learner’s name for the link, such as Company X - Analyst |
| `expiresOn` | `YYYY-MM-DD` |
| `createdAt` | ISO time |
| `revoked` | Closed by the learner |

`share_links/{token}/views/{id}` stores `at`, `itemTitle`, and `visitorLabel`. `visitorLabel` is only the text the visitor types. The view does not store an IP address or any other detail about the visitor.

The public page is `/record/{token}`. An expired or revoked token does not return the record.

## `verification_requests/{id}`

An employer can ask the learner or the school to confirm a self-reported item. The employer cannot write the record.

| Field | Meaning |
| --- | --- |
| `studentId` | Learner uid |
| `itemId`, `itemTitle` | The self-reported item |
| `note`, `visitorLabel` | What the visitor typed |
| `status` | `open` or `confirmed` |
| `confirmedBy` | `learner` or `school` |
| `schoolIds` | Academies already on the learner’s education history |

A school reads with `where('schoolIds', 'array-contains', institutionId)`. That is a single-field query. Confirming sets `confirmation` on `users/{uid}/portfolio_items/{id}` to `learner` or `school`. The line stays self-reported. It does not become a Poket School certificate.

## `users/{uid}/applications/{id}`

The learner’s own job tracker: `company`, `role`, `link` (https or empty), `status` (`draft`, `applied`, `interview`, `offer`, `hired`, `studying`, `closed`), `date`, `shareToken`, `reminderOn`. A reminder shows in the portfolio when the date is today or earlier and the status is `applied` or `interview`. Poket School does not email a blast and does not apply for the learner.

ET AI tailors bullets from verified achievements whose title or detail already contains a word from the pasted job description. A skill that appears only in the job text is left out.

When the status is `hired` or `studying` and the learner already shares a destination with former schools, that outcome is copied onto the existing destination rows. Alumni Destinations then counts Hired and Studying. A count under 5 stays hidden.

`linkedInSub` on `users/{uid}` is written by the server during link. Mobile clients do not write it.

Rules still need an owner deploy. These rules are not deployed from this change.

## CV versions and the public portfolio theme

A learner can keep more than one CV. Each version is presentation only. The Poket School record stays the source of the verified facts.

## `users/{uid}/cv_versions/{id}`

The learner reads and writes these through the portfolio API. The id matches `cv-` plus letters, numbers, and hyphens.

| Field | Meaning |
| --- | --- |
| `name` | The learner’s name for this CV, such as Company X - Analyst |
| `shareToken` | Optional id of a `share_links` document this learner owns |
| `template` | `classic`, `serif`, `compact`, `deep`, `mid`, `bright`, or `mist`. Older rows may still say `forest`, `gold`, `coral`, or `blue`. The server reads those as `deep`, `mid`, `bright`, and `bright`. |
| `accent` | Hex colour. New colourful templates start from the confirmed tokens in `lib/brand-theme.ts`: `blueDeep`, `primary`, `blueBright`, and `wash`. |
| `font` | `sans`, `serif`, or `mono` |
| `layout` | `one` or `two` |
| `photo` | Whether the CV shows a photo block |
| `pageSize` | `A4` or `Letter` |
| `language` | A supported language code. English stays as written |
| `sectionOrder` | Section ids, including custom ids |
| `sectionTitles` | Renamed headings |
| `hiddenSections`, `hiddenItems` | Lines and sections left off this version |
| `customSections` | Up to eight `{ id, title, body }` blocks |
| `wording` | Title and detail overrides for self-reported items only |
| `summary` | Summary wording for this version |
| `showScores` | Whether score lines are eligible for this version |
| `updatedAt` | ISO time |

`wording` is ignored for a verified item. Showing or hiding that item is the only choice, so the Verified mark stays honest. A language other than English is a display copy from content translation at download. The stored facts are not replaced. If `OPENROUTER_API_KEY` is unset, the download keeps the original wording and says so.

PDF and DOCX are produced from the composed version. The photo block draws initials. It does not fetch a remote image into the file.

## Public theme

`users/{uid}/portfolio/profile.theme` and `portfolio_public/{studentNumber}.theme` store the same visual choices: template, accent, font, layout, photo, section order, renamed headings, hidden sections, custom sections, self-reported wording, and summary. The public page `/portfolio/{studentNumber}` renders that theme. A verified title in `portfolio_public` stays the recorded title.

`photoUrl` is copied from the account avatar only when it is an `https` URL and photo is on. The public document still stores the public name, student number, and public items. It does not store an email address.

This is a single-document read by student number, and a subcollection under the learner. No composite index is required. Rules still need an owner deploy. These rules are not deployed from this change.

## Alumni communications and class networks

An alumnus stays linked to every academy they attended, including after the account is Individual. The link is history. It does not occupy a seat.

## `users/{uid}/attended/{institutionId}`

Written by the server when someone graduates or transfers. Mobile clients read it. They do not write `seatCounted` or `holdsSeat`.

| Field | Meaning |
| --- | --- |
| `institutionId`, `institutionName` | The academy |
| `level`, `className`, `programme`, `country` | The class or cohort they left |
| `leftOn` | The day the span closed, `YYYY-MM-DD` |
| `destination`, `job`, `contact` | What the alumnus later told that academy. Contact is not shown in the directory |
| `seatCounted` | Always `false` |
| `holdsSeat` | Always `false` |

If `institutions/{id}/alumni/{uid}` is missing, the server creates it with `seatFreed: true` and `seatCounted: false` so the academy can reach them. An existing alumni document keeps its graduation seat fields. This change does not rewrite `seatFreed`, `seatCounted`, or `undoneOn` on a graduation that already happened.

## `users/{uid}/alumni_consent/{institutionId}`

One consent record per academy. Email and push default off. Inbox defaults on. Directory, direct messages, and mentorship default off.

| Field | Meaning |
| --- | --- |
| `email`, `inbox`, `push` | Channels. Unsubscribe stops email and push. Inbox stays on its own flag |
| `directory` | Opt in to the classmate directory. The directory shows a first name and last initial, never an email |
| `messages` | Opt in to 1:1 notes. Both adults must opt in |
| `mentor` | Opt in to mentor a current student. The academy still approves the match |
| `unsubscribed` | Stops email and push from this academy |
| `unsubscribeToken` | 32 hex characters. The public unsubscribe page reads `alumni_unsubscribes/{token}` |

`alumni_unsubscribes/{token}` stores `studentId` and `institutionId` so the email link is one document read.

## `alumni_outbox/{id}`

Top-level, so a scheduled send is `where('status', '==', 'scheduled')`. The academy list is `where('institutionId', '==', id)`. Status is filtered in memory. No composite index.

| Field | Meaning |
| --- | --- |
| `institutionId` | The sender |
| `kind` | `reunion`, `newsletter`, `event`, `fundraising`, or `survey` |
| `subject`, `body` | Rendered from the template plus the academy's note |
| `filter` | Optional cohort year, level, programme, class, country, and destination. An empty field means everyone |
| `sendOn` | `YYYY-MM-DD`. A future date waits for the daily cron |
| `status` | `scheduled`, `sending`, or `sent` |
| `reached`, `opened`, `clicked`, `replies` | Counts. Opens and clicks are unique per alumnus |
| `createdAt`, `sentAt` | ISO times |

`alumni_outbox/{id}/receipts/{studentId}` stores `opened`, `clicked`, `emailed`, and a 32-hex `token`. `alumni_receipts/{token}` points back at the campaign so the view link and the event link can record one open or click. There is no tracking pixel.

`alumni_outbox/{id}/replies` stores `studentId`, `body`, `decision`, and `at`. The alumnus can reply to the academy.

`users/{uid}/inbox/{campaignId}` is the in-app copy: `institutionId`, `subject`, `body`, `fromName`, `at`. Push uses the existing device token store and is skipped when push consent is off.

The older academy newsletter toggle is unchanged. These campaigns are separate and follow the per-person consent above.

## Class groups, events, and safety

`institutions/{id}/alumni_groups/{groupId}` is created for the class, or for the level cohort when there is no class name. `memberCount` is a number. Members live in `members/{uid}` with `studentId`, `joinedOn`, and `directoryName` (empty until they opt in).

Posts live in `alumni_groups/{groupId}/posts/{postId}`: `authorId`, `authorName`, `body`, `decision` (`allow`, `hold`, or `block`), `visible`, `queued`, `at`. A minor's post is held even when the safety filter would allow it. An adult post that is held (contact details, harassment, or an off-platform app) waits too. A blocked post is not stored.

`institutions/{id}/alumni_queue/{postId}` is the moderator list: `status` `held`, `released`, or `blocked`, plus `kind` `post` or `mentor`. The held query is a single field.

`institutions/{id}/alumni_events/{eventId}` stores `title`, `when`, `place`, `rsvpCount`, and `at`. RSVPs are `rsvps/{uid}` with `going` and `at`.

`users/{uid}/blocks/{otherId}` is a block. `institutions/{id}/alumni_reports` stores `reporterId`, `targetId`, `postId`, `reason`, `status: open`, and `at`.

Direct messages exist only between two adults who both opted in and have not blocked each other. They are stored at `users/{uid}/alumni_threads/{otherId}` and `messages/{id}`. A minor cannot open a direct message.

## Mentorship

`institutions/{id}/mentorships/{id}` and a mirror at `users/{uid}/mentorships/{id}`: `mentorId`, `studentId`, `mentorName`, `studentName`, `status` (`pending`, `approved`, `closed`), `moderated`, `institutionId`, `at`.

The mentor is an adult alumnus who opted in. The student is a current student of that academy. Messages stay closed until the academy sets `approved`. `moderated` is true when the student is under 18, and the academy can read `mentorships/{id}/messages`. A minor's message in that thread is held for the same moderator queue.

These are single-document reads, subcollections, or one-field queries. No composite index and no collection-group query. Rules still need an owner deploy. These rules are not deployed from this change. Mobile clients do not write seat counts.

## Alumni yearbook and wall

Each graduating class has one yearbook. The book id is the class group id, or the level cohort when there is no class name. Creating a page does not occupy a seat and does not change `seatCounted`, `seatFreed`, or `undoneOn`.

## `institutions/{id}/yearbooks/{bookId}`

| Field | Meaning |
| --- | --- |
| `institutionId`, `institutionName` | The academy |
| `name` | Class or cohort label, such as Oak 2026 |
| `cohort` | Four-digit graduating cohort, or empty |
| `className`, `level` | The class the page was opened from |
| `lockOn` | `YYYY-MM-DD`. Students can edit through this day. Default is 30 days after they leave |
| `status` | `open` or `released` |
| `template` | `deep`, `mid`, `bright`, or `mist`. Older books may still say `forest`, `gold`, `coral`, or `blue`. The server reads those as `deep`, `mid`, `bright`, and `bright`. |
| `principalMessage`, `teacherMessage` | Staff notes printed on the cover. Contact details are refused |
| `releasedAt` | ISO time, set when the academy releases the book |

`yearbooks/{bookId}/pages/{studentId}` is the student's page. The student writes `quote`, `mostLikely`, `clubs`, and `photo` (a boolean). The server fills achievements and destination from the existing record. The client does not write `status`, `parentApproved`, or achievement titles.

`audiences` is one of `classmates`, `institution`, `alumni`, or `public` for each of `photo`, `name`, `className`, `quote`, `mostLikely`, `clubs`, `achievements`, and `destination`. The default is `classmates`. A wider audience includes the narrower ones. A field set to classmates stays off the public page.

`status` is `draft`, `pending`, or `approved`. `parentApproved` is set only by a linked parent whose `childIds` contains the student. A student cannot set it. An under-18 page stays hidden from classmates, other alumni, and the public until the parent has agreed and the academy has approved it. The academy can still read the draft in order to approve it.

`yearbooks/{bookId}/signatures/{id}` is a note or sticker on a classmate page or the class wall (`toId` `wall`). Fields: `fromId`, `fromName` (first name and last initial), `toId`, `body`, `sticker` (`star`, `spark`, `deep`, `mid`, `bright`, or empty). Older notes may still say `leaf`, `gold`, or `coral`. The server reads those as `deep`, `mid`, and `bright`. Also `decision`, `visible`, `queued`, `at`. A minor's signature is held even when the safety filter would allow it. A blocked note is not stored. There is no direct message for anyone under 18.

`yearbooks/{bookId}/memories/{id}` is the class timeline: `authorId`, `authorName`, `title`, `body`, `visible`, `queued`, `at`. A minor's memory is held.

`yearbooks/{bookId}/gallery/{id}` is a class photo the academy adds: `caption`, `imageUrl` (https only, otherwise empty), `at`.

Push uses the device token store. A released book, a visible signature, a reunion, and a connection request all use category `alumni`. Other academy notices use `institution`. The link is `/dashboard/student/yearbook`. Push is skipped when that person's alumni push consent is off, when `users.notificationPrefs.push` is `false`, or when the `alumni` account toggle is `false`. The printable PDF is built on the server. It does not fetch remote photos.

## Alumni wall, map, and directory

`alumni_feed/{id}` is one update for an academy. The list is `where('institutionId', '==', id)`. No composite index.

| Field | Meaning |
| --- | --- |
| `institutionId`, `authorId`, `authorName` | Who posted, with a public name |
| `kind` | `update`, `reunion`, `throwback`, or `achievement` |
| `title`, `body` | The note. An achievement title must match a badge or certificate already on the record |
| `visible`, `queued` | A minor's update is held. Hidden rows stay out of the feed |
| `likeCount`, `rsvpCount` | Counts. RSVP is only for a reunion |
| `at` | ISO time |

Likes are `alumni_feed/{id}/likes/{uid}`. Comments are `comments/{id}` with `authorId`, `authorName`, `body`, `visible`, `queued`, and `at`. Reunion RSVPs are `rsvps/{uid}` with `going` and `at`. A reunion notifies alumni who still accept inbox or push.

`alumni_directory/{institutionId}__{uid}` is the opt-in adult directory. The query is `where('institutionId', '==', id)`, then cohort, class, destination, industry, and country are filtered in memory. Fields: `studentId`, `name` (first name and last initial), `year`, `className`, `destination`, `industry`, `country`. No email. A minor cannot opt in.

`alumni_places/{institutionId}__{uid}` is the map opt-in: `country`, `shareName`, `name` (empty unless they opted to show a name and they are an adult). Countries with fewer than five people are hidden. The map uses country names only, not a personal coordinate.

`users/{uid}/connections/{otherId}` is an adult connection request: `status` `pending` or `accepted`, `institutionId`, `name`, `at`. Both people must be adults in that academy's directory, and neither may have blocked the other. There is no direct message until both have the existing messages consent, and never for a minor.

Mentorship stays on `institutions/{id}/mentorships/{id}`. An adult alumnus can offer to mentor a current student. Messages stay closed until the academy approves. A minor student's thread is moderated.

Held yearbook signatures, memories, feed updates, and comments join the existing `institutions/{id}/alumni_queue` list. `kind` may be `yearbook`, `yearbook-memory`, `feed`, or `feed-comment`, in addition to `post` and `mentor`. The held query is still one field.

These are single-document reads, subcollections, or one-field queries. No composite index and no collection-group query. Rules still need an owner deploy. These rules are not deployed from this change. Mobile clients do not write seat counts, `parentApproved`, or verified achievement text.

## Poketschool app contract

This is the request and response shape the mobile app uses. Collection fields named earlier in this file stay as written. A missing push preference stays on.

### Signup fields

`users/{uid}` on first signup. The client writes these. The server issues `studentNumber` and never lets the client choose it.

| Field | Type | Notes |
|---|---|---|
| `email` | string | From the auth account. |
| `name` | string | Display name. |
| `avatarUrl` | string | Optional photo URL. |
| `role` | string | `student`, `parent`, or `teacher`. |
| `dateOfBirth` | string | `YYYY-MM-DD` when the person entered one. |
| `gender` | string | Labels are Male and Female. Stored exactly as `male` or `female`. No other value is accepted. |
| `demographicConsentAt` | number | Milliseconds. Required before gender is stored. |
| `country` | string | Country code or name entered at signup. |
| `region` | string | State or region. |
| `phone` | string | Optional. |
| `consentAcceptedAt` | timestamp | Terms accepted. |
| `pathway`, `level`, `yearGroup` | string | Student placement. |
| `subjects`, `subject`, `teachingLevel`, `institutionName` | string or array | Teacher profile. |
| `pendingChildEmail` | string | Parent signup, until the child is linked. |
| `xp` | number | Starts at 0. |

`POST /api/account/student-number` with a Firebase ID token and `{}` returns `{ studentNumber }`. The same call returns the existing code. `POST /api/account/self-reported-school` with `{ name, country, state }` records a school the student typed. It does not attach an institution membership.

### Student number and QR

Format: `PS-XXXX-XXXX`. Alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `I`, `O`, `0`, or `1`). The QR payload is the join path `/join/PS-XXXX-XXXX`. A scan or a typed code is normalised before lookup. The public portfolio URL is `https://poketschool.ai/portfolio/PS-XXXX-XXXX` and the credential URL is `https://poketschool.ai/p/PS-XXXX-XXXX`.

### Parent link

`POST /api/join` with a Firebase ID token.

| `action` | Body | Response |
|---|---|---|
| `lookup` | `{ action: "lookup", code }` | `{ card: { studentNumber, name, level, photoUrl, membership } }` |
| `membership` | `{ action: "membership", code, level }` | Same card, plus `{ message }`. Institution admin only. Sets membership. Does not set `parentApproved`. |
| `parent` | `{ action: "parent", code }` | `{ message, confirmBy }` where `confirmBy` is `student` or `institution_admin`. |
| `confirm` | `{ action: "confirm", requestId }` | `{ ok: true, message }`. Institution admin confirms an under-13 link. |

`code` may be `PS-XXXX-XXXX` or a scanned `/join/PS-XXXX-XXXX` URL. A teen or adult student confirms on `parent_links/{parentId}_{studentId}`. A learner under 13, or with no age tier yet, creates `institution_parent_requests/{parentId}_{studentId}` with `status: pending` and the institution admin confirms it. `GET /api/join` returns `{ requests: [{ id, parentName, studentName, studentNumber, status }] }` for that admin.

`POST /api/institutions/join` with `{ action: "link", studentNumber, institutionId, name }` is the parent link from the academy join page. It returns `{ links }` or `{ error }`.

### Invite code, roster, and email domain

`institutions/{id}.domains` is `string[]`: lower-case hosts, with a leading `@` stripped. `institutions/{id}.joinPolicy` is one of `open`, `invite`, `domain`, `code`, `roster`, or `manual`.

| `joinPolicy` | What approves |
|---|---|
| `open` | The account is approved. `decision.method` is `open`. |
| `invite` | A class code or a generic invite of at least four characters. |
| `domain` | The email host is in `domains`. |
| `code` | A class code only. |
| `roster` | A roster row only. |
| `manual` | The admin queue. |

When `joinPolicy` is absent, the older combined checks stay: roster, then invite code, then domain, then the queue. `signupPolicy` (`open`, `invite`, or `domain` on academy settings) does not select `joinPolicy`. A non-empty `domains` list replaces `settings/join` `emailDomains`. An empty or missing `domains` leaves that older list. `allowedEmailDomains` fills in only when both are empty.

`GET /api/institutions/join?slug={slug}` returns `{ name, slug, policy, domains, joinPolicy, codes, overage }`. `domains` is the effective host list. `joinPolicy` is the mode, or `null` when the combined checks still apply. `policy` still includes `emailDomains`, `acceptInviteCode`, `rosterMatch`, and `manualFallback`. `codes` is `[{ code, level, className }]`.

`POST /api/institutions/join` `{ action: "decide", slug, role, email, name, dob, studentId, inviteCode, parentConsent, programmeId, level }` returns `{ decision, programmes, institutionName }`. `decision.status` is `approved`, `pending`, `needs_consent`, `waiting_for_seat`, or `rejected`. `decision.method` is `roster`, `code`, `domain`, `manual`, `open`, or empty. A roster row matches the school student id, the email, or the name plus date of birth. A student under 13 returns `needs_consent` until `parentConsent` is true.

`{ action: "attach", slug, ...same attempt, childStudentNumber, takeCredit }` signs the caller in and returns the preview plus `credit` and `message`. An approved student keeps the same `studentNumber`. `{ action: "claim", slug, token }` claims a seat-ledger invite. `{ action: "leave" }` returns `{ progressKept: true, account: "individual", institutionAccess, graceEndsOn }`.

### Import roster

`institutions/{institutionId}/rosters/{rosterId}` is the import and match list. It is not `joinRoster`. `joinRoster` remains the seat ledger (`unclaimed`, `pending`, `joined`, `waiting`, `leaver`).

| Field | Type | Notes |
|---|---|---|
| `email` | string | Lower case. Required. |
| `studentNumber` | string | Optional school id. |
| `firstName`, `lastName` | string | Required. |
| `level` | string | Required. |
| `classId` | string | Optional class id. |
| `gender` | string | Labels Male and Female. Stored exactly as `male` or `female`. |
| `role` | string | `student` or `parent`. |
| `status` | string | `pending`, `matched`, or `invited`. |
| `matchedUid` | string | Optional. The matched person may read their own row. |
| `importedAt` | string | ISO time. |
| `importBatchId` | string | The import batch. |

The server writes this collection. An institution admin may write it under the rules in `firestore.rules`. A teacher, an institution admin, or a platform admin may read it. A matched person may read their own row. Clients do not set `matchedUid` for someone else. Join and alumni verification match `email` or `studentNumber`. A `student` row in `pending`, `matched`, or `invited` counts. It does not occupy a seat.

`POST /api/institutions/join` `{ action: "importRoster", institutionId, roster: { ...fields } }` writes one row. The document id is the lower-case email. The response is `{ id, row }`.

Indexes, not deployed: `email` + `status`, `importBatchId` + `importedAt` descending, `studentNumber` + `status`. Harry approves the rules deploy.

### Welcome star

The onboarding course awards a badge only. Finishing the welcome track writes `badges/{uid}_welcome_{track}`. `track` is `student`, `parent`, `teacher`, `institution`, or `independent`. Fields: `userId`, `type` (`welcome_{track}`), `name` (`Welcome star`), `description`, `icon`, `sparks` (`0`), `awardedAt`. It does not issue a certificate and it does not spend Sparks. Badge push uses category `achievements`.

### Graduation to an individual account

Graduating decrements the occupied seat immediately (`seatFreed: true` on `institutions/{id}/alumni/{uid}`; the server writes `seatCounted`). That academy’s finished courses move to the Completed shelf. The account becomes an individual: `users/{uid}` keeps `role: student` and the same `studentNumber`, the server deletes `institutionId` when that academy was the current one, and it sets `alumniOf`, `alumniName`, `alumniLeftOn`, `alumniGraceEnds`, `alumniDiscount`, and `institutionAccess` (`grace` for a Professional or Law leaver inside 90 days, otherwise `ended`). Undo stays open for 7 days (`undoUntil`). Undoing restores the seat and academy access. Progress, the portfolio, and the student number stay on the account. `POST /api/institutions/join` `{ action: "leave" }` is the student's own move to an individual account and returns the same access fields.

### CV, portfolio, share links, and the job tracker

The record lives at `users/{uid}/portfolio/profile`, `users/{uid}/portfolio_items/{id}`, `users/{uid}/cv_versions/{id}`, and `portfolio_public/{studentNumber}`. Each CV version is a draft. There is no separate draft collection and a CV does not issue a certificate. Verified rows come from courses, scores, certificates, and badges. The client does not write a verified line. Routes: `GET` and `POST /api/portfolio`, `GET` and `POST /api/applications`, `GET /api/record?token=`.

`share_links/{token}` fields are `studentId`, `label`, `expiresOn`, `createdAt`, and `revoked`. The public page is `/record/{token}`. Each open adds `share_links/{token}/views/{id}` with `at`, `itemTitle`, and `visitorLabel`. The view count is the size of that subcollection. The app reads it. It does not write a count field, an IP address, or a visitor id.

`users/{uid}/applications/{id}` is the job tracker: `company`, `role`, `link` (https or empty), `status` (`draft`, `applied`, `interview`, `offer`, `hired`, `studying`, `closed`), `date`, `shareToken`, and `reminderOn`. Poket School does not apply for the learner.

### Alumni messages, yearbook, wall, reunions, and mentoring

Direct messages are `users/{uid}/alumni_threads/{otherId}/messages/{id}` with `authorId`, `body`, and `at`. Both adults must have `messages: true` on `users/{uid}/alumni_consent/{institutionId}`. A minor cannot open that consent. The push category is `alumni`.

Yearbook documents are `institutions/{id}/yearbooks/{bookId}` and `pages/{studentId}`. Yearbook release, wall signatures, reunion posts, and alumni messages use `alumni`. Other academy campaigns use `institution`.

Mentoring stays on `institutions/{id}/mentorships/{id}`. A minor student's thread is moderated. Mentor consent is `mentor: true` on the same alumni consent document, and a minor cannot set it.

Alumni posts are `alumni_feed/{id}` (`kind` `update`, `reunion`, `throwback`, or `achievement`) and `institutions/{id}/alumni_groups/{groupId}/posts/{postId}`. Class networks are `institutions/{id}/alumni_groups/{groupId}` with `members/{uid}`. Reunions are `institutions/{id}/alumni_events/{eventId}` plus feed items with `kind: reunion`. Directory consent is the `directory` boolean on `users/{uid}/alumni_consent/{institutionId}`. The directory row is `alumni_directory/{institutionId}__{uid}`. Routes: `GET` and `POST /api/alumni/network`, `GET` and `POST /api/alumni/yearbook`, `GET` and `POST /api/institutions/alumni`, `GET` and `POST /api/institutions/yearbook`.

### DM consent and minor moderation

`users/{uid}/alumni_consent/{institutionId}` fields: `email`, `inbox`, `push`, `directory`, `messages`, `mentor`, `unsubscribed`. Missing means off. `messages` is the DM consent. Both people must opt in. Under-18 accounts cannot set `messages` or `mentor`.

A minor's wall signature, memory, feed post, and comment is held on `institutions/{id}/alumni_queue` until a staff member releases it. `kind` is `yearbook`, `yearbook-memory`, `feed`, or `feed-comment`. The minor's own yearbook page can be saved when their own text passes the word filter. They still need `parentApproved` before the page is submitted, and the client never writes that flag.

### Push preference toggles

Each new category has an account toggle on `users/{uid}.notificationPrefs` and the same key on `deviceTokens/{deviceId}.prefs`.

| Key | What it covers |
|---|---|
| `alumni` | Reunions, the alumni wall, yearbook release, and alumni messages |
| `institution` | Institution notices that are not alumni events |
| `achievements` | Badge pushes |
| `grades` | Unit-test grade pushes. It is a send category. It is not an account toggle |

There is no separate `reunions`, `wall`, `yearbook`, or `alumni_messages` category.

`notificationPrefs.push: false` stops every push from the shared sender. A missing key stays on. `false` opts out. The in-app `notifications` row is still written.

### Indexes and rules waiting for an owner deploy

These rows are in `firestore.indexes.json` and `firestore.rules`. They are not deployed from this change. Harry approves the deploy.

| Collection | Index |
|---|---|
| `leaderboard_entries` | `scope` ASC, `scopeId` ASC, `period` ASC, `xp` DESC. House boards use `scope: house`. |
| `rosters` | `email` + `status`; `importBatchId` + `importedAt` DESC; `studentNumber` + `status` |
| `certificates` | `studentId` ASC, `issuedAt` DESC |
| `badges` | `userId` ASC, `awardedAt` DESC |
| `parent_links` | `parentId` + `studentEmail`; `studentId` + `status` |
| `join_requests` | `status` + `createdAt` |

`certificates` allow a public get, a signed-in list for the owner, a teacher, or a linked parent, and no client write. `badges` allow a signed-in read and an admin write. `parent_links` and `institutions/{id}/join_requests` keep their existing create and update checks. `gamification/{uid}` is readable by that person, an admin, or a linked parent, and is not client-writable. `gamification_config/{docId}` is readable while signed in and writable by an admin. `leaderboard_entries/{id}` is readable when `shareBoard` is true and is not client-writable. Fields on a board row: `userId`, `scope` (`class`, `institution`, or `house`), `scopeId`, `period` (ISO week or `all`), `xp`, `label`, `schoolName`, `shareBoard`, `updatedAt`.

### Brand colours

Poket School brand colours are the confirmed blue gradient. Forest green `#1A3C34` and gold `#C8922A` are Rochford's school colours, not Poket School's. A platform pass sets the same token names site-wide. This branch keeps a local copy in `lib/brand-theme.ts` and `app/globals.css` so screens, PDFs, and cards match that palette.

The hero gradient is `135deg`, from `#1E6A83` through `#2786A4` to `#6FBBCE`. Screens use `bg-hero`, which reads `--hero-gradient`.

| Token | Value | Class |
| --- | --- | --- |
| `primary` | `#2786A4` | `bg-brand-primary` |
| `blueDeep` | `#1E6A83` | `bg-blue-deep`, `text-blue-deep`. White text clears on this fill. Small accent text uses it, because primary on white is under 4.5:1 |
| `blueBright` | `#6FBBCE` | `bg-blue-bright`. Use ink text on it |
| `amber` | `#E2AF4D` | Warning and accent. Use ink text. Stored as `--amber`, not a Tailwind amber scale |
| `coral` | `#D0553F` | Danger. Stored as `--coral` |
| `good` | `#1F8A70` | Success |
| `bg` | `#F4F6F6` | Page background. `bg-background` already matches |
| `wash` | `#E9F7FA` | `bg-wash` |
| `card` | `#FFFFFF` | Card, and text on the deep and primary stops |
| `line` | `#E7EDED` | `border-line` |
| `ink` | `#203337` | `text-ink` |
| `muted` | `#5F7074` | Secondary text. `--muted-ink` |
| `teacher` | `#E9F7FA` | Role wash |
| `parent` | `#E5F6EF` | Role wash |
| `admin` | `#F0F5F4` | Role wash |

Plus Jakarta Sans is the UI face and Instrument Sans is the display face. Radius steps are 12, 18, 24, 32, and pill (`--radius-12`, `--radius-18`, `--radius-24`, `--radius-32`, `--radius-pill`).

Institution white-label colours stay on each academy (`primaryColor` and `secondaryColor`). They are not this palette. Older stored yearbook templates, CV templates, pricing-card accents, and welcome hues named `forest`, `gold`, `coral`, `cream`, or `blue` still open. New writes use `deep`, `mid`, `bright`, and `mist`.

## Individual alumni claims

An individual learner can add a school they attended from the portfolio, the alumni network page, or a parent page. The control is “Add a school I attended”. The server writes every document below with the Admin SDK. Clients cannot write `seatCounted`, `parentApproved`, `studentNumber`, `ageTier`, `claimedIndividual`, or these claim documents. The default Firestore rule denies them.

A verified claim does not set `users.institutionId` or `users.alumniOf`, and it does not occupy or free a licence. `releaseAlumniSeat` returns immediately when `claimedIndividual` is true. The seat-release sweep skips those rows. A later real graduation still runs if that person is currently enrolled at the academy (`users.institutionId` equals the academy).

### `users/{uid}/alumni_claims/{id}`

Document id is the institution id when the school is registered, or the school key when it is not.

| Field | Type | Notes |
|---|---|---|
| `institutionId` | string | Set for a registered academy. Empty for a self-reported group until that school registers. |
| `schoolKey` | string | `schoolKey(country, state, name)`. Empty for a registered claim. Format `CC\|state\|slug`, with no slash. |
| `schoolName` | string | Academy name or the typed school name. |
| `className` | string | Class the learner entered. |
| `graduationYear` | string | Four digits, from 1950 through the current year. |
| `status` | string | `needs_parent`, `pending`, `verified`, `unverified`, or `rejected`. |
| `method` | string | `roster`, `domain`, `admin`, `peer`, or empty. |
| `email` | string | Lower-case email copied at request time. |
| `createdAt` | string | ISO time. |

### `institutions/{id}/alumni_claims/{uid}`

Same claim, plus `studentId` and `name`. The academy queue lists `pending` and `needs_parent` only. An admin can confirm or decline `pending`. `needs_parent` stays until a linked parent confirms.

### Decision

`decideAlumniClaim` in `lib/alumni-claim.ts`:

| Case | Status | Method |
|---|---|---|
| Minor (`under13` or `teen`) and the parent has not confirmed | `needs_parent` | empty |
| School is not registered | `unverified` | `peer` |
| `joinPolicy` is absent, `rosterMatch` is on, and a `joinRoster` or `rosters` row matches the email, `role` is `student`, and `status` is not `leaver` | `verified` | `roster` |
| `joinPolicy` is `roster` and that same row matches | `verified` | `roster` |
| `joinPolicy` is absent and the email host is in `domains`, or in `emailDomains` when `domains` is empty | `verified` | `domain` |
| `joinPolicy` is `domain` and the email host is in `domains` | `verified` | `domain` |
| Registered academy, no automatic match | `pending` | `admin` |

A missing age tier fails closed as `under13`. An institution admin cannot file a claim. A learner who still has `users.institutionId` equal to that academy is told alumni opens when they leave or graduate. An existing `users/{uid}/attended/{institutionId}` returns already verified and does not write a second membership.

### Verified placement

`rememberAttendance` with `claimedIndividual: true` writes:

- `users/{uid}/attended/{institutionId}` with `seatCounted: false` and `holdsSeat: false`.
- `users/{uid}/alumni_consent/{institutionId}` if missing. Consent stays off. `messages` and `mentor` stay unavailable to a minor.
- `institutions/{id}/alumni_groups/{groupId}` and `members/{uid}`. The group id uses the class name, or the level, plus the graduation year.
- A yearbook page for that class and year.
- `institutions/{id}/alumni/{uid}` only when that document is missing. Fields include `reason: claimed`, `claimedIndividual: true`, `seatFreed: false`, `seatCounted: false`, and `publicProfile: false`. An existing graduate document is not overwritten, so a real graduation keeps `seatFreed`.

`seatFreed: false` keeps the row out of “seats freed” and blocks undo. The desk shows “joined · no seat”. Class networks, the yearbook, the wall, messaging, and the directory are the same surfaces institution-graduated alumni use. Directory, messages, and mentor stay opt-in. A minor cannot set `messages` or `mentor`, and `canDirectMessage` blocks a minor.

### Unregistered group

`unregistered_alumni/{schoolKey}`:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Display name. |
| `country` | string | Two-letter country code. |
| `state` | string | Region, as typed. |
| `verified` | boolean | `false`. The badge is Unverified. |
| `mergedInto` | string | Empty until the school registers. Then the institution id. |
| `memberCount` | number | Incremented when a new member is added. |

`unregistered_alumni/{schoolKey}/members/{uid}`: `studentId`, `name` (public name), `className`, `graduationYear`, `parentApproved` (`true` once a parent has confirmed, or immediately for an adult), `joinedOn`.

`unregistered_alumni/{schoolKey}/posts/{id}`: `authorId`, `authorName`, `body` (max 500), `visible`, `queued`, `at`. `screenPost` blocks a threat. A minor’s note is held (`queued: true`, `visible: false`). Another adult member, not the author, can release it. There is no academy admin for this group.

A minor’s request does not create the member until a parent confirms.

### Sales lead

`unregistered_schools/{schoolKey}` gains:

| Field | Type | Notes |
|---|---|---|
| `alumniCount` | number | People who asked to join this name as alumni. |
| `registeredInstitutionId` | string | Set when the group merges into a registered academy. |

`unregistered_schools/{schoolKey}/alumni_leads/{uid}` is `{ at }` and is written once. `alumniCount` increments with that first write. `count` increments in the same write only when `users/{uid}.selfReportedSchool.key` is not already this key, so a student who already named the school is not counted twice. Super admin sees “N alumni asked to join” and, after registration, “Now on Poket School”. Merging two lead rows adds their `alumniCount` values.

### Merge when the school registers

`POST /api/institutions/register` calls `mergeUnregisteredAlumni` after the academy document is committed. The key is `schoolKey(country, state, organisation name)`, using the same two-letter country and state the registration form stores. A typed state that does not match that string will not merge.

Members with `parentApproved === false` are skipped. Everyone else is placed with `claimedIndividual: true`. Their user claim becomes `status: verified`, `method: admin`, and `institutionId` is set. The group’s `mergedInto` and the lead’s `registeredInstitutionId` are set. A failure is logged and does not fail registration.

A later request for that same school name follows the registered academy. A parent confirmation that arrives after the merge places the child in the official network instead of the old group. Posts to a merged group are refused.

### Routes

`GET /api/alumni/claim` requires a Firebase ID token.

| Query | Response |
|---|---|
| `?q=` of at least two characters | `{ schools: [{ id, name, country, state }] }`. Registered academies whose name contains the query. Suspended academies are omitted. At most eight. |
| none | `{ country, state, minor, mine, groups, children }`. `mine` is the caller’s claims. `groups` are unverified groups and their posts. `children` are linked `childIds` claims still on `needs_parent`. |

`POST /api/alumni/claim`:

| `action` | Body | Response |
|---|---|---|
| `request` (default) | `{ institutionId?, schoolName?, graduationYear, className, country?, state? }` | `{ status, message }`. `country` is required only when `institutionId` is empty, and it must be two letters. |
| `approve-child` | `{ childId, claimId }` | `{ status, message }`. The caller’s `childIds` must include `childId`. The decision runs again with `parentApproved: true` and the child’s real age tier. |
| `post` | `{ schoolKey, body }` | `{ id, visible, queued }`. |
| `release` | `{ schoolKey, postId }` | `{ ok: true }`. |

`GET /api/institutions/alumni` adds `claims: [{ studentId, name, className, graduationYear, status }]`. `POST` `{ action: "review-claim", institutionId, studentId, approve }` returns `{ status }` (`verified` or `rejected`). `approve` defaults to true. A `needs_parent` row returns “A parent confirms this learner first.”

Parent confirmation notifies the parent in app with `skipPush`. A `pending` claim notifies the academy `adminId` with push preference `institution`. A verified learner is notified with the same preference. A minor still cannot open direct messages, and a minor’s posts on the official wall stay in `institutions/{id}/alumni_queue`.

## Career extras

Rules and indexes for this section are in the repo only. Harry approves the deploy. The Admin SDK writes every collection below. A missing Firebase admin account returns `ADMIN_NOT_CONFIGURED`. A missing SMTP host returns the receipt or parent summary as text. Giving and reunion tickets use the sandbox payments layer and never charge a card. ET AI ranks opportunities that already exist. It does not call a model and it does not invent a row.

Level names are stored as text, for example Oak. Push for reunions and the reopened signing wall uses the `alumni` category.

### Skills passport

`skill_maps/{institutionId}_{skillId}` or `skill_maps/platform_{skillId}`:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Named skill. |
| `institutionId` | string | Empty for a platform map. |
| `lessonIds` | string[] | Lesson ids that prove the skill. |
| `blooms` | string[] | `remember`, `understand`, `apply`, `analyze`, `evaluate`, `create`. A unit test must carry one of these and the lesson id. |
| `badgeIds` | string[] | Badge document ids. |

`users/{uid}/proven_skills/{skillId}`: `name`, `visible`, `locked: true`, `evidence[]` (`kind` `lesson` | `unit_test` | `badge`, `id`, `lessonId`, `bloom`, `label`, `url`). Refresh copies the map name and the evidence from lessons, passed `unit_quiz_attempts`, and `badges`. The learner can change `visible` only. Hidden skills stay off the CV and the public portfolio.

### Teacher references

`users/{studentId}/endorsements/{id}`: `institutionId`, `studentId`, `teacherId`, `teacherName`, `body` (max 400), `visible`, `revoked`, `locked: true`. A teacher at that academy writes it. The student cannot change `body`. The student can set `visible`. The academy sets `revoked: true`, which hides it. The ET AI safety filter blocks a threat. A minor cannot write a reference.

### Matcher and tracker

`opportunities/{id}`: `kind` `scholarship` | `university` | `internship`, `title`, `organisation`, `summary`, `url`, `deadline` (`YYYY-MM-DD`), `interests[]`, `levels[]` (level names), `minScore` or null, `institutionId` (empty means every academy). A super admin or the institution enters the row.

`suggestOpportunities` returns a subset of that list. It needs a stated interest on `users/{uid}/career/profile.interests`, the learner's level when the row names levels, and a verified grade or passed unit test when `minScore` is set. No interests means no matches.

Saving a match writes `users/{uid}/applications/{id}` with `company`, `role`, `link`, `status: applied`, `date`, `deadline`, `reminderOn` (the deadline), and optional `cvVersionId`.

### School board

`institutions/{id}/openings/{openingId}`: `title`, `employer`, `kind` `job` | `internship`, `summary`, `url`, `deadline`, `level`, `posterRole` `alumni` | `partner`, `posterId`, `status` `pending` | `published` | `rejected`. Students and alumni of that academy see `published` only. Applying stores the same application shape plus `openingId`.

### Alumni giving

`institutions/{id}.givingEnabled` is false until the academy turns it on.

`institutions/{id}/campaigns/{id}`: `title`, `kind` `fundraising` | `sponsor_seat`, `goal`, `raised`, `currency`. `gifts/{id}`: `uid`, `amount`, `sandbox: true`, `receipt`, `at`. The receipt says no card was charged.

### Reunions

`institutions/{id}/reunions/{id}`: `title`, `when`, `place`, `ticketed`, `price`, `currency`, `wallOpenUntil`, `bookId`, `rsvpCount`. `rsvps/{uid}` is `{ going, at }`. `tickets/{uid}` is a sandbox receipt. `album/{id}` opens on or after `when`, with `caption`, `url`, `visible`, `queued`. A minor's caption is held. A public RSVP count under 5 is omitted. Reopening the wall sets `wallOpenUntil` on `institutions/{id}/yearbooks/{bookId}`. Wall notes after the lock date need that date. Pushes use `alumni`.

### Career talks

`institutions/{id}/talks/{id}`: `title`, `alumniId`, `alumniName`, `format` `live` | `recorded`, `provider` `zoom` | `meet` | `teams` or empty, `link`, `when`, `level`, `status` `proposed` | `approved` | `declined`. A live link must be on Zoom, Meet, or Teams. Students see `approved` talks. The speaker is an adult. This is not a direct message.

### Parent bridge

On graduation, linked parents receive the existing graduation letter plus one summary line. `users/{uid}/parent_bridge/access`: `consent`, `keepsPdf`, `needsConsent`, `institutionId`, `summarySentAt`. A learner under 18 leaves `keepsPdf: true`. An adult leaves `needsConsent: true` until they set `consent: true`. `GET /api/institutions/extras?view=achievement&studentId=` returns the achievement PDF for the learner, or for a linked parent when `keepsPdf` is true.

### Certificate portfolio link

`GET /api/verify/{id}` adds `portfolioUrl`. It is `https://poketschool.ai/portfolio/{studentNumber}` only when the public portfolio is already on. A learner under 18 still needs parent approval. Otherwise `portfolioUrl` is empty. The verify page shows the link only in that case.

### Routes

`GET /api/institutions/extras` is the learner desk: skills, references, matches, openings, campaigns, reunions, talks, and the parent bridge. `?view=institution&institutionId=` is the academy desk. Missing admin config returns 503.

`POST /api/institutions/extras` `action`:

| Action | Who | Effect |
|---|---|---|
| `interests` | learner | Saves stated interests. |
| `refresh-skills` | learner | Rebuilds proven skills from the record. |
| `hide-skill` | learner | Sets `visible` only. |
| `hide-endorsement` | learner | Sets `visible` only. |
| `endorse` | teacher | Writes a locked reference. |
| `revoke-endorsement` | institution | Revokes a reference. |
| `save-skill` | institution, or a super admin when `platform` is true | Saves a skill map. |
| `save-opportunity` | institution or super admin | Enters an opportunity. |
| `save-match` | learner | Copies a matched row into the tracker. |
| `post-opening` | alumnus or academy | Creates a pending opening. |
| `review-opening` | institution | Publishes or rejects it. |
| `apply-opening` | student or alumnus of that academy | Applies with a CV version. |
| `set-giving` | institution | Turns giving on or off. |
| `save-campaign` | institution | Refuses while giving is off. |
| `give` | member of that academy | Sandbox gift and receipt. |
| `save-reunion` | institution | Creates a reunion and pings `alumni`. |
| `rsvp` | student or alumnus | RSVP. |
| `ticket` | student or alumnus | Sandbox ticket. |
| `album` | student or alumnus | Photo after the date. |
| `reopen-wall` | institution | Reopens the signing wall and pings `alumni`. |
| `propose-talk` | adult alumnus | Proposes a talk. |
| `review-talk` | institution | Approves or declines it. |
| `parent-consent` | learner | Adult graduate shares the achievement PDF. |

Screens: `/dashboard/student/career`, `/dashboard/institution/career`, `/dashboard/teacher/references`.

Those three screens use the app home in `components/career/app-surface.tsx`: brand-gradient header, rounded category tiles with badge counts, a collapsible icon rail on desktop, a 64px bottom tab bar on mobile, and the top three tasks one tap from home. Icons are lucide-react at 24px. Rings and charts use `--chart-1`. Solid buttons use `bg-primary` and `text-primary-foreground`. Tile radius is 18 and greeting cards are 24. Touch targets are at least 48px. Light and dark follow the kit tokens `--ps-wash`, `--ps-blue-deep`, `--ps-hero`, `--ps-mint`, `--ps-amber-soft`, and `--ps-coral-soft`. When `components/dashboard` lands, swap `CareerHome`, `CategoryIcon`, `ProgressRing`, and `StatCard` for the kit exports of the same names.




Parent Explainer reads `badges` for the linked child and names them in the weekly note. No rules or index deploy is part of this change.

## Professional network

Poket School's verified network. The mobile app calls the HTTP routes. It does not publish by writing Firestore from the device. ET AI screens every post, comment, message, and profile first. Rules and indexes below are in the repo and are not deployed.

`platform_settings/network` holds the super-admin switches. Missing document uses these defaults: `networkOn` true, `recruiterTierOn` false, `foundersOn` false, `foundersProOn` false, `studentGroupsOn` true, `groupApprovalMode` `school`, `groupDuesOn` false, `orgVerificationMode` `domain_and_admin`, placeholder prices `recruiterFreeCents` `recruiterProCents` `foundersProCents` at 0, `inmailCreditsFree` 0, `inmailCreditsPro` 20. Paid charges are sandbox records in `recruiter_charges` and `group_dues`. Nothing captures a live card.

Under-18 profiles are `visibility: school`, `searchable: false`, and never appear in recruiter or public founder search. A missing `users.ageTier` still fails closed as `under13`.

### Screen plan

The app screen plan matches this website policy. No new network screens were added for that plan.

- Under-18 visibility is forced to `school` and `searchable` is false.
- Two adults may connect.
- A minor and an adult may connect only when one role is `teacher` or `staff` and they share an institution. `admin` and `institution_admin` are not that exception. Do not widen it.
- Two minors connect only when they share a school and a class.
- Direct messages require both people to be adults and already connected.
- Recruiter email and phone stay blank unless `shareContact` is true.
- Feed rank: connection +50, followed organisation +30, same institution +20, same class +20, shared skill +10.
- Defaults match `platform_settings/network` above, including inmail Pro at 20 and prices at 0.
- Insights hide groups under 5.

These differences remain. The website value is the one to follow.

| Topic | Website | App plan |
| --- | --- | --- |
| Adult visibility `school` | Stored as `network` by `forcedVisibility`. | Not the same stored value. |
| Minor connection | `teacher` or `staff` only. Search of a minor at the same school also allows `admin`, and that search exception is not a connection. | Do not treat `admin` or `institution_admin` as a connection exception. |
| Rank | Also adds a recency bonus `max(0, 5 - weeks)` in `rankFeed`. | The five weights only. |
| Push | The server sends category `network`. The app should receive that payload. | The app does not send a network push, and it should not invent a second one. |
| Direct messages | `canDirectMessage` requires `connected`. The reason text mentions a message request, and there is no request path. | A message request is not a way around the connection. |

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

`network` and `safety` join `alumni`, `institution`, and `achievements` on both `lib/push.ts` and `lib/platform/push.ts`. The reject string lists every category.

Account toggles: `notificationPrefs.alumni`, `notificationPrefs.institution`, `notificationPrefs.achievements`, `notificationPrefs.network`, `notificationPrefs.safety`, and `notificationPrefs.networkDigest`.
## Poket SafeLine

The student safety hotline is named Poket SafeLine. After the first mention, the short form is SafeLine. Routes, Firestore collections, and the push category stay `hotline`. Parent-to-school tickets. The website shape here is canonical. Client writes are denied. Do not deploy these rules from this branch.

`hotline_tickets/{id}`

| Field | Notes |
| --- | --- |
| `institutionId`, `studentId`, `parentUid` | The parent must have `studentId` in `users.childIds`. |
| `addressedTo` | `teacher`, `academic_lead`, `principal`, `safeguarding_lead`. |
| `assigneeUid` | Staff member, or empty. |
| `category` | `academic`, `attendance`, `fees`, `transport`, `wellbeing`, `bullying`, `safeguarding`, `technical`, `feedback`, `other`. Fees and billing are stored as `fees`. `POST /api/hotline/create` accepts the app alias `fees_billing` and stores `fees`. |
| `priority` | `low`, `medium`, `high`. Maps onto the shared severity in `lib/alerts/model.ts` (`low`, `medium`, `high`). SafeLine has no critical priority. |
| `status` | `pending`, `in_progress`, `kiv`, `solved`, `closed`. |
| `kivReason`, `kivFollowUpAt` | Required together when status is `kiv`. |
| `slaDueAt` | Working hours in the institution timezone. High is 4 working hours, medium is 1 working day, low is 3 working days. Default window is Monday to Friday, 08:00 to 17:00, `Asia/Kuala_Lumpur`, plus `institutions/{id}.holidays`. |
| `escalationLevel` | `GET /api/cron/hotline` with `Authorization: Bearer CRON_SECRET` moves an overdue ticket to teacher, then academic lead, then principal. Bullying and safeguarding never leave the safeguarding lead and the principal. |
| `reopenUntil`, `solvedAt` | A parent can reopen within 7 days of `solved`. |
| `satisfaction` | `{ rating: 1–5, comment }` after the parent rates. |
| `body`, `safeguardingCaseId` | Sensitive categories open `safeguarding_cases/{id}` with `source: hotline`. Other staff cannot read those tickets. |
| `source` | Empty for a parent SafeLine ticket. `student_safety_report` and `danger_now` are student safeguarding tickets. See [Student safety reports](#student-safety-reports). |
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
| GET, POST | `/api/hotline/share` refuses. SafeLine tickets cannot be shared. |
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
| `authorities` | Same shape as a SafeLine ticket. Public share needs `informed`, `acknowledged`, or `closed_by_authority`. A missing-child draft needs that record before it is saved. |
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

`emergency_alerts/{id}/attachments/{fileId}`: same file shape as a SafeLine attachment, plus `updateId`, `guardianConsent`, `consentRecordId`, and `public`. Only a photo with guardian consent and a consent record can be public. Storage path: `institutions/{institutionId}/alerts/{alertId}/{fileId}-{name}`, served by a signed URL.

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

A student can send a safety report, or tap **I'm in danger now**, without a parent opening a SafeLine ticket. The website shape here is canonical. `docs/HOTLINE_ALERTS_SCHEMA.md` is not on a branch. Client writes are denied. Do not deploy these rules from this branch.

The shield is one tap on the student home (`/dashboard/student`) and in Community. The form is `/dashboard/student/safety`. A parent or staff notice is `/dashboard/safety/{ticketId}`.

### Report

`POST /api/safety/report`. The type alone is enough. Optional fields are `description`, `who`, `where`, `when`, and evidence through the existing SafeLine attachment rules (`label: evidence`). Types: `bullying`, `cyberbullying`, `harassment`, `abuse`, `self_harm_concern`, `discrimination`, `unsafe_other`.

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

`POST /api/safety/danger`. The screen shows the country's emergency number immediately (999 in Malaysia) from `emergencyNumber`. The server then creates a `danger_now` ticket and a safeguarding case with `source: danger_now`, `category: safeguarding`, `severity: critical`, and `dangerId` equal to the ticket id. SafeLine priority stays `high`, because SafeLine has no critical priority. The case source stays `danger_now` so client rules can keep excluding it.

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

Staff are notified when a student files a safety report, taps **I'm in danger now**, a parent opens a high-priority safeguarding SafeLine ticket, or a second staff member confirms an emergency alert. The form teacher, the head, and the principal each get a push and an email. Parents are not on this list. Do not deploy the `mail_deliveries` rule from this branch.

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

### Poket SafeLine

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

SafeLine events and emergency `audit`, `updates`, and `consent` are permanent. Firestore rules set `allow update, delete: if false` on those subcollections for every role, admin included. Clients cannot create them either. The Admin SDK bypasses rules, so the server is the only writer, and it only creates these documents inside a transaction (`lib/server/ledger.ts`). It never updates or deletes them. `lib/ledger/chain.test.ts` fails if a server file updates, deletes, or `.add()`s those paths.

Nothing in SafeLine or emergency is hard-deleted. Resolve, retract, and withdrawn consent set flags (`publicRedacted`, `consentWithdrawn`, `publicShareEnabled: false`) and mark public attachments `public: false`. Public pages, OG cards, and share links hide the name and photo. The internal document, the file bytes, and the log stay. A separate redact-internal action may blank the parent fields only when `legalHold.on` is false, and only after the previous values are in the chain diff. That overrides any earlier retention or purge rule for these records. The 90-day purge in `purgeAudit` deletes `moderation_audit` only.

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

WhatsApp, Facebook, X, and copy link are logged with `channel`, time, and a hashed actor or `anonymous`. Sharing works only for an `active` or `updated` alert whose public share is enabled, through `/alerts/{id}`. `GET /api/emergency/share` writes the log and redirects. Copy link redirects back to the alert page. SafeLine has no share control. `GET` and `POST /api/hotline/share` return 403 and write nothing.

### Off-site backup

`GET /api/cron/firestore-backup` is a scheduled-export stub. It is disabled unless `FIRESTORE_BACKUP_ENABLED=true` and `FIRESTORE_BACKUP_BUCKET` are both set. Neither is set. It is not listed in `vercel.json`. Enabling it needs the Firebase Blaze plan and a locked bucket with a retention policy. Pending Harry's approval. Until then the route returns 503 with `pendingApproval: true` and `plan: blaze`, and it does not call the Google export API.

Retention: closed alerts stay archived and are not indexed. Retracted alerts are noindex. Public views drop the name and photo. Internal copies and the hash chain stay.

## Push categories added

`hotline` and `emergency`, on both `lib/push.ts` and `lib/platform/push.ts`. The reject string is `category must be goals, flags, attendance, digests, grades, assignments, general, progress, alumni, institution, achievements, network, safety, hotline, or emergency.`

Account toggle: `notificationPrefs.hotline`. Emergency alerts are not a preference. `pushBypassesQuietHours` is true for category `emergency`, so an all-staff alert and every other emergency push are delivered during quiet hours and when the device has muted the category.

## Alert recipients matrix

`resolveRecipients` in `lib/alerts/recipients.ts` is the only recipient list. Safety reports, danger alerts, SafeLine tickets, amber alerts, emergency alerts, Safety Desk cases, and all-staff alerts call it. Server notify paths do not keep a second staff or parent list.

| Kind | Who is included |
| --- | --- |
| Student safety report and I'm in danger now | Safeguarding lead, principal, and form teacher at the school, plus approved `parent_links`, unless the parent-exclusion rule applies. No other staff. An academic lead, another teacher, or an institution admin is not added. |
| SafeLine ticket | The addressed post, the addressed uid when one is set, and every post in the escalation chain. Sensitive tickets (`bullying`, `safeguarding`) are the safeguarding lead and the principal. Other tickets are the teacher, the academic lead, and the principal. |
| Amber (`missing_child`) or any other emergency | Every user whose `institutionId` is the school (students, parents, and staff), plus users with `emergencyOptIn: true` who match `region` (country, and state and city when the alert set them) or whose `homeCountry` is the same country. A region match without `emergencyOptIn` is not included. Institution members are included without that opt-in. |
| Safety Desk | Super admins (`role: admin`), the on-call primary, the backup only when the case has escalated, and linked guardians whose verification tier is 2 or higher. Parent exclusion removes those parent uids from the recipient list. The confidential card still lists the guardian contacts and says parents were not notified. |
| All-staff | Every staff member at the institution: teachers, institution admins, and users with a staff post. Students and parents are not included. |

Parent exclusion is unchanged: type `abuse`, `concernRole` of parent or guardian, `who` naming a parent or guardian, or `dontTellParents`. Excluded parents are not pushed. The form teacher is `users.formTeacherUid`, or a teacher at the school whose `classId` or `classIds` matches the student.

`users.emergencyOptIn` is the regional opt-in. It is not the founders `optIn` and not the recruiter `optedIn`. Missing means not opted in. `homeCountry` is compared with the alert country, including `MY` / `Malaysia`, `US` / `United States` / `USA`, and `GB` / `United Kingdom` / `UK`.

Safety and danger store `staffUids`, `notifiedParentUids`, `parentsExcluded`, and `formTeacherUid` from this resolver. SafeLine tickets store `recipientUids`. A high safeguarding ticket still sends the confidential case card to the SafeLine staff set. Other SafeLine tickets get a `hotline` push. Danger parent pushes stay category `emergency` with `force` and sound `emergency`. A safety-report parent push is category `safety`, and `force` only when the student is under 13.

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
- No SafeLine ticket, message, or category.
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

## Verification tiers

`users/{uid}.verification` is `{ tier, method, verifiedAt, verifiedBy }`. The server is the only writer. A missing object is tier 0, method `basic`. A later write cannot lower a tier. `partnerKind` (`police` or `ngo`) is stored beside it for tier 4. Firestore rules reject `verification` and `partnerKind` on create, and `verificationUntouched()` rejects them on every update, including an admin using the client SDK. Rules are not deployed from this branch.

| Tier | Who | How it is raised |
| --- | --- | --- |
| 0 | Basic account | Default. |
| 1 | Email and phone verified | OTP. Email uses the existing HMAC token against `users.email`. Phone uses the same token with the subject `phone:{number}`. Both `emailVerified` and `phoneVerified` must already be true before the tier becomes 1, method `otp`. |
| 2 | Verified guardian | The guardian creates an 8-character code. The child confirms it. The guardian is raised to tier 2, method `guardian_link`, `verifiedBy` the child. `parent_links/{parentId}_{childId}` is set approved. The code is the QR payload. It expires after 24 hours. |
| 3 | Verified school staff | A school admin of the same school, or a super admin, records `admin_invite` or `email_domain` when `institutions.emailDomain` matches the staff email. A principal is not verified on this path. A principal is raised only by a super admin, method `school_documents`, with a note of at least 3 characters about the school registration documents. |
| 4 | Verified partner | Super admin only. Method `partner_review`. Kind is `police` or `ngo`. |

An optional ID-check adapter (`lib/verification/id-check.ts`) stays off until both `ID_CHECK_API_KEY` and `ID_CHECK_URL` are set. No vendor is called otherwise. Phone OTP is delivered to `SMS_WEBHOOK_URL` when that is set. Without it, development logs that a code was created and production returns `Phone verification is not configured.` The code is not written to the production log. Reviews are appended to `verification_reviews`. Clients cannot read or write that collection or `guardian_link_codes`.

`requireTier(have, need)` is the shared check. The server throws when a gate fails.

| Feature | Need |
| --- | --- |
| Professional network and direct messages | Tier 1. Class channels stay open. The message is `Verify your email and phone before using the network.` |
| Parent view of an alert | Tier 2. |
| Staff safeguarding case | Tier 3, or `role === 'admin'` so the platform desk still works at tier 0. |
| Publish an Amber alert (`missing_child`) | Tier 3 and `staffPost === 'principal'`, or tier 4. |
| Publish any emergency alert with no school | Blocked unless the person is a super admin or a tier 4 partner. The message tells them to use the Safety Desk. |

A principal who is `verifiedStaff` but still tier 0 can still draft a non-Amber alert when `canCreate` allows it. They cannot publish Amber, and they cannot open a safeguarding case, until tier 3. The profile shows the tier label: Basic, Contact verified, Verified guardian, Verified staff, Verified partner.

`users.currentCountry` and `users.homeCountry` are self-service fields. `POST /api/verification/country` stores them as `MY`, `US`, or `GB` (and the same helper for any other two-letter code).

| Method | Path |
| --- | --- |
| GET | `/api/verification/read` |
| POST | `/api/verification/email` |
| POST | `/api/verification/phone-send` |
| POST | `/api/verification/phone` |
| POST | `/api/verification/guardian-code` |
| POST | `/api/verification/confirm-guardian` |
| POST | `/api/verification/id-check` |
| POST | `/api/verification/staff` |
| POST | `/api/verification/principal` |
| POST | `/api/verification/partner` |
| POST | `/api/verification/country` |

## Safety Desk

A person with an empty `institutionId` can file a safety report or a danger alert. The ticket is still a `hotline_tickets` document, so the hash chain, legal hold, and append-only events already apply. `addressedTo` is `poket_safety_desk` instead of `safeguarding_lead`. A student at a school keeps the school path. The old error `Join a school before sending a safety report` is gone for people without a school.

The desk sends an urgent push and a confidential email to super admins (`role === 'admin'`), the on-call primary, and linked guardians at tier 2 or higher. The same parent-exclusion rule applies: those parents are not recipients. The email card still lists guardian name, phone, and email, and it says parents were not notified. Backup is included only when the case is escalated. Delivery is the same append-only `delivery` chain entry. A failed channel falls back and, if anything failed, the first super admin gets `Staff notice failed` / `Open case.`

`GET /api/cron/hotline` also calls `escalateUnackedDesk`. Escalation is strict: `now - createdAt > 5 minutes`, status `pending`, and both `staffAckAt` and `deskEscalatedAt` empty. It writes chain action `desk_escalated` once and notifies again with the backup. It is not a new cron.

The rota is `safety_desk/rota`: `{ timezone, slots: [{ weekday, startMinutes, endMinutes, primaryUid, backupUid }], updatedBy, updatedAt }`. Weekday is 0 Sunday through 6 Saturday, matching the SafeLine calendar. Clients cannot read or write `safety_desk`. The super-admin queue is `/dashboard/admin/safety-desk`. It shows SLA, assignment, and the rota. Assignment sets `status: in_progress` and chain action `assigned`. The queue projection has no report body.

An individual (empty `institutionId`, not a super admin, tier below 4) cannot create or confirm an emergency alert, including Amber. `publishBlock` runs after `canCreate` on create and again on confirm. `POST /api/safety-desk/submit` writes a `desk_alert` ticket to the desk and does not create `emergency_alerts`.

Index, not deployed: `hotline_tickets` `addressedTo` ASC, `createdAt` DESC.

| Method | Path |
| --- | --- |
| GET | `/api/safety-desk/queue` |
| GET | `/api/safety-desk/rota` |
| POST | `/api/safety-desk/rota` |
| POST | `/api/safety-desk/assign` |
| POST | `/api/safety-desk/submit` |

## Emergency numbers

The catalog is `platform_settings/emergency_numbers/catalog/{countryCode}`. A document cannot sit at `platform_settings/emergency_numbers/{countryCode}` because that path has three segments. Each entry has police, ambulance, fire, general, child helpline name and number, mental-health helpline name and number, the official child-alert name and link, `sourceUrl`, `lastVerified`, and `needsReview`. Public read is allowed. Client write is false, including for an admin. The editor is `POST /api/emergency-numbers`, super admin only. `GET /api/emergency-numbers` is public and merges the database over the bundled seed. If the database is down, the seed is returned.

Seeded on 17 October 2026 from pages fetched for this change. `needsReview` is false only when the number is on one of these pages:

| Country | Numbers | Source |
| --- | --- | --- |
| MY | 999 for police, ambulance, fire, and general. Talian Kasih 15999. NUR Alert `https://rmp2u.rmp.gov.my/nur-alert`. Mental health left blank. | `https://www.malaysia.gov.my/en/topics/mers-999-emergency-line`, `https://999.gov.my/`, `https://www.malaysia.gov.my/en/topics/talian-kasih-15999` |
| US | 911 for every service. Childhelp `1-800-422-4453`. 988 Suicide and Crisis Lifeline. AMBER Alert `https://amberalert.ojp.gov/`. | `https://www.usa.gov/report-crime`, `https://www.fcc.gov/988-suicide-and-crisis-lifeline` |
| GB | 999 for every service. Childline `0800 1111`. Samaritans `116 123`. Child Rescue Alert `https://missingpersons.police.uk/en-gb/child-rescue-alert`. | `https://www.gov.uk/report-child-abuse`, `https://www.samaritans.org/how-we-can-help/contact-samaritan/talk-us-phone/` |

Malaysia's mental-health line is not in this seed. Befrienders remains on the separate safety support card. A row with no `https` source or no `YYYY-MM-DD` date is stored as `needsReview`. The super-admin editor is `/dashboard/admin/emergency-numbers`.

Amber and emergency push targeting is institution members, plus region match, plus `homeCountry` match. `currentCountry` is not a target. The region query still requires country, state, and city when those are set. Home country matches `MY` / `Malaysia`, `US` / `United States` / `USA`, or `GB` / `United Kingdom` / `UK`. Push text uses the recipient's `language`: English, Malay, Chinese (including `zh-Hant`), and Tamil, otherwise English. The title is the type. The body is the short "open the alert" line. The description and phone numbers are not in the push.

| Method | Path |
| --- | --- |
| GET | `/api/emergency-numbers` |
| GET | `/api/emergency-numbers?country=MY` |
| POST | `/api/emergency-numbers` |

## Help near me

`/help/near-me` is public. It is linked from the safety shield, the danger screen, and the public alert page. It renders tap-to-call numbers from the bundled seed first, so the numbers are on the page when the network is down. The country picker defaults from the geo cookie when that country is in the seed. A row marked `needsReview` says the numbers still need a review.

`Nearest police station` and `Nearest hospital` open `https://www.google.com/maps/search/?api=1&query=police%20station` or `hospital`. The device location is added to that query only after the person grants it. A denial opens the search without coordinates. There is no Places API. People without a school can submit a title and description on this page. That calls `POST /api/safety-desk/submit` and does not publish an alert.

## Anti-bullying is free

Anti-bullying help is free for every account, including an account with no school. `bullyingReceiveAllowed` is always true. It does not read `accessTier` or `subscriptionTier`. Safety Report, I'm in danger, block, mute, restrict, ET AI moderation, the evidence locker, Get help near me, and the report tracker all use that gate.

Routing is still `resolveRecipients`. Kind `bullying` with an `institutionId` and `anonymous` not true uses the student safety report list (safeguarding lead, principal, form teacher, and approved parents unless parent exclusion applies). No school, or an anonymous report, uses the Safety Desk list: super admins (`role: admin`), the on-call primary on `safety_desk/rota`, the backup only when `escalate` is set, and linked guardians at verification tier 2 or higher unless parent exclusion applies. The reporter's real name stays on the ticket. Anonymous pushes say the name stays with Desk leads and do not call `notifyTicketStaff`. `safetyView` returns `full` for a super admin or `staffPost: safety_desk` only. The reporter gets `tracker`. Everyone else, including a guardian and a school principal, gets `hidden`.

Desk SLAs are config in `DESK_SLA_MS`: critical 15 minutes, high 1 hour, medium 24 hours, low 72 hours. A desk ticket stores `deskSeverity` and `slaDueAt` from that clock. SafeLine `priority` still uses `low|medium|high`, so critical is stored as priority `high` plus `deskSeverity: critical`. The cron `GET /api/cron/hotline` calls `escalateCriticalDesk`. An unacknowledged critical desk ticket past 15 minutes sets `deskEscalatedAt` and pushes the backup and super admins. It appends `desk_escalated`.

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

## Schools that are not on Poket School

When the student's school, or the other student's school, is not an `institutions/{id}` document, the Safety Desk can still tell that school. Naming a school on a report does not send anything. `fileSafetyReport` writes a draft and the email goes out only when a Desk lead posts `send: true`.

The report form asks, optionally, "Your school" and "Bully's school". Each field is a directory picker plus free text. The ticket stores `victimSchoolId`, `victimSchoolName`, `victimSchoolOnPoket`, `bullySchoolId`, `bullySchoolName`, `bullySchoolOnPoket`, `schoolNoticeConsent`, `schoolNoticeGuardianId`, and `schoolInformedAt`. `schoolNoticeConsent` is saved only when the reporter is not `under13` and they ticked the box. A Desk request cannot set that flag.

`schools/{id}` is the directory of off-platform schools. A free-text name is stored at the first 20 hex characters of SHA-256 of the cleaned lowercase name, with `name`, `nameLower`, `onPoket: false`, `contactEmail: ''`, `contactSource: ''`, and `contactVerified: false`. An id that already exists as `institutions/{id}` is on Poket School. The email notice is refused with "That school is on Poket School. Use the safeguarding referral." `GET /api/bullying/schools?q=` returns `{ id, name, onPoket }` only. It does not return an email address. The search reads up to 50 directory rows and 40 institutions and filters in memory, so it does not need a new composite index.

`schoolNotices/{id}` is append-only through `appendChain` on `schoolNotices/{id}/events`. Clients cannot read or write `schoolNotices`, its `events`, or `schools`. Rules are not deployed. The document is:

| Field | Meaning |
| --- | --- |
| `reportId` | `hotline_tickets` id |
| `schoolId` | `schools/{id}` or blank |
| `schoolName` | Display name |
| `side` | `victim` or `bully` |
| `contact` | Verified email, or the word `phone` or `letter`. Never a guessed address |
| `contactSource` | `https://` page the Desk opened |
| `consentBy` | Student uid, guardian uid, or the Desk uid for a serious-risk override |
| `sentBy` | Desk uid. Blank until something is actually sent or logged as reached |
| `sentAt` | Milliseconds. `0` until then |
| `ackAt` | Milliseconds the school confirmed, else `0` |
| `actionTaken` | What the school wrote |
| `status` | `draft`, `find_contact`, `sent`, `reminded`, `escalated`, `acknowledged` |
| `channel` | `email`, `phone`, or `letter` |
| `incidentType` | Safety type |
| `dates` | When it happened |
| `summary` | Short account. Rejected if it contains the reporter's name |
| `token` | 48 hex characters. Server only. Clients cannot read this collection |
| `tokenHash` | SHA-256 of `token`. The public page looks up this |
| `tokenExpiresAt` | 30 days after send |
| `remindedAt` | Set when the 3-working-day reminder runs |
| `escalatedAt` | Set when the 7-working-day escalation runs |
| `chainSeq`, `chainHead`, `legalHold` | Same audit chain as other safety records |

A draft starts at `find_contact`. The Desk push says "Find contact. A school notice is waiting for review. Nothing was sent." An email is accepted only when it is a valid address, the source is a public `https://` URL (no localhost, no IP address, no userinfo, and the fetch does not follow redirects), and that exact address appears on the page. Otherwise the status stays `find_contact` and the task is `Find contact`. Phone and letter logging store the channel word plus the source URL. They do not store a number or a postal address. `reached` has to be true before that log counts as sent.

Consent is the student's own tick from age 13, or `POST /api/bullying/school-consent` from an approved guardian at verification tier 2 or higher who is not excluded by the parent-exclusion rule. Under 13, the student's tick is ignored. A serious-risk override needs `seriousRisk: true` and `overrideReason` of at least 8 characters. That writes `school_notice_override` on the ticket chain and on the notice chain, with the reason. The notice body is built by `schoolNoticeMessage`. It has the incident type, the dates, the summary, the Desk address `safety@poketschool.ai`, the acknowledgement link, and the free join link `/signup?help=bullying&ref=POKETSTAND`. It says the reporter is not named. Mail goes through `lib/mail` from `Poket School <safety@poketschool.ai>`, even when `MAIL_FROM` is something else. An evidence PDF is attached only when the Desk passes an evidence locker id whose note does not contain the reporter's name.

The acknowledgement page is `/school-notice/{token}`. It is `noindex`, omitted from the sitemap, and disallowed in `robots.ts`. The sample `/school-notice/sample` renders a static notice and does not call Firebase. A bad or unknown token says "This link is not available." An expired token says "This link has expired." The page shows the incident type, the dates, the summary, the Desk contact, a receipt form, and the join link. It does not show the reporter, the report id, or the token hash. `POST /api/school-notice/ack` is public. The token is the credential.

`GET /api/cron/hotline` calls `remindSchoolNotices` and `escalateSchoolNotices`. Three working days after `sentAt` (Monday to Friday, `Asia/Kuala_Lumpur`, skipping holidays on `DEFAULT_WORK`), a `sent` notice becomes `reminded`. The reminder email reuses the stored token, and only when the channel is email, the contact contains `@`, and the token is 48 hex characters. Otherwise the Desk is pushed: "Remind the school. No acknowledgement yet, and no email is on file." Seven working days with no `ackAt` sets `escalated` and pushes the rota primary, the backup, and `staffPost: safety_desk`. The school is not emailed a third time. The push does not include the reporter's name.

When a notice is sent, or a phone or letter is logged as reached, the ticket `schoolInformedAt` is set. The student's tracker then shows "Your school has been informed". It does not name the school.

| Method | Path |
| --- | --- |
| GET | `/api/bullying/schools` |
| GET | `/api/bullying/school-notice` |
| POST | `/api/bullying/school-notice` |
| POST | `/api/bullying/school-consent` |
| GET | `/school-notice/{token}` |
| POST | `/api/school-notice/ack` |

Queries, single field, not a new composite index: `schoolNotices.reportId`, `schoolNotices.tokenHash`, `schoolNotices.status`. Rules and indexes are not deployed. Samples: `/school-notice/sample` and the desk card on `/preview/bullying?view=desk`. The report form sample is `/preview/safety`.

## Authority referrals

High and critical safety cases reuse `hotline_tickets.authorities`. A case is high or critical when `deskSeverity` or `safetyType` is `high`, `critical`, `bullying`, `cyberbullying`, `harassment`, `abuse`, or `self_harm_concern`, or when the text matches threats of violence, assault, sexual content or exploitation, extortion, self-harm risk, or a hate crime. Before `solved` or `closed`, the Desk records refer (`required: yes`, `status: to_be_informed`) or not needed (`required: no`, `status: not_required`, reason at least 3 characters). Refer cannot close until the referral is sent and the status is `informed`, `acknowledged`, or `closed_by_authority`. A parent SafeLine ticket keeps the older close check. Low `unsafe_other` with none of those words is not this extra gate. New safety and danger tickets store `reporterCountry` from the account `country` or `homeCountry`, `authorityReferredAt: 0`, and `authorityTrackerVisible: false`.

Nothing is emailed unless `POST /api/bullying/authority-send` has `send: true`. A verified partner is a `users` document with `partnerKind` of `police` or `child_protection`, `verification.tier` at least 4, and the same country (Malaysia and `MY` match). If both the partner and the report have a state, those must match. The Desk list returns `{ id, name, kind, country }` and never an email. Mail uses the account email only when it already matches an email shape. If that partner has no email, the Desk pushes the case link instead. The message is from `Poket School <safety@poketschool.ai>` and is rejected if it contains the reporter's name. An evidence PDF is attached only when the evidence note does not name the reporter.

Where no partner matches, the Desk submits a referral pack through an official channel in `OFFICIAL_AUTHORITY_CHANNELS`. Checked Malaysia pages, and no others:

| Channel | How | Source |
| --- | --- | --- |
| Royal Malaysia Police | In person at a station. e-Reporting is not used for a crime | `https://rmp2u.rmp.gov.my/faq` |
| Talian Kasih 15999 | Child and family line | `https://www.malaysia.gov.my/en/topics/talian-kasih-15999` |
| National Scam Response Centre 997 | Extortion or a scam that took money, and a station report is still required | `https://nfcc.jpm.gov.my/index.php/en/about-nsrc` |

TODO: another country, only after its official page is opened. TODO: MCMC Cyber999, only after the official reporting URL is opened. A country with no checked channel returns "No verified official channel is on file for this country. The task is to find the official page. Do not guess an email." The pack stores the agency, the source URL, the incident type, the dates, the summary, and the reference. It does not invent an email.

Sexual cases in Malaysia include a mandatory-reporting note citing Child Act 2001 sections 27 to 29A and Sexual Offences Against Children Act 2017 section 19, with source `https://petari.bheuu.gov.my/wp-content/uploads/2025/10/UNICEF-Child-Sexual-Abuse-Report-Final-FA_Digital-Version-Interactive-pdf-compressed.pdf`. Other countries and other kinds leave the note empty.

The student sees the country emergency number first. The page says "The Safety Desk does not replace emergency services." Guardians are told unless the case is abuse by a parent or guardian, or parents are already excluded. The student is told unless the Desk sets `withholdStudent` with a reason of at least 8 characters. That writes `authority_referral_withhold` on the ticket chain and the referral chain. The tracker shows "Referred to authorities" only when `authorityTrackerVisible` is true and `authorityReferredAt` is set, which is only when the student is told.

`authorityReferrals/{id}` is append-only through `appendChain` on `authorityReferrals/{id}/events`. Clients cannot read or write the collection or its events. Rules are not deployed.

| Field | Meaning |
| --- | --- |
| `reportId` | `hotline_tickets` id |
| `country` | Reporter country, or Malaysia when the account has none |
| `agency` | Partner name or official agency |
| `partnerId` | `users` id, or blank for an official pack |
| `channel` | `partner`, `police`, `helpline`, or `scam` |
| `sentBy` | Desk uid |
| `sentAt` | Milliseconds |
| `reference` | Official reference, or `PS-` plus the first 8 token characters |
| `status` | `draft`, `sent`, `acknowledged`, `closed` |
| `outcome` | What the authority did. The Desk records it. Status becomes `acknowledged` |
| `contact` | Source URL, or the words `Poket School partner` |
| `summary`, `incidentType`, `dates` | Minimal facts. The summary cannot contain the reporter's name |
| `token` | 48 hex characters. Server only |
| `tokenHash` | SHA-256. The public page looks up this |
| `tokenExpiresAt` | 30 days |
| `chainSeq`, `chainHead`, `legalHold` | Same audit chain as other safety records |

The partner page is `/authority-case/{token}`. It is `noindex` and disallowed in `robots.ts`. `/authority-case/sample` does not call Firebase. A bad token says "This link is not available." An expired token says "This link has expired." The page shows the emergency number, the agency, the country, the incident type, the dates, the summary, the reference, the status, and `safety@poketschool.ai`. It does not show the reporter or the report id.

| Method | Path |
| --- | --- |
| GET | `/api/bullying/authority` |
| POST | `/api/bullying/authority-decision` |
| POST | `/api/bullying/authority-send` |
| POST | `/api/bullying/authority-outcome` |
| GET | `/authority-case/{token}` |

Queries, single field, not a new composite index: `users.partnerKind`, `authorityReferrals.tokenHash`. Rules and indexes are not deployed. The desk sample is `/preview/bullying?view=desk`.

## Community safety terms

The draft wording lives in `lib/safety/disclaimer.ts` as version `2026-10-17`. The title keeps `DRAFT, pending legal review`. Clause 2.1 keeps the placeholder `[COMPANY LEGAL NAME]`. The public page `/safety-terms` is indexable and is in the sitemap. Its server HTML always includes the ten clauses so a crawler can read them. A signed-in under-13 account, including an account with no `ageTier`, sees the child sentence after the page loads and the long clauses are hidden in the browser. The child sentence is the one in the draft. This build does not add BM, ZH, or TA translations.

The requested path `legal/safetyTerms/{version}` is stored as the document `legal/safetyTerms/versions/{version}` because a Firestore document path needs an even number of segments. The server creates that document in `ensureCurrentTerms` only when it is missing, with `chainSeq: 0`, `chainHead` set to the genesis hash, and an empty `legalHold`. A later write merges the draft text and does not reset the chain. Clients may get the version document when they are signed in. They cannot list, create, update, or delete it. The subcollection `legal/safetyTerms/versions/{version}/audit` is denied to clients. Rules are not deployed.

Each acknowledgement is one `appendChain` entry on that audit subcollection. The action is `safety_terms_ack`. The entry stores `uid`, `version`, and `timestamp` in addition to the usual chain fields. The user document also stores `safetyTermsAckVersion` and `safetyTermsAckAt` so the next check is one read. Those two fields are not in `selfServiceFields()`, so a client cannot write them. A matching version is not written again. A different version asks for a new acknowledgement.

`POST /api/safety/terms-ack` writes the acknowledgement. `GET /api/safety/terms` returns the current version, whether this account still needs to acknowledge it, and whether the account is under 13. Non-emergency safety writes call `requireSafetyTerms` at the route: a safety report, a SafeLine ticket, evidence, restrict, mute, block, desk restrict, a school referral, ET AI support chat, a school notice, school-notice consent, and an authority decision, send, or outcome. A support chat whose text is `critical` self-harm risk skips the acknowledgement so the report can still be filed. The check is not inside `fileSafetyReport` or `raiseDanger`.

These actions never wait for the disclaimer or the acknowledgement: I'm in danger (`danger`), the danger acknowledgement (`ack`), emergency numbers, roll-call I'm safe and Need help (`check-in`), and an Amber receipt (`lib/server/emergency.ts` and the Amber opt-in route). The I'm in danger button stays above the short footer. The footer does not cover it.

The short footer is the draft headline with the local emergency number, the goodwill sentence, and a link to `/safety-terms`. It is on `/amber/{id}`, the SafeLine and report pages, I'm in danger, `/stand-up-to-bullying`, the Safety Desk, ET AI support, Get help near me, school-notice pages, and authority case pages. School-notice email, the authority partner message, the authority referral pack, the staff case-card email, and the failed-notice email append the same footer. When the country is unknown the email uses `999`. The SMS body is `caseCardSms` and `safetyDeskSmsText`. This build has no SMS provider, so nothing is sent or logged as a failed SMS.

| Method | Path |
| --- | --- |
| GET | `/safety-terms` |
| GET | `/api/safety/terms` |
| POST | `/api/safety/terms-ack` |

The short footer and `/safety-terms` also say "Poket School's safety features are a free community service. We invite community partners to get involved." and link to `/community-partners`.

## Community partners

`/community-partners` is a public indexable page. It lists police, child-protection NGOs, schools, counsellors and mental-health organisations, helplines, businesses and sponsors, volunteers, and media. The interest form posts to `POST /api/community-partners`. The page itself does not call Firebase, so it still renders when the admin SDK is missing.

`communityPartnerApplications/{id}` is written only by the server. Clients cannot read or write it. Rules are not deployed. The document is `{ orgName, type, country, region, contactName, email, phone, website, message, status, createdAt }`, plus `route`, `nextPath`, `reviewedAt`, and `reviewedBy` after a review. `status` starts as `pending`. A hidden honeypot field is dropped and is not stored. The route allows five applications an hour for one address. A website, when present, has to start with `https://`.

If Firebase Admin is not configured, the form answers "Partner applications are coming soon." and writes nothing. If mail is not configured, the application is still saved and the review email is not treated as a crash. The review note goes to `SAFETY_ADMIN_EMAIL` or `safety@poketschool.ai`, from `Poket School <safety@poketschool.ai>`.

`POST /api/community-partners/review` is admin only. Approve sets `route` and `nextPath` and does not change a user, a verification tier, `partnerKind`, or a merchant record. Police and child-protection NGOs are pointed at tier-4 verification (`/signup?partner=tier4`). Schools are pointed at the existing institution onboarding page (`/dashboard/institution/onboarding`). Businesses and sponsors are pointed at the partner merchant flow (`/signup?partner=merchant`). Other types wait for a person. Decline stores `declined` and grants nothing.

An approval also emails the contact the absolute next link, from `Poket School <safety@poketschool.ai>`. The letter says the approval does not grant access. A missing mail key, a bad address, or a send failure leaves the approval in place and does not throw. Signup does not read `partner`. The school link is the onboarding page an institution admin already uses. The tier-4 and merchant links name those routes. They do not raise `verification.tier`, set `partnerKind`, or create a merchant record.

Get involved links to `/community-partners` from `/stand-up-to-bullying`, `/amber/{id}`, Get help near me, the safety footer, school-notice email, and Safety Desk email.

| Method | Path |
| --- | --- |
| GET | `/community-partners` |
| POST | `/api/community-partners` |
| POST | `/api/community-partners/review` |

## Institutions

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

WhatsApp Cloud API uses `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. OTP and notifications try the template first and fall back to email. Push adds the FCM v1 path above beside Expo and Web Push. None of these collections need a new client rule. Rules still need an owner deploy only for changes that already said so. This note does not deploy rules or indexes.
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

### Card face

The web card and the app card use the same layout, at credit-card ratio 85.6 × 54 mm. Copy the structure of a campus ID, not its colours.

- Header band: logo on the left, institution name in bold caps with a tagline under it, and a rounded badge on the right reading **Student ID Card** plus the institution name.
- Body, left: photo with a thick frame, then a barcode and the ID number.
- Body, right: **Name** large; **Student ID** and **Level**; **Programme** and **Academic year**; **Valid until** and a seal, with a small QR for `/verify` beside the seal. Level is a level name such as IGCSE, A-Level, or Degree Year.
- Emergency row: a phone icon, **Poket SafeLine**, and `branding.emergencyPhone` when the school has set one.
- Footer band: the motto (`branding.motto`, otherwise `branding.certificateFooter`).

Poket School colours: header is a blue gradient, the badge and footer are `#3FE0D0` with `#203337` ink, labels are `#1E6A83`, values are `#203337`. No orange, yellow, or gold.

An institution card uses that school's `branding.displayName`, `logoUrl`, tagline, motto, and seal. An independent learner gets the Poket School mark, **PoketSchool.Ai**, and the tagline “AI teachers, study tools, and the school desk”. Rochford's International School is the one demo that uses forest `#1A3C34` and gold `#C8922A`.

The sample face is **Alex Student**, **PSM-SAMPLE**, level IGCSE, with a SAMPLE watermark at 18% opacity and a cyan **Sample card** chip. The owner card prints `users.studentNumber`. The public share still does not. The QR is the existing HMAC `ps1.` token from `GET /api/student-id`. The back carries short terms, the same QR, “If found, return to…”, and Poket SafeLine. PNG and PDF downloads are generated in the browser. Apple Wallet and Google Wallet buttons are placeholders and do not issue a pass. `GET /api/card` also returns `holderName` and `brand` for the owner face. Clients still cannot write `studentNumber`.

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

Only the owner can read or write a note. Clients cannot set `share`, cannot set `remindedAt` to anything except `0`, and cannot hard-delete. A delete sets `deletedAt`. The note stays in trash for 30 days. `GET /api/cron/notes` runs once a day at 02:45 UTC (`CRON_SECRET`). The Hobby plan rejects a cron that runs more than once a day, so a reminder waits for that run. The cron sends due reminders and then deletes trash older than 30 days. A reminder push uses category `general`. It waits while `notify_settings/{uid}` quiet hours are in effect (default 21:00–07:00). If that daily run falls inside quiet hours, `remindedAt` stays `0` and the next run sends it.

The web client and the app use the same documents. The web Firestore client turns on offline persistence so an edit made offline syncs on reconnect.

Sharing is off until the owner asks. `POST /api/notes` with `action: "share"` checks the study group, then runs the note through ET AI moderation (`moderateText` plus the model). A live share is copied to `note_shares/{uid}_{noteId}` as `{ ownerId, noteId, spaceId, status, text, colour, authorFirstName, at }`. Held or blocked notes are not readable by the group and land on `moderation_queue` with surface `note`. Under-18s can share only to a `class` or `school` space whose `institutionId` matches their own. A space without `institutionId` is refused for minors. Adults can share to a study group they belong to. `action: "unshare"` removes the copy.

`action` `flashcards`, `summarise`, or `plan` reads only the owner's selected notes and sends them to ET AI. Nothing is sent until the student presses one of those actions.

Indexes for the reminder query and the trash query are in `firestore.indexes.json`. They are not deployed from this change.

## Study planner goals

The mobile contract stays `daily_goals`. The same goal is also stored at `users/{uid}/goals/{goalId}` so a plan, a link, and a visibility flag travel with the learner. `goalId` matches the `daily_goals` document id (`mirrorId` on the subcollection copy).

`source` is `self` (older documents may say `student`), `et_ai` (older documents may say `ai`), `teacher`, `parent`, or `institution`. The teacher desk filters on those values. Assigned sources cannot be deleted by the student. A teacher, parent, or institution admin can delete only a goal whose `assignedBy` is their uid and whose `source` is theirs. The title of an assigned goal stays fixed. `private` and `parentVisibility` are still stored, and they do not hide the goal. `rescheduleCount` may rise by a logged move and cannot pass `rescheduleLimit`.

| Field | Meaning |
| --- | --- |
| `link` | `{ type, id }` where `type` is `course`, `lesson`, `assignment`, `exam`, or `note`. The note id is a pointer. Note text is never copied. |
| `parentVisibility` | Note only. A linked parent can read the goal either way. |
| `private` | Note only. It does not hide the goal from parents, class teachers, or institution staff. |
| `assignedBy` | Uid of the adult who added a teacher, parent, or institution goal. They are the only adult who can delete it. |
| `focusMinutes` | Shown to parents and teachers only while `status` is `in_progress`. |
| `dueDateKey` | The real deadline the planner worked backwards from. |
| `catchUp` | True when the block was placed after the deadline. |
| `missCount` | Overdue repeats. At the age cap this raises a `missed_goals` concern for the existing progress alerts. |
| `rescheduleLog` | Optional short list. The full log is append-only at `users/{uid}/goal_reschedules/{id}` with `{ goalId, at, fromDate, toDate, fromTime, toTime, by }`. |
| `category` | Also `homework` and `personal`, beside `study`, `revision`, `practice`, `reading`, and `other`. |

`users/{uid}/study_plan/{planId}` is the week the planner built: `{ source, weekStart, goals, limits }`. The student, a linked parent, or an admin can read it. A teacher writes only `source: teacher`.

`users/{uid}/goal_adherence/{weekId}` is counts only: `{ assigned, onTime, plannedMinutes, actualMinutes, teacherIds, institutionId }`. It must not contain `titles` or `noteText`. A listed teacher, or the institution admin for `institutionId`, can read it.

`planner_defaults/global` is `{ maxDailyMinutes, maxGoalsPerDay, rescheduleLimit, missFlagAfter }`. Signed-in users can read it. Only an admin can write it. Age caps in `limitsForAge` are a ceiling: under-13 is 45 minutes and 3 goals, teen is 90 minutes and 5 goals, adult is 150 minutes and 5 goals. Admin values can only tighten those caps.

Without an ET AI key, `buildStudyPlan` in `lib/study/planner.ts` places blocks into evening and weekend windows, working backwards from deadlines. Completing the linked lesson or assignment ticks the goal. Overdue assigned goals roll into the next open slot. One miss reminds the student and notifies a parent (category `goals`, quiet hours on `notify_settings`). Repeated misses use the existing `missed_goals` concern, which already reaches teachers. Push and email still go through `/api/push`. If FCM or email keys are missing, the in-app notification remains.

These rules are in `firestore.rules` and are not deployed.

## School wall

One wall for community, class, school, groups, alumni, and a profile timeline at `/u/{handle}`. The web component is `components/wall/wall-screen.tsx`. The mobile app should render the same fields and the same audience rules.

`wall_posts/{postId}` is `{ authorId, authorHandle, body, audience, feed, schoolId, feeling, tags, locationOn, location, images, link, poll, event, sharedId, pinned, reactions, shares, moderation, createdAt }`. `audience` is `public`, `school`, `class`, `group`, or `only-me`. Under-18 accounts cannot choose `public`, cannot turn location on, and the `schoolId` must match `users.institutionId`. `feed` is `school`, `class`, `group`, `alumni`, or `event`. `reactions` is a map of `like`, `love`, `celebrate`, `insightful`, and `support` counts. `locationOn` defaults to false. Images are resized in the browser and re-encoded so EXIF location is dropped, then stored at `media/{uid}/posts/{file}`.

`wall_posts/{postId}/comments/{commentId}` is `{ authorId, body, image, parentId, createdAt }`. Replies set `parentId`. `wall_posts/{postId}/reactions/{uid}` is `{ kind }` so one person has one reaction. `wall_notifications/{id}` is `{ userId, fromId, kind, postId, read, createdAt }` with `kind` `reaction`, `comment`, or `mention`.

Feed queries are `schoolId + createdAt`, `authorHandle + createdAt`, and `feed + createdAt` in `firestore.indexes.json`. They are not deployed. A minor only reads posts whose school matches theirs. A held post is visible to the author until the Safety Desk releases it. Reports use the existing `reports` collection and the Safety Desk queue.

The app should follow `docs/DASHBOARD_UX.md` for the three-column wall: profile shortcuts, composer and feed, then events, groups, moments, online classmates, and SafeLine.

