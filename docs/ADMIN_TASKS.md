# Admin Action Centre

Collection name: `admin_tasks`. The web route is `/dashboard/admin/tasks`. A card opens with `?task={taskId}`.

```
/dashboard/admin/tasks?task={taskId}
```

That is the deep link in the FCM data payload. Do not use a different page path.

The collection name stays `admin_tasks`. An earlier draft called it `adminTasks`. These names map onto the fields below:

| Earlier draft | `admin_tasks` |
| --- | --- |
| `adminTasks` | collection `admin_tasks` |
| priority `urgent` | `critical`. A high or critical SafeLine case uses the `emergency` channel |
| priority `normal` | `medium` |
| status `in_progress` | `claimed` |
| `assignee` | `claimedBy` |
| status `open`, `done`, `snoozed` | the same words. Reject and dismiss use status `dismissed` |

## Document

`admin_tasks/{taskId}`

| Field | Values |
| --- | --- |
| `type` | `registration` \| `safeline_case` \| `teacher_verification` \| `institution_verification` \| `report` \| `partner_application` \| `amber_request` \| `course_review` \| `other` |
| `entityType` | Source collection name, for example `hotline_tickets` |
| `entityPath` | Source document path, for example `hotline_tickets/abc` |
| `refPath` | Always equal to `entityPath`. Kept as an alias for older readers |
| `title` | Short label. SafeLine and Amber titles are stored as `SafeLine case` and `Amber request` |
| `summary` | One safe line, at most 280 characters. Emails, phone numbers, and labelled names are stripped before the write |
| `priority` | `critical` \| `high` \| `medium` \| `low` |
| `slaTier` | Same four values. The countdown uses `dueAt`, which is `createdAt + slaTier` |
| `scope` | `{ institutionId?, region? }` |
| `status` | `open` \| `claimed` \| `snoozed` \| `done` \| `dismissed` |
| `claimedBy` | uid, or `''` |
| `claimedAt` | milliseconds, or `null` |
| `createdAt`, `dueAt` | milliseconds |
| `snoozedUntil` | milliseconds, or `null`. A snooze cannot be longer than 7 days |
| `resolution` | `{ action, reason, by, at }` or `null`. This is the source of truth |
| `resolvedAt` | Mirror of `resolution.at`, or `null` |
| `resolvedBy` | Mirror of `resolution.by`, or `''` |
| `resolutionReason` | Mirror of `resolution.reason`, or `''` |

`resolution.action` is `done`, `dismiss`, or `reject`.

- `done` does not need a reason. Status becomes `done`.
- `dismiss` and `reject` need a reason of 3 to 500 characters. Status becomes `dismissed`. Reject is `resolution.action: 'reject'` with status `dismissed`.
- The flat fields stay in sync with `resolution`. Do not write one without the other.

SLA clocks match the SafeLine desk:

| `slaTier` | `dueAt` |
| --- | --- |
| `critical` | created + 15 minutes |
| `high` | created + 1 hour |
| `medium` | created + 24 hours |
| `low` | created + 72 hours |

A safeguarding or bullying SafeLine ticket opened at hotline priority `high` is stored as `priority: 'critical'` and `slaTier: 'critical'`.

The task id is derived from `entityPath`, so opening the same source twice does not create a second task.

## Who can write

Clients cannot create or delete `admin_tasks`. The server (Admin SDK) creates a task when the source document is created, and resolves it when that source is resolved. The Admin SDK bypasses rules, so the API repeats the reason check before it writes.

An admin client may update only these fields: `status`, `claimedBy`, `claimedAt`, `snoozedUntil`, `resolvedAt`, `resolvedBy`, `resolutionReason`, `resolution`. Rules reject the update when:

- status is `dismissed` and `resolution.action` is `reject` or `dismiss` without a reason of at least 3 characters
- the flat fields do not match `resolution`
- `resolution.by` is not the signed-in admin
- a snooze is not in the future, or is more than 8 days ahead (the API caps this at 7 days)

The web UI does not write Firestore itself. It calls `POST /api/admin/tasks`, which writes `admin_audit` as well:

```
{
  actorId, actorEmail, action, targetId, at, before, after
}
```

`action` is `admin_task.claim`, `admin_task.snooze`, `admin_task.unsnooze`, `admin_task.done`, `admin_task.dismiss`, or `admin_task.reject`.

A direct client update that passes the rules does not write that audit row. Use the API when the audit log should move with the task.

