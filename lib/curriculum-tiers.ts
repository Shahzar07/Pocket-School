/**
 * Curriculum Generation Tiers.
 *
 * The whole platform generates lesson content from ONE prompt spine, but the
 * field set, the case-study format and the assessment component change per
 * academic tier:
 *
 *   Tier 1 — Primary / Lower Secondary / IGCSE      → Mock Exam + Problem Q
 *   Tier 2 — A-Level / Pre-University / Foundation  → Structured Questions (+ Problem Q)
 *   Tier 3 — Micro Degree / Professional            → Competency Checklist or Rubric + Stretch Task
 *   Tier 4 — Law (any stage)                        → Key Case Law / Key Statutes + Case Study Questions
 *
 * Everything in this file is pure data + string building so it can be imported
 * from both the client (CMS selectors) and the server (generation route).
 */

/* ── Types ──────────────────────────────────────────────────── */

export type TierId = 'tier1' | 'tier2' | 'tier3' | 'tier4';

/** Tier 2 branches its Case Study format by subject type. */
export type Tier2SubjectType = 'essay' | 'technical';

/** Tier 4 scales case-law depth by the stage Law is taught at. */
export type LawStage = 'a_level' | 'pre_university' | 'llb' | 'university';

/** Tier 3 assessment style — open question in the spec, both are supported. */
export type Tier3Assessment = 'checklist' | 'rubric';

export interface TierSelection {
  tier: TierId;
  /** Tier 2 only. */
  subjectType?: Tier2SubjectType;
  /** Tier 4 only. */
  lawStage?: LawStage;
  /** Tier 3 only. Defaults to 'checklist'. */
  assessmentStyle?: Tier3Assessment;
}

/** What a lesson is being generated as — affects objective/vocabulary counts. */
export type GenerateLevel = 'lesson' | 'chapter' | 'subtopic';

export interface GenerationMeta {
  programme?: string;
  subject?: string;
  yearLevel?: string;
  unit?: string;
  chapter?: string;
  topic?: string;
  /** "Build on prior content already covered". */
  priorContent?: string;
  generateLevel?: GenerateLevel;
}

/* ── Tier catalogue (drives every dropdown in the CMS) ───────── */

export interface TierDef {
  id: TierId;
  /** Exact label the curriculum team specified for the dropdown. */
  label: string;
  short: string;
  blurb: string;
  /** Ordered field keys this tier produces — also the CMS render order. */
  fields: string[];
  /** Which optional sub-dropdown this tier needs, if any. */
  subSelect?: 'subjectType' | 'lawStage';
}

export const TIERS: TierDef[] = [
  {
    id: 'tier1',
    label: 'Tier 1 — Primary / Lower Secondary / IGCSE',
    short: 'Tier 1 · Primary–IGCSE',
    blurb: 'Mock Exam (3 questions, ascending marks) plus a Problem Q one Bloom’s level up.',
    fields: [
      'title', 'duration', 'blooms', 'objectives', 'vocabulary', 'mnemonic',
      'explainer', 'caseStudy', 'activity', 'assignment', 'summary',
      'mockExam', 'problemQ',
    ],
  },
  {
    id: 'tier2',
    label: 'Tier 2 — A-Level / Pre-University / Foundation',
    short: 'Tier 2 · A-Level–Foundation',
    blurb: 'Case Study or Structured Problem plus 3–4 marked structured questions.',
    subSelect: 'subjectType',
    fields: [
      'title', 'duration', 'blooms', 'objectives', 'vocabulary', 'mnemonic',
      'explainer', 'caseStudy', 'questions', 'activity', 'assignment', 'summary',
      'problemQ',
    ],
  },
  {
    id: 'tier3',
    label: 'Tier 3 — Micro Degree / Professional',
    short: 'Tier 3 · Professional',
    blurb: 'Practical Brief, a named Deliverable, Competency Checklist or Rubric, and a Stretch Task.',
    fields: [
      'title', 'duration', 'blooms', 'objectives', 'vocabulary', 'mnemonic',
      'explainer', 'practicalBrief', 'activity', 'deliverable', 'assignment',
      'summary', 'competencyChecklist', 'rubric', 'stretchTask',
    ],
  },
  {
    id: 'tier4',
    label: 'Tier 4 — Law (A-Level Law / Pre-University Law / LLB / University)',
    short: 'Tier 4 · Law',
    blurb: 'Real Key Case Law and Key Statutes, then a multi-incident Case Study with marked questions.',
    subSelect: 'lawStage',
    fields: [
      'title', 'duration', 'blooms', 'objectives', 'vocabulary', 'mnemonic',
      'explainer', 'keyCaseLaw', 'keyStatutes', 'caseStudy', 'questions',
      'activity', 'assignment', 'summary',
    ],
  },
];

export const TIER_BY_ID: Record<TierId, TierDef> = Object.fromEntries(
  TIERS.map(t => [t.id, t])
) as Record<TierId, TierDef>;

export const SUBJECT_TYPES: { id: Tier2SubjectType; label: string; hint: string }[] = [
  { id: 'essay', label: 'Essay / Scenario', hint: 'Business, Economics, Psychology, History, Sociology…' },
  { id: 'technical', label: 'Technical / Calculation', hint: 'Maths, Physics, Chemistry, Biology, Computing…' },
];

