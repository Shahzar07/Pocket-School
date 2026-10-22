# Dashboard audit

Every page under `/dashboard`, what it is for, who it is for, and what we did with the overlaps. The banner on each page reads the same purpose text.

## Decisions

- **Users vs Access.** Users & Sparks is the directory. Access is the role-capability reference with live counts, plus institution-admin assignment. It is not a second email editor.
- **Allocations.** Tier, course, and coupon grants stay here, with clearer sections.
- **Tasks and goals.** One daily-goals feature at `/dashboard/student/tasks`. `/dashboard/student/goals` redirects. Parents and teachers keep a read view.
- **Wallet and Sparks.** One wallet shows cash and Sparks. Sparks stay the learning allowance.
- **Billing.** Student, teacher, and parent billing share one payer model (parent, institution, or adult learner). Admin finance is the invoice console.
- **Calendar and planner.** One page at `/dashboard/calendar`. Year “units” are terms. `/dashboard/planner` redirects. Google Calendar sync needs owner OAuth keys.
- **Channels and community.** Community is the social surface. Channels are a tab. `/dashboard/channels` redirects.
- **Snap.** Moves into ET Maths. `/dashboard/snap` redirects to `/dashboard/studio/maths?snap=1`.
- **Resources.** Stays the file library. The CMS links to it.
- **Integrity.** Stays. It is the case, evidence, decision, and appeal flow.
- **Studio.** ET AI, ET Maths, and ET Exams open full page. ET AI Essay Writer is a new studio tool and a student page.
- **Helpdesk.** Ticket number, notes, priority, assignee, SLA, and statuses open / pending / KIV / solved / closed.
- **Keys.** Integrations is the only API-key hub, super-admin only. Payments does not store a second copy. SMTP password is `SMTP_PASS`, not the database.

## Owner keys still required

| Key | Used for |
| --- | --- |
| `OPENROUTER_API_KEY` | ET AI drafts, essay grading, moderation suggestions, summaries |
| `SMTP_PASS` | Test send and ticket or announcement email. Host presets do not include the password. |
| Stripe, Billplz, iPay88, RMS, PayPal, Xendit | Checkout, wallet top-ups, invoice links. Set in Integrations. |
| Google Calendar OAuth | Two-way calendar sync. The term editor works without it. |
| Web push (VAPID) | Browser push for messages and announcements. |
| Daily.co | Live class rooms. |

Firestore rules already allow extra fields on announcements, support tickets, and platform settings. New collections are not required for these changes, and rules are not deployed from this work.

## Pages

### Dashboard

- **Route:** `/dashboard`
- **Audience:** everyone
- **Purpose:** Opens the home for the signed-in role.
- **Overlaps:** Student, teacher, parent, and admin homes.
- **Decision:** Redirect. There is no second dashboard.
- **Owner keys:** None.

### Student home

- **Route:** `/dashboard/student`
- **Audience:** student
- **Purpose:** The student landing page: today’s goals, courses to continue, and shortcuts into ET AI, achievements, and learning.
- **Overlaps:** Achievements and daily goals also have their own pages.
- **Decision:** Keep. Surface achievements here and link to the single daily-goals page.
- **Owner keys:** None.

### Academic results

- **Route:** `/dashboard/results`
- **Audience:** student, parent, admin, institution
- **Purpose:** Students record IGCSE and O-Level, A-Level, degree, Masters, and PhD results by subject, board, grade, and session. Exam boards award these grades. Poket School records them. Entries stay self-reported until a school or admin verifies them. An optional certificate stays private. A read-only portfolio link can be turned off. Parents can read a linked child. Progress is the list of subjects and grades in each session.
- **Overlaps:** CV and portfolio, certificates, and parent progress. This page records exam-board grades. It does not award them.
- **Decision:** Keep. The learner writes. A school or platform admin verifies. Teachers do not open this page.
- **Owner keys:** None. Firestore writes use the admin SDK when FIREBASE_SERVICE_ACCOUNT or the Firestore emulator is set.

### Teacher home

- **Route:** `/dashboard/teacher`
- **Audience:** teacher
- **Purpose:** The teacher landing page: today’s class work, questions waiting, courses, and marking.
- **Overlaps:** Gradebook, assignments, and insights go deeper.
- **Decision:** Keep as the classroom overview.
- **Owner keys:** None.

### Parent home

- **Route:** `/dashboard/parent`
- **Audience:** parent
- **Purpose:** A family’s view of each child’s progress, certificates, and what needs attention.
- **Overlaps:** Parent reports, goals, and analytics.
- **Decision:** Keep. Parents read daily goals here; they do not get a second goals editor.
- **Owner keys:** None.

### Admin home

- **Route:** `/dashboard/admin`
- **Audience:** admin
- **Purpose:** Platform health: people, courses, and the queues an admin should open first.
- **Overlaps:** Reports and finance.
- **Decision:** Keep as the staff landing page.
- **Owner keys:** None.

### Institution home

- **Route:** `/dashboard/institution`
- **Audience:** institution
- **Purpose:** An institution admin’s view of classes and the people in their school.
- **Overlaps:** Admin institutions.
- **Decision:** Keep. Scoped to one institution, unlike the platform admin list.
- **Owner keys:** None.

### Report templates

- **Route:** `/dashboard/institution/templates`
- **Audience:** institution
- **Purpose:** Institution-level report card templates teachers reuse.
- **Overlaps:** Teacher report studio.
- **Decision:** Keep. Institution owns the template; teachers fill it.
- **Owner keys:** None.

### ET AI Studio

- **Route:** `/dashboard/studio`
- **Audience:** everyone
- **Purpose:** The front door to ET AI, ET Maths, and ET Exams. Opens as a full-page chat, covering the dashboard frame.
- **Overlaps:** Each tool has its own route.
- **Decision:** Keep the hub. Full-page layout lives under /dashboard/studio.
- **Owner keys:** OPENROUTER_API_KEY for live replies.

### ET AI

- **Route:** `/dashboard/studio/et`
- **Audience:** everyone
- **Purpose:** A full-page chat with ET AI for study help, drafts, and explanations. Teachers and school timetablers can ask it to draft a timetable and confirm before it changes the week.
- **Overlaps:** The floating tutor on other pages.
- **Decision:** Keep. This is the focused chat; the floating tutor stays a shortcut.
- **Owner keys:** OPENROUTER_API_KEY.

### ET AI Timetabler

- **Route:** `/dashboard/studio/timetable`
- **Audience:** teacher, institution, admin
- **Purpose:** The school or personal timetable grid inside AI Studio, beside the main sidebar, with no nested studio frame.
- **Overlaps:** The role timetable pages and the ET AI chat.
- **Decision:** Keep. The chat drafts a change and this page is the full editor. The add-on gates editing.
- **Owner keys:** None. OPENROUTER_API_KEY only adds a model reading of a photographed timetable.

### ET Maths

- **Route:** `/dashboard/studio/maths`
- **Audience:** everyone
- **Purpose:** Work a maths problem step by step, including a photo snap that used to live on its own page.
- **Overlaps:** /dashboard/snap.
- **Decision:** Snap & solve folds in here (?snap=1). The old snap URL redirects.
- **Owner keys:** OPENROUTER_API_KEY for the solver.

### Maths lab

- **Route:** `/dashboard/studio/maths/lab`
- **Audience:** everyone
- **Purpose:** Plot functions and practise with today’s equation puzzle.
- **Overlaps:** ET Maths chat.
- **Decision:** Keep as the visual lab beside the chat.
- **Owner keys:** None.

### Maths packs

- **Route:** `/dashboard/studio/maths/packs`
- **Audience:** everyone
- **Purpose:** Redirects to the mathematics step of the official exam flow.
- **Overlaps:** ET Exams official packs.
- **Decision:** Keep as the ET Maths shortcut. The flow lives under ET Exams.
- **Owner keys:** None.

### Official exams

- **Route:** `/dashboard/studio/exams/packs`
- **Audience:** everyone
- **Purpose:** Choose a level. Each later step of the official exam flow has its own page.
- **Overlaps:** The ET Maths shortcut and the admin exam pack desk.
- **Decision:** Keep. This is the first step. Saved exams are offered as quick picks.
- **Owner keys:** Firestore collection exam_packs. A student’s saved exams live on their pack progress.

### Choose an exam board

- **Route:** `/dashboard/studio/exams/packs/board/[levelId]`
- **Audience:** everyone
- **Purpose:** Exam boards for the level the student picked. The list is the shared board list.
- **Overlaps:** ET Essays board styles.
- **Decision:** Keep. This step only offers boards that belong to the level.
- **Owner keys:** None.

### Choose a subject

- **Route:** `/dashboard/studio/exams/packs/subject/[levelId]/[boardId]`
- **Audience:** everyone
- **Purpose:** Subjects for the chosen level and exam board.
- **Overlaps:** The pack list.
- **Decision:** Keep. Empty subjects stay on the next step as coming soon.
- **Owner keys:** None.

### Choose a pack

- **Route:** `/dashboard/studio/exams/packs/browse/[levelId]/[boardId]/[subjectSlug]`
- **Audience:** everyone
- **Purpose:** Published packs for the chosen subject, level, and exam board.
- **Overlaps:** The ET Maths shortcut.
- **Decision:** Keep. A subject with no pack says coming soon.
- **Owner keys:** Firestore collection exam_packs.