Read access: a super admin can read every task. Another admin can read a task whose `scope.institutionId` or `scope.region` matches their profile. A task with an empty scope is visible to super admins only. The web list is filtered again on the server.

## SafeLine identities

Firestore cannot hide one field from one reader, so the stored `title` and `summary` never keep a SafeLine identity. `safeSummary` replaces an email, a phone number, and a labelled name (`name:`, `student:`, `parent:`, `reporter:`, `caller:`) with `[hidden]`.

A safeguarding lead or a super admin still opens the source document to see who is involved. If a name is ever written onto a sensitive task by mistake, the API hides it again unless the viewer is a super admin or `staffPost` is `safeguarding_lead`.

Sensitive types are `safeline_case` and `amber_request`.

## Push

FCM `data` for an Action Centre push is exactly:

```
{
  taskId,
  type,
  priority,
  slaTier,
  entityPath,
  deepLink,
  title
}
```

`deepLink` is `/dashboard/admin/tasks?task={taskId}`.

Android notification channel:

| Channel | When |
| --- | --- |
| `emergency` | `type` is `safeline_case` and `slaTier` or `priority` is `critical` or `high` |
| `admin` | Every other task, including medium and low SafeLine |

`emergency` is sent as FCM Android priority `HIGH`. Other pushes that are not Action Centre tasks still send `{ link, category }` and do not set a channel.

Expo uses the same `channelId`. The push `category` is `emergency` or `admin`. `admin` was added to the shared category list.

Recipients are users with `role == 'admin'` or `adminRole == 'super_admin'`, then filtered to the task scope. Super admins are always included. The query is capped.

## Notification preferences

Account toggles stay on the user document, in the map field `users/{uid}.notificationPrefs` (`email`, `push`, `messages`, `announcements`, `product`, `alumni`, `institution`, `achievements`, `network`, `safety`, `hotline`, `networkDigest`). That map is unchanged.

Action Centre preferences are a different document, so they do not collide with that map:

```
users/{uid}/notificationPrefs/admin
```

| Field | Values |
| --- | --- |
| `mode` | `instant` \| `digest` |
| `digestTimes` | 1 to 4 `HH:MM` strings. Default `08:00` and `17:00` |
| `quietHours` | `{ start, end, tz }`. Default `22:00`–`07:00`, `Asia/Kuala_Lumpur` |
| `categories` | `{ admin: boolean, emergency: true }` |
| `lastDigestAt` | milliseconds. Written by the server. A client update must leave it unchanged |

`categories.emergency` is forced on. Rules reject a write that sets it to false. Quiet hours never mute the `emergency` channel. A muted `admin` category does not mute `emergency` either.

`instant` sends the admin channel immediately, unless quiet hours are active. `digest` holds the admin channel until a `digestTimes` entry. The cron at `/api/cron/admin-tasks` runs every 15 minutes. A digest time fires once inside that window, and it does not fire during quiet hours. If the whole window sits inside quiet hours, that digest is skipped until the next time. Emergency SafeLine pushes are not held for digest or quiet hours.

The signed-in user can read and write their own `notificationPrefs/admin` document. The web screen saves through `POST /api/admin/tasks/prefs`, which also forces `emergency: true` and ignores a client `lastDigestAt`.

## Server entry points

Call these from the server that creates or closes the source. A task failure is caught and does not fail the source write.

- `openAdminTask` / `rememberAdminTask` in `lib/server/admin-tasks.ts`
- `finishAdminTask(entityPath, by, action, reason)` when the source is resolved
- `reopenAdminTask(entityPath)` when a done task should open again

Connected when the source is written:

- SafeLine ticket create, solve/close, and reopen (`hotline_tickets/{id}`)
- Amber draft (`emergency_alerts/{id}`, missing child), resolve, and retract
- Community report (`reports/{id}`), summary is generic
- New institution pending approval (`institutions/{id}`), closed when the desk approves it
- Student registration and teacher join (`institutions/{id}/join_requests/{uid}`, status `pending`). Approve and decline on the task update the join request
- Community partner application, closed on approve or decline
- Refund request (`refund_requests/{id}`) and a failed payout (`payouts/{id}`)
- Failed school or subscription payment (`institutions/{id}/billing/current`, `subscriber_billing/{uid}`)