export const LAW_STAGES: { id: LawStage; label: string; depth: string }[] = [
  { id: 'a_level', label: 'A-Level Law', depth: '6 foundational cases, shorter case study, statute basics only.' },
  { id: 'pre_university', label: 'Pre-University Law', depth: '6–7 cases, moderate analytical depth.' },
  { id: 'llb', label: 'LLB', depth: '7 cases at full degree depth, academic debate included.' },
  { id: 'university', label: 'University', depth: '7 cases at full degree depth, academic debate included.' },
];

export const TIER3_ASSESSMENTS: { id: Tier3Assessment; label: string; hint: string }[] = [
  { id: 'checklist', label: 'Competency Checklist', hint: 'Tick-box statements — pass/not-yet, no marks.' },
  { id: 'rubric', label: 'Graded Rubric / Portfolio', hint: 'Criteria, weighting and descriptors — produces a score.' },
];

/** Human label for a full selection, e.g. "Tier 4 · Law (LLB)". */
export function describeSelection(sel: TierSelection): string {
  const def = TIER_BY_ID[sel.tier] ?? TIER_BY_ID.tier1;
  if (sel.tier === 'tier2' && sel.subjectType) {
    return `${def.short} (${SUBJECT_TYPES.find(s => s.id === sel.subjectType)?.label})`;
  }
  if (sel.tier === 'tier4' && sel.lawStage) {
    return `${def.short} (${LAW_STAGES.find(s => s.id === sel.lawStage)?.label})`;
  }
  if (sel.tier === 'tier3' && sel.assessmentStyle === 'rubric') {
    return `${def.short} (Rubric)`;
  }
  return def.short;
}

/* ── Auto-detection ─────────────────────────────────────────── */

const has = (hay: string, ...needles: string[]) => needles.some(n => hay.includes(n));

export interface TierDetection extends TierSelection {
  /** Why this tier was chosen — shown under the dropdown so admins can trust it. */
  reason: string;
}

/**
 * Best-guess tier from the Programme / Subject / Year already chosen.
 * Always overridable in the CMS — this only sets the dropdown's default.
 *
 * Law wins over every stage rule: Law at A-Level is still Tier 4, because real
 * case law is the substance of the subject at any level.
 */
export function detectTier(meta: {
  programme?: string; subject?: string; yearLevel?: string; courseTitle?: string;
}): TierDetection {
  const hay = [meta.programme, meta.subject, meta.courseTitle, meta.yearLevel]
    .filter(Boolean).join(' ').toLowerCase();
  const stageHay = [meta.programme, meta.yearLevel, meta.courseTitle]
    .filter(Boolean).join(' ').toLowerCase();

  // ── Tier 4: Law at any stage ──
  const isLaw =
    /\blaw\b|\bllb\b|\bllm\b|jurisprud|legal studies|legal system|\bcontract law\b|\btort\b/.test(hay);
  if (isLaw) {
    let lawStage: LawStage = 'llb';
    let where = 'LLB';
    if (has(stageHay, 'a-level', 'a level', 'as-level', 'as level')) { lawStage = 'a_level'; where = 'A-Level'; }
    else if (has(stageHay, 'pre-university', 'pre university', 'pre-u', 'foundation')) { lawStage = 'pre_university'; where = 'Pre-University'; }
    else if (has(stageHay, 'llb')) { lawStage = 'llb'; where = 'LLB'; }
    else if (has(stageHay, 'university', 'degree', 'undergrad', 'bachelor')) { lawStage = 'university'; where = 'University'; }
    return {
      tier: 'tier4', lawStage,
      reason: `Law subject detected — Law always uses Tier 4. Stage read as ${where}.`,
    };
  }

  // ── Tier 3: professional / vocational programmes ──
  if (has(hay, 'micro degree', 'micro-degree', 'microdegree', 'professional', 'vocational',
    'cpd', 'bootcamp', 'certificate', 'diploma', 'apprentice', 'workplace', 'upskill')) {
    return {
      tier: 'tier3', assessmentStyle: 'checklist',
      reason: 'Professional / Micro Degree programme — competency-based tier.',
    };
  }

  // ── Tier 2: A-Level / Pre-U / Foundation ──
  if (has(stageHay, 'a-level', 'a level', 'as-level', 'as level', 'pre-university',
    'pre university', 'pre-u', 'foundation', 'sixth form', 'ib diploma', 'year 12', 'year 13')) {
    return {
      tier: 'tier2', subjectType: detectSubjectType(meta.subject ?? meta.courseTitle ?? ''),
      reason: 'A-Level / Pre-University / Foundation stage detected.',
    };
  }

  // ── Tier 1: everything school-age ──
  return {
    tier: 'tier1',
    reason: has(hay, 'igcse', 'gcse')
      ? 'IGCSE programme detected.'
      : 'Primary / Lower Secondary default.',
  };
}

/** Essay vs technical, used to pre-fill the Tier 2 sub-dropdown. */
export function detectSubjectType(subject: string): Tier2SubjectType {
  const s = subject.toLowerCase();
  if (/math|physic|chemis|biolog|statis|comput|engineer|account|further maths|mechanic/.test(s)) {
    return 'technical';
  }
  return 'essay';
}

