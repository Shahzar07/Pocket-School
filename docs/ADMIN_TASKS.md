# Admin Action Centre

Collection name: `admin_tasks`. The web route is `/dashboard/admin/tasks`. A card opens with `?task={taskId}`.

```
/dashboard/admin/tasks?task={taskId}
```

That is the deep link in the FCM data payload. Do not use a different page path.

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

Already connected:

- SafeLine ticket create, solve/close, and reopen (`hotline_tickets/{id}`)
- Amber draft (`emergency_alerts/{id}`, missing child), resolve, and retract
- Community report (`reports/{id}`), summary is generic
- New institution pending approval (`institutions/{id}`), closed when the desk approves it

Other source types should call `rememberAdminTask` with their `entityPath` when the source document is created, and `finishAdminTask` when it is resolved. Pass a summary that has already had identities removed. `buildAdminTask` runs `safeSummary` again.

## Web

- Page: `app/dashboard/admin/tasks/page.tsx` (`ActionCentrePage`)
- Home widget on the admin desk
- Bell in the admin header (`TaskBell`), next to the existing notifications bell
- Components in `components/admin/action-centre/`
- Dismiss and Reject stay disabled until the reason is at least 3 characters. The API returns the same error if that is skipped

The countdown on a card is the SLA `dueAt` for `slaTier`, including while a task is snoozed. The snooze time is shown separately. The cron returns a snoozed task to `claimed` when `claimedBy` is set, otherwise to `open`.

No composite Firestore index was added. The server query is `status in ['open','claimed','snoozed']` and the sort happens in memory. Add an index before combining that filter with `orderBy`.
