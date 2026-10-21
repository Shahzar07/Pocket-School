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

- Bahasa Melayu changes the public nav, the homepage hero, and the sections under the hero. `e2e/language.spec.ts` switches the globe and checks Laman Utama, Kursus, Mula percuma, “Belajar dengan cara anda.”, and the Malay headings for the problem list and the worldwide price. Dashboard items that had an English override use the catalog when the language is not English.
- Homepage header scrolls away on `/`, stays fixed on other public pages, and is hidden on `/p/[code]`. “Programmes and products” uses the same 12px size as the other nav links. Shots: `docs/qa/homepage/homepage-header-flow.png`, `docs/qa/homepage/homepage-header-scrolled-away.png`, `docs/qa/homepage/profile-header-hidden.png`, `docs/qa/homepage/homepage-bahasa.png`.
- Shared dialogs, the cookie notice, toasts, and the dashboard popups that already called the close helper use one Close control: 44px hit area, the label Close, and a focus ring. The copyright upload modal and the curriculum publish dialog use that same Close control.

## Deferred

- Blog editor: full page, WYSIWYG, edit/preview, SEO/AEO, and custom fields. Left for a follow-up PR.
- CMS: teacher copyright declaration, cached lesson translation, mind maps, infographics, every block type, the deduped Add a block grid, Properties/Publish/Allocate/History, the PDF icon overlap, breadcrumb course titles, downloads, alt text, and MI tags.
- Rebase of #156, #155, and #154 onto this branch after it merges. They also touch `app/dashboard/layout.tsx` and `QA_QC.md`.

# Certificate template verification

Checked on 21 Oct 2026 from the certificate designer, without a signed-in admin. Re-checked after the rebase onto `487246d`: `lib/certificates/design.test.ts` and `lib/admin/batch.test.ts` passed (11), and `e2e/certificate-template.spec.ts` passed (3). The page under test is the same `CertificateDesigner` the admin route renders. Preview: `/preview/admin-tools?view=certificates`. Verify: `/verify/PS-1042`.

| Check | Result | Evidence |
| --- | --- | --- |
| The editor form renders once. Save template, Add template, and the signatory footer are not repeated. | PASS | `e2e/certificate-template.spec.ts`. One `[data-certificate-form]`, one Save template, no button named New template. `docs/qa/certificates/certificates-light-desktop.png` |
| Recipient name and Course or level sit on their own rows and do not clip into the row below. | PASS | Checkbox rows use a 44px minimum height. `docs/qa/certificates/certificates-light-desktop.png` |
| Template tabs do not show "New template" twice. Rename, duplicate, delete with confirmation, and the default flag work. | PASS | The add button is Add template. The same e2e renames a tab to Harbour cyan, clears Default, duplicates, asks for confirmation, cancels, then deletes. |
| A saved state is visible. | PASS | Preview save sets the status to "This preview does not write a template." A real save sets "Saved." when Firebase Admin is configured. |
| Logo, co-brand, and signature fields reject a non-https link and accept a PNG upload. | PASS | The e2e types `http://example.com/logo.png`, sees the https error, then uploads a PNG and removes it. `lib/certificates/design.test.ts` |
| The preview is one A4 landscape sheet that scales to the panel. It does not grow with the form. | PASS | Desktop sheet measured 440×311 (ratio 1.41) beside a 1537px form. `docs/qa/certificates/certificates-light-desktop.png` |
| A4 portrait and US Letter are available. | PASS | The same e2e selects both. Portrait is taller than it is wide. US Letter stays landscape. |
| The signatory, QR, and verify URL appear once and stay inside the sheet. | PASS | One footer node. Signatory text is Poket School, Issuer, the verify URL, and the copyright line. |
| Light and dark, with the preview under the form on a phone. | PASS | `docs/qa/certificates/certificates-light-desktop.png`, `certificates-dark-desktop.png`, `certificates-light-mobile.png`, `certificates-dark-mobile.png`. Phone preview starts below the form. Dark card colour is #1A1918 on #0B1417. |
| The PDF is the same sheet: A4 landscape, cyan #3FE0D0 and ink #203337, double border, Poket mark, institution logo, co-brand, title, recipient, course, date, id, signature, QR, verify link, copyright, embedded Noto Sans. No gold or amber. | PASS | `docs/qa/certificates/certificate-amina-yusuf.pdf` and `certificate-amina-yusuf.png`. Text baselines are separate (title y 377, name y 352, course y 335, date y 318, id y 304). `lib/certificates/design.test.ts` |
| North Academy, Harbour, and the drawn signature appear only on the labelled template sample. | PASS | The preview caption says they stay on the sample. The co-brand field stays empty. `designForIssue` and `normaliseDesign` strip the sample images before a save or an issued PDF. `lib/certificates/design.test.ts` |
| An institution admin cannot replace the platform default. | PASS | `scopeDesignForActor` sets `isDefault` false and id `institution-{id}`. The certificates API uses that helper. Covered by `lib/certificates/design.test.ts`. A signed-in institution session was not opened here. |
| `/verify/PS-1042` resolves. | PASS | `e2e/certificate-template.spec.ts`. The page shows Amina Yusuf, IGCSE Mathematics, PS-1042, and "Template sample", and it does not call the sample a completed module. `docs/qa/certificates/certificates-verify-light.png`, `certificates-verify-dark.png` |