/* ── Prompt construction ────────────────────────────────────── */

const ROLE = `ROLE
You are an expert educator and course writer producing curriculum content as genuine, ready-to-deliver material. Students must be able to learn directly from what you write. This is a finished lesson, not a draft, not a conversation, and not a study-guide summary.`;

const CRITICAL_RULES = `CRITICAL OUTPUT RULES
- Never end with an offer, a question to the reader, or any conversational line. The output stops at the final required field for this tier.
- Never use headers-and-bullets as the primary format for the Explainer Text. Bullets are permitted only inside Vocabulary, the assessment component, structured field entries, and the Problem Q.
- Never produce more or fewer items than specified for any field.
- Never merge, reorder or rename fields. Use the exact labels given, in the exact order given.
- Never omit a field. If it seems not to apply, still include it and say why in one line.
- Use only the output format for the stated tier. Never blend tiers.`;

const GENERAL_RULES = `GENERAL RULES
- You may draw on textbooks, articles or reference material for facts and concepts, but rewrite everything fully in your own words. Never copy sentences or phrasing directly.
- No exam board, publisher, curriculum brand, or branded resource names anywhere.
- Case studies and scenarios use original, fictional people and organisations only. The single exception is Law case law and statutes, which must be real (see the Law tier), and subjects that require real historical or scientific fact (History, Science), which are cited factually and neutrally.
- Match vocabulary, sentence complexity and explanation depth to the stated Year/Level. A Year 1 lesson and a Year 11 lesson on a related idea must read completely differently.`;

const EXPLAINER_RULES = (tone: string) => `EXPLAINER TEXT FORMAT
- Flowing prose in paragraphs. Not headers, not bullet lists, not labelled sub-sections, not lesson-plan notes.
- Exactly 3 paragraphs of 4 to 5 sentences each, each building on the last like a real textbook chapter.
- Paragraph 1 defines the concept in plain language before any technical term appears. Paragraph 2 explains why it matters and how it works, the mechanism rather than the definition. Paragraph 3 walks through one worked example woven into the prose itself.
- Tone: ${tone}
- Language stays accessible even where the ideas are complex. Clarity comes from strong explanation, never from shortening the content.
- Complete enough that a student could learn the concept from reading it alone, with no teacher input.
- Technical vocabulary is introduced only after the underlying idea has been explained in plain words.`;

const MARKDOWN_CONTRACT = `OUTPUT ENCODING
- Reply in GitHub-flavoured Markdown, nothing before the first field and nothing after the last.
- Every field label is a bold line in the exact form "**Label:**" followed by its content. Keep labels on their own line where the content runs to more than one line.
- Do not wrap the reply in code fences. Do not add a preamble, a sign-off, or commentary about what you produced.
- Leave exactly one blank line between fields.`;

/** Objective / vocabulary counts shift between a lesson and a whole chapter. */
function countsFor(level: GenerateLevel | undefined) {
  return level === 'chapter'
    ? { objectives: '4 to 5', vocab: '6 to 8, one consolidated list for the whole chapter' }
    : { objectives: '3 to 4', vocab: '5 to 8' };
}

function tier1Spec(meta: GenerationMeta): string {
  const c = countsFor(meta.generateLevel);
  return `TIER 1 — PRIMARY / LOWER SECONDARY / IGCSE

Case Study: 1 to 2 full paragraphs, distinct from the worked example inside the Explainer Text, with enough concrete detail (names, figures, circumstances) that the application question can test reasoning rather than recall. Scale the reading level to the stated Year.
Assessment: a Mock Exam of exactly 3 questions in ascending difficulty. 1) recall (2 marks), 2) explain (3 marks), 3) apply to the Case Study, referring to it by name (3 to 4 marks).
Problem Q: included. One scenario question set one Bloom's level above the lesson's stated level.

OUTPUT FORMAT (exact labels, exact order)

**Lesson:** [title]

**Duration:** [e.g. 60 minutes]

**Bloom's Taxonomy Level:** [one level only]

**Objectives:** [${c.objectives} objectives, each starting with an action verb matching the Bloom's level, separated by " · "]

**Vocabulary:** [${c.vocab} terms, comma separated, terms only with no inline definitions]

**Mnemonic:** "[one mnemonic specific to this content, age appropriate]"

**Explainer Text:**
[three prose paragraphs, blank line between each]

**Case Study:** [title] — [1 to 2 paragraph original scenario]

**Activity:** [one concrete hands-on or applied task]

**Assignment:** [one deliverable the student produces, different from the Activity]

**Summary:** [1 to 2 sentences]

**Mock Exam:**
1) [recall question] (2 marks)
2) [explain question] (3 marks)
3) [apply to the Case Study by name] (3 to 4 marks)

**Problem Q:** [one scenario question, one Bloom's level above]`;
}

