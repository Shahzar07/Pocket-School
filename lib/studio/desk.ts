/**
 * ET AI Studio desk tools: Teacher Toolkit, Parent Explainer, Research Helper.
 * Pure decisions live here. Firestore, Sparks, and the model stay in the route.
 */

import { hasAccountRole, type RoleSource } from '../account-modes';
import { isTeacherOrAdmin } from '../roles';
import { isEssayShaped } from '../essays/plan';

export type DeskToolId = 'teacher-toolkit' | 'parent-explainer' | 'research-helper';

export const DESK_TOOLS: readonly DeskToolId[] = [
  'teacher-toolkit',
  'parent-explainer',
  'research-helper',
];

export const DESK_SPARK_COSTS: Record<DeskToolId, number> = {
  'teacher-toolkit': 15,
  'parent-explainer': 8,
  'research-helper': 10,
};

export const TOOLKIT_KINDS = [
  { id: 'pack', label: 'Full pack' },
  { id: 'lesson-plan', label: 'Lesson plan' },
  { id: 'worksheet', label: 'Worksheet' },
  { id: 'rubric', label: 'Rubric' },
  { id: 'differentiated', label: 'Differentiated task' },
  { id: 'exit-ticket', label: 'Exit ticket' },
] as const;

export type ToolkitKind = (typeof TOOLKIT_KINDS)[number]['id'];

export const RESEARCH_INTEGRITY =
  'ET AI finds and summarises trustworthy sources, with citations and a note on how credible each one is. It never writes the assignment, the essay, or the answers. You write the work.';

export interface TeacherPack {
  title: string;
  subject: string;
  level: string;
  kind: ToolkitKind;
  objectives: string[];
  lessonPlan: { starter: string; main: string[]; plenary: string };
  worksheet: { instructions: string; tasks: string[] };
  rubric: { criterion: string; support: string; core: string; stretch: string }[];
  differentiated: { task: string; support: string; core: string; stretch: string };
  exitTicket: string[];
  teacherNotes: string;
}

export interface ResearchSource {
  title: string;
  authors: string;
  url: string;
  summary: string;
  credibility: string;
  citations: { apa: string; harvard: string; mla: string };
}

export interface ResearchPack {
  question: string;
  integrity: string;
  sources: ResearchSource[];
  nextSteps: string[];
  refusedWriting: boolean;
}

export interface ChildActivityFacts {
  childName: string;
  studyMinutes: number | null;
  quizAverage: number | null;
  mastery: number | null;
  lessonsCompleted: number | null;
  goalsMet: number | null;
  goalsMissed: number | null;
  strengths: string[];
  gaps: string[];
  courses: { label: string; progress: number }[];
  goalTitles: string[];
  misconceptions: string[];
  /** Badge names already awarded. Empty when none are saved. */
  badges: string[];
}

export interface ParentExplainer {
  childName: string;
  language: string;
  learned: string;
  strengths: string;
  gaps: string;
  helpAtHome: string[];
  empty: boolean;
  badges: string[];
}

const WRITE_REQUEST = /\b(write|draft|complete|do|finish)\b[\s\S]{0,40}\b(my |the |an |this )?(essay|assignment|coursework|answer|paragraphs?)\b/i;
const WRITES_THE_WORK = /\b(in conclusion|model answer|your essay|the assignment|completed essay|hand (it|this) in)\b/i;

function writesTheWork(value: string): boolean {
  return WRITE_REQUEST.test(value) || WRITES_THE_WORK.test(value) || isEssayShaped(value);
}

export function isDeskTool(value: string | null | undefined): value is DeskToolId {
  return value === 'teacher-toolkit' || value === 'parent-explainer' || value === 'research-helper';
}

export function isToolkitKind(value: string | null | undefined): value is ToolkitKind {
  return TOOLKIT_KINDS.some(kind => kind.id === value);
}

/** Teachers and institution staff. Admin accounts can draft courses too. */
export function canUseTeacherToolkit(source: RoleSource | null | undefined): boolean {
  return isTeacherOrAdmin(source);
}

/** Parents only. A teacher account does not see a child's week unless it also holds parent. */
export function canUseParentExplainer(source: RoleSource | null | undefined): boolean {
  return hasAccountRole(source, 'parent');
}