### Official exam pack

- **Route:** `/dashboard/studio/exams/packs/[packId]`
- **Audience:** everyone
- **Purpose:** Pack overview: units, topic progress, the free first topic, an optional exam date, and where the student left off. Teachers can assign the pack, a topic, or the mock.
- **Overlaps:** The official exam list and teacher assignments.
- **Decision:** Keep.
- **Owner keys:** Firestore collection exam_packs. Progress is stored on the signed-in student.

### Exam topic

- **Route:** `/dashboard/studio/exams/packs/[packId]/topics/[topicId]`
- **Audience:** everyone
- **Purpose:** One topic. The first topic is free. A later topic offers an upgrade and a way back to the free topic.
- **Overlaps:** Student billing.
- **Decision:** Keep. The upgrade stays on this page.
- **Owner keys:** None.

### Topic practice

- **Route:** `/dashboard/studio/exams/packs/[packId]/topics/[topicId]/practice`
- **Audience:** everyone
- **Purpose:** Exam-style questions one at a time, with a timer and step-by-step hints.
- **Overlaps:** The marking step.
- **Decision:** Keep. Hints do not reveal the final answer.
- **Owner keys:** OPENROUTER_API_KEY when the pack has no authored questions.

### Topic marking

- **Route:** `/dashboard/studio/exams/packs/[packId]/topics/[topicId]/marking`
- **Audience:** everyone
- **Purpose:** Mark-scheme marks, the worked solution, and the examiner tip when the pack includes one.
- **Overlaps:** Topic practice.
- **Decision:** Keep. Method, accuracy, and communication marks appear only when the scheme names them.
- **Owner keys:** None.

### Topic results

- **Route:** `/dashboard/studio/exams/packs/[packId]/topics/[topicId]/results`
- **Audience:** everyone
- **Purpose:** The topic score, weak questions, and the next step: retry, a similar or harder set, a lesson, the next topic, or the mock.
- **Overlaps:** The mock and the lesson.
- **Decision:** Keep.
- **Owner keys:** None.

### Mock exam

- **Route:** `/dashboard/studio/exams/packs/[packId]/mock`
- **Audience:** everyone
- **Purpose:** A timed full or half paper using only the paper structure stored on the pack.
- **Overlaps:** Topic practice.
- **Decision:** Keep. A pack with no paper names does not invent a paper.
- **Owner keys:** None.

### Results and readiness

- **Route:** `/dashboard/studio/exams/packs/[packId]/readiness`
- **Audience:** everyone
- **Purpose:** Topic mastery, an ET AI estimate on the pack’s grade scale, a revision plan to the exam date, and a save or share.
- **Overlaps:** Academic Results.
- **Decision:** Keep. The estimate is labelled ET AI estimate. The school transcript stays the academic record.
- **Owner keys:** None. The estimate is saved on the student’s pack progress.

### Maths pack

- **Route:** `/dashboard/studio/maths/packs/[packId]`
- **Audience:** everyone
- **Purpose:** Redirects to the official pack overview.
- **Overlaps:** The official exam pack.
- **Decision:** Keep so older maths links still open.
- **Owner keys:** None.

### ET Exams

- **Route:** `/dashboard/studio/exam-prep`
- **Audience:** everyone
- **Purpose:** Exam plans the learner is walking through, opened as a full-page studio.
- **Overlaps:** Student exams and the exam centre.
- **Decision:** Keep. This is personal prep. The exam centre is the booked sitting.
- **Owner keys:** OPENROUTER_API_KEY when a plan is generated.

### New exam plan

- **Route:** `/dashboard/studio/exam-prep/new`
- **Audience:** everyone
- **Purpose:** Turn notes and a date into an ET Exams study plan.
- **Overlaps:** The exam list.
- **Decision:** Keep.
- **Owner keys:** OPENROUTER_API_KEY.

### Exam plan

- **Route:** `/dashboard/studio/exam-prep/[id]`
- **Audience:** everyone
- **Purpose:** One exam’s daily goals, mastery, and past attempts.
- **Overlaps:** Student daily goals.
- **Decision:** Keep. These goals belong to an exam plan, not the daily-goals page.
- **Owner keys:** None.

### Exam topic

- **Route:** `/dashboard/studio/exam-prep/[id]/topic/[topicId]`
- **Audience:** everyone
- **Purpose:** Practise one topic inside an exam plan.
- **Overlaps:** The plan page.
- **Decision:** Keep.
- **Owner keys:** OPENROUTER_API_KEY for marking.

### Oral exam

- **Route:** `/dashboard/studio/exam-prep/[id]/oral`
- **Audience:** everyone
- **Purpose:** A spoken practice with ET AI and a rubric.
- **Overlaps:** The written mock.
- **Decision:** Keep.
- **Owner keys:** OPENROUTER_API_KEY.

### Mock paper

- **Route:** `/dashboard/studio/exam-prep/[id]/mock`
- **Audience:** everyone
- **Purpose:** Sit a timed paper and read the examiner’s summary.
- **Overlaps:** Student exams.
- **Decision:** Keep as practice. Formal exams stay on the exams pages.
- **Owner keys:** OPENROUTER_API_KEY for the summary.

### Join an exam plan

- **Route:** `/dashboard/studio/exam-prep/join/[shareId]`
- **Audience:** everyone
- **Purpose:** Open a plan a teacher or classmate shared.
- **Overlaps:** None.
- **Decision:** Keep.
- **Owner keys:** None.

### ET AI Essay Writer

- **Route:** `/dashboard/studio/essay`
- **Audience:** student, teacher
- **Purpose:** Write an essay and have ET AI grade it on the 9–1 scale, with a percentage, an A*–U grade, and feedback.
- **Overlaps:** Assignments.
- **Decision:** New studio tool. Teachers assign essays; students can also open it from their area.
- **Owner keys:** OPENROUTER_API_KEY for grading. The scale itself works without a key.

### My essays

- **Route:** `/dashboard/student/essay`
- **Audience:** student
- **Purpose:** The student home for ET AI Essay Writer: drafts, assigned essays, and grades.
- **Overlaps:** Studio essay writer.
- **Decision:** Same writer, inside the student area so assignments stay with other schoolwork.
- **Owner keys:** OPENROUTER_API_KEY.

### My learning

- **Route:** `/dashboard/student/learning`
- **Audience:** student
- **Purpose:** Courses grouped by level so a learner can see what they are in the middle of.
- **Overlaps:** My courses.
- **Decision:** Keep. Learning is progress by level; My courses is the enrolment list.
- **Owner keys:** None.

### My courses

- **Route:** `/dashboard/student/courses`
- **Audience:** student
- **Purpose:** Every course the student is enrolled in.
- **Overlaps:** My learning.
- **Decision:** Keep as the enrolment list.
- **Owner keys:** None.

### Course

- **Route:** `/dashboard/student/courses/[courseId]`
- **Audience:** student
- **Purpose:** One enrolled course: modules, lessons, and progress.
- **Overlaps:** The lesson page.
- **Decision:** Keep.
- **Owner keys:** None.

### Lesson

- **Route:** `/dashboard/student/courses/[courseId]/lessons/[lessonId]`
- **Audience:** student
- **Purpose:** Read and complete one lesson, including generated formats paid for with Sparks.
- **Overlaps:** Resources.
- **Decision:** Keep. This is the lesson; Resources is the library of saved files.
- **Owner keys:** OPENROUTER_API_KEY when a format is generated.

### Live classes

- **Route:** `/dashboard/student/live`
- **Audience:** student
- **Purpose:** Join a class that is live now or scheduled, with the teacher and the room link.
- **Overlaps:** Teacher live.
- **Decision:** Keep and improve the student join view. Teachers host on their own page.
- **Owner keys:** Daily.co keys for the room.

### Achievements

- **Route:** `/dashboard/student/achievements`
- **Audience:** student
- **Purpose:** Badges and milestones. The same highlights appear on the student home.
- **Overlaps:** Student home.
- **Decision:** Keep the full list here. Home shows a short strip.
- **Owner keys:** None.

### Assignments

- **Route:** `/dashboard/student/assignments`
- **Audience:** student
- **Purpose:** Work a teacher sent to this student, their class, or the whole institution.
- **Overlaps:** Exams and essays.
- **Decision:** Keep. Assignments are set work; exams are timed papers; essays are ET AI Essay Writer.
- **Owner keys:** None.

### Exams

- **Route:** `/dashboard/student/exams`
- **Audience:** student
- **Purpose:** Formal exams a teacher sent to a class, a student, or the institution.
- **Overlaps:** ET Exams and the exam centre.
- **Decision:** Keep as the sitting. ET Exams is personal prep. Exam centre is booking.
- **Owner keys:** None.

### Transcript

- **Route:** `/dashboard/student/transcript`
- **Audience:** student, parent
- **Purpose:** Grades and completed courses for each level, ready to view, print, or download as a PDF.
- **Overlaps:** Certificates and report cards.
- **Decision:** Keep. Transcript is the academic record. Certificates are awards. Report cards are teacher comments.
- **Owner keys:** None.

### Attendance

- **Route:** `/dashboard/student/attendance`
- **Audience:** student, parent
- **Purpose:** Presence and login times recorded by the institution and its teachers.
- **Overlaps:** Teacher attendance and reports.
- **Decision:** Keep. Linked from reports and analytics.
- **Owner keys:** None.