function tier2Spec(meta: GenerationMeta, subjectType: Tier2SubjectType): string {
  const c = countsFor(meta.generateLevel);
  const essay = subjectType !== 'technical';
  const caseBlock = essay
    ? `Case Study: a medium-length scenario of 2 to 3 paragraphs covering a single incident, with concrete detail (names, figures, circumstances). More analytical depth than IGCSE, less complexity than degree level.
Assessment: 3 to 4 structured questions ascending explain → analyse → evaluate, each with its marks stated.`
    : `Structured Problem: the Case Study field is replaced by a realistic applied scenario requiring calculation or technical analysis, with at least 1 to 2 full paragraphs of setup detail (quantities, conditions, measurements) before the questions.
Assessment: 3 to 4 structured questions ascending apply/calculate → analyse → evaluate/interpret, each with its marks stated. Show units and state any assumptions in the model answers where the question demands them.`;
  const caseLabel = essay ? '**Case Study:**' : '**Structured Problem:**';

  return `TIER 2 — A-LEVEL / PRE-UNIVERSITY / FOUNDATION
Subject type for this lesson: ${essay ? 'ESSAY / SCENARIO' : 'TECHNICAL / CALCULATION'}.

${caseBlock}
Problem Q: included. One scenario question set one Bloom's level above the lesson's stated level.

OUTPUT FORMAT (exact labels, exact order)

**Lesson:** [title]

**Duration:** [ ]

**Bloom's Taxonomy Level:** [one level only]

**Objectives:** [${c.objectives}, separated by " · "]

**Vocabulary:** [${c.vocab} terms, comma separated, no inline definitions]

**Mnemonic:** "[one mnemonic specific to this content]"

**Explainer Text:**
[three prose paragraphs, blank line between each]

${caseLabel} [title] — [${essay ? '2 to 3 paragraph scenario' : 'applied problem with full setup detail'}]

**Questions:**
1) [ ] (marks)
2) [ ] (marks)
3) [ ] (marks)
4) [optional fourth] (marks)

**Activity:** [one concrete task]

**Assignment:** [one deliverable, separate from the Activity]

**Summary:** [1 to 2 sentences]

**Problem Q:** [one scenario question, one Bloom's level above]`;
}

function tier3Spec(meta: GenerationMeta, style: Tier3Assessment): string {
  const c = countsFor(meta.generateLevel);
  const assessment = style === 'rubric'
    ? `**Assessment Rubric:**
| Criteria | Weighting | Description |
|---|---|---|
| [criterion] | [%] | [what a competent submission looks like] |
[4 to 6 rows. Weightings must be whole percentages summing to exactly 100.]`
    : `**Competency Checklist:**
- [ ] [Can … statement]
- [ ] [Can … statement]
- [ ] [Can … statement]
- [ ] [Can … statement]
[4 to 6 statements, each starting "Can ", each observable and tickable. Never exam questions.]`;

  return `TIER 3 — MICRO DEGREE / PROFESSIONAL

Practical Brief: the Case Study field becomes a short real-world workplace scenario of 1 to 2 paragraphs with concrete detail (a fictional client, a budget, a deadline, a constraint), describing a task, problem or client need relevant to the skill taught. Fictional workplace and client only.
Deliverable: state exactly what the learner produces and submits as evidence of competency, naming the concrete output format (a one-page plan, a spreadsheet model, a 3-minute recording, a working file).
Assessment: ${style === 'rubric'
    ? 'a graded rubric table of 4 to 6 criteria with percentage weightings summing to 100.'
    : 'a Competency Checklist of 4 to 6 short tickable statements, not exam questions.'}
Problem Q is omitted at this tier and replaced by a Stretch Task, a harder real-world variation of the Practical Brief.

OUTPUT FORMAT (exact labels, exact order)

**Module:** [title]

**Duration:** [ ]

**Bloom's Taxonomy Level:** [one level only]

**Objectives:** [${c.objectives}, separated by " · ", written as workplace-capability statements]

**Vocabulary:** [${c.vocab} terms used in the trade or profession, comma separated]

**Mnemonic:** "[one mnemonic specific to this content]"

**Explainer Text:**
[three prose paragraphs, blank line between each]

**Practical Brief:** [title] — [1 to 2 paragraph workplace or client scenario]

**Activity:** [one concrete task done during the session]

**Deliverable:** [the exact artefact submitted, with its format]

**Assignment:** [one deliverable, separate from the Activity]

**Summary:** [1 to 2 sentences]

${assessment}

**Stretch Task:** [a harder real-world variation of the Practical Brief]`;
}

/** Case count and case-study weight scale with the stage Law is taught at. */
export function lawDepth(stage: LawStage | undefined) {
  switch (stage) {
    case 'a_level':
      return {
        label: 'A-Level Law',
        cases: '6',
        factsSentences: '3 to 4',
        caseStudy: '2 paragraphs covering a single incident',
        questions: '3 to 4',
        extra: 'Keep to foundational, frequently cited authorities. Explain each principle in plain terms before naming it. Do not open academic debate or minority judicial opinion at this stage.',
      };
    case 'pre_university':
      return {
        label: 'Pre-University Law',
        cases: '6 to 7',
        factsSentences: '4 to 5',
        caseStudy: '2 to 3 paragraphs, may link two incidents',
        questions: '4',
        extra: 'Introduce one point of academic or judicial disagreement where the topic genuinely contains one, briefly and without assuming prior reading.',
      };
    case 'university':
    case 'llb':
    default:
      return {
        label: stage === 'university' ? 'University Law' : 'LLB',
        cases: '7',
        factsSentences: '4 to 6',
        caseStudy: '3 to 4 paragraphs with multiple linked incidents building over time',
        questions: '5 to 6',
        extra: 'Full degree depth. Engage with competing lines of authority, dissenting judgments and academic critique where they genuinely exist, and mark where the law is unsettled.',
      };
  }
}