/** Students and teachers. Parents are not included unless they also hold one of those roles. */
export function canUseResearchHelper(source: RoleSource | null | undefined): boolean {
  return hasAccountRole(source, 'student') || hasAccountRole(source, 'teacher');
}

export function canUseDeskTool(source: RoleSource | null | undefined, tool: DeskToolId): boolean {
  if (tool === 'teacher-toolkit') return canUseTeacherToolkit(source);
  if (tool === 'parent-explainer') return canUseParentExplainer(source);
  return canUseResearchHelper(source);
}

export function ownsChild(childIds: readonly string[] | null | undefined, childId: string): boolean {
  const id = childId.trim();
  if (!id) return false;
  return (childIds ?? []).includes(id);
}

export function deskSparkCost(tool: DeskToolId): number {
  return DESK_SPARK_COSTS[tool];
}

/** Drop school-year labels and calendar years from teacher and parent prose. */
export function stripYearLabels(text: string): string {
  return text
    .replace(/\bYear\s+\d{1,2}\b(?:\s*\([^)]*\))?/gi, '')
    .replace(/\b20\d{2}\b/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function brandVoice(text: string): string {
  return stripYearLabels(
    text
      .replace(/\b(ChatGPT|OpenAI|Claude|Gemini|GPT-?\d+)\b/gi, 'ET AI')
      .replace(/\bPocket School\b/g, 'Poket School'),
  );
}

function clipWords(value: string, max: number): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, max).join(' ');
}

