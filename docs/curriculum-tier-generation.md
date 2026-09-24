# Tiered Curriculum Generation — build notes and spec review

This document covers two things: the review the curriculum team asked for on
`Curriculum_Generation_Prompts_All_Tiers.md`, and how the tier system is now
wired into the platform.

---

## 1. Is the spec implementable as written?

Yes, all four tiers are implementable, and they are now implemented. The
mechanic the whole document rests on — **a different field schema and prompt
structure per tier, rather than one fixed structure for every subject** — was
the part worth checking first, and the answer is that the backend already had
the right shape for it.

`POST /api/ai/generate` previously held one fixed prompt per output format
(`text`, `notes`, `quiz`, …). It now takes a tier selection alongside the
format, and for the two formats the tiers own (`text` = Lesson Full Text,
`notes` = Student Notes) it builds the prompt from that tier's own field set
and output format. Everything else (quiz, flashcards, slides, video script)
keeps its existing prompt, so nothing that already worked changed behaviour.

The per-tier prompt spine lives in one place, `lib/curriculum-tiers.ts`, so
the spec and the code stay in step: one file holds the role, the critical
output rules, the explainer rules, and then the four tier bodies.

### Two deviations from the spec, both deliberate

**a. The Explainer Text is emitted with a `**Explainer Text:**` label.**
The spec has the explainer as unlabelled italic prose between Mnemonic and
Case Study. Unlabelled prose cannot be reliably parsed back out of the reply,
which means the CMS could not store it as a field or render it separately
from the rest. The generator therefore emits the label, and the renderer
**hides it** — the student sees exactly what the spec describes: three
paragraphs of flowing prose with no heading above them. This costs nothing
editorially and buys a parseable field.

**b. Key Case Law entries use bullet lines under a numbered heading.**
The spec's "no bullets outside Vocabulary / assessment / Problem Q" rule is
about the *Explainer Text* not degenerating into notes. Case law entries are a
structured record with nine named parts, and the spec itself lists them as
fields. They are generated as `- **Facts:** …` lines under `### 1. Case Name
[citation]`, then rendered as proper case cards. The prose rule still binds
the explainer, the case *Facts* paragraph, and the Case Study.

### Things the spec leaves loose that the build had to decide

| Point | Decision |
|---|---|
| Tier 1 Case Study length says both "1 sentence–1 short paragraph" and "at least 1-2 full paragraphs" | Took the longer reading (1–2 paragraphs). The shorter one cannot support the "apply to the Case Study" question worth 3–4 marks. |
| Tier 2 says Law at A-Level uses Tier 4, but is also listed under Tier 2's essay subjects | Law routes to Tier 4 at every stage. Auto-detection checks for Law **before** it checks the stage, so "A-Level Law" never lands in Tier 2. |
| Objectives count: "2-3" in the required-fields list, "3-4 for a Lesson, 4-5 for a Chapter" in the source prompt | Used 3–4 for a lesson and 4–5 for a chapter. Flagging this because the two numbers in the document disagree. |
| Tier 4 "no hyphens anywhere" | Passed through as "no hyphens inside sentences", with markdown list markers and case citations exempted. A literal reading would break `Donoghue v Stevenson` style citations and every bullet. |
| Key Statutes when a topic is pure common law | The field is still emitted, carrying the single line "Not applicable: this topic is governed by common law." The spec says to omit it; omitting a field silently is indistinguishable from a failed generation, so it is stated instead. |

---

## 2. The two open questions

### Tier 3: Competency Checklist vs graded rubric

**Neither is meaningfully harder to build.** Both are supported, selectable per
subject / chapter / lesson from an "Assessment" dropdown that appears only on
Tier 3. Pick on pedagogy, not on engineering cost:

- **Competency Checklist** — 4–6 tickable "Can …" statements. Produces a
  pass / not-yet signal, no score. Cheap to mark, cheap to store, and it maps
  onto nothing in the existing gradebook, so a Tier 3 course assessed this way
  will not produce a percentage or feed a report card.
- **Graded Rubric** — 4–6 criteria with percentage weightings summing to 100.
  Produces a score, which means it *does* feed the gradebook, transcripts and
  the pass-mark logic that already exist for assignments.

So the real question is not build cost but whether a Micro Degree learner
needs a grade on their transcript. If they do, choose the rubric — otherwise
the checklist leaves a gap where their result should be. The rubric's
weightings are normalised to exactly 100 in the prompt because models
reliably produce 95 or 105 otherwise.

### Tier 4: does depth scale automatically by stage, or does it need three presets?

**It scales automatically from one preset.** There is a single Tier 4 prompt
with a Stage dropdown (A-Level Law / Pre-University Law / LLB / University),
and the stage drives every depth-sensitive number in the prompt:

| | A-Level Law | Pre-University Law | LLB / University |
|---|---|---|---|
| Cases | 6 | 6–7 | 7 |
| Facts paragraph | 3–4 sentences | 4–5 sentences | 4–6 sentences |
| Case Study | 2 paragraphs, single incident | 2–3 paragraphs, may link two | 3–4 paragraphs, multiple linked incidents |
| Questions | 3–4 | 4 | 5–6 |
| Academic debate | excluded | one point, briefly | dissents and critique where they exist |

Three separate presets would be three copies of the same 60-line prompt
drifting apart the first time someone edits one of them. The stage table is
the only thing that differs, so that is the only thing that varies.

---

## 3. Does the field structure need simplifying for the data model?

**No.** This was the right question to ask before content generation started,
and the answer is that a variable field set per tier is genuinely cheap here —
Firestore is schemaless, so there is no migration and no nullable-column
sprawl.

Concretely: the generated lesson is stored twice, on purpose.

1. `lesson.aiOutputs.text` — the raw markdown, exactly as before. Every
   existing viewer, export, and downstream generation (quiz-from-lesson,
   video script) keeps working with no change.
2. `lesson.lessonPack` — one optional map holding the parsed fields. A Tier 1
   lesson simply has no `keyCaseLaw` key; a Tier 4 lesson has no `mockExam`.
   Nothing is nullable-by-necessity and nothing needs a migration when a fifth
   tier is added.

The parser never throws and never loses content: `lessonPack.raw` always holds
the original markdown, so a partial parse degrades to "render the markdown"
rather than to an error. If a generation comes back missing fields its tier
requires, the CMS says which ones in a toast rather than silently publishing
a half lesson.

The one thing worth knowing: **`lessonPack` is a snapshot, not a live
projection.** Editing the raw lesson text in the builder does not re-parse the
pack; regenerating does. If the team wants hand edits to flow into the
structured view, that is a follow-up (re-parse on save), not something the
current spec calls for.

---

## 4. How it is wired

### Tier resolution

Precedence, most specific first:

```
lesson.tier  →  chapter.tier  →  subject.tier  →  auto-detected
```

Auto-detection reads the Programme, Subject, Year/Level and course title:

- Anything matching Law / LLB / jurisprudence / legal studies → **Tier 4**,
  checked first, before any stage rule.
- Micro degree / professional / vocational / CPD / diploma → **Tier 3**.
- A-Level / AS / Pre-University / Foundation / sixth form / Year 12–13 →
  **Tier 2**, with Essay vs Technical guessed from the subject name.
- Everything else → **Tier 1**.

The detected tier is shown with the reason underneath it ("Law subject
detected — Law always uses Tier 4. Stage read as LLB."), and an admin can
override it at any level. An override is sticky and marked **Manual**, with a
"Reset to auto" control next to it.

### Where the dropdowns are

| Place | What it sets |
|---|---|
| Curriculum → New Subject | The subject default every lesson inherits |
| Curriculum → AI Course Architect | The tier for the whole generated scheme of work |
| Curriculum → edit a subject | Changes the subject default |
| Content Builder → new chapter / lesson dialog | The item's own tier, pre-filled with what it would inherit |
| Content Builder → lesson header | The selected lesson's tier |
| Content Builder → Properties panel | The selected chapter's tier |
| AI Studio | Mapped from the level selector; Law overrides to Tier 4 |

### Files

| File | Role |
|---|---|
| `lib/curriculum-tiers.ts` | Tier catalogue, auto-detection, prompt builders, parser |
| `app/api/ai/generate/route.ts` | Accepts the tier, builds the tiered prompt, returns markdown + parsed pack |
| `components/tier-selector.tsx` | The dropdown(s), with auto-detect and override |
| `components/lesson-pack-view.tsx` | Renders each tier's field set, including case cards |
| `lib/db.ts` | `tier` fields on Course / Module / Lesson, `lessonPack` on Lesson |

### Token budget

Tier 4 asks for six or seven case-law entries on top of the normal field set,
so it is given 12k output tokens against 5–6k for the other tiers. That is the
one place where the tier materially changes generation cost.

---

## 5. Known limits

- **The model can still cite a case wrongly.** The prompt forbids invented
  cases and tells the model to choose a different authority when it is not
  certain of a citation, but nothing in the pipeline verifies a citation
  against a law report. Law content needs a human check before publishing —
  the same review step the platform already requires, but it matters more
  here.
- `lessonPack` does not re-parse on manual edits (see section 3).
- Auto-detection is keyword-based. A subject called "Business" inside an LLB
  programme will be read from the programme name, but an unusually named
  subject may need the manual override. That is what the override is for.