function tier4Spec(meta: GenerationMeta, stage: LawStage | undefined): string {
  const d = lawDepth(stage);
  const c = countsFor(meta.generateLevel);
  return `TIER 4 — LAW (${d.label.toUpperCase()})
Law always uses this tier regardless of the stage it is taught at, because real case law and statutes are the substance of the subject at every level.

DEPTH FOR THIS STAGE: ${d.label}. ${d.extra}

LAW SUBJECT STANDARD (applies to the whole lesson)
- Original degree-standard content, freshly composed. No textbook or revision-guide paraphrase.
- Never invent a case or a statute under any circumstance. Every case must be real, reported and accurately cited. Every statutory section must be accurate to the actual wording and numbering of that provision. If you are not certain a citation is correct, choose a different case you are certain of.
- Tone: intellectually honest, academically rigorous and examiner aware. It reflects what markers reward: precise use of authority, clear application to facts, and awareness of academic debate where relevant. Never patronising.
- Do not use hyphens inside sentences; use commas or colons instead. Markdown list markers and case citations are unaffected by this rule.

KEY CASE LAW — exactly ${d.cases} real, reported cases relevant to this topic. Each entry must give, as bullet lines under a numbered heading:
- Case Name and Citation, e.g. Donoghue v Stevenson [1932] AC 562
- Court and Year
- Facts, one flowing paragraph of ${d.factsSentences} sentences
- Held, the decision or outcome in 3 to 4 sentences
- Judge(s), the name or names who delivered the leading judgment
- Ratio Decidendi, the binding principle the case established
- Obiter Dicta, notable non-binding remarks. Omit this line only where genuinely none exist
- Significance, why the case matters to the development of this area of law
- Exam Highlight, one line on how the case is typically tested, for example the case it is commonly compared with or the point students most often misread

KEY STATUTES — include this field only where legislation genuinely governs the topic. Many common law topics have little or no statutory content, and the field should then contain the single line "Not applicable: this topic is governed by common law." rather than padded material. Where included, each entry gives: Statute Name and Citation, Relevant Section(s), the Provision explained in plain terms, the Purpose or mischief it addresses, Key judicial interpretation cross-referenced to the Key Case Law field above, Significance, and Exam Highlight.

CASE STUDY: ${d.caseStudy}. Fictional parties, written to test application of the real authorities above to new facts.
ASSESSMENT: the Case Study replaces the Mock Exam entirely. ${d.questions} numbered structured questions beneath the Case Study, each with its marks stated, escalating from identification and explanation to evaluation and advisory judgement, ending with a stated total.
Problem Q is omitted at this tier because the numbered Case Study questions serve that role.

OUTPUT FORMAT (exact labels, exact order)

**Lesson:** [title]

**Duration:** [ ]

**Bloom's Taxonomy Level:** [one level only]

**Objectives:** [${c.objectives}, separated by " · "]

**Vocabulary:** [${c.vocab} legal terms and any active Latin maxims, comma separated, no inline definitions]

**Mnemonic:** "[one mnemonic specific to this content]"

**Explainer Text:**
[three prose paragraphs, blank line between each]

**Key Case Law:**

### 1. [Case Name and Citation]
- **Court and Year:** [ ]
- **Facts:** [one paragraph, ${d.factsSentences} sentences]
- **Held:** [3 to 4 sentences]
- **Judge(s):** [ ]
- **Ratio Decidendi:** [ ]
- **Obiter Dicta:** [ ]
- **Significance:** [ ]
- **Exam Highlight:** [ ]

[repeat the same block for every case, numbered through to ${d.cases}]

**Key Statutes:**

### [Statute Name and Citation]
- **Relevant Section(s):** [ ]
- **Provision:** [ ]
- **Purpose:** [ ]
- **Key Judicial Interpretation:** [ ]
- **Significance:** [ ]
- **Exam Highlight:** [ ]

[or the single line "Not applicable: this topic is governed by common law."]

**Case Study:** [title] — [${d.caseStudy}]

**Questions:**
1) [ ] (marks)
2) [ ] (marks)
[continue to ${d.questions} questions]
Total: [ ] marks

**Activity:** [one concrete task]

**Assignment:** [one deliverable, separate from the Activity]

**Summary:** [1 to 2 sentences]`;
}

/** Tone line handed to the explainer rules, per tier. */
function toneFor(tier: TierId): string {
  if (tier === 'tier3') {
    return 'practical and workplace-oriented, still polished prose, the way a good professional handbook addresses a working adult.';
  }
  if (tier === 'tier4') {
    return 'academic and examiner aware, the register of a well-written degree-level textbook that respects the reader.';
  }
  return 'authoritative and clear, the way a well-written textbook talks to a student directly. Never casual, never a list of facts, never teacher notes.';
}