### Certificates

- **Route:** `/dashboard/student/certificates`
- **Audience:** student
- **Purpose:** Awards issued when a course is completed. Super admins edit the template.
- **Overlaps:** Transcript.
- **Decision:** Keep. Issuing stays automatic from completion.
- **Owner keys:** None.

### Daily goals

- **Route:** `/dashboard/student/tasks`
- **Audience:** student, parent, teacher
- **Purpose:** The old tasks address. It opens the daily-goals page and keeps the query.
- **Overlaps:** /dashboard/student/goals.
- **Decision:** Redirect to /dashboard/student/goals. The query, including add=1, is kept.
- **Owner keys:** None.

### Daily goals

- **Route:** `/dashboard/student/goals`
- **Audience:** student
- **Purpose:** The one daily-goals list: what to finish today, visible to the student, their parents, and their teachers.
- **Overlaps:** Tasks.
- **Decision:** This is the merged goals page. /dashboard/student/tasks redirects here.
- **Owner keys:** None.

### Planner

- **Route:** `/dashboard/student/planner`
- **Audience:** student
- **Purpose:** Month, week, and day calendar of classes, assignment due dates, exams, attendance, and personal goals.
- **Overlaps:** Daily goals and the year calendar.
- **Decision:** Keep beside daily goals. Desk events mirror into the same calendar.
- **Owner keys:** None.

### Learning insights

- **Route:** `/dashboard/student/analytics`
- **Audience:** student, parent, teacher
- **Purpose:** How this student is learning, with links to attendance, reports, and behaviour.
- **Overlaps:** Reports.
- **Decision:** Keep and link the shared reports.
- **Owner keys:** None.

### Academic integrity

- **Route:** `/dashboard/student/integrity`
- **Audience:** student
- **Purpose:** Cases, evidence, the teacher’s decision, and the student’s appeal or resit. This page stays.
- **Overlaps:** Teacher integrity.
- **Decision:** Keep and explain. It is the student side of a real review, not a duplicate.
- **Owner keys:** None.

### Billing

- **Route:** `/dashboard/student/billing`
- **Audience:** student
- **Purpose:** Who pays for this learner: a parent, an institution, or the learner. Invoices live in admin finance.
- **Overlaps:** Wallet, parent billing, teacher billing, admin finance.
- **Decision:** One payer model. This page explains it and links to the wallet. Admins issue invoices in finance.
- **Owner keys:** Payment provider keys, set only in Integrations.

### Sparks

- **Route:** `/dashboard/student/sparks`
- **Audience:** student
- **Purpose:** The learning allowance: how Sparks are spent and what is left this month.
- **Overlaps:** Wallet.
- **Decision:** Keep the explanation. The balance also shows on the wallet next to cash.
- **Owner keys:** None.

### Become an instructor

- **Route:** `/dashboard/student/become-instructor`
- **Audience:** student
- **Purpose:** Ask to teach on Poket School.
- **Overlaps:** None.
- **Decision:** Keep.
- **Owner keys:** None.

### My classes

- **Route:** `/dashboard/teacher/classes`
- **Audience:** teacher
- **Purpose:** Create and run a class: roster, join code, attendance, assignments, goals, and the gradebook.
- **Overlaps:** Institution home.
- **Decision:** Keep.
- **Owner keys:** None.

### Courses and products

- **Route:** `/dashboard/teacher/courses`
- **Audience:** teacher
- **Purpose:** Courses this teacher owns, including drafts.
- **Overlaps:** Admin courses and the curriculum CMS.
- **Decision:** Keep. Teachers edit their own. Admins publish the catalogue. CMS builds curriculum.
- **Owner keys:** None.

### Build a course

- **Route:** `/dashboard/teacher/courses/build`
- **Audience:** teacher
- **Purpose:** Start a new course.
- **Overlaps:** The course editor.
- **Decision:** Keep.
- **Owner keys:** None.

### Edit course

- **Route:** `/dashboard/teacher/courses/[courseId]`
- **Audience:** teacher
- **Purpose:** Edit one course’s outline and publishing state.
- **Overlaps:** Curriculum builder.
- **Decision:** Keep for teacher-owned courses.
- **Owner keys:** None.

### Course preview

- **Route:** `/dashboard/teacher/courses/[courseId]/preview`
- **Audience:** teacher
- **Purpose:** See the course the way a student will.
- **Overlaps:** The student course page.
- **Decision:** Keep.
- **Owner keys:** None.

### Earnings

- **Route:** `/dashboard/teacher/earnings`
- **Audience:** teacher
- **Purpose:** Course sales, live sessions, school payments, and revenue share. Sample figures until the payout keys exist.
- **Overlaps:** Wallet and admin finance.
- **Decision:** Keep as the teacher’s own earnings. Payouts still settle in the wallet.
- **Owner keys:** None.

### Class analytics

- **Route:** `/dashboard/teacher/analytics`
- **Audience:** teacher
- **Purpose:** How the teacher’s classes are doing.
- **Overlaps:** Insights and reports.
- **Decision:** Keep. Insights is the narrative; analytics is the numbers; reports is the shared pack.
- **Owner keys:** None.

### Insights

- **Route:** `/dashboard/teacher/insights`
- **Audience:** teacher
- **Purpose:** A written read of class progress for the teacher.
- **Overlaps:** Analytics.
- **Decision:** Keep beside analytics.
- **Owner keys:** OPENROUTER_API_KEY if a summary is generated.

### Class daily goals

- **Route:** `/dashboard/teacher/goals`
- **Audience:** teacher
- **Purpose:** Every goal for students in the teacher’s class, with status, due time, active focus, reschedules, and completion.
- **Overlaps:** Student daily goals.
- **Decision:** Assigned goals live on the student record. Daily goals students set stay on the daily goals list.
- **Owner keys:** None.

### Planner

- **Route:** `/dashboard/teacher/planner`
- **Audience:** teacher
- **Purpose:** The teacher’s month, week, and day view of class sessions, assignments, exams, and attendance.
- **Overlaps:** The student planner and the year calendar.
- **Decision:** Keep. Classroom changes mirror onto this calendar.
- **Owner keys:** None.

### Gradebook

- **Route:** `/dashboard/teacher/gradebook`
- **Audience:** teacher
- **Purpose:** Enter marks for a class on the assessment scale, then publish them to the student and parent.
- **Overlaps:** Transcript and report cards.
- **Decision:** Keep. The gradebook is where marks are entered.
- **Owner keys:** None.

### Assignments

- **Route:** `/dashboard/teacher/assignments`
- **Audience:** teacher
- **Purpose:** Set work for a class or a student, mark the inbox, and return it to the gradebook.
- **Overlaps:** Student assignments.
- **Decision:** Keep. This is the sending side.
- **Owner keys:** None.

### Exam builder

- **Route:** `/dashboard/teacher/exams`
- **Audience:** teacher
- **Purpose:** Build an exam and send it to a class, a student, or the institution.
- **Overlaps:** Student exams and ET Exams.
- **Decision:** Keep as the formal paper builder.
- **Owner keys:** None.

### Report cards

- **Route:** `/dashboard/teacher/report-cards`
- **Audience:** teacher
- **Purpose:** Term report cards pulled from the gradebook, attendance, merits, and goals.
- **Overlaps:** Report studio and parent reports.
- **Decision:** Keep. Studio designs them; this page issues them.
- **Owner keys:** None.

### Report studio

- **Route:** `/dashboard/teacher/report-studio`
- **Audience:** teacher
- **Purpose:** Build and run reports: pick a template, a scope, and dates, then export or schedule them.
- **Overlaps:** Institution templates.
- **Decision:** Keep.
- **Owner keys:** None.

### Take attendance

- **Route:** `/dashboard/teacher/attendance`
- **Audience:** teacher
- **Purpose:** Mark a class register and send absent or late notices to parents.
- **Overlaps:** Student attendance.
- **Decision:** Keep as the register.
- **Owner keys:** None.

### Host a live class

- **Route:** `/dashboard/teacher/live`
- **Audience:** teacher
- **Purpose:** Start or schedule the class students join.
- **Overlaps:** Student live.
- **Decision:** Keep.
- **Owner keys:** Daily.co keys.

### Integrity reviews

- **Route:** `/dashboard/teacher/integrity`
- **Audience:** teacher, admin
- **Purpose:** Open an academic-integrity case and record a decision.
- **Overlaps:** Student integrity.
- **Decision:** Keep. Explained on the student page; decided here.
- **Owner keys:** None.

### Integrity cases

- **Route:** `/dashboard/teacher/integrity/cases`
- **Audience:** teacher, admin
- **Purpose:** The queue of open integrity cases.
- **Overlaps:** The integrity review page.
- **Decision:** Keep as the queue.
- **Owner keys:** None.

### Merits

- **Route:** `/dashboard/teacher/behaviour`
- **Audience:** teacher, admin, parent
- **Purpose:** Teacher comments and merits that admin, teachers, and parents can all read.
- **Overlaps:** /dashboard/behaviour.
- **Decision:** Keep. This page writes; the shared behaviour page reads.
- **Owner keys:** None.

### Teacher billing

