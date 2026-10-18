# Teacher and institution feature audit

Checked against `docs/SCHEMA_CHANGES.md`, `docs/DASHBOARD_AUDIT.md`, `docs/INSTITUTION_SYSTEM.md`, the dashboard page catalogue, and the teacher and institution navigation on 18 October 2026.

School admin in this product is the institution admin. Platform school leads stay on `/dashboard/admin/schools`.

The other agent `bc-fe6ce9aa` (`cursor/ai-teachers-content-language-02e8`) still stores daily goals on `daily_goals` with `source` of `student`, `parent`, or `ai`. It does not yet publish `users/{uid}/goals`. This branch adds that subcollection with `source` of `teacher` or `institution` and leaves `daily_goals` unchanged so the two branches can merge.

## Gradebook root cause

`getSubmissionsForTeacher` queried `submissions` with `where(courseId)` and `orderBy(submittedAt)`. That pair is not in `firestore.indexes.json`, so Firestore rejected the query. The gradebook caught the error and showed “Couldn’t load submissions”. The same call sits on the teacher home, so that page failed with it. The query now sorts in memory. The gradebook itself reads the shared class record, not that quiz-only list. A submission document without `answers` would also have crashed the old marker.

## Shared record

Assignments, the gradebook, attendance, goals, report cards, Report Studio, and the parent view read one sample for Rochford’s International School: institution, class IGCSE Mathematics, enrolments, assessments, marks, attendance, and goals. It is labelled sample. It stays in the browser until `scripts/seed-rochford-class.ts` can write with the Firebase Admin key.

## Register