function metaBlock(meta: GenerationMeta): string {
  const rows: string[] = [];
  if (meta.programme) rows.push(`Programme: ${meta.programme}`);
  if (meta.subject) rows.push(`Subject: ${meta.subject}`);
  if (meta.yearLevel) rows.push(`Year / Level: ${meta.yearLevel}`);
  if (meta.unit) rows.push(`Unit: ${meta.unit}`);
  if (meta.chapter) rows.push(`Chapter: ${meta.chapter}`);
  if (meta.topic) rows.push(`Topic: ${meta.topic}`);
  rows.push(`Generating: ${meta.generateLevel ?? 'lesson'}`);
  if (meta.priorContent) rows.push(`Build on prior content already covered: ${meta.priorContent}`);
  return rows.length ? `LESSON TO GENERATE\n${rows.join('\n')}` : '';
}

/**
 * The full system+user prompt for a tiered Lesson Full Text generation.
 * `sourceContent` is whatever the author already typed into the lesson (notes,
 * a syllabus extract, a rough draft); it steers the content but never the shape.
 */
export function buildLessonPrompt(
  sel: TierSelection,
  meta: GenerationMeta,
  sourceContent?: string,
  briefPrompt?: string,
): string {
  const tier = TIER_BY_ID[sel.tier] ? sel.tier : 'tier1';
  const spec =
    tier === 'tier4' ? tier4Spec(meta, sel.lawStage)
      : tier === 'tier3' ? tier3Spec(meta, sel.assessmentStyle ?? 'checklist')
        : tier === 'tier2' ? tier2Spec(meta, sel.subjectType ?? 'essay')
          : tier1Spec(meta);

  return [
    ROLE,
    metaBlock(meta),
    CRITICAL_RULES,
    GENERAL_RULES,
    EXPLAINER_RULES(toneFor(tier)),
    spec,
    MARKDOWN_CONTRACT,
    briefPrompt ? `AUTHOR'S BRIEF (follow it wherever it does not conflict with the tier rules above)\n${briefPrompt}` : '',
    sourceContent ? `SOURCE MATERIAL TO BUILD FROM\n${sourceContent}` : '',
    'Produce the lesson now, starting at the first field and stopping at the last.',
  ].filter(Boolean).join('\n\n');
}

/** Student Notes — the condensed revision counterpart to the full lesson. */
export function buildNotesPrompt(
  sel: TierSelection,
  meta: GenerationMeta,
  sourceContent?: string,
): string {
  const lawLine = sel.tier === 'tier4'
    ? '\n- Add a **Key Authorities** field after Key Definitions: one line per leading case, in the form "Case Name [year] — the principle it establishes". Cases must be real and accurately cited, drawn only from the source lesson. Do not use hyphens inside sentences.'
    : '';
  return `ROLE
You are an expert educator condensing curriculum content into concise, high-quality revision notes for recall and review, not for first-time learning.

${metaBlock(meta)}

RULES
- Base the notes on the source lesson below. Condense and rephrase; never copy its sentences.
- No exam board, publisher, or curriculum brand names anywhere.
- No case studies, activities or assignments. Notes are for recall.
- Match vocabulary and phrasing to the stated Year/Level.
- A student must be able to review this in under three minutes.

FORMAT
- Bullet points only. No flowing paragraphs, no multi-sentence explanations.
- One fact, definition or idea per bullet, maximum one short sentence.
- Bold every key term the first time it appears.
- State the fact directly. No "why it matters" narrative.
- Field order: **Key Points:** (3 to 5 bullets) → **Key Definitions:** (term: one-line definition) → **Mnemonic:** (reuse the source lesson's mnemonic unchanged) → **One Example:** (one line) → **Quick-Check Question:** (one short recall question, no answer given).${lawLine}
- Reply in GitHub-flavoured Markdown with nothing before the first field or after the last.

SOURCE LESSON TO CONDENSE
${sourceContent ?? ''}`;
}

/* ── Parsing the generated markdown back into fields ────────── */

export interface CaseLawEntry {
  name: string;
  court?: string;
  facts?: string;
  held?: string;
  judges?: string;
  ratio?: string;
  obiter?: string;
  significance?: string;
  examHighlight?: string;
}

export interface StatuteEntry {
  name: string;
  sections?: string;
  provision?: string;
  purpose?: string;
  interpretation?: string;
  significance?: string;
  examHighlight?: string;
}

/**
 * A tier-agnostic parsed lesson. Every field is optional: the CMS renders only
 * what the chosen tier produced, so one Firestore map covers all four tiers
 * without a schema migration per tier.
 */
export interface LessonPack {
  tier: TierId;
  subjectType?: Tier2SubjectType;
  lawStage?: LawStage;
  assessmentStyle?: Tier3Assessment;
  title?: string;
  duration?: string;
  blooms?: string;
  objectives?: string[];
  vocabulary?: string[];
  mnemonic?: string;
  explainer?: string;
  caseStudy?: string;
  practicalBrief?: string;
  deliverable?: string;
  activity?: string;
  assignment?: string;
  summary?: string;
  mockExam?: string[];
  questions?: string[];
  /** The "Total: N marks" line the tier's question list ends with. */
  totalMarks?: string;
  problemQ?: string;
  competencyChecklist?: string[];
  rubric?: { criteria: string; weighting: string; description: string }[];
  stretchTask?: string;
  keyCaseLaw?: CaseLawEntry[];
  keyStatutes?: StatuteEntry[];
  /** The raw markdown, always kept so nothing generated is ever lost. */
  raw: string;
}