function asString(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function asList(value: unknown, maxItems: number, maxWords: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => clipWords(asString(item, 400), maxWords))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function numbersIn(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

/** Every number in the prose must already be in the source facts. */
export function proseKeepsFacts(prose: string, source: string): boolean {
  const allowed = new Set(numbersIn(source));
  return numbersIn(prose).every(value => allowed.has(value));
}

function cleanProse(value: string): string {
  return brandVoice(value).replace(/\s+/g, ' ').trim();
}

export function teacherFallback(input: {
  topic: string;
  subject: string;
  level: string;
  kind: ToolkitKind;
}): TeacherPack {
  const topic = cleanProse(input.topic) || 'the topic';
  const subject = cleanProse(input.subject) || 'General';
  const level = cleanProse(input.level) || 'the programme';
  const task = `Explain ${topic} with one example a learner can check.`;
  return {
    title: `${topic}`,
    subject,
    level,
    kind: input.kind,
    objectives: [
      `Describe ${topic} in their own words.`,
      `Use one correct example of ${topic}.`,
      `Say where a simple explanation of ${topic} stops being enough.`,
    ],
    lessonPlan: {
      starter: `Ask what the class already knows about ${topic}. Collect three ideas on the board.`,
      main: [
        `Teach ${topic} with one worked example. Pause for a pair to retell the example.`,
        `The class tries the same task. Move around and note who needs the support version.`,
      ],
      plenary: `Exit ticket: one sentence on ${topic}, then one thing that is still unclear.`,
    },
    worksheet: {
      instructions: `Same task for everyone: ${task} The support, core, and stretch versions change the help, not the task.`,
      tasks: [
        `Name the idea in ${topic}.`,
        `Show one example and say what it proves.`,
        `Mark the point where the example would fail.`,
      ],
    },
    rubric: [
      {
        criterion: 'Idea',
        support: 'Names the idea with a prompt or a word bank.',
        core: 'Names the idea in their own words.',
        stretch: 'Names the idea and the limit of that wording.',
      },
      {
        criterion: 'Example',
        support: 'Uses a given example correctly.',
        core: 'Chooses an example and explains it.',
        stretch: 'Chooses an example and says what would change the conclusion.',
      },
    ],
    differentiated: {
      task,
      support: `Support, including SEN: the task is still "${task}" A word bank, a sentence starter, and a worked first line are on the sheet. A teaching assistant can read the task aloud.`,
      core: `Core: the learner completes "${task}" with no extra scaffold, in full sentences.`,
      stretch: `Stretch: the learner completes the same task, then adds where the explanation of ${topic} would fail.`,
    },
    exitTicket: [
      `In one sentence, what is ${topic}?`,
      'What is one thing you can now do that you could not do at the start?',
      'What should the next lesson clear up?',
    ],
    teacherNotes: `Draft from ET AI at Poket School for ${subject}, ${level}. Read it before you publish. The three versions are the same task.`,
  };
}

function rubricRow(value: unknown): TeacherPack['rubric'][number] | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const criterion = cleanProse(asString(row.criterion, 120));
  if (!criterion) return null;
  return {
    criterion,
    support: cleanProse(asString(row.support, 300)) || 'Names the idea with a prompt.',
    core: cleanProse(asString(row.core, 300)) || 'Explains the idea in their own words.',
    stretch: cleanProse(asString(row.stretch, 300)) || 'Explains the idea and its limit.',
  };
}

export function acceptTeacherPack(
  raw: unknown,
  input: { topic: string; subject: string; level: string; kind: ToolkitKind },
): TeacherPack {
  const fallback = teacherFallback(input);
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const lesson = record.lessonPlan && typeof record.lessonPlan === 'object'
    ? record.lessonPlan as Record<string, unknown>
    : {};
  const worksheet = record.worksheet && typeof record.worksheet === 'object'
    ? record.worksheet as Record<string, unknown>
    : {};
  const differentiated = record.differentiated && typeof record.differentiated === 'object'
    ? record.differentiated as Record<string, unknown>
    : {};
  const rubric = Array.isArray(record.rubric)
    ? record.rubric.map(rubricRow).filter((row): row is TeacherPack['rubric'][number] => row !== null).slice(0, 6)
    : [];
  const task = cleanProse(asString(differentiated.task, 300)) || fallback.differentiated.task;
  const pack: TeacherPack = {
    title: cleanProse(asString(record.title, 140)) || fallback.title,
    subject: cleanProse(asString(record.subject, 80)) || fallback.subject,
    level: cleanProse(asString(record.level, 80)) || fallback.level,
    kind: input.kind,
    objectives: asList(record.objectives, 5, 30).map(cleanProse).filter(Boolean),
    lessonPlan: {
      starter: cleanProse(asString(lesson.starter, 400)) || fallback.lessonPlan.starter,
      main: asList(lesson.main, 4, 40).map(cleanProse).filter(Boolean),
      plenary: cleanProse(asString(lesson.plenary, 400)) || fallback.lessonPlan.plenary,
    },
    worksheet: {
      instructions: cleanProse(asString(worksheet.instructions, 400)) || fallback.worksheet.instructions,
      tasks: asList(worksheet.tasks, 6, 30).map(cleanProse).filter(Boolean),
    },
    rubric: rubric.length ? rubric : fallback.rubric,
    differentiated: {
      task,
      support: cleanProse(asString(differentiated.support, 500)) || fallback.differentiated.support,
      core: cleanProse(asString(differentiated.core, 500)) || fallback.differentiated.core,
      stretch: cleanProse(asString(differentiated.stretch, 500)) || fallback.differentiated.stretch,
    },
    exitTicket: asList(record.exitTicket, 4, 30).map(cleanProse).filter(Boolean),
    teacherNotes: cleanProse(asString(record.teacherNotes, 500)) || fallback.teacherNotes,
  };
  if (!pack.objectives.length) pack.objectives = fallback.objectives;
  if (!pack.lessonPlan.main.length) pack.lessonPlan.main = fallback.lessonPlan.main;
  if (!pack.worksheet.tasks.length) pack.worksheet.tasks = fallback.worksheet.tasks;
  if (!pack.exitTicket.length) pack.exitTicket = fallback.exitTicket;
  return pack;
}

export function teacherPrompt(input: {
  topic: string;
  subject: string;
  level: string;
  kind: ToolkitKind;
}): string {
  return [
    'You are ET AI at Poket School. Return JSON only.',
    'Write a teacher pack. Do not name another product. Do not write a school year or a calendar year.',
    'The support, core, and stretch versions are the SAME task. Support includes SEN: word bank, sentence starter, and a note that the task can be read aloud. Do not give support a different question.',
    'kind tells you which section to write in full. Still include every key.',
    'Keys: title, subject, level, objectives (string[]), lessonPlan {starter, main string[], plenary}, worksheet {instructions, tasks string[]}, rubric [{criterion, support, core, stretch}], differentiated {task, support, core, stretch}, exitTicket (string[]), teacherNotes.',
    `Subject: ${input.subject}`,
    `Programme: ${input.level}`,
    `Focus: ${input.kind}`,
    `Topic: ${input.topic}`,
  ].join('\n');
}

const ASSIGNMENT_LINE = 'This line was removed because it started to write the assignment. Read the source and write the work yourself.';

function citationFrom(source: { authors: string; title: string; url: string }, style: 'apa' | 'harvard' | 'mla'): string {
  const authors = source.authors || 'Author unknown';
  const title = source.title || 'Untitled source';
  const url = source.url || 'No address given. Check the source before you cite it.';
  if (style === 'apa') return `${authors}. ${title}. ${url}`;
  if (style === 'harvard') return `${authors}, ${title}. Available at: ${url}`;
  return `${authors}. "${title}." ${url}`;
}

function sourceFrom(value: unknown): ResearchSource | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const title = asString(row.title, 180);
  if (!title) return null;
  const authors = asString(row.authors, 160) || 'Author unknown';
  const url = asString(row.url, 300);
  const original = typeof row.summary === 'string' ? row.summary.trim() : '';
  const summary = !original || writesTheWork(original)
    ? ASSIGNMENT_LINE
    : clipWords(asString(original, 1200), 60);
  const credibility = asString(row.credibility, 280)
    || 'Check who published this, when it was updated, and whether it cites its own evidence before you rely on it.';
  const citations = row.citations && typeof row.citations === 'object'
    ? row.citations as Record<string, unknown>
    : {};
  const base = { authors, title, url };
  return {
    title,
    authors,
    url,
    summary,
    credibility: clipWords(credibility, 40),
    citations: {
      apa: asString(citations.apa, 400) || citationFrom(base, 'apa'),
      harvard: asString(citations.harvard, 400) || citationFrom(base, 'harvard'),
      mla: asString(citations.mla, 400) || citationFrom(base, 'mla'),
    },
  };
}