| Route | Who | Status | Data | Created by | Syncs to |
| --- | --- | --- | --- | --- | --- |
| `/dashboard/teacher` | Teacher | Partial | Own courses and the shared class when the school is attached | Courses from the course builder. Classes from the class desk. | Gradebook, assignments |
| `/dashboard/studio` | Teacher | Partial | Studio tools | Inside Studio | Student learning |
| `/dashboard/teacher/classes` | Teacher | Built | school_classes and school_enrolments for one institution | Institution admin, or a teacher when teachersCanCreateClasses is on. Independent teachers create their own. | Assignments, gradebook, attendance, goals, reports, parent view |
| `/dashboard/teacher/courses` | Teacher | Partial | courses the teacher owns | Course builder | Marketplace, enrolments |
| `/dashboard/teacher/courses/build` | Teacher | Partial | One course draft | This form | Course editor |
| `/dashboard/teacher/courses/[courseId]` | Teacher | Partial | One course | Course builder | Preview, marketplace |
| `/dashboard/teacher/courses/[courseId]/preview` | Teacher | Partial | One course | Course builder | Student course page |
| `/dashboard/teacher/earnings` | Teacher | Built | Sample ledger by course, live session, institution payment, and revenue share | Gateway webhooks when keys exist. Sample rows until then. | Wallet, admin finance, MyInvois-ready invoice fields |
| `/courses` | Teacher | Partial | Published courses | Course publish | Earnings |
| `/reads` | Teacher | Partial | Reads library | Reads studio | Student reading goals |
| `/dashboard/wallet` | Teacher | Partial | Wallet ledger | Checkout | Earnings |
| `/dashboard/referrals` | Teacher | Partial | Referral codes | Referral form | Wallet |
| `/dashboard/messages` | Teacher | Partial | Threads | Compose | Notifications |
| `/dashboard/teacher/hotline` | Teacher | Built | hotline_tickets for the school | A report | Safety desk |
| `/dashboard/teacher/analytics` | Teacher | Partial | Quiz submissions for owned courses, plus the class selector | Lesson quizzes | Insights, gradebook |
| `/dashboard/teacher/insights` | Teacher | Partial | Class narrative | Insight job | Analytics |
| `/dashboard/teacher/progress` | Teacher | Partial | At-risk signals | Nightly job | Goals |
| `/dashboard/teacher/goals` | Teacher | Built | users/{uid}/goals with source teacher or institution | Assign, edit, bulk assign. Delete only when source is teacher and assignedBy is that teacher. | Student goals, report cards, ET AI planner |
| `/dashboard/teacher/references` | Teacher | Partial | Reference letters | Reference form | Student record |
| `/dashboard/teacher/gradebook` | Teacher | Built | school_marks on school_assessments for one class and term | Inline entry, CSV import, or a returned assignment | Student dashboard, parent notice, report cards, analytics, goals, certificates |
| `/dashboard/teacher/assignments` | Teacher | Built | Class or named students, rubric, due time, scale, late policy | Create form. Students submit from the student view. | Gradebook, student, parent, goals |
| `/dashboard/teacher/exams` | Teacher | Partial | Exams, with the class selector | Existing exam form. Mock exam also sits on the gradebook. | Gradebook, student exams |
| `/dashboard/teacher/report-cards` | Teacher | Built | Gradebook, attendance, merits, goals, school branding | Build per student or the whole class, review, publish | Parent acknowledgement, PDF, verification QR |
| `/dashboard/teacher/report-studio` | Teacher and institution | Built | Templates over the same class record | Pick template, scope, dates, preview, export, schedule | Parents, PDF, CSV |
| `/dashboard/teacher/attendance` | Teacher | Built | school_attendance for a class session | Roster marks, bulk present, live-login sample | Report cards, Report Studio, parent dashboard |
| `/dashboard/teacher/live` | Teacher | Partial | Live rooms | Existing scheduler. Attendance can copy a live session. | Attendance |
| `/dashboard/teacher/integrity` | Teacher | Partial | Integrity cases | Existing case form | Report card note |
| `/dashboard/teacher/integrity/cases` | Teacher | Partial | Case queue | Integrity review | Integrity |
| `/dashboard/reports` | Teacher | Partial | Shared report pack | Report Studio | Report cards |
| `/dashboard/behaviour` | Teacher | Partial | Merits on the class record | Merits page | Report cards |
| `/dashboard/teacher/behaviour` | Teacher | Partial | Merit notes | Existing merits form | Report cards, behaviour |
| `/dashboard/community` | Teacher | Partial | Community spaces | Existing community tools | Messages |
| `/dashboard/network` | Teacher | Partial | Network profiles | Existing network | Community |
| `/dashboard/tutors` | Teacher | Partial | Tutor offers | Existing tutor form | Earnings live sessions |
| `/dashboard/exam-centre` | Teacher | Partial | Sitting bookings | Existing exam centre | Exams |
| `/dashboard/store` | Teacher | Partial | Creator resources | Existing store | Earnings share |
| `/dashboard/announcements` | Teacher | Partial | School announcements plus class announcements | Class desk for a class. This page for the school. | Class detail |
| `/dashboard/calendar` | Teacher | Partial | Term dates | Existing calendar | Report term selector |
| `/dashboard/resources` | Teacher | Partial | Files | Upload | Assignment attachments |
| `/dashboard/card` | Teacher | Partial | Profile card | Account | Profile |
| `/dashboard/profile` | Teacher | Partial | users/{uid} | Profile form | Class teacher name |
| `/dashboard/institution` | Institution admin | Built | The school, its classes, roster CSV, and teacher assignment | Class desk on this page, plus the existing invite CSV | Teacher classes |
| `/dashboard/institution/insights` | Institution admin | Partial | School roll-up | Insight job | Teacher analytics |
| `/dashboard/institution/approvals` | Institution admin | Partial | Join requests | Student request. Class join approval is on the class desk. | Enrolments |
| `/dashboard/institution/join` | Institution admin | Partial | Join policy and teachersCanCreateClasses | This setting | Class create permission |
| `/dashboard/institution/alumni` | Institution admin | Partial | Alumni records | Existing alumni tools | Network |
| `/dashboard/institution/career` | Institution admin | Partial | Destinations | Existing career desk | Student career |
| `/dashboard/institution/verify` | Institution admin | Partial | Student id | Existing verifier | Enrolment |
| `/dashboard/institution/publishing` | Institution admin | Partial | School courses | Publish action | Teacher courses |
| `/dashboard/institution/sparks` | Institution admin | Partial | Sparks balance | Existing pool | Student Sparks |
| `/dashboard/institution/billing` | Institution admin | Partial | Seats and invoices | Existing billing | Admin finance |
| `/dashboard/institution/usage` | Institution admin | Partial | Usage counters | Existing usage page | Billing |
| `/dashboard/institution/onboarding` | Institution admin | Partial | Setup steps | Existing checklist | Join settings |
| `/dashboard/admin/institutions` | School admin via platform | Built | institutions/{id} | Admin institutions screen and the Rochford fixture | Institution home |
| `/dashboard/institution/templates` | Institution admin | Partial | Report templates | Template editor. Report Studio runs them. | Report Studio, report cards |
| `/dashboard/institution/activity` | Institution admin | Partial | Audit rows | Desk actions | Gradebook audit |
| `/dashboard/institution/progress` | Institution admin | Partial | Risk flags | Nightly job and weak grades | Teacher progress, goals |
| `/dashboard/institution/certificates` | Institution admin | Partial | Published term grades | Certificate designer | Gradebook |
| `/dashboard/institution/hotline` | Institution admin | Built | School hotline tickets | A report | Safety desk |
| `/dashboard/institution/emergency` | Institution admin | Built | emergency_alerts | Safety desk | SafeLine banner |
| `/dashboard/institution/groups` | Institution admin | Partial | Groups beside classes | Existing groups page | Classes |
| `/dashboard/institution/destinations` | Institution admin | Partial | Leaver destinations | Existing form | Career desk |
| `/dashboard/institution/pricing` | Institution admin | Partial | Seat price | Existing pricing | Billing |
| `/dashboard/institution/automation` | Institution admin | Partial | Rules | Existing automation | Reports schedule |
| `/dashboard/admin/schools` | Platform school admin | Partial | School lead inbox | Existing leads form | Institutions |