/** Field labels the model is told to emit, mapped to LessonPack keys. */
const LABEL_MAP: Record<string, keyof LessonPack> = {
  'lesson': 'title', 'module': 'title', 'title': 'title',
  'duration': 'duration',
  "bloom's taxonomy level": 'blooms', 'blooms taxonomy level': 'blooms', "bloom's level": 'blooms',
  'objectives': 'objectives',
  'vocabulary': 'vocabulary',
  'mnemonic': 'mnemonic',
  'explainer text': 'explainer',
  'case study': 'caseStudy', 'case study / structured problem': 'caseStudy',
  'structured problem': 'caseStudy',
  'practical brief': 'practicalBrief',
  'deliverable': 'deliverable',
  'activity': 'activity',
  'assignment': 'assignment',
  'summary': 'summary',
  'mock exam': 'mockExam',
  'questions': 'questions',
  'problem q': 'problemQ',
  'competency checklist': 'competencyChecklist',
  'assessment rubric': 'rubric', 'rubric': 'rubric',
  'stretch task': 'stretchTask',
  'key case law': 'keyCaseLaw',
  'key statutes': 'keyStatutes',
};

const stripMd = (s: string) => s.replace(/\*\*/g, '').trim();

/** Split a markdown body into `{label -> content}` on bold "**Label:**" lines. */
function splitLabelledFields(md: string): { key: keyof LessonPack; body: string }[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: { key: keyof LessonPack; body: string }[] = [];
  let current: { key: keyof LessonPack; body: string[] } | null = null;

  for (const line of lines) {
    // "**Case Study:** Something" or "## **Case Study:**" or "**Case Study**:"
    const m = line.match(/^\s*#{0,4}\s*\*\*\s*([A-Za-z'’()\/ ]{2,42}?)\s*:?\s*\*\*\s*:?\s*(.*)$/);
    const key = m ? LABEL_MAP[m[1].trim().toLowerCase().replace(/’/g, "'")] : undefined;
    if (m && key) {
      if (current) out.push({ key: current.key, body: current.body.join('\n').trim() });
      current = { key, body: m[2] ? [m[2]] : [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) out.push({ key: current.key, body: current.body.join('\n').trim() });
  return out;
}

const splitList = (body: string): string[] => {
  const bulletLines = body.split('\n')
    .map(l => l.replace(/^\s*(?:[-*+]|\d+[).])\s*(?:\[[ x]\]\s*)?/, '').trim())
    .filter(Boolean);
  const looksBulleted = /^\s*(?:[-*+]|\d+[).])/m.test(body);
  if (looksBulleted) return bulletLines;
  return body.split(/\s*·\s*|\s*;\s*|\s*,\s*/).map(s => s.trim()).filter(Boolean);
};

/** Pull "- **Label:** value" pairs out of one structured entry block. */
function entryFields(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key = '';
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*[-*+]?\s*\*\*\s*([^:*]{2,40}?)\s*:?\s*\*\*\s*:?\s*(.*)$/);
    if (m) {
      key = m[1].trim().toLowerCase().replace(/’/g, "'");
      out[key] = m[2].trim();
    } else if (key && line.trim()) {
      out[key] = `${out[key]} ${line.trim()}`.trim();
    }
  }
  return out;
}