export function researchQuestion(raw: string): { question: string; refusedWriting: boolean } {
  const question = raw.replace(/\s+/g, ' ').trim().slice(0, 500);
  const refusedWriting = WRITE_REQUEST.test(question);
  const topic = question
    .replace(WRITE_REQUEST, ' ')
    .replace(/\b(please|for me|in full)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    question: refusedWriting ? (topic || question) : question,
    refusedWriting,
  };
}

export function acceptResearchPack(raw: unknown, asked: { question: string; refusedWriting: boolean }): ResearchPack | null {
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const sources = Array.isArray(record.sources)
    ? record.sources.map(sourceFrom).filter((item): item is ResearchSource => item !== null).slice(0, 6)
    : [];
  if (!sources.length) return null;
  const steps = asList(record.nextSteps, 4, 24).filter(step => !writesTheWork(step));
  return {
    question: asked.question,
    integrity: RESEARCH_INTEGRITY,
    sources,
    nextSteps: steps.length ? steps : [
      'Read one source and note the claim you might use.',
      'Check the credibility note before you quote it.',
      'Write the assignment yourself. This pack is not a draft.',
    ],
    refusedWriting: asked.refusedWriting,
  };
}

export function researchPrompt(question: string): string {
  return [
    'You are ET AI at Poket School. Return JSON only.',
    RESEARCH_INTEGRITY,
    'Do not write the assignment, an introduction, a conclusion, or a model answer.',
    'Each source summary is at most 60 words and describes the source. It is not the student\'s paragraph.',
    'If you are not sure a source is real, leave url empty and say so in credibility. Do not invent a quotation.',
    'Keys: sources [{title, authors, url, summary, credibility, citations: {apa, harvard, mla}}], nextSteps (string[], how to use the sources, not the essay).',
    `Question the student is researching: ${question}`,
  ].join('\n');
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim()).slice(0, max);
}

