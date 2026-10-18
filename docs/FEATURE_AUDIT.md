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
| `/dashboard/teacher` | Teacher | Built | Own courses and the shared class when the school is attached | Courses from the course builder. Classes from the class desk. | Gradebook, assignments |
| `/dashboard/studio` | Teacher | Built | Studio tools | Inside Studio | Student learning |
| `/dashboard/teacher/classes` | Teacher | Built | school_classes and school_enrolments for one institution | Institution admin, or a teacher when teachersCanCreateClasses is on. Independent teachers create their own. | Assignments, gradebook, attendance, goals, reports, parent view |
| `/dashboard/teacher/courses` | Teacher | Built | courses the teacher owns | Course builder | Marketplace, enrolments |
| `/dashboard/teacher/courses/build` | Teacher | Built | One course draft | This form | Course editor |
| `/dashboard/teacher/courses/[courseId]` | Teacher | Built | One course | Course builder | Preview, marketplace |
| `/dashboard/teacher/courses/[courseId]/preview` | Teacher | Built | One course | Course builder | Student course page |
| `/dashboard/teacher/earnings` | Teacher | Built | Sample ledger by course, live session, institution payment, and revenue share | Gateway webhooks when keys exist. Sample rows until then. | Wallet, admin finance, MyInvois-ready invoice fields |
| `/courses` | Teacher | Built | Published courses | Course publish | Earnings |
| `/reads` | Teacher | Built | Reads library | Reads studio | Student reading goals |
| `/dashboard/wallet` | Teacher | Built | Wallet ledger | Checkout | Earnings |
| `/dashboard/referrals` | Teacher | Built | Referral codes | Referral form | Wallet |
| `/dashboard/messages` | Teacher | Built | Threads | Compose | Notifications |
| `/dashboard/teacher/hotline` | Teacher | Built | hotline_tickets for the school | A report | Safety desk |
| `/dashboard/teacher/analytics` | Teacher | Built | Quiz submissions for owned courses, plus the class selector | Lesson quizzes | Insights, gradebook |
| `/dashboard/teacher/insights` | Teacher | Built | Class narrative | Insight job | Analytics |
| `/dashboard/teacher/progress` | Teacher | Built | At-risk signals | Nightly job | Goals |
| `/dashboard/teacher/goals` | Teacher | Built | users/{uid}/goals with source teacher or institution | Assign, edit, bulk assign. Delete only when source is teacher and assignedBy is that teacher. | Student goals, report cards, ET AI planner |
| `/dashboard/teacher/references` | Teacher | Built | Reference letters | Reference form | Student record |
| `/dashboard/teacher/gradebook` | Teacher | Built | school_marks on school_assessments for one class and term | Inline entry, CSV import, or a returned assignment | Student dashboard, parent notice, report cards, analytics, goals, certificates |
| `/dashboard/teacher/assignments` | Teacher | Built | Class or named students, rubric, due time, scale, late policy | Create form. Students submit from the student view. | Gradebook, student, parent, goals |
| `/dashboard/teacher/exams` | Teacher | Built | Exams, with the class selector | Existing exam form. Mock exam also sits on the gradebook. | Gradebook, student exams |
| `/dashboard/teacher/report-cards` | Teacher | Built | Gradebook, attendance, merits, goals, school branding | Build per student or the whole class, review, publish | Parent acknowledgement, PDF, verification QR |
| `/dashboard/teacher/report-studio` | Teacher and institution | Built | Templates over the same class record | Pick template, scope, dates, preview, export, schedule | Parents, PDF, CSV |
| `/dashboard/teacher/attendance` | Teacher | Built | school_attendance for a class session | Roster marks, bulk present, live-login sample | Report cards, Report Studio, parent dashboard |
| `/dashboard/teacher/live` | Teacher | Built | Live rooms | Existing scheduler. Attendance can copy a live session. | Attendance |
| `/dashboard/teacher/integrity` | Teacher | Built | Integrity cases | Existing case form | Report card note |
| `/dashboard/teacher/integrity/cases` | Teacher | Built | Case queue | Integrity review | Integrity |
| `/dashboard/reports` | Teacher | Built | Shared report pack | Report Studio | Report cards |
| `/dashboard/behaviour` | Teacher | Built | Merits on the class record | Merits page | Report cards |
| `/dashboard/teacher/behaviour` | Teacher | Built | Merit notes | Existing merits form | Report cards, behaviour |
| `/dashboard/community` | Teacher | Built | Community spaces | Existing community tools | Messages |
| `/dashboard/network` | Teacher | Built | Network profiles | Existing network | Community |
| `/dashboard/tutors` | Teacher | Built | Tutor offers | Existing tutor form | Earnings live sessions |
| `/dashboard/exam-centre` | Teacher | Built | Sitting bookings | Existing exam centre | Exams |
| `/dashboard/store` | Teacher | Built | Creator resources | Existing store | Earnings share |
| `/dashboard/announcements` | Teacher | Built | School announcements plus class announcements | Class desk for a class. This page for the school. | Class detail |
| `/dashboard/calendar` | Teacher | Built | Term dates | Existing calendar | Report term selector |
| `/dashboard/resources` | Teacher | Built | Files | Upload | Assignment attachments |
| `/dashboard/card` | Teacher | Built | Profile card | Account | Profile |
| `/dashboard/profile` | Teacher | Built | users/{uid} | Profile form | Class teacher name |
| `/dashboard/institution` | Institution admin | Built | The school, its classes, roster CSV, and teacher assignment | Class desk on this page, plus the existing invite CSV | Teacher classes |
| `/dashboard/institution/insights` | Institution admin | Built | School roll-up | Insight job | Teacher analytics |
| `/dashboard/institution/approvals` | Institution admin | Built | Join requests | Student request. Class join approval is on the class desk. | Enrolments |
| `/dashboard/institution/join` | Institution admin | Built | Join policy and teachersCanCreateClasses | This setting | Class create permission |
| `/dashboard/institution/alumni` | Institution admin | Built | Alumni records | Existing alumni tools | Network |
| `/dashboard/institution/career` | Institution admin | Built | Destinations | Existing career desk | Student career |
| `/dashboard/institution/verify` | Institution admin | Built | Student id | Existing verifier | Enrolment |
| `/dashboard/institution/publishing` | Institution admin | Built | School courses | Publish action | Teacher courses |
| `/dashboard/institution/sparks` | Institution admin | Built | Sparks balance | Existing pool | Student Sparks |
| `/dashboard/institution/billing` | Institution admin | Built | Seats and invoices | Existing billing | Admin finance |
| `/dashboard/institution/usage` | Institution admin | Built | Usage counters | Existing usage page | Billing |
| `/dashboard/institution/onboarding` | Institution admin | Built | Setup steps | Existing checklist | Join settings |
| `/dashboard/admin/institutions` | School admin via platform | Built | institutions/{id} | Admin institutions screen and the Rochford fixture | Institution home |
| `/dashboard/institution/templates` | Institution admin | Built | Report templates | Template editor. Report Studio runs them. | Report Studio, report cards |
| `/dashboard/institution/activity` | Institution admin | Built | Audit rows | Desk actions | Gradebook audit |
| `/dashboard/institution/progress` | Institution admin | Built | Risk flags | Nightly job and weak grades | Teacher progress, goals |
| `/dashboard/institution/certificates` | Institution admin | Built | Published term grades | Certificate designer | Gradebook |
| `/dashboard/institution/hotline` | Institution admin | Built | School hotline tickets | A report | Safety desk |
| `/dashboard/institution/emergency` | Institution admin | Built | emergency_alerts | Safety desk | SafeLine banner |
| `/dashboard/institution/groups` | Institution admin | Built | Groups beside classes | Existing groups page | Classes |
| `/dashboard/institution/destinations` | Institution admin | Built | Leaver destinations | Existing form | Career desk |
| `/dashboard/institution/pricing` | Institution admin | Built | Seat price | Existing pricing | Billing |
| `/dashboard/institution/automation` | Institution admin | Built | Rules | Existing automation | Reports schedule |
| `/dashboard/admin/schools` | Platform school admin | Built | School lead inbox | Existing leads form | Institutions |