function parseCaseLaw(body: string): CaseLawEntry[] {
  const blocks = body.split(/\n(?=\s*(?:#{2,4}\s*)?\d+[.)]\s+)|\n(?=\s*#{2,4}\s+)/)
    .map(b => b.trim()).filter(Boolean);
  const entries: CaseLawEntry[] = [];
  for (const block of blocks) {
    const headLine = block.split('\n')[0] ?? '';
    const name = stripMd(headLine.replace(/^\s*#{2,4}\s*/, '').replace(/^\d+[.)]\s*/, ''));
    if (!name) continue;
    const f = entryFields(block);
    const pick = (...keys: string[]) => keys.map(k => f[k]).find(Boolean);
    entries.push({
      name,
      court: pick('court and year', 'court', 'year'),
      facts: pick('facts'),
      held: pick('held', 'decision'),
      judges: pick('judge(s)', 'judges', 'judge'),
      ratio: pick('ratio decidendi', 'ratio'),
      obiter: pick('obiter dicta', 'obiter'),
      significance: pick('significance'),
      examHighlight: pick('exam highlight'),
    });
  }
  return entries;
}

function parseStatutes(body: string): StatuteEntry[] {
  if (/^\s*not applicable/i.test(body)) return [];
  const blocks = body
    .split(/\n(?=\s*#{2,4}\s+)|\n(?=\s*\d+[.)]\s+)/)
    .map(b => b.trim())
    .filter(Boolean);
  const entries: StatuteEntry[] = [];
  for (const block of blocks) {
    const headLine = block.split('\n')[0] ?? '';
    const name = stripMd(headLine.replace(/^\s*#{2,4}\s*/, '').replace(/^\d+[.)]\s*/, ''));
    // A statute head always carries its year; anything else is stray prose.
    if (!name || !/\d{4}/.test(name)) continue;
    const f = entryFields(block);
    const pick = (...keys: string[]) => keys.map(k => f[k]).find(Boolean);
    entries.push({
      name,
      sections: pick('relevant section(s)', 'relevant sections', 'section(s)', 'sections'),
      provision: pick('provision'),
      purpose: pick('purpose', 'purpose or mischief'),
      interpretation: pick('key judicial interpretation', 'judicial interpretation'),
      significance: pick('significance'),
      examHighlight: pick('exam highlight'),
    });
  }
  return entries;
}

function parseRubric(body: string): { criteria: string; weighting: string; description: string }[] {
  return body.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && !/^\|[\s|:-]+\|$/.test(l))
    .map(l => l.split('|').map(c => stripMd(c)).filter((_, i, arr) => i > 0 && i < arr.length - 1))
    .filter(cells => cells.length >= 3 && !/^criteria$/i.test(cells[0]))
    .map(cells => ({ criteria: cells[0], weighting: cells[1], description: cells[2] }));
}

/**
 * Parse a generated lesson back into structured fields. Parsing never throws
 * and never loses content: `raw` always holds the original markdown, so a
 * partial parse degrades to "render the markdown" rather than to an error.
 */
export function parseLessonPack(markdown: string, sel: TierSelection): LessonPack {
  const raw = String(markdown ?? '').trim();
  const pack: LessonPack = {
    tier: sel.tier, subjectType: sel.subjectType, lawStage: sel.lawStage,
    assessmentStyle: sel.assessmentStyle, raw,
  };

  for (const { key, body } of splitLabelledFields(raw)) {
    if (!body) continue;
    switch (key) {
      case 'objectives':
      case 'vocabulary':
      case 'competencyChecklist':
        (pack[key] as string[]) = splitList(body);
        break;
      case 'mockExam':
      case 'questions': {
        // The tiers end a question list with "Total: N marks"; that is the
        // paper's total, not a question, so it gets its own field.
        const items = splitList(body);
        const total = items.find(i => /^total\s*[:\-–]/i.test(i));
        if (total) pack.totalMarks = total.replace(/^total\s*[:\-–]\s*/i, '').trim();
        (pack[key] as string[]) = items.filter(i => !/^total\s*[:\-–]/i.test(i));
        break;
      }
      case 'keyCaseLaw':
        pack.keyCaseLaw = parseCaseLaw(body);
        break;
      case 'keyStatutes':
        pack.keyStatutes = parseStatutes(body);
        break;
      case 'rubric':
        pack.rubric = parseRubric(body);
        break;
      case 'mnemonic':
        pack.mnemonic = body.replace(/^["“]|["”]$/g, '').trim();
        break;
      default:
        (pack[key] as string) = body;
    }
  }
  return pack;
}

/**
 * Which required fields the tier expects but the generation did not produce.
 * The CMS shows these as a warning so an admin never publishes a half lesson.
 */
export function missingFields(pack: LessonPack): string[] {
  const required: Partial<Record<TierId, (keyof LessonPack)[]>> = {
    tier1: ['title', 'blooms', 'objectives', 'vocabulary', 'mnemonic', 'explainer', 'caseStudy', 'activity', 'assignment', 'summary', 'mockExam', 'problemQ'],
    tier2: ['title', 'blooms', 'objectives', 'vocabulary', 'mnemonic', 'explainer', 'caseStudy', 'questions', 'activity', 'assignment', 'summary', 'problemQ'],
    tier3: ['title', 'blooms', 'objectives', 'vocabulary', 'mnemonic', 'explainer', 'practicalBrief', 'activity', 'deliverable', 'assignment', 'summary', 'stretchTask'],
    tier4: ['title', 'blooms', 'objectives', 'vocabulary', 'mnemonic', 'explainer', 'keyCaseLaw', 'caseStudy', 'questions', 'activity', 'assignment', 'summary'],
  };
  const list = required[pack.tier] ?? required.tier1!;
  if (pack.tier === 'tier3') {
    list.push(pack.assessmentStyle === 'rubric' ? 'rubric' : 'competencyChecklist');
  }
  const labels: Partial<Record<keyof LessonPack, string>> = {
    title: 'Title', blooms: "Bloom's Level", objectives: 'Objectives', vocabulary: 'Vocabulary',
    mnemonic: 'Mnemonic', explainer: 'Explainer Text', caseStudy: 'Case Study',
    practicalBrief: 'Practical Brief', deliverable: 'Deliverable', activity: 'Activity',
    assignment: 'Assignment', summary: 'Summary', mockExam: 'Mock Exam', questions: 'Questions',
    problemQ: 'Problem Q', competencyChecklist: 'Competency Checklist', rubric: 'Rubric',
    stretchTask: 'Stretch Task', keyCaseLaw: 'Key Case Law',
  };
  return list
    .filter(k => {
      const v = pack[k];
      return v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');
    })
    .map(k => labels[k] ?? String(k));
}