`/api/cron/admin-tasks` also scans queues that are written from the browser, and opens or closes the matching task. The scan is limited and one missing index does not stop the others. Opening the Action Centre runs the same scan at most once a minute.

| Source | Task `type` | `entityType` | Open while |
| --- | --- | --- | --- |
| Join request, student | `registration` | `join_requests` | `pending` |
| Join request, teacher or institution staff | `teacher_verification` | `join_requests` | `pending` |
| SafeLine ticket | `safeline_case` | `hotline_tickets` | not solved or closed |
| Amber alert | `amber_request` | `emergency_alerts` | missing child, not resolved or retracted |
| Community report | `report` | `reports` | `open` |
| Moderation appeal | `report` | `moderation_appeals` | `open` |
| Moderation queue, when it is not a copy of a report | `report` | `moderation_queue` | not approved or rejected |
| Institution sign-up | `institution_verification` | `institutions` | `pending` |
| Community partner or merchant | `partner_application` | `communityPartnerApplications` or `partners` | `pending` |
| Offer | `other` | `offers` | `review` |
| Course | `course_review` | `courses` | `pending_approval` |
| Refund | `other` | `refund_requests` | `requested` |
| Payout | `other` | `payouts` | `transfer_failed` or `awaiting_connect` |
| Support ticket | `other` | `support_tickets` | `open` or `in_progress` |
| Failed payment | `other` | `billing` or `subscriber_billing` | phase `grace` or `suspended` |

Not a queue: blog posts are `draft`, `scheduled`, or `published`. There is no “awaiting review” status, so a draft does not open a task. Poket Reads books are the author’s studio, not a separate approval collection. “Become an instructor” turns teaching on immediately. `verification_reviews` is an audit log, not a pending list. Teacher applications in this list are school join requests with role `teacher`.

Summaries do not copy names, emails, phone numbers, or ticket bodies. SafeLine and Amber titles stay generic.

## Web

- Page: `app/dashboard/admin/tasks/page.tsx` (`ActionCentrePage`)
- Home widget on the admin desk
- Bell in the admin header (`TaskBell`), next to the existing notifications bell
- Components in `components/admin/action-centre/`
- Dismiss and Reject stay disabled until the reason is at least 3 characters. The API returns the same error if that is skipped

The countdown on a card is the SLA `dueAt` for `slaTier`, including while a task is snoozed. The snooze time is shown separately. The cron returns a snoozed task to `claimed` when `claimedBy` is set, otherwise to `open`.

The home widget counts tasks by `type`, with the urgent count (critical or high) first. The to-do page filters by type, SLA, and status. Assign to me is `claim`. Bulk actions send `ids` to `POST /api/admin/tasks`. Approve on a registration or teacher application calls the existing join decision and then closes the task. Decline needs a reason. SafeLine opens `/dashboard/admin/hotline`. The stored summary never includes the case identity.

The bell badge is the open and claimed tasks this browser has not opened. That seen list is `localStorage` key `poket-admin-task-seen`. The collection has no read field. New tasks toast in the app. The list also listens with `onSnapshot` on `status in ['open','claimed','snoozed']`. If rules reject that query for a school admin, the page keeps the 30 second API refresh.

Push uses `FCM_SERVICE_ACCOUNT` when it is set, and `sendFcm` returns quietly when `FCM_SERVICE_ACCOUNT` and `FCM_SERVER_KEY` are both missing. Optional email uses `sendMail`. It sends only when `RESEND_API_KEY` and `RESEND_FROM` are set, and a missing key returns `{ sent: false, reason: 'not_configured' }` without failing the task. Admin-channel email follows quiet hours, digest mode, and the account map `users/{uid}.notificationPrefs.email`. Emergency SafeLine email is sent even during quiet hours and even when that account toggle is off. The message is the safe title, the safe summary, and the deep link.

## Rules and indexes

`firestore.rules` already denies client create and delete on `admin_tasks`, and denies a dismiss or reject without a reason. `firestore.indexes.json` adds:

- `admin_tasks` `status` + `dueAt`
- `admin_tasks` `status` + `scope.institutionId`
- collection group `join_requests` on `status`
- collection group `billing` on `phase`

These rules and indexes are in the repo and are not deployed. Deploy with:

```
npx firebase deploy --only firestore:rules,firestore:indexes --project ringed-sentinel-436615-c2
```

Do not run that from an agent session. Until the indexes are deployed, a collection-group scan logs the skip and the other queues still sync. Direct server writes do not need those indexes.
