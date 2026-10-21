# Shell verification

Checked on the local Firebase emulators with fixture accounts only. A row passes when the admin menu is hidden, the horizontal studio tab bar is absent, the “What this page is for” banner is absent, the studio sidebar is present, and the page does not scroll sideways.

AI Teachers sits in the top group (Dashboard, New chat, Chats, Library, AI Teachers, Recents). ET + Subject is the same grid, so it is not a second link. `/ai-teachers` remains the public address.

Teacher Toolkit and Timetabler stay off the student and parent lists. Book Studio (`/reads/studio`) has no role gate. AI Book Creator (`/dashboard/admin/books`) stays on the staff gate. A student who opens that address is sent away from it.

| Role | Route | Theme | Viewport | Result | Screenshot |
| --- | --- | --- | --- | --- | --- |
| admin | AI Studio `/dashboard/studio` | light | desktop | PASS | docs/qa/studio-shell/admin-ai-studio-light-desktop.png |
| admin | ET AI `/dashboard/studio/et` | light | desktop | PASS | docs/qa/studio-shell/admin-et-ai-light-desktop.png |
| admin | AI Teachers `/dashboard/studio/teachers` | light | desktop | PASS | docs/qa/studio-shell/admin-ai-teachers-light-desktop.png |
| admin | ET Maths `/dashboard/studio/maths` | light | desktop | PASS | docs/qa/studio-shell/admin-et-maths-light-desktop.png |
| admin | ET Exams `/dashboard/studio/exam-prep` | light | desktop | PASS | docs/qa/studio-shell/admin-et-exams-light-desktop.png |
| admin | ET Essays `/dashboard/studio/essays` | light | desktop | PASS | docs/qa/studio-shell/admin-et-essays-light-desktop.png |
| admin | Creator Store `/dashboard/store` | light | desktop | PASS | docs/qa/studio-shell/admin-creator-store-light-desktop.png |
| admin | AI Book Creator `/dashboard/admin/books` | light | desktop | PASS | docs/qa/studio-shell/admin-ai-book-creator-light-desktop.png |
| admin | Timetabler `/dashboard/studio/timetable` | light | desktop | PASS | docs/qa/studio-shell/admin-timetabler-light-desktop.png |
| admin | Teacher session `/dashboard/studio/teachers/et-maths` | light | desktop | PASS | docs/qa/studio-shell/admin-teacher-session-light-desktop.png |
| admin | Exam join `/dashboard/studio/exam-prep/join/sample` | light | desktop | PASS | docs/qa/studio-shell/admin-exam-join-light-desktop.png |
| admin | Essay review `/dashboard/studio/essays/review` | light | desktop | PASS | docs/qa/studio-shell/admin-essay-review-light-desktop.png |
| admin | AI Studio `/dashboard/studio` | light | mobile | PASS | docs/qa/studio-shell/admin-ai-studio-light-mobile.png |
| admin | ET AI `/dashboard/studio/et` | light | mobile | PASS | docs/qa/studio-shell/admin-et-ai-light-mobile.png |
| admin | AI Teachers `/dashboard/studio/teachers` | light | mobile | PASS | docs/qa/studio-shell/admin-ai-teachers-light-mobile.png |
| admin | ET Maths `/dashboard/studio/maths` | light | mobile | PASS | docs/qa/studio-shell/admin-et-maths-light-mobile.png |
| admin | ET Exams `/dashboard/studio/exam-prep` | light | mobile | PASS | docs/qa/studio-shell/admin-et-exams-light-mobile.png |
| admin | ET Essays `/dashboard/studio/essays` | light | mobile | PASS | docs/qa/studio-shell/admin-et-essays-light-mobile.png |
| admin | Creator Store `/dashboard/store` | light | mobile | PASS | docs/qa/studio-shell/admin-creator-store-light-mobile.png |
| admin | AI Book Creator `/dashboard/admin/books` | light | mobile | PASS | docs/qa/studio-shell/admin-ai-book-creator-light-mobile.png |
| admin | Timetabler `/dashboard/studio/timetable` | light | mobile | PASS | docs/qa/studio-shell/admin-timetabler-light-mobile.png |
| admin | Teacher session `/dashboard/studio/teachers/et-maths` | light | mobile | PASS | docs/qa/studio-shell/admin-teacher-session-light-mobile.png |
| admin | Exam join `/dashboard/studio/exam-prep/join/sample` | light | mobile | PASS | docs/qa/studio-shell/admin-exam-join-light-mobile.png |
| admin | Essay review `/dashboard/studio/essays/review` | light | mobile | PASS | docs/qa/studio-shell/admin-essay-review-light-mobile.png |
| admin | AI Studio `/dashboard/studio` | dark | desktop | PASS | docs/qa/studio-shell/admin-ai-studio-dark-desktop.png |
| admin | ET AI `/dashboard/studio/et` | dark | desktop | PASS | docs/qa/studio-shell/admin-et-ai-dark-desktop.png |
| admin | AI Teachers `/dashboard/studio/teachers` | dark | desktop | PASS | docs/qa/studio-shell/admin-ai-teachers-dark-desktop.png |
| admin | ET Maths `/dashboard/studio/maths` | dark | desktop | PASS | docs/qa/studio-shell/admin-et-maths-dark-desktop.png |
| admin | ET Exams `/dashboard/studio/exam-prep` | dark | desktop | PASS | docs/qa/studio-shell/admin-et-exams-dark-desktop.png |
| admin | ET Essays `/dashboard/studio/essays` | dark | desktop | PASS | docs/qa/studio-shell/admin-et-essays-dark-desktop.png |
| admin | Creator Store `/dashboard/store` | dark | desktop | PASS | docs/qa/studio-shell/admin-creator-store-dark-desktop.png |
| admin | AI Book Creator `/dashboard/admin/books` | dark | desktop | PASS | docs/qa/studio-shell/admin-ai-book-creator-dark-desktop.png |
| admin | Timetabler `/dashboard/studio/timetable` | dark | desktop | PASS | docs/qa/studio-shell/admin-timetabler-dark-desktop.png |
| admin | Teacher session `/dashboard/studio/teachers/et-maths` | dark | desktop | PASS | docs/qa/studio-shell/admin-teacher-session-dark-desktop.png |
| admin | Exam join `/dashboard/studio/exam-prep/join/sample` | dark | desktop | PASS | docs/qa/studio-shell/admin-exam-join-dark-desktop.png |
| admin | Essay review `/dashboard/studio/essays/review` | dark | desktop | PASS | docs/qa/studio-shell/admin-essay-review-dark-desktop.png |
| admin | AI Studio `/dashboard/studio` | dark | mobile | PASS | docs/qa/studio-shell/admin-ai-studio-dark-mobile.png |
| admin | ET AI `/dashboard/studio/et` | dark | mobile | PASS | docs/qa/studio-shell/admin-et-ai-dark-mobile.png |
| admin | AI Teachers `/dashboard/studio/teachers` | dark | mobile | PASS | docs/qa/studio-shell/admin-ai-teachers-dark-mobile.png |
| admin | ET Maths `/dashboard/studio/maths` | dark | mobile | PASS | docs/qa/studio-shell/admin-et-maths-dark-mobile.png |
| admin | ET Exams `/dashboard/studio/exam-prep` | dark | mobile | PASS | docs/qa/studio-shell/admin-et-exams-dark-mobile.png |
| admin | ET Essays `/dashboard/studio/essays` | dark | mobile | PASS | docs/qa/studio-shell/admin-et-essays-dark-mobile.png |
| admin | Creator Store `/dashboard/store` | dark | mobile | PASS | docs/qa/studio-shell/admin-creator-store-dark-mobile.png |
| admin | AI Book Creator `/dashboard/admin/books` | dark | mobile | PASS | docs/qa/studio-shell/admin-ai-book-creator-dark-mobile.png |
| admin | Timetabler `/dashboard/studio/timetable` | dark | mobile | PASS | docs/qa/studio-shell/admin-timetabler-dark-mobile.png |
| admin | Teacher session `/dashboard/studio/teachers/et-maths` | dark | mobile | PASS | docs/qa/studio-shell/admin-teacher-session-dark-mobile.png |
| admin | Exam join `/dashboard/studio/exam-prep/join/sample` | dark | mobile | PASS | docs/qa/studio-shell/admin-exam-join-dark-mobile.png |
| admin | Essay review `/dashboard/studio/essays/review` | dark | mobile | PASS | docs/qa/studio-shell/admin-essay-review-dark-mobile.png |
| student | AI Studio `/dashboard/studio` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-ai-studio-light-desktop.png |
| student | ET AI `/dashboard/studio/et` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-et-ai-light-desktop.png |
| student | AI Teachers `/dashboard/studio/teachers` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-ai-teachers-light-desktop.png |
| student | ET Maths `/dashboard/studio/maths` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-et-maths-light-desktop.png |
| student | ET Exams `/dashboard/studio/exam-prep` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-et-exams-light-desktop.png |
| student | ET Essays `/dashboard/studio/essays` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-et-essays-light-desktop.png |
| student | Creator Store `/dashboard/store` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-creator-store-light-desktop.png |
| student | AI Book Creator `/dashboard/admin/books` | light | desktop | PASS — Student is sent to /dashboard/student. AI Book Creator stays off the student list. Book Studio is /reads/studio. | docs/qa/studio-shell/student-ai-book-creator-light-desktop.png |
| student | Timetabler `/dashboard/studio/timetable` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-timetabler-light-desktop.png |
| student | Teacher session `/dashboard/studio/teachers/et-maths` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-teacher-session-light-desktop.png |
| student | Exam join `/dashboard/studio/exam-prep/join/sample` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-exam-join-light-desktop.png |
| student | Essay review `/dashboard/studio/essays/review` | light | desktop | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-essay-review-light-desktop.png |
| student | AI Studio `/dashboard/studio` | light | mobile | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-ai-studio-light-mobile.png |
| student | ET AI `/dashboard/studio/et` | light | mobile | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-et-ai-light-mobile.png |
| student | AI Teachers `/dashboard/studio/teachers` | light | mobile | PASS — Measured on the first capture pass. | docs/qa/studio-shell/student-ai-teachers-light-mobile.png |
| student | ET Maths `/dashboard/studio/maths` | light | mobile | PASS | docs/qa/studio-shell/student-et-maths-light-mobile.png |
| student | ET Exams `/dashboard/studio/exam-prep` | light | mobile | PASS | docs/qa/studio-shell/student-et-exams-light-mobile.png |
| student | ET Essays `/dashboard/studio/essays` | light | mobile | PASS | docs/qa/studio-shell/student-et-essays-light-mobile.png |
| student | Creator Store `/dashboard/store` | light | mobile | PASS | docs/qa/studio-shell/student-creator-store-light-mobile.png |
| student | AI Book Creator `/dashboard/admin/books` | light | mobile | PASS — Student is sent to /dashboard/student. AI Book Creator stays off the student list. Book Studio is /reads/studio. | docs/qa/studio-shell/student-ai-book-creator-light-mobile.png |
| student | Timetabler `/dashboard/studio/timetable` | light | mobile | PASS | docs/qa/studio-shell/student-timetabler-light-mobile.png |
| student | Teacher session `/dashboard/studio/teachers/et-maths` | light | mobile | PASS | docs/qa/studio-shell/student-teacher-session-light-mobile.png |
| student | Exam join `/dashboard/studio/exam-prep/join/sample` | light | mobile | PASS | docs/qa/studio-shell/student-exam-join-light-mobile.png |
| student | Essay review `/dashboard/studio/essays/review` | light | mobile | PASS | docs/qa/studio-shell/student-essay-review-light-mobile.png |
| student | AI Studio `/dashboard/studio` | dark | desktop | PASS | docs/qa/studio-shell/student-ai-studio-dark-desktop.png |
| student | ET AI `/dashboard/studio/et` | dark | desktop | PASS | docs/qa/studio-shell/student-et-ai-dark-desktop.png |
| student | AI Teachers `/dashboard/studio/teachers` | dark | desktop | PASS | docs/qa/studio-shell/student-ai-teachers-dark-desktop.png |
| student | ET Maths `/dashboard/studio/maths` | dark | desktop | PASS | docs/qa/studio-shell/student-et-maths-dark-desktop.png |
| student | ET Exams `/dashboard/studio/exam-prep` | dark | desktop | PASS | docs/qa/studio-shell/student-et-exams-dark-desktop.png |
| student | ET Essays `/dashboard/studio/essays` | dark | desktop | PASS | docs/qa/studio-shell/student-et-essays-dark-desktop.png |
| student | Creator Store `/dashboard/store` | dark | desktop | PASS | docs/qa/studio-shell/student-creator-store-dark-desktop.png |
| student | AI Book Creator `/dashboard/admin/books` | dark | desktop | PASS — Student is sent to /dashboard/student. AI Book Creator stays off the student list. Book Studio is /reads/studio. | docs/qa/studio-shell/student-ai-book-creator-dark-desktop.png |
| student | Timetabler `/dashboard/studio/timetable` | dark | desktop | PASS | docs/qa/studio-shell/student-timetabler-dark-desktop.png |
| student | Teacher session `/dashboard/studio/teachers/et-maths` | dark | desktop | PASS | docs/qa/studio-shell/student-teacher-session-dark-desktop.png |
| student | Exam join `/dashboard/studio/exam-prep/join/sample` | dark | desktop | PASS | docs/qa/studio-shell/student-exam-join-dark-desktop.png |
| student | Essay review `/dashboard/studio/essays/review` | dark | desktop | PASS | docs/qa/studio-shell/student-essay-review-dark-desktop.png |
| student | AI Studio `/dashboard/studio` | dark | mobile | PASS | docs/qa/studio-shell/student-ai-studio-dark-mobile.png, drawer docs/qa/studio-shell/student-ai-studio-dark-mobile-drawer.png |
| student | ET AI `/dashboard/studio/et` | dark | mobile | PASS | docs/qa/studio-shell/student-et-ai-dark-mobile.png |
| student | AI Teachers `/dashboard/studio/teachers` | dark | mobile | PASS | docs/qa/studio-shell/student-ai-teachers-dark-mobile.png, drawer docs/qa/studio-shell/student-ai-teachers-dark-mobile-drawer.png |
| student | ET Maths `/dashboard/studio/maths` | dark | mobile | PASS | docs/qa/studio-shell/student-et-maths-dark-mobile.png |
| student | ET Exams `/dashboard/studio/exam-prep` | dark | mobile | PASS | docs/qa/studio-shell/student-et-exams-dark-mobile.png |
| student | ET Essays `/dashboard/studio/essays` | dark | mobile | PASS | docs/qa/studio-shell/student-et-essays-dark-mobile.png |
| student | Creator Store `/dashboard/store` | dark | mobile | PASS | docs/qa/studio-shell/student-creator-store-dark-mobile.png |
| student | AI Book Creator `/dashboard/admin/books` | dark | mobile | PASS — Student is sent to /dashboard/student. AI Book Creator stays off the student list. Book Studio is /reads/studio. | docs/qa/studio-shell/student-ai-book-creator-dark-mobile.png |
| student | Timetabler `/dashboard/studio/timetable` | dark | mobile | PASS — Recaptured after a connection reset during the first pass. | docs/qa/studio-shell/student-timetabler-dark-mobile.png |
| student | Teacher session `/dashboard/studio/teachers/et-maths` | dark | mobile | PASS | docs/qa/studio-shell/student-teacher-session-dark-mobile.png |
| student | Exam join `/dashboard/studio/exam-prep/join/sample` | dark | mobile | PASS | docs/qa/studio-shell/student-exam-join-dark-mobile.png |
| student | Essay review `/dashboard/studio/essays/review` | dark | mobile | PASS | docs/qa/studio-shell/student-essay-review-dark-mobile.png |
| teacher | AI Studio `/dashboard/studio` | light | desktop | PASS | docs/qa/studio-shell/teacher-ai-studio-light-desktop.png |
| teacher | AI Teachers `/dashboard/studio/teachers` | light | desktop | PASS | docs/qa/studio-shell/teacher-ai-teachers-light-desktop.png |
| teacher | Timetabler `/dashboard/studio/timetable` | light | desktop | PASS | docs/qa/studio-shell/teacher-timetabler-light-desktop.png |
| teacher | AI Studio `/dashboard/studio` | light | mobile | PASS | docs/qa/studio-shell/teacher-ai-studio-light-mobile.png, drawer docs/qa/studio-shell/teacher-ai-studio-light-mobile-drawer.png |
| teacher | AI Teachers `/dashboard/studio/teachers` | light | mobile | PASS | docs/qa/studio-shell/teacher-ai-teachers-light-mobile.png, drawer docs/qa/studio-shell/teacher-ai-teachers-light-mobile-drawer.png |
| teacher | Timetabler `/dashboard/studio/timetable` | light | mobile | PASS | docs/qa/studio-shell/teacher-timetabler-light-mobile.png |
| teacher | AI Studio `/dashboard/studio` | dark | desktop | PASS | docs/qa/studio-shell/teacher-ai-studio-dark-desktop.png |
| teacher | AI Teachers `/dashboard/studio/teachers` | dark | desktop | PASS | docs/qa/studio-shell/teacher-ai-teachers-dark-desktop.png |
| teacher | Timetabler `/dashboard/studio/timetable` | dark | desktop | PASS | docs/qa/studio-shell/teacher-timetabler-dark-desktop.png |
| teacher | AI Studio `/dashboard/studio` | dark | mobile | PASS | docs/qa/studio-shell/teacher-ai-studio-dark-mobile.png, drawer docs/qa/studio-shell/teacher-ai-studio-dark-mobile-drawer.png |
| teacher | AI Teachers `/dashboard/studio/teachers` | dark | mobile | PASS | docs/qa/studio-shell/teacher-ai-teachers-dark-mobile.png, drawer docs/qa/studio-shell/teacher-ai-teachers-dark-mobile-drawer.png |
| teacher | Timetabler `/dashboard/studio/timetable` | dark | mobile | PASS | docs/qa/studio-shell/teacher-timetabler-dark-mobile.png |
| parent | AI Studio `/dashboard/studio` | light | desktop | PASS | docs/qa/studio-shell/parent-ai-studio-light-desktop.png |
| parent | AI Teachers `/dashboard/studio/teachers` | light | desktop | PASS | docs/qa/studio-shell/parent-ai-teachers-light-desktop.png |
| parent | AI Studio `/dashboard/studio` | light | mobile | PASS | docs/qa/studio-shell/parent-ai-studio-light-mobile.png, drawer docs/qa/studio-shell/parent-ai-studio-light-mobile-drawer.png |
| parent | AI Teachers `/dashboard/studio/teachers` | light | mobile | PASS | docs/qa/studio-shell/parent-ai-teachers-light-mobile.png, drawer docs/qa/studio-shell/parent-ai-teachers-light-mobile-drawer.png |
| parent | AI Studio `/dashboard/studio` | dark | desktop | PASS | docs/qa/studio-shell/parent-ai-studio-dark-desktop.png |
| parent | AI Teachers `/dashboard/studio/teachers` | dark | desktop | PASS | docs/qa/studio-shell/parent-ai-teachers-dark-desktop.png |
| parent | AI Studio `/dashboard/studio` | dark | mobile | PASS | docs/qa/studio-shell/parent-ai-studio-dark-mobile.png, drawer docs/qa/studio-shell/parent-ai-studio-dark-mobile-drawer.png |
| parent | AI Teachers `/dashboard/studio/teachers` | dark | mobile | PASS | docs/qa/studio-shell/parent-ai-teachers-dark-mobile.png, drawer docs/qa/studio-shell/parent-ai-teachers-dark-mobile-drawer.png |
| institution | AI Studio `/dashboard/studio` | light | desktop | PASS | docs/qa/studio-shell/institution-ai-studio-light-desktop.png |
| institution | AI Teachers `/dashboard/studio/teachers` | light | desktop | PASS | docs/qa/studio-shell/institution-ai-teachers-light-desktop.png |
| institution | Timetabler `/dashboard/studio/timetable` | light | desktop | PASS | docs/qa/studio-shell/institution-timetabler-light-desktop.png |
| institution | AI Studio `/dashboard/studio` | light | mobile | PASS | docs/qa/studio-shell/institution-ai-studio-light-mobile.png, drawer docs/qa/studio-shell/institution-ai-studio-light-mobile-drawer.png |
| institution | AI Teachers `/dashboard/studio/teachers` | light | mobile | PASS | docs/qa/studio-shell/institution-ai-teachers-light-mobile.png, drawer docs/qa/studio-shell/institution-ai-teachers-light-mobile-drawer.png |
| institution | Timetabler `/dashboard/studio/timetable` | light | mobile | PASS | docs/qa/studio-shell/institution-timetabler-light-mobile.png |
| institution | AI Studio `/dashboard/studio` | dark | desktop | PASS | docs/qa/studio-shell/institution-ai-studio-dark-desktop.png |
| institution | AI Teachers `/dashboard/studio/teachers` | dark | desktop | PASS | docs/qa/studio-shell/institution-ai-teachers-dark-desktop.png |
| institution | Timetabler `/dashboard/studio/timetable` | dark | desktop | PASS | docs/qa/studio-shell/institution-timetabler-dark-desktop.png |
| institution | AI Studio `/dashboard/studio` | dark | mobile | PASS | docs/qa/studio-shell/institution-ai-studio-dark-mobile.png, drawer docs/qa/studio-shell/institution-ai-studio-dark-mobile-drawer.png |
| institution | AI Teachers `/dashboard/studio/teachers` | dark | mobile | PASS | docs/qa/studio-shell/institution-ai-teachers-dark-mobile.png, drawer docs/qa/studio-shell/institution-ai-teachers-dark-mobile-drawer.png |
| institution | Timetabler `/dashboard/studio/timetable` | dark | mobile | PASS | docs/qa/studio-shell/institution-timetabler-dark-mobile.png |