## Notes

- `/dashboard/teacher` (Partial): Home no longer dies on the submissions index error. It is still a course overview, not the class register.
- `/dashboard/studio` (Partial): Left to the Studio owner. Not rebuilt here.
- `/dashboard/teacher/classes` (Built): Replaces the curriculum matrix that had no create-class action.
- `/dashboard/teacher/courses` (Partial): Scope bar added. Course products stay separate from the class register.
- `/dashboard/teacher/courses/build` (Partial): Existing builder kept.
- `/dashboard/teacher/courses/[courseId]` (Partial): Existing editor kept.
- `/dashboard/teacher/courses/[courseId]/preview` (Partial): Existing preview kept.
- `/dashboard/teacher/earnings` (Built): Clearly labelled sample. No bank payout without Stripe or gateway keys.
- `/courses` (Partial): Public catalogue. Not redesigned in this pass.
- `/reads` (Partial): Owned by the Reads work. Not redesigned here.
- `/dashboard/wallet` (Partial): Existing wallet. Earnings explains the teacher split.
- `/dashboard/referrals` (Partial): Existing page.
- `/dashboard/messages` (Partial): Existing mailbox. Class announcements live on the class.
- `/dashboard/teacher/hotline` (Built): Already shipped on this branch.
- `/dashboard/teacher/analytics` (Partial): Scope bar added. Numbers still come from course quizzes.
- `/dashboard/teacher/insights` (Partial): Scope bar added.
- `/dashboard/teacher/progress` (Partial): Scope bar added. Weak published marks also open a teacher goal.
- `/dashboard/teacher/goals` (Built): daily_goals stays the student list. Students cannot delete assigned goals.
- `/dashboard/teacher/references` (Partial): Scope bar added.
- `/dashboard/teacher/gradebook` (Built): Root cause of the blank page: submissions query required a missing composite index.
- `/dashboard/teacher/assignments` (Built): ET AI suggests a mark. Nothing is returned until the teacher approves it.
- `/dashboard/teacher/exams` (Partial): Scope bar and how-to added. Full paper builder was already present.
- `/dashboard/teacher/report-cards` (Built): ET AI comment is a draft until the teacher edits it.
- `/dashboard/teacher/report-studio` (Built): Intro explains how it differs from the gradebook and from report cards.
- `/dashboard/teacher/attendance` (Built): Absent and late queue a parent notice. Live fill is sample active time.
- `/dashboard/teacher/live` (Partial): Daily.co still needs its keys. Scope bar added.
- `/dashboard/teacher/integrity` (Partial): Scope bar added.
- `/dashboard/teacher/integrity/cases` (Partial): Scope bar added.
- `/dashboard/reports` (Partial): Scope bar points people to Report Studio.
- `/dashboard/behaviour` (Partial): Scope bar added. Report cards read the sample merits.
- `/dashboard/teacher/behaviour` (Partial): Scope bar added.
- `/dashboard/community` (Partial): Scope bar added. Not a second class register.
- `/dashboard/network` (Partial): Scope bar added.
- `/dashboard/tutors` (Partial): Scope bar added.
- `/dashboard/exam-centre` (Partial): Scope bar added.
- `/dashboard/store` (Partial): Scope bar added.
- `/dashboard/announcements` (Partial): Scope bar added.
- `/dashboard/calendar` (Partial): Scope bar added.
- `/dashboard/resources` (Partial): Scope bar added. Assignment attachments store the file name in the sample.
- `/dashboard/card` (Partial): Not changed. Another area owns the card.
- `/dashboard/profile` (Partial): Existing profile.
- `/dashboard/institution` (Built): School admin is the institution admin in this product.
- `/dashboard/institution/insights` (Partial): Scope bar added.
- `/dashboard/institution/approvals` (Partial): Scope bar added.
- `/dashboard/institution/join` (Partial): Scope bar added. The sample school allows teachers to create classes.
- `/dashboard/institution/alumni` (Partial): Scope bar added.
- `/dashboard/institution/career` (Partial): Scope bar added.
- `/dashboard/institution/verify` (Partial): Scope bar added.
- `/dashboard/institution/publishing` (Partial): Scope bar added.
- `/dashboard/institution/sparks` (Partial): Scope bar added.
- `/dashboard/institution/billing` (Partial): Scope bar added. Gateway keys still required to charge.
- `/dashboard/institution/usage` (Partial): Scope bar added.
- `/dashboard/institution/onboarding` (Partial): Scope bar added.
- `/dashboard/admin/institutions` (Built): Shipped earlier on this branch.
- `/dashboard/institution/templates` (Partial): Scope bar explains the split.
- `/dashboard/institution/activity` (Partial): Scope bar added. The class audit is on the gradebook.
- `/dashboard/institution/progress` (Partial): Scope bar added.
- `/dashboard/institution/certificates` (Partial): Designer shipped earlier. Issuance still needs a published grade.
- `/dashboard/institution/hotline` (Built): Already shipped.
- `/dashboard/institution/emergency` (Built): Already shipped.
- `/dashboard/institution/groups` (Partial): Scope bar added. Teaching groups are classes.
- `/dashboard/institution/destinations` (Partial): Scope bar added.
- `/dashboard/institution/pricing` (Partial): Scope bar added.
- `/dashboard/institution/automation` (Partial): Scope bar added. Weekly parent reports are queued from Report Studio.
- `/dashboard/admin/schools` (Partial): Platform pipeline, not the class register.

## Still open

- Firestore rules for `school_*` and `users/{uid}/goals` are written and not deployed.
- The Rochford class is not written to the live database until the Firebase Admin key exists.
- Stripe, Daily.co, mail, and push stay sample or queued. Nothing is sent to a bank, a parent inbox, or MyInvois.
- Course builder, Studio, Reads, wallet, and the member card were not redesigned.
- Exam builder, live rooms, integrity, behaviour, community, tutors, and the exam centre keep their existing forms plus a class selector and how-to.