Other CMS checks are not part of this change and are not marked here.

# CMS desk verification

Checked on 21 Oct 2026 against the Firebase emulators and a local Next server. Sample course title: Cells and tissues. No real accounts.

| Check | Result | Evidence |
| --- | --- | --- |
| Curriculum list does not ask for a copyright signature | PASS | `docs/qa/cms/cms-list-light.png` |
| Admin publish does not ask for a copyright signature | PASS | `docs/qa/cms/cms-publish-admin.png` |
| A teacher is asked to sign once, at first publish, when the course has no signature | PASS | `docs/qa/cms/cms-copyright-teacher.png` |
| A student is not shown the copyright form | PASS | Student lesson has no `[data-copyright-sign]` |
| Breadcrumb shows the course title | PASS | Builder navigation contains "Cells and tissues" |
| Add a block has one Image, one Illustration, and separate Infographic / Infographic image | PASS | `docs/qa/cms/cms-builder-light.png` |
| Blocks are grouped Lesson, Practice, Visual | PASS | Same screenshot |
| Mind map renders the Buzan map from the lesson JSON | PASS | Map image in the builder screenshot |
| Infographic renders the written sections and does not add a percentage | PASS | Builder contains "Plant cell" and no "%" |
| PDF / Word toolbar does not cover the mind map or the ET AI actions | PASS | Bounding boxes in `e2e/cms-desk.spec.ts` |
| Right panel tabs are Properties, Publish, Allocate, History | PASS | `docs/qa/cms/cms-publish-panel.png` |
| Download allowance is on the Publish tab | PASS | `[data-downloads="1"]` |
| Alt text and a multiple-intelligence tag are on a visual block | PASS | `docs/qa/cms/cms-alt-mi.png` |
| Student reader uses a saved Bahasa Melayu title | PASS | `docs/qa/cms/cms-student-translation.png` shows "Sel tumbuhan" |
| Cached ET AI translation when no saved copy exists | PASS | Unit test for `displayedField`; the student hook calls `/api/content/translate` only when the saved copy falls back |
| Lesson body in Bahasa Melayu on the student page | PASS | The Lesson tab is not behind the Sparks lock. The saved sentence “Sel tumbuhan mempunyai nukleus dan dinding sel.” is on screen. Mind Map still shows the ⚡10 lock. |
| Mobile builder | PASS | `docs/qa/cms/cms-builder-mobile.png` |

Unit tests in `lib/cms/desk.test.ts`: 5 passed (teacher-only signature, unique block grid, no amber Buzan branch, infographic stats only from the written text, breadcrumb title).