/** Read a stored analytics snapshot. Missing fields stay null. Nothing is invented. */
export function factsFromSnapshot(
  childName: string,
  snapshot: Record<string, unknown> | null | undefined,
  goalTitles: string[] = [],
  badgeNames: string[] = [],
): ChildActivityFacts {
  const metrics = snapshot?.metrics && typeof snapshot.metrics === 'object'
    ? snapshot.metrics as Record<string, unknown>
    : {};
  const courses = Array.isArray(snapshot?.courseProgress)
    ? snapshot.courseProgress.flatMap(row => {
      if (!row || typeof row !== 'object') return [];
      const item = row as Record<string, unknown>;
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      const progress = numOrNull(item.progress);
      if (!label || progress === null) return [];
      return [{ label, progress }];
    }).slice(0, 6)
    : [];
  const misconceptions = Array.isArray(snapshot?.misconceptions)
    ? snapshot.misconceptions.flatMap(row => {
      if (!row || typeof row !== 'object') return [];
      const item = row as Record<string, unknown>;
      const topic = typeof item.topic === 'string' ? item.topic.trim() : '';
      return topic ? [topic] : [];
    }).slice(0, 5)
    : [];
  return {
    childName: childName.trim() || 'Your child',
    studyMinutes: numOrNull(metrics.study_time),
    quizAverage: numOrNull(metrics.quiz_average),
    mastery: numOrNull(metrics.mastery),
    lessonsCompleted: numOrNull(metrics.lessons_completed) ?? numOrNull(snapshot?.lessonsCompleted),
    goalsMet: numOrNull(snapshot?.goalsMet),
    goalsMissed: numOrNull(snapshot?.goalsMissed),
    strengths: stringList(snapshot?.strengths, 5),
    gaps: stringList(snapshot?.weaknesses, 5),
    courses,
    goalTitles: goalTitles.map(title => title.trim()).filter(Boolean).slice(0, 6),
    misconceptions,
    badges: (badgeNames.length ? badgeNames : stringList(snapshot?.badges, 8)).slice(0, 8),
  };
}

export function hasChildActivity(facts: ChildActivityFacts): boolean {
  if (facts.studyMinutes || facts.quizAverage !== null || facts.mastery !== null) return true;
  if (facts.lessonsCompleted || facts.goalsMet || facts.goalsMissed) return true;
  return facts.strengths.length + facts.gaps.length + facts.courses.length + facts.goalTitles.length + facts.misconceptions.length + facts.badges.length > 0;
}