Rows: 128. Failed: 0.

## Included besides the shell

- Bahasa Melayu changes the public nav and the homepage hero. `e2e/language.spec.ts` switches the globe and checks Laman Utama, Kursus, Mula percuma, and “Belajar dengan cara anda.” Dashboard items that had an English override use the catalog when the language is not English. The longer marketing sections under the hero still use the English HOME copy.
- Homepage header scrolls away on `/`, stays fixed on other public pages, and is hidden on `/p/[code]`. “Programmes and products” uses the same 12px size as the other nav links. Shots: `docs/qa/homepage/homepage-header-flow.png`, `docs/qa/homepage/homepage-header-scrolled-away.png`, `docs/qa/homepage/profile-header-hidden.png`, `docs/qa/homepage/homepage-bahasa.png`.
- Shared dialogs, the cookie notice, toasts, and the dashboard popups that already called the close helper use one Close control: 44px hit area, the label Close, and a focus ring. The copyright modal and the curriculum editor are not in this change.

## Deferred

- Blog editor: full page, WYSIWYG, edit/preview, SEO/AEO, and custom fields. Left for a follow-up PR.
- CMS: teacher copyright declaration, cached lesson translation, mind maps, infographics, every block type, the deduped Add a block grid, Properties/Publish/Allocate/History, the PDF icon overlap, breadcrumb course titles, downloads, alt text, and MI tags.
- Rebase of #156, #155, and #154 onto this branch after it merges. They also touch `app/dashboard/layout.tsx` and `QA_QC.md`.