- **Route:** `/dashboard/teacher/billing`
- **Audience:** teacher
- **Purpose:** The same payer model as student billing, for a teacher who also buys a plan.
- **Overlaps:** Admin finance.
- **Decision:** Point at the shared billing model. Invoices are issued in finance.
- **Owner keys:** Payment provider keys in Integrations.

### Upload

- **Route:** `/dashboard/teacher/upload`
- **Audience:** teacher
- **Purpose:** Bring files into a course or the resource library.
- **Overlaps:** Resources and the CMS.
- **Decision:** Keep as the upload action. Files then show in Resources.
- **Owner keys:** None.

### Mailbox

- **Route:** `/dashboard/parent/communications`
- **Audience:** parent
- **Purpose:** Messages between the school and this parent.
- **Overlaps:** Messages and announcements.
- **Decision:** Keep. Mailbox is school-to-parent. Messages is person-to-person. Announcements are broadcasts.
- **Owner keys:** SMTP for email copies.

### Due dates

- **Route:** `/dashboard/parent/duedates`
- **Audience:** parent
- **Purpose:** What is due for this parent’s children.
- **Overlaps:** Calendar.
- **Decision:** Keep as the family list. Dates also appear on the shared calendar.
- **Owner keys:** None.

### Parent notifications

- **Route:** `/dashboard/parent/notifications`
- **Audience:** parent
- **Purpose:** Alerts for this parent that are not a full message.
- **Overlaps:** The notification bell.
- **Decision:** Keep as the history behind the bell.
- **Owner keys:** Web push keys for browser alerts.

### Parent controls

- **Route:** `/dashboard/parent/controls`
- **Audience:** parent
- **Purpose:** What a child may do in community and live tools.
- **Overlaps:** None.
- **Decision:** Keep.
- **Owner keys:** None.

### Family billing

- **Route:** `/dashboard/parent/billing`
- **Audience:** parent
- **Purpose:** A parent paying for one or more learners. The invoice itself is in admin finance.
- **Overlaps:** Student billing and wallet.
- **Decision:** Same payer model. Cash top-ups stay on the wallet.
- **Owner keys:** Payment provider keys in Integrations.

### Family daily goals

- **Route:** `/dashboard/parent/goals`
- **Audience:** parent
- **Purpose:** Read the daily goals each child set. Parents see them; students edit them.
- **Overlaps:** Student daily goals.
- **Decision:** Keep as the read-only family view of the merged goals.
- **Owner keys:** None.

### Family planner

- **Route:** `/dashboard/parent/planner`
- **Audience:** parent
- **Purpose:** A parent reads the linked child’s classes, due dates, exams, attendance, and goals.
- **Overlaps:** Family daily goals.
- **Decision:** Keep as the read view. Parents do not create school events.
- **Owner keys:** None.

### Family insights

- **Route:** `/dashboard/parent/analytics`
- **Audience:** parent
- **Purpose:** Learning, attendance, and reports for each child.
- **Overlaps:** Reports.
- **Decision:** Keep and link the shared reports.
- **Owner keys:** None.

### Family integrity

- **Route:** `/dashboard/parent/integrity`
- **Audience:** parent
- **Purpose:** Integrity cases a parent is allowed to see, including appeals.
- **Overlaps:** Student integrity.
- **Decision:** Keep as the parent view.
- **Owner keys:** None.

### Family report cards

- **Route:** `/dashboard/parent/reports`
- **Audience:** parent
- **Purpose:** Issued report cards for this family.
- **Overlaps:** The shared reports hub.
- **Decision:** Keep. Report cards are the issued documents. Reports is the wider pack.
- **Owner keys:** None.

### Users and Sparks

- **Route:** `/dashboard/admin/users`
- **Audience:** admin
- **Purpose:** The people directory: search, roles, Sparks grants, status, and institution assignment.
- **Overlaps:** Access.
- **Decision:** This stays the directory. Access does not edit the same emails.
- **Owner keys:** None for the directory. Grants use the existing platform API.

### Institutions

- **Route:** `/dashboard/admin/institutions`
- **Audience:** admin
- **Purpose:** Schools and organisations on the platform. A super admin adds one through the server. Without the Firebase Admin key the form says the tool is coming soon.
- **Overlaps:** Access institution-admin assignment.
- **Decision:** Keep. Assigning an institution admin is reachable from Access and from an institution.
- **Owner keys:** None.

### Institution

- **Route:** `/dashboard/admin/institutions/[institutionId]`
- **Audience:** admin
- **Purpose:** One school: its people, plan, and admins.
- **Overlaps:** The institution list.
- **Decision:** Keep.
- **Owner keys:** None.

### Roles and capabilities

- **Route:** `/dashboard/admin/access`
- **Audience:** admin
- **Purpose:** What each role can do, with a live count of people in that role, plus assigning an institution admin.
- **Overlaps:** Users and Sparks, and allocations.
- **Decision:** Roles stay here. Tier, course, and coupon grants stay on Allocations, linked from this page.
- **Owner keys:** None.

### Allocations

- **Route:** `/dashboard/admin/allocations`
- **Audience:** admin
- **Purpose:** Seat allocations for a course or plan, plus a tier, course, or coupon for one person.
- **Overlaps:** Access and Users.
- **Decision:** Keep. This is the grants half of Access. Coupons are created only here.
- **Owner keys:** None.

### System settings

- **Route:** `/dashboard/admin/settings`
- **Audience:** admin
- **Purpose:** Sectioned platform settings: name, maintenance, SMTP presets, a test email, and data retention.
- **Overlaps:** Integrations.
- **Decision:** SMTP host settings live here. The SMTP password and every API key live in Integrations, super-admin only.
- **Owner keys:** SMTP_PASS. Provider presets do not store the password.

### Verifications

- **Route:** `/dashboard/admin/verifications`
- **Audience:** admin
- **Purpose:** Review parent and identity checks, search and filter them, and download a CSV.
- **Overlaps:** Users.
- **Decision:** Keep. This is the review queue, not the directory.
- **Owner keys:** None.

### All courses

- **Route:** `/dashboard/admin/courses`
- **Audience:** admin
- **Purpose:** Every course on the platform, including catalogue publishing.
- **Overlaps:** Teacher courses and the CMS.
- **Decision:** Keep as the platform catalogue.
- **Owner keys:** None.

### Exam pack desk

- **Route:** `/dashboard/admin/exam-packs`
- **Audience:** admin
- **Purpose:** First step of the admin create flow: pack name, subject, level, and exam board. Drafts autosave. Admins can edit or delete a pack.
- **Overlaps:** The student official exam flow.
- **Decision:** Keep. This desk is platform-admin only. The studio flow is read-only.
- **Owner keys:** Firestore collection exam_packs. Writes go through /api/admin/exam-packs.

### Pack units and topics

- **Route:** `/dashboard/admin/exam-packs/units`
- **Audience:** admin
- **Purpose:** Second step: units and topics for the draft pack.
- **Overlaps:** The pack details step.
- **Decision:** Keep.
- **Owner keys:** Firestore collection exam_packs.

### Pack questions

- **Route:** `/dashboard/admin/exam-packs/questions`
- **Audience:** admin
- **Purpose:** Third step: question text, marks, worked solution, mark scheme, paper name, image, and examiner tip.
- **Overlaps:** The units step.
- **Decision:** Keep. Paper names are optional. The mock uses only names stored here.
- **Owner keys:** Firestore collection exam_packs.

### Pack preview

- **Route:** `/dashboard/admin/exam-packs/preview`
- **Audience:** admin
- **Purpose:** Fourth step: read the draft before it is published.
- **Overlaps:** The student pack overview.
- **Decision:** Keep. Students do not see a draft.
- **Owner keys:** None.

### Publish exam pack

- **Route:** `/dashboard/admin/exam-packs/publish`
- **Audience:** admin
- **Purpose:** Last step: save the draft or publish it for students.
- **Overlaps:** The student official exam flow.
- **Decision:** Keep.
- **Owner keys:** Firestore collection exam_packs.

### Curriculum CMS

- **Route:** `/dashboard/admin/curriculum`
- **Audience:** admin
- **Purpose:** Build official curriculum: subjects, modules, and lessons.
- **Overlaps:** Resources.
- **Decision:** Keep. Resources is the file library the CMS can point at.
- **Owner keys:** OPENROUTER_API_KEY for lesson generation.

### Study planner

- **Route:** `/dashboard/admin/planner`
- **Audience:** admin
- **Purpose:** Age caps and reschedule limits for ET AI assigned goals, plus the month, week, and day calendar.
- **Overlaps:** Student daily goals.
- **Decision:** Keep the limits form and the calendar. The planner writes the same daily goals.
- **Owner keys:** None. Without an ET AI key the planner is rule-based.

### Platform

- **Route:** `/dashboard/admin/platform`
- **Audience:** admin
- **Purpose:** Platform settings for the super admin.
- **Overlaps:** Admin settings.
- **Decision:** Keep as the platform desk.
- **Owner keys:** FIREBASE_SERVICE_ACCOUNT.

### Pulse

- **Route:** `/dashboard/admin/pulse`
- **Audience:** admin
- **Purpose:** Live platform pulse for the super admin.
- **Overlaps:** Insights.
- **Decision:** Keep.
- **Owner keys:** None.

### Action Centre

