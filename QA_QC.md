# QA / QC

This file records the ET AI Timetabler check on `cursor/et-ai-timetabler-336c`. It does not sign the wider handover table.

| Check | Result |
| --- | --- |
| Solver unit tests on the Primary 2 and IGCSE seed | No teacher, room, student, room-type, capacity, availability, load, or campus hard violation. |
| Option blocks | Co-chosen subjects land in different blocks. One block reports the clashes. Approval creates sets and enrols the students. |
| Cover | A teacher on leave gets a qualified free cover teacher. Notices are built for the teacher, the students, and the parents. Cover load is counted. |
| Plain language | “Mr Chen can’t do Friday afternoons” blocks Friday P5 and P6 without a model key. |
| Publish | Calendar items are type `class`. Planner items are periods. Registers are unmarked. iCal exports. Rollback restores the version. Sample school-desk classes can be added from the feed. |
| Package | Teacher add-on is personal. Institution is the school week. Enterprise is multi-campus. Price stays TBC by Harry. |
| Playwright | `e2e/timetable.spec.ts` generates a week, rejects a clash and applies a free slot, approves cover, saves a student option, and opens the teacher, parent, and personal views. |
| Rules | `timetables` editors are institution admins and `timetable:edit`. Teachers, students, and parents read their own `people` view. Audit create only, no update or delete. Not deployed. |
| Not claimed | Live OpenRouter wording, production Firestore deploy, and the rest of the handover sign-off. |