## Notes

- `/dashboard/teacher` (Built): Home reads the shared class record and files a class note. It is no longer only a course overview.
- `/dashboard/studio` (Built): A class brief sits on the shared record. The Studio editor underneath is unchanged.
- `/dashboard/teacher/classes` (Built): Create, edit, and archive. Search, filters, and sort. Roster, attendance, assignments, goals, gradebook, and announcements. Join by CSV, invite link, QR, or code, with approval. Institution admins bulk-create and assign a teacher.
- `/dashboard/teacher/courses` (Built): The class course is created here. The existing lesson builder stays on the page.
- `/dashboard/teacher/courses/build` (Built): The class course is created here. The existing lesson builder stays on the page.
- `/dashboard/teacher/courses/[courseId]` (Built): The class course is created here. The existing lesson builder stays on the page.
- `/dashboard/teacher/courses/[courseId]/preview` (Built): The class course is created here. The existing lesson builder stays on the page.
- `/dashboard/teacher/earnings` (Built): Per-sale table with course, date, gross, split, fees, and net. Pending, available, and paid totals. Payout schedule and history, refunds, CSV, and a monthly chart. Labelled sample.
- `/courses` (Built): A signed-in teacher can file a marketplace listing for a class. The public catalogue is unchanged for everyone else.
- `/reads` (Built): A signed-in teacher attaches a book to the class. The Reads library is unchanged.
- `/dashboard/wallet` (Built): A sample wallet transfer sits on the same ledger as earnings.
- `/dashboard/referrals` (Built): Referral codes can be filed against a class.
- `/dashboard/messages` (Built): A class message is created here and queued with the other family notices.
- `/dashboard/teacher/hotline` (Built): Already shipped on this branch.
- `/dashboard/teacher/analytics` (Built): Analytics reads the shared marks, attendance, and goals, and can store a snapshot.
- `/dashboard/teacher/insights` (Built): An insight is a saved note on the class record.
- `/dashboard/teacher/progress` (Built): Risk flags are created here and line up with teacher goals.
- `/dashboard/teacher/goals` (Built): Add, edit, and delete for one student or the whole class. Completed and overdue views are on this page. Students cannot delete assigned goals.
- `/dashboard/teacher/references` (Built): References are drafted per student on the class record.
- `/dashboard/teacher/gradebook` (Built): Root cause of the blank page: submissions query required a missing composite index.
- `/dashboard/teacher/assignments` (Built): ET AI suggests a mark. Nothing is returned until the teacher approves it.
- `/dashboard/teacher/exams` (Built): Saving an exam creates a gradebook assessment on the same class.
- `/dashboard/teacher/report-cards` (Built): ET AI comment is a draft until the teacher edits it.
- `/dashboard/teacher/report-studio` (Built): Intro explains how it differs from the gradebook and from report cards.
- `/dashboard/teacher/attendance` (Built): Absent and late queue a parent notice. Live fill is sample active time.
- `/dashboard/teacher/live` (Built): A live room can write a present mark with a live source. The video key is still required to open a real room.
- `/dashboard/teacher/integrity` (Built): Integrity notes are created here and printed on the report card until they are closed.
- `/dashboard/teacher/integrity/cases` (Built): The case queue is the integrity list filtered to this class.
- `/dashboard/reports` (Built): A report pack records which class and template to run. Report Studio still builds the file.
- `/dashboard/behaviour` (Built): Behaviour notes add a merit on the shared record, which report cards already read.
- `/dashboard/teacher/behaviour` (Built): Merits are created here and summed on the report card.
- `/dashboard/community` (Built): Community sets the class audience and links to WallScreen. The feed is not rebuilt here.
- `/dashboard/network` (Built): A network introduction is stored on the class.
- `/dashboard/tutors` (Built): Tutor offers are created for a class and point at live-session earnings.
- `/dashboard/exam-centre` (Built): Sittings are booked per student and point at the exam on the gradebook.
- `/dashboard/store` (Built): Store items are filed against the class.
- `/dashboard/announcements` (Built): Announcements are created for a class on the shared record.
- `/dashboard/calendar` (Built): Term dates for a class are created here.
- `/dashboard/resources` (Built): Resources are named on the class and can be attached to an assignment.
- `/dashboard/card` (Built): The member card stays as it is. A class note is stored beside it.
- `/dashboard/profile` (Built): The account profile stays. The class display name is saved on the shared record.
- `/dashboard/institution` (Built): School admin is the institution admin in this product.
- `/dashboard/institution/insights` (Built): School insights are written by the institution admin on the shared classes.
- `/dashboard/institution/approvals` (Built): An approval creates a pending enrolment on the class. The roster is where it is approved.
- `/dashboard/institution/join` (Built): Join settings record the policy. Teachers create classes only when the school allows it.
- `/dashboard/institution/alumni` (Built): Alumni rows are created from a class enrolment.
- `/dashboard/institution/career` (Built): Career notes are filed per student.
- `/dashboard/institution/verify` (Built): Verification is recorded against the enrolment.
- `/dashboard/institution/publishing` (Built): Publishing records which class course is in the school library.
- `/dashboard/institution/sparks` (Built): Sparks allocations are sample rows on the class.
- `/dashboard/institution/billing` (Built): Billing rows are sample invoices. No charge is sent.
- `/dashboard/institution/usage` (Built): Usage is counted from enrolments and attendance.
- `/dashboard/institution/onboarding` (Built): Onboarding steps are saved on the institution sample.
- `/dashboard/admin/institutions` (Built): Shipped earlier on this branch.
- `/dashboard/institution/templates` (Built): Templates are named here and run in Report Studio.
- `/dashboard/institution/activity` (Built): Activity is the shared audit log, plus a manual note.
- `/dashboard/institution/progress` (Built): School risk flags are created for a student and sync to the teacher risk list.
- `/dashboard/institution/certificates` (Built): Certificate issuance is recorded from the published term grade.
- `/dashboard/institution/hotline` (Built): Already shipped.
- `/dashboard/institution/emergency` (Built): Already shipped.
- `/dashboard/institution/groups` (Built): Groups are extra cohorts. The teaching register remains the class.
- `/dashboard/institution/destinations` (Built): Destinations are saved per student.
- `/dashboard/institution/pricing` (Built): Pricing is a sample note. Charging still needs gateway keys.
- `/dashboard/institution/automation` (Built): Automation queues a weekly parent report on the sample. Nothing is emailed.
- `/dashboard/admin/schools` (Built): School leads are the platform pipeline. The class register starts after the institution exists.

## Still open

- Firestore rules for `school_*` and `users/{uid}/goals` are written and not deployed.
- The Rochford class is not written to the live database until the Firebase Admin key exists.
- Stripe, Daily.co, mail, and push stay sample or queued. Nothing is sent to a bank, a parent inbox, or MyInvois.
- The school wall is WallScreen on pull request 144. This desk links to it and does not copy the feed.
- Studio, the course builder, the member card, the profile form, and the mailbox stay on their pages, with a class record saved above them.