- **Route:** `/dashboard/admin/tasks`
- **Audience:** admin
- **Purpose:** The queued admin to-do list. SafeLine names stay on the source document.
- **Overlaps:** Queues and the Safety Desk.
- **Decision:** Keep. Clients cannot create tasks.
- **Owner keys:** FIREBASE_SERVICE_ACCOUNT.

### Queues

- **Route:** `/dashboard/admin/queues`
- **Audience:** admin
- **Purpose:** Work queues the admin desk still has to clear.
- **Overlaps:** The admin desk.
- **Decision:** Keep.
- **Owner keys:** FIREBASE_SERVICE_ACCOUNT.

### Copyright signatures

- **Route:** `/dashboard/admin/signatures`
- **Audience:** admin
- **Purpose:** Search, view, and export the copyright declarations teachers sign.
- **Overlaps:** Course publishing.
- **Decision:** Keep. Records are immutable.
- **Owner keys:** None.

### Curriculum course

- **Route:** `/dashboard/admin/curriculum/[courseId]`
- **Audience:** admin
- **Purpose:** Edit one official course in the CMS.
- **Overlaps:** The CMS list.
- **Decision:** Keep.
- **Owner keys:** OPENROUTER_API_KEY.

### Course preview

- **Route:** `/dashboard/admin/curriculum/[courseId]/preview`
- **Audience:** admin
- **Purpose:** Review the whole course as a student sees it, leave comments, and publish from the checklist.
- **Overlaps:** The public preview link and the teacher preview.
- **Decision:** Keep. Reviewers use this page. Students never see the review link.
- **Owner keys:** None.

### AI Book Creator

- **Route:** `/dashboard/admin/books`
- **Audience:** admin
- **Purpose:** Create a PoketReads book with ET AI, a cover, pages, and pictures, then preview, publish, and export.
- **Overlaps:** Poket Reads studio.
- **Decision:** Keep. Books are written here and read in Poket Reads.
- **Owner keys:** None for the shelf. Picture generation uses the existing AI key.

### Audit log

- **Route:** `/dashboard/admin/audit`
- **Audience:** admin
- **Purpose:** Who changed staff-level settings and when.
- **Overlaps:** Activity log.
- **Decision:** Redirect to /dashboard/admin/activity. Staff changes and the server log are one list.
- **Owner keys:** None.

### Payments

- **Route:** `/dashboard/admin/payments`
- **Audience:** admin
- **Purpose:** Which checkout methods are on, and the link to the integrations hub where keys are stored.
- **Overlaps:** Integrations.
- **Decision:** Keys are not pasted here. Super admins manage secrets only in Integrations.
- **Owner keys:** Stripe, Billplz, iPay88, RMS, PayPal, Xendit — all via Integrations.

### Integrations

- **Route:** `/dashboard/admin/integrations`
- **Audience:** admin
- **Purpose:** The only place API keys are saved. Super admins see masked secrets and can test a provider.
- **Overlaps:** Payments and SMTP.
- **Decision:** Single key hub. Other roles never see a raw key.
- **Owner keys:** Every provider secret, plus SMTP_PASS.

### Finance

- **Route:** `/dashboard/admin/finance`
- **Audience:** admin
- **Purpose:** Invoices, payment history, and a search across payers. Teacher, student, and parent billing all post here.
- **Overlaps:** The three billing pages and the wallet.
- **Decision:** This is the invoice console. Billing pages explain who pays; they do not mint a second invoice.
- **Owner keys:** Gateway keys already in Integrations, so invoices can link to a charge.

### Moderation

- **Route:** `/dashboard/admin/moderation`
- **Audience:** admin, teacher
- **Purpose:** Review community and channel reports, with an ET AI suggestion the moderator still confirms.
- **Overlaps:** Community and reports.
- **Decision:** Keep. ET AI drafts a note; a person decides.
- **Owner keys:** OPENROUTER_API_KEY for the suggestion.

### Messages

- **Route:** `/dashboard/messages`
- **Audience:** everyone
- **Purpose:** Write to a person with a rich editor, an ET AI draft, and delivery by in-app, email, or push.
- **Overlaps:** Announcements.
- **Decision:** Keep for one-to-one and small threads. Broadcasts stay on announcements.
- **Owner keys:** OPENROUTER_API_KEY, SMTP_PASS, web push keys.

### Announcements

- **Route:** `/dashboard/announcements`
- **Audience:** teacher, admin, parent, student
- **Purpose:** Broadcast to a class or the school, with a rich editor, an ET AI draft, a schedule, and in-app, email, or push delivery.
- **Overlaps:** Messages and channels.
- **Decision:** Keep as the broadcast composer.
- **Owner keys:** OPENROUTER_API_KEY, SMTP_PASS, web push keys.

### Community

- **Route:** `/dashboard/community`
- **Audience:** everyone
- **Purpose:** Facebook-style school wall: composer, photo grids, reactions, and comments. Class channels stay on a tab. The same wall is used for class, groups, alumni, and profile timelines.
- **Overlaps:** /dashboard/channels.
- **Decision:** Channels fold in as a tab. /dashboard/channels redirects here.
- **Owner keys:** OPENROUTER_API_KEY for summaries.

### Channels (retired)

- **Route:** `/dashboard/channels`
- **Audience:** everyone
- **Purpose:** The old class-channel page. It now opens Community on the channels tab.
- **Overlaps:** Community.
- **Decision:** Redirect to /dashboard/community?tab=channels. Removed from the nav.
- **Owner keys:** None.

### Tutors

- **Route:** `/dashboard/tutors`
- **Audience:** everyone
- **Purpose:** Find a person to book, with subjects, levels, and a way to request a session.
- **Overlaps:** AI teachers.
- **Decision:** Keep. Tutors are people. AI teachers are ET subject tutors.
- **Owner keys:** None.

### Creator store

- **Route:** `/dashboard/store`
- **Audience:** everyone
- **Purpose:** Sell and browse teacher-made products that are not a full course.
- **Overlaps:** Marketplace.
- **Decision:** Keep. The public marketplace lists courses. This store lists creator add-ons.
- **Owner keys:** None.

### Marketplace

- **Route:** `/dashboard/marketplace`
- **Audience:** everyone
- **Purpose:** Dashboard entry to the public course marketplace.
- **Overlaps:** /courses.
- **Decision:** Keep as the signed-in door to the same catalogue.
- **Owner keys:** None.

### Exam centre

- **Route:** `/dashboard/exam-centre`
- **Audience:** everyone
- **Purpose:** Book or manage a sitting, separate from personal ET Exams practice.
- **Overlaps:** Student exams.
- **Decision:** Keep.
- **Owner keys:** None.

### Snap and solve (retired)

- **Route:** `/dashboard/snap`
- **Audience:** student
- **Purpose:** The old photo solver. It now opens ET Maths with the camera ready.
- **Overlaps:** ET Maths.
- **Decision:** Redirect to /dashboard/studio/maths?snap=1. Nav points at ET Maths.
- **Owner keys:** OPENROUTER_API_KEY.

### Calendar and terms

- **Route:** `/dashboard/calendar`
- **Audience:** everyone
- **Purpose:** One planner: terms with start and end dates, a week view you can edit, and a file import for term dates.
- **Overlaps:** /dashboard/planner.
- **Decision:** Planner and calendar are one page. “Units” in the year plan are terms. Google Calendar sync needs owner OAuth.
- **Owner keys:** Google Calendar OAuth client id and secret.

### Planner (retired)

- **Route:** `/dashboard/planner`
- **Audience:** everyone
- **Purpose:** The old year planner. It now opens the calendar.
- **Overlaps:** Calendar.
- **Decision:** Redirect to /dashboard/calendar. Removed from the nav.
- **Owner keys:** None.

### Resources

- **Route:** `/dashboard/resources`
- **Audience:** everyone
- **Purpose:** The file library: uploads and saved lesson files. The curriculum CMS links here instead of keeping a second library.
- **Overlaps:** CMS and teacher upload.
- **Decision:** Keep as the library. Do not delete it into the CMS editor.
- **Owner keys:** None.

### Helpdesk

- **Route:** `/dashboard/helpdesk`
- **Audience:** everyone
- **Purpose:** Tickets with a number, notes, priority, an assignee, and a status of open, pending, KIV, solved, or closed.
- **Overlaps:** None.
- **Decision:** Real ticketing on the existing support tickets. SLA is calculated from priority and the open time.
- **Owner keys:** SMTP_PASS to email the requester.

### Profile

- **Route:** `/dashboard/profile`
- **Audience:** everyone
- **Purpose:** Name, password, and account preferences.
- **Overlaps:** None.
- **Decision:** Keep.
- **Owner keys:** None.

### Wallet

- **Route:** `/dashboard/wallet`
- **Audience:** everyone
- **Purpose:** One wallet: cash (USD or MYR top-ups) and Sparks bought or granted, side by side.
- **Overlaps:** Sparks page and billing.
- **Decision:** Sparks are the learning token inside this wallet, not a second product.
- **Owner keys:** Payment provider keys in Integrations for cash top-ups.

### Notes

- **Route:** `/dashboard/notes`
- **Audience:** student
- **Purpose:** Private sticky notes for a student. They sync with the app, can link to a lesson, course, assignment, or exam, and stay in trash for 30 days.
- **Overlaps:** The old lesson notepad on a lesson tab is a single text field. These notes are the board.
- **Decision:** Keep. Sharing is off until the student chooses a study group, and under-18s stay inside their school.
- **Owner keys:** OPENROUTER_API_KEY when the student asks ET AI to use selected notes. CRON_SECRET for reminders.