function joinList(items: string[]): string {
  if (!items.length) return '';
  if (items.length === 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function parentExplainerFromFacts(facts: ChildActivityFacts): ParentExplainer {
  const name = facts.childName || 'Your child';
  if (!hasChildActivity(facts)) {
    return {
      childName: name,
      language: 'en',
      learned: `${name} has no saved activity for this week. ET AI will not guess what they learned.`,
      strengths: 'Nothing is saved yet, so there is no strength to report.',
      gaps: 'Nothing is saved yet, so there is no gap to report.',
      helpAtHome: ['Ask them what they opened in Poket School, then check again after they study.'],
      empty: true,
      badges: facts.badges,
    };
  }
  const learnedBits: string[] = [];
  if (facts.studyMinutes) learnedBits.push(`${facts.studyMinutes} minutes of study`);
  if (facts.lessonsCompleted) learnedBits.push(`${facts.lessonsCompleted} lessons finished`);
  if (facts.goalTitles.length) learnedBits.push(`work on ${joinList(facts.goalTitles)}`);
  if (facts.courses.length) {
    learnedBits.push(facts.courses.map(course => `${course.label} at ${course.progress}%`).join('; '));
  }
  if (facts.badges.length) learnedBits.push(`badges ${joinList(facts.badges)}`);
  const learned = learnedBits.length
    ? `This week ${name} has ${learnedBits.join(', ')}.`
    : `${name} has saved activity, but the weekly totals are still thin.`;
  const strengths = facts.strengths.length
    ? `${name} is stronger in ${joinList(facts.strengths)}${facts.quizAverage !== null ? `. Quiz average is ${facts.quizAverage}%` : ''}${facts.mastery !== null ? `, and mastery is ${facts.mastery}%` : ''}.`
    : facts.quizAverage !== null
      ? `Quiz average is ${facts.quizAverage}%.`
      : 'No strength is marked in the saved totals yet.';
  const gapBits = [...facts.gaps, ...facts.misconceptions];
  const gaps = gapBits.length
    ? `The saved gaps are ${joinList(gapBits)}${facts.goalsMissed ? `. ${facts.goalsMissed} goals were missed` : ''}.`
    : facts.goalsMissed
      ? `${facts.goalsMissed} goals were missed.`
      : 'No gap is marked in the saved totals yet.';
  const help = [
    facts.gaps[0] ? `Spend ten quiet minutes on ${facts.gaps[0]}. Ask ${name} to teach you one step.` : `Ask ${name} to teach you one thing they finished.`,
    facts.goalTitles[0] ? `Look at the goal "${facts.goalTitles[0]}" together and tick the next small step.` : 'Open their goals and pick one thing for the next study sitting.',
  ];
  return {
    childName: name,
    language: 'en',
    learned: cleanProse(learned),
    strengths: cleanProse(strengths),
    gaps: cleanProse(gaps),
    helpAtHome: help.map(cleanProse),
    empty: false,
    badges: facts.badges,
  };
}

export function parentFactText(explainer: ParentExplainer): string {
  return [explainer.learned, explainer.strengths, explainer.gaps, ...explainer.helpAtHome, ...explainer.badges].join('\n');
}

export function acceptParentTranslation(
  modelText: string,
  explainer: ParentExplainer,
  languageName: string,
): ParentExplainer {
  const source = parentFactText(explainer);
  const cleaned = brandVoice(modelText);
  if (!cleaned || !proseKeepsFacts(cleaned, source) || isEssayShaped(cleaned)) return explainer;
  const parts = cleaned.split(/\n+/).map(part => part.trim()).filter(Boolean);
  if (parts.length < 4) return explainer;
  return {
    ...explainer,
    language: languageName,
    learned: parts[0] ?? explainer.learned,
    strengths: parts[1] ?? explainer.strengths,
    gaps: parts[2] ?? explainer.gaps,
    helpAtHome: parts.slice(3, 6),
  };
}

export function parentTranslatePrompt(explainer: ParentExplainer, languageName: string): string {
  return [
    `You are ET AI at Poket School. Rewrite the note below in ${languageName}.`,
    'Use only the facts given. Do not add a number, a topic, a grade, or a school year.',
    'Reply as four or more short paragraphs separated by blank lines: what they learned, strengths, gaps, then one paragraph per way to help at home.',
    'Do not write an essay.',
    parentFactText(explainer),
  ].join('\n\n');
}

export function toolkitLines(pack: TeacherPack): string[] {
  return [
    `${pack.subject} · ${pack.level}`,
    '',
    'Objectives',
    ...pack.objectives.map(item => `• ${item}`),
    '',
    'Lesson plan',
    `Starter: ${pack.lessonPlan.starter}`,
    ...pack.lessonPlan.main.map(item => `• ${item}`),
    `Plenary: ${pack.lessonPlan.plenary}`,
    '',
    'Worksheet',
    pack.worksheet.instructions,
    ...pack.worksheet.tasks.map(item => `• ${item}`),
    '',
    'Same task, three versions',
    `Task: ${pack.differentiated.task}`,
    `Support (SEN): ${pack.differentiated.support}`,
    `Core: ${pack.differentiated.core}`,
    `Stretch: ${pack.differentiated.stretch}`,
    '',
    'Rubric',
    ...pack.rubric.flatMap(row => [
      row.criterion,
      `Support: ${row.support}`,
      `Core: ${row.core}`,
      `Stretch: ${row.stretch}`,
    ]),
    '',
    'Exit ticket',
    ...pack.exitTicket.map(item => `• ${item}`),
    '',
    'Teacher notes',
    pack.teacherNotes,
  ];
}

export function explainerLines(explainer: ParentExplainer): string[] {
  return [
    `Weekly note for ${explainer.childName}`,
    '',
    'What they learned',
    explainer.learned,
    '',
    'Strengths',
    explainer.strengths,
    '',
    'Gaps',
    explainer.gaps,
    '',
    'How to help at home',
    ...explainer.helpAtHome.map(item => `• ${item}`),
    ...(explainer.badges.length ? ['', 'Badges', ...explainer.badges.map(item => `• ${item}`)] : []),
  ];
}

export function researchLines(pack: ResearchPack): string[] {
  return [
    pack.integrity,
    '',
    `Research question: ${pack.question}`,
    '',
    ...pack.sources.flatMap((source, index) => [
      `${index + 1}. ${source.title}`,
      `Authors: ${source.authors}`,
      source.url ? `Address: ${source.url}` : 'Address: not given. Check the source before you cite it.',
      `Summary: ${source.summary}`,
      `Credibility: ${source.credibility}`,
      `APA: ${source.citations.apa}`,
      `Harvard: ${source.citations.harvard}`,
      `MLA: ${source.citations.mla}`,
      '',
    ]),
    'What to do next',
    ...pack.nextSteps.map(item => `• ${item}`),
  ];
}

export function toolkitLessonBody(pack: TeacherPack): string {
  return toolkitLines(pack).join('\n');
}