### Perks

- **Route:** `/dashboard/student/perks`
- **Audience:** student
- **Purpose:** Partner discounts on the free student card, grouped by category. Age-restricted offers are hidden on the server.
- **Overlaps:** Member card and the partner portal.
- **Decision:** Keep. Students redeem here. Merchants never see this list of people.
- **Owner keys:** CARD_TOKEN_SECRET for the QR and checkout code. The card itself stays free.

### Partner portal

- **Route:** `/dashboard/partner`
- **Audience:** everyone
- **Purpose:** Approved merchants create offers and see redemption counts. No student personal data.
- **Overlaps:** Admin partner review.
- **Decision:** Keep. The partner_merchant role cannot publish Amber alerts.
- **Owner keys:** None. Admin approval writes the role.

### Partner perks

- **Route:** `/dashboard/admin/partners`
- **Audience:** admin
- **Purpose:** Add and update merchants, then approve, suspend, or archive them. A partner edits only their own record.
- **Overlaps:** Partner portal.
- **Decision:** Keep. Offers stay in review until an admin approves them.
- **Owner keys:** None.

### Member card

- **Route:** `/dashboard/card`
- **Audience:** everyone
- **Purpose:** A free digital card for every account: a server-issued number, a share link, a parent toggle for under-13s, and an adult choice about search indexing.
- **Overlaps:** Referrals, affiliates, and promos.
- **Decision:** Keep. This card is the public share and the member number. The referrals page stays the affiliate rewards desk. This card does not pay out.
- **Owner keys:** None. The server writes the number, the share id, and the referral code.

### Referrals, affiliates, and promos

- **Route:** `/dashboard/referrals`
- **Audience:** everyone
- **Purpose:** Share a short link, earn a commission an admin sets, and run a promo with a quantity limit and a countdown.
- **Overlaps:** Allocations coupons.
- **Decision:** Referrals are people and payouts. Coupons in allocations are staff grants. Promos are public offers with a banner.
- **Owner keys:** None to display. Payouts use the existing payment account.

### Checkout

- **Route:** `/dashboard/checkout`
- **Audience:** everyone
- **Purpose:** Pay for a plan, a book, or a top-up.
- **Overlaps:** Wallet and billing.
- **Decision:** Keep as the payment step.
- **Owner keys:** Provider keys in Integrations.

### Reports

- **Route:** `/dashboard/reports`
- **Audience:** student, parent, teacher, admin
- **Purpose:** Attendance, grades, goals, and behaviour in one pack for parents, teachers, and admins.
- **Overlaps:** Analytics and moderation.
- **Decision:** Keep and link attendance, analytics, and behaviour from here.
- **Owner keys:** None.

### Behaviour

- **Route:** `/dashboard/behaviour`
- **Audience:** student, parent, teacher, admin
- **Purpose:** Teacher comments and merits that admin, teachers, and parents can read.
- **Overlaps:** Teacher merits.
- **Decision:** Keep as the shared read view.
- **Owner keys:** None.

### Activity log

- **Route:** `/dashboard/admin/activity`
- **Audience:** admin
- **Purpose:** Server-written sign-in, role, content, and admin actions. Super admins read it. People cannot edit a row.
- **Overlaps:** The older audit page and institution audit on an academy.
- **Decision:** Keep. /dashboard/admin/audit opens this log. Academy settings keep their own audit.
- **Owner keys:** None. The server stamps actor, time, and IP.

### Badges

- **Route:** `/dashboard/admin/badges`
- **Audience:** admin
- **Purpose:** Super admins edit badge names, art, criteria, tier, audience, and the small Sparks reward.
- **Overlaps:** Certificates stay the signed course credential. These are learning badges.
- **Decision:** Keep as the badge catalogue. Awards are written by the server.
- **Owner keys:** OPEN_BADGE_PRIVATE_KEY is optional and only signs an export.

### Certificates

- **Route:** `/dashboard/admin/certificates`
- **Audience:** admin
- **Purpose:** Design certificate templates with a live preview and PDF export. A super admin sets the default. An institution admin saves their override.
- **Overlaps:** Module certificates and the school issuance desk.
- **Decision:** Keep as the platform badge template and bulk issue desk.
- **Owner keys:** Credential signing keys stay on the server.

### Class certificates

- **Route:** `/dashboard/institution/certificates`
- **Audience:** institution
- **Purpose:** Issue Poket School badges for students in this school who have finished a module.
- **Overlaps:** Admin certificates.
- **Decision:** Keep as the academy issuance desk. It does not change the platform template.
- **Owner keys:** None.

### Professional network

- **Route:** `/dashboard/network`
- **Audience:** everyone
- **Purpose:** Profiles, the feed, organisations, and messages. Under-18 members stay inside their school.
- **Overlaps:** Community spaces and groups.
- **Decision:** Keep as the verified professional network. Community remains the class wall.
- **Owner keys:** OPENROUTER_API_KEY or GEMINI_API_KEY for ET AI moderation. Patterns run when no key is set.

### Poket School Founders

- **Route:** `/dashboard/network/founders`
- **Audience:** everyone
- **Purpose:** Adult opt-in co-founder matching, startup pages, and school entrepreneurship teams.
- **Overlaps:** The job board and alumni mentoring, when those land.
- **Decision:** Off until a super admin enables it. Under-18s are not in public matching.
- **Owner keys:** None. Founders Pro sandbox billing stays off.

### Groups and associations

- **Route:** `/dashboard/network/groups`
- **Audience:** everyone
- **Purpose:** Interest groups, clubs, study groups, associations, alumni chapters, and professional groups.
- **Overlaps:** Institution group approval.
- **Decision:** Student groups need a teacher advisor and school approval by default.
- **Owner keys:** None. Dues are sandbox and off.

### Recruiter search

- **Route:** `/dashboard/network/recruit`
- **Audience:** everyone
- **Purpose:** Search opted-in adult candidates by verified skills, level, certificates, and availability.
- **Overlaps:** The job board and CV versions.
- **Decision:** Recruiter tiers stay off until a super admin enables sandbox billing.
- **Owner keys:** None until billing is enabled. Charges are sandbox only.

### Safeguarding

- **Route:** `/dashboard/admin/safeguarding`
- **Audience:** admin
- **Purpose:** Case files, alerts, and the moderation audit for schools and the super admin.
- **Overlaps:** Moderation queue.
- **Decision:** Parents see a redacted note. Schools see the case. Critical alerts cannot be muted.
- **Owner keys:** OPENROUTER_API_KEY or GEMINI_API_KEY. SMTP_PASS for high-severity email when it is set.

### School groups

- **Route:** `/dashboard/institution/groups`
- **Audience:** institution, admin
- **Purpose:** Approve, archive, or transfer a student group when officers leave.
- **Overlaps:** Groups and associations.
- **Decision:** Institution admins act on their own school. A super admin can see every school.
- **Owner keys:** None.

### Poket SafeLine

- **Route:** `/dashboard/parent/hotline`
- **Audience:** parent
- **Purpose:** Parents open a ticket to a teacher, academic lead, principal, or safeguarding lead.
- **Overlaps:** Helpdesk and messages.
- **Decision:** Safeguarding and bullying tickets stay with the principal or safeguarding lead.
- **Owner keys:** None.

### Poket SafeLine

- **Route:** `/dashboard/teacher/hotline`
- **Audience:** teacher
- **Purpose:** Teachers work parent tickets, with filters for status and overdue items.
- **Overlaps:** The admin SafeLine queue.
- **Decision:** Sensitive categories are hidden from teachers who are not the safeguarding lead.
- **Owner keys:** None.

### Poket SafeLine

- **Route:** `/dashboard/admin/hotline`
- **Audience:** admin
- **Purpose:** Volume, SLA, resolution time, satisfaction, and overdue tickets. Groups under five are hidden.
- **Overlaps:** The teacher queue.
- **Decision:** Keep for platform and school admins.
- **Owner keys:** None.

### Emergency alerts

- **Route:** `/dashboard/admin/emergency`
- **Audience:** admin
- **Purpose:** Create, confirm, update, resolve, and close an alert. A second staff member confirms before it is public.
- **Overlaps:** Safeguarding cases.
- **Decision:** Publishing is server-only and two-person. Emergency push cannot be muted.
- **Owner keys:** None.

### Poket SafeLine

- **Route:** `/dashboard/institution/hotline`
- **Audience:** institution
- **Purpose:** The institution queue for parent tickets, including escalation to the principal.
- **Overlaps:** The teacher SafeLine queue.
- **Decision:** Institution leads see their own school. Sensitive tickets stay restricted.
- **Owner keys:** None.

### School emergency alerts

- **Route:** `/dashboard/institution/emergency`
- **Audience:** institution
- **Purpose:** A verified principal drafts an alert. Another verified staff member confirms it.
- **Overlaps:** The admin emergency desk.
- **Decision:** The region comes from the school, never a home address.
- **Owner keys:** None.

### Welcome course

- **Route:** `/dashboard/welcome`
- **Audience:** everyone
- **Purpose:** The first-run welcome session. It plays once, then the learner continues into the dashboard.
- **Overlaps:** Student home.
- **Decision:** Keep as the onboarding player. It is not a second home.
- **Owner keys:** None.

### Alumni home

- **Route:** `/dashboard/alumni`
- **Audience:** everyone
- **Purpose:** An alumni landing page for certificates already issued and the profile a school is allowed to see.
- **Overlaps:** Student certificates and the institution alumni desk.
- **Decision:** Keep. Certificates stay on the student certificates page.
- **Owner keys:** None.

### Recruiter desk

- **Route:** `/dashboard/recruiter`
- **Audience:** everyone
- **Purpose:** A recruiter searches shared talent lists. A list appears only after a school shares it.
- **Overlaps:** Institution career desk.
- **Decision:** Keep. Recruiters never see a list the school has not shared.
- **Owner keys:** None.

### Safety alert

- **Route:** `/dashboard/safety/[id]`
- **Audience:** everyone
- **Purpose:** One safeguarding notice: who needs help, and the family contact decision.
- **Overlaps:** Safety Desk and the student safety report.
- **Decision:** Keep. The notice is one record, not a second queue.
- **Owner keys:** None.

### Staff roll call

- **Route:** `/dashboard/staff/roll-call`
- **Audience:** teacher, admin, institution
- **Purpose:** Staff mark who is accounted for during an all-staff alert.
- **Overlaps:** Emergency alerts.
- **Decision:** Keep for the all-staff check-in. It does not publish an alert.
- **Owner keys:** None.

### My academy

- **Route:** `/dashboard/student/academy`
- **Audience:** student
- **Purpose:** The student’s academy home: classes, people, and the school they belong to.
- **Overlaps:** Class network and yearbook.
- **Decision:** Keep as the academy front door.
- **Owner keys:** None.

### Class network

- **Route:** `/dashboard/student/network`
- **Audience:** student
- **Purpose:** The class network for the student’s school, including alumni posts they are allowed to see.
- **Overlaps:** Community and the professional network.
- **Decision:** Keep. Visibility still follows the network and safety gates.
- **Owner keys:** None.

### Yearbook

- **Route:** `/dashboard/student/yearbook`
- **Audience:** student
- **Purpose:** A student’s yearbook page: quote, clubs, photo, and who is allowed to see it. Under-18 pages need a parent.
- **Overlaps:** Class network.
- **Decision:** Keep. Sharing stays with the student and, for minors, the parent.
- **Owner keys:** None.

### Career

- **Route:** `/dashboard/student/career`
- **Audience:** student
- **Purpose:** The student’s skills passport and the teacher references written for them.
- **Overlaps:** Portfolio and teacher references.
- **Decision:** Keep. The student reads references; teachers write them.
- **Owner keys:** None.

### CV and portfolio

- **Route:** `/dashboard/student/portfolio`
- **Audience:** student
- **Purpose:** The student’s CV and portfolio, including what a school or recruiter may see.
- **Overlaps:** Career and certificates.
- **Decision:** Keep. The public portfolio is a separate share link.
- **Owner keys:** None.

### My progress

- **Route:** `/dashboard/student/progress`
- **Audience:** student
- **Purpose:** The student’s own progress alerts: what is slipping and what to do next.
- **Overlaps:** Analytics and parent progress.
- **Decision:** Keep. Parents and teachers have their own read views.
- **Owner keys:** None.

### Report a concern

- **Route:** `/dashboard/student/safety`
- **Audience:** student
- **Purpose:** A student reports a safety or bullying concern, including an anonymous report to the Safety Desk.
- **Overlaps:** Safety Desk and Poket SafeLine.
- **Decision:** Keep. Anonymous reports do not put the student’s name on the push.
- **Owner keys:** None.

### Child progress

- **Route:** `/dashboard/parent/progress`
- **Audience:** parent
- **Purpose:** A parent’s view of a linked child’s progress alerts.
- **Overlaps:** Parent home and student progress.
- **Decision:** Keep as a read view. Parents do not edit the student’s plan.
- **Owner keys:** None.

### Class risk

- **Route:** `/dashboard/teacher/progress`
- **Audience:** teacher
- **Purpose:** Teachers see which learners in their classes are at risk and what the alert says.
- **Overlaps:** Institution at-risk learners.
- **Decision:** Keep scoped to the teacher’s classes.
- **Owner keys:** None.

### Teacher references

- **Route:** `/dashboard/teacher/references`
- **Audience:** teacher
- **Purpose:** A teacher writes a reference that can appear on a student’s career page.
- **Overlaps:** Student career.
- **Decision:** Keep. The student does not edit the reference.
- **Owner keys:** None.

### ET Essays

- **Route:** `/dashboard/studio/essays`
- **Audience:** everyone
- **Purpose:** ET AI Essay Writer inside the studio. The learner drafts; a teacher can review.
- **Overlaps:** Teacher essay review.
- **Decision:** Keep under the studio hub.
- **Owner keys:** OPENROUTER_API_KEY

### Essay review

- **Route:** `/dashboard/studio/essays/review`
- **Audience:** teacher
- **Purpose:** A teacher reviews an essay draft from ET Essays.
- **Overlaps:** ET Essays.
- **Decision:** Keep. Review is separate from the learner’s draft.
- **Owner keys:** OPENROUTER_API_KEY

### AI Teachers

- **Route:** `/dashboard/studio/teachers`
- **Audience:** everyone
- **Purpose:** The studio list of ET subject teachers a learner can open.
- **Overlaps:** The public AI Teachers pages.
- **Decision:** Keep. Studio conversations stay inside the dashboard.
- **Owner keys:** OPENROUTER_API_KEY

### AI Teacher conversation

- **Route:** `/dashboard/studio/teachers/[teacherId]`
- **Audience:** everyone
- **Purpose:** One ET subject teacher conversation inside the studio.
- **Overlaps:** AI Teachers list.
- **Decision:** Keep. Unknown teacher ids return to the list.
- **Owner keys:** OPENROUTER_API_KEY

### Automation rules

- **Route:** `/dashboard/admin/automation`
- **Audience:** admin
- **Purpose:** Super admins edit the automation rules. Institution admins only read them.
- **Overlaps:** Institution automation.
- **Decision:** Keep. Only a super admin can save a rule.
- **Owner keys:** None.

### Blog

- **Route:** `/dashboard/admin/blog`
- **Audience:** admin
- **Purpose:** Super admins draft and publish the public Poket School blog.
- **Overlaps:** The public blog.
- **Decision:** Keep. Publishing stays with super admins.
- **Owner keys:** None.

### New essay

- **Route:** `/dashboard/admin/blog/new`
- **Audience:** admin
- **Purpose:** A super admin starts a journal essay with a live preview and SEO fields.
- **Overlaps:** Blog list.
- **Decision:** Keep. Publishing stays with super admins.
- **Owner keys:** None.

### Edit essay

- **Route:** `/dashboard/admin/blog/[id]/edit`
- **Audience:** admin
- **Purpose:** A super admin edits one journal essay. Bold text, images, and SEO survive a reload.
- **Overlaps:** Blog list.
- **Decision:** Keep. Publishing stays with super admins.
- **Owner keys:** None.

### Pathways

- **Route:** `/dashboard/admin/pathways`
- **Audience:** admin
- **Purpose:** Admins edit the public pathway pages: stages, subjects, ET teachers, and the questions.
- **Overlaps:** The public Primary, IGCSE, A-Level, LLB, MBBS, and Independent pages.
- **Decision:** Keep. A saved page replaces the catalogue copy for that pathway.
- **Owner keys:** None.

### Landing pages

- **Route:** `/dashboard/admin/funnels`
- **Audience:** admin
- **Purpose:** Admins draft a landing page from sections, preview it, and publish it at a public /p/[slug] address. Duplicate starts as a draft. Lead form submissions are listed here.
- **Overlaps:** Public alumni records also use /p/[code]. A published landing page uses the slug. An unpublished slug does not show the draft.
- **Decision:** Keep. Only a platform admin can write a page. Visitors can submit a lead on a published page.
- **Owner keys:** None. Firestore writes use the admin SDK when FIREBASE_SERVICE_ACCOUNT or the Firestore emulator is set.

### Store import

- **Route:** `/dashboard/admin/store/import`
- **Audience:** admin
- **Purpose:** Admins and content editors dry-run a ZIP of creator-store products and save valid rows as drafts.
- **Overlaps:** The single product file form at /dashboard/store.
- **Decision:** Keep. Bulk rows stay drafts until an admin publishes them. Downloads need FIREBASE_SERVICE_ACCOUNT.
- **Owner keys:** FIREBASE_SERVICE_ACCOUNT

### Admin help

- **Route:** `/dashboard/admin/help`
- **Audience:** admin
- **Purpose:** Where each admin tool lives, what each role can do, which keys still say coming soon, and the help articles ET AI answers from.
- **Overlaps:** Help centre.
- **Decision:** Keep as the only editor for help articles.
- **Owner keys:** OPENROUTER_API_KEY

### Platform insights

- **Route:** `/dashboard/admin/insights`
- **Audience:** admin
- **Purpose:** Census, programme revenue, and platform progress alerts for staff.
- **Overlaps:** Institution insights.
- **Decision:** Keep. Platform scope is separate from one school.
- **Owner keys:** None.

### School leads

- **Route:** `/dashboard/admin/schools`
- **Audience:** admin
- **Purpose:** School leads waiting to become institutions, plus the homepage school-strip threshold.
- **Overlaps:** Institution onboarding.
- **Decision:** Keep for super admins. Approving a school starts institution onboarding.
- **Owner keys:** None.

### Placement

- **Route:** `/dashboard/admin/placement`
- **Audience:** admin
- **Purpose:** Staff place courses and learners on Primary, Lower Secondary, IGCSE, A-Level, or a professional programme.
- **Overlaps:** Institution join settings.
- **Decision:** Keep. Levels use the named programmes, not year numbers.
- **Owner keys:** None.

### Institution pricing

- **Route:** `/dashboard/admin/institution-pricing`
- **Audience:** admin
- **Purpose:** Platform prices for institution plans. Schools read the result on their own pricing page.
- **Overlaps:** Institution pricing.
- **Decision:** Keep. A school does not set the platform price.
- **Owner keys:** None.

### Local emergency numbers

- **Route:** `/dashboard/admin/emergency-numbers`
- **Audience:** admin
- **Purpose:** The local emergency numbers shown with an alert, by country.
- **Overlaps:** Emergency alerts.
- **Decision:** Keep. Numbers are reference data, not an alert.
- **Owner keys:** None.

### Safety Desk

- **Route:** `/dashboard/admin/safety-desk`
- **Audience:** admin
- **Purpose:** The Safety Desk queue for reports addressed to the desk, including anonymous ones.
- **Overlaps:** Student safety reports and Poket SafeLine.
- **Decision:** Keep. Desk leads see the queue. Anonymous names stay off the push.
- **Owner keys:** None.

### Activity log

- **Route:** `/dashboard/institution/activity`
- **Audience:** institution
- **Purpose:** What changed in this institution: joins, approvals, and settings.
- **Overlaps:** Admin audit log.
- **Decision:** Keep scoped to one institution.
- **Owner keys:** None.

### Alumni verification

- **Route:** `/dashboard/institution/alumni`
- **Audience:** institution
- **Purpose:** The school verifies alumni and decides what they can see.
- **Overlaps:** Alumni destinations and the alumni home.
- **Decision:** Keep. Verification is the school’s decision.
- **Owner keys:** None.

### Approvals

- **Route:** `/dashboard/institution/approvals`
- **Audience:** institution
- **Purpose:** Pending students, parents, and teachers. A student is assigned a level when approved.
- **Overlaps:** Join settings.
- **Decision:** Keep. Approval is the gate into the school.
- **Owner keys:** None.

### School automation

- **Route:** `/dashboard/institution/automation`
- **Audience:** institution
- **Purpose:** A read-only view of the automation rules a super admin can change.
- **Overlaps:** Admin automation.
- **Decision:** Keep read-only. Institution admins do not edit the rules here.
- **Owner keys:** None.

### Institution billing

- **Route:** `/dashboard/institution/billing`
- **Audience:** institution
- **Purpose:** The school’s subscription, renewal, and the lower tier that applies at renewal.
- **Overlaps:** Usage and admin finance.
- **Decision:** Keep. Test mode can apply a change without a card.
- **Owner keys:** Stripe and the other payment keys in Integrations.

### Career desk

- **Route:** `/dashboard/institution/career`
- **Audience:** institution
- **Purpose:** Skill map, opportunities, and alumni giving for this school.
- **Overlaps:** Student career and the recruiter desk.
- **Decision:** Keep. Sharing a list with a recruiter is a separate step.
- **Owner keys:** None.

### Alumni destinations

- **Route:** `/dashboard/institution/destinations`
- **Audience:** institution
- **Purpose:** Where alumni went, and the verification requests still open.
- **Overlaps:** Alumni verification.
- **Decision:** Keep with the alumni desk.
- **Owner keys:** None.

### School insights

- **Route:** `/dashboard/institution/insights`
- **Audience:** institution
- **Purpose:** Alumni count, seats freed, and certificates for this institution.
- **Overlaps:** Platform insights.
- **Decision:** Keep scoped to one school.
- **Owner keys:** None.

### Join settings

- **Route:** `/dashboard/institution/join`
- **Audience:** institution
- **Purpose:** Who can join this school, and the claim links sent to families.
- **Overlaps:** Approvals and public join pages.
- **Decision:** Keep. Join rules save for this institution only.
- **Owner keys:** None.

### Institution onboarding

- **Route:** `/dashboard/institution/onboarding`
- **Audience:** institution
- **Purpose:** The school’s setup, including the branded login page.
- **Overlaps:** School leads.
- **Decision:** Keep. A new school lands here after approval.
- **Owner keys:** None.

### School pricing

- **Route:** `/dashboard/institution/pricing`
- **Audience:** institution
- **Purpose:** How this school’s programme price is shared, and who receives a programme.
- **Overlaps:** Admin institution pricing.
- **Decision:** Keep as the school’s view. Platform prices are set by admins.
- **Owner keys:** None.

### At-risk learners

- **Route:** `/dashboard/institution/progress`
- **Audience:** institution
- **Purpose:** Learners in this school whose progress alerts are open.
- **Overlaps:** Teacher class risk and parent progress.
- **Decision:** Keep. The school sees its own learners.
- **Owner keys:** None.

### Goal adherence

- **Route:** `/dashboard/institution/goals`
- **Audience:** institution
- **Purpose:** Goal completion for the school. Class teachers and institution staff can read every goal.
- **Overlaps:** Teacher class goals and student daily goals.
- **Decision:** Keep as the school count. A private flag does not hide a goal.
- **Owner keys:** None.

### Course library

- **Route:** `/dashboard/institution/publishing`
- **Audience:** institution
- **Purpose:** Teacher courses that pass the content check enter this library. This page is the override.
- **Overlaps:** CMS and resources.
- **Decision:** Keep. A passing course publishes itself; this page overrides that.
- **Owner keys:** None.

### Sparks pool

- **Route:** `/dashboard/institution/sparks`
- **Audience:** institution
- **Purpose:** The finite monthly Sparks allowance per student seat. Sparks cannot buy marketplace courses.
- **Overlaps:** Wallet and usage.
- **Decision:** Keep. There is no unlimited plan.
- **Owner keys:** None.

### Usage and cost

- **Route:** `/dashboard/institution/usage`
- **Audience:** institution
- **Purpose:** Seats, Sparks, and cost for this institution.
- **Overlaps:** Institution billing.
- **Decision:** Keep as the usage view. Invoices stay on billing.
- **Owner keys:** None.

### Verify a student

- **Route:** `/dashboard/institution/verify`
- **Audience:** institution
- **Purpose:** Scan or enter a student number to see name, level, and photo, then approve membership. Parent links for learners under 13 live here too.
- **Overlaps:** Approvals and the public student-ID check.
- **Decision:** Keep. The public verify page does not show the student number.
- **Owner keys:** CARD_TOKEN_SECRET for live student-ID tokens. Without it, verification says it is coming soon.

### ET AI Timetabler

- **Route:** `/dashboard/admin/timetable`
- **Audience:** admin
- **Purpose:** School timetable for a platform admin: setup, option blocks, generation, clashes, cover, and publishing.
- **Overlaps:** The institution timetable and the calendar.
- **Decision:** Keep. It feeds the calendar, year planner, classes, and attendance. It does not replace them.
- **Owner keys:** OPENROUTER_API_KEY only for an optional model explanation. The solver runs without it.

### ET AI Timetabler

- **Route:** `/dashboard/institution/timetable`
- **Audience:** institution
- **Purpose:** Full school timetable for an Institution or Enterprise add-on. Enterprise can use more than one campus.
- **Overlaps:** Calendar, year planner, school desk classes, and attendance.
- **Decision:** Keep as an add-on. Price is TBC by Harry.
- **Owner keys:** OPENROUTER_API_KEY only for an optional model explanation.

### ET AI Timetabler

- **Route:** `/dashboard/teacher/timetable`
- **Audience:** teacher
- **Purpose:** A teacher published week, plus a personal timetable for private classrooms when the teacher add-on is on.
- **Overlaps:** Classes, attendance, assignments, and exams.
- **Decision:** Keep. Personal editing needs the add-on. The school week is read only.
- **Owner keys:** None for the grid. OPENROUTER_API_KEY only for an optional explanation.

### ET AI Timetabler

- **Route:** `/dashboard/student/timetable`
- **Audience:** student
- **Purpose:** The student’s published lessons and option-block choices.
- **Overlaps:** Calendar and attendance.
- **Decision:** Keep as a read view. Students do not edit the school week.
- **Owner keys:** None.

### ET AI Timetabler

- **Route:** `/dashboard/parent/timetable`
- **Audience:** parent
- **Purpose:** A parent view of their child published lessons and option choices.
- **Overlaps:** Calendar.
- **Decision:** Keep as a read view.
- **Owner keys:** None.

### Dashboard session

- **Route:** `/dashboard/session`
- **Audience:** everyone
- **Purpose:** Exchanges a verified Firebase ID token for the signed dashboard cookie, then continues to the requested page.
- **Overlaps:** None. It is not a product page.
- **Decision:** Keep. Middleware sends role-restricted URLs here when the cookie is missing. It does not render admin tools.
- **Owner keys:** DASHBOARD_SESSION_SECRET, or OTP_SECRET when that is already set.
