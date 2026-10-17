/**
 * Idea-to-book tools for the existing Book Studio.
 * Every category can start from one line. The desk shows the tools that
 * category actually uses. The writing tools do not set a price. A new book
 * starts at the shared buy-to-own default, and the author can change it.
 */

import type {
  AgeRating, Book, BookCategory, BookChapter, BookCraft, BookForm, ReadingLevel, SceneCard, StoryCharacter,
} from '@/lib/reads/types';
import { LANGUAGES } from '@/lib/languages';
import { BRAND_COVER } from '@/lib/reads/cover';
import { seedPricing } from '@/lib/pricing';
import { storedBookPriceRM } from '@/lib/platform/pricing';
import { chapterPlain } from '@/lib/reads/book-export';

export type CraftTool = 'characters' | 'world' | 'plot' | 'syllabus' | 'glossary' | 'references' | 'quiz' | 'exercises';

export type StructureId =
  | 'three-act'
  | 'heros-journey'
  | 'picture-12'
  | 'syllabus'
  | 'workbook'
  | 'explainer'
  | 'biography'
  | 'language-lesson'
  | 'case-method'
  | 'clinical'
  | 'design-cycle';

export interface BookKind {
  id: string;
  label: string;
  category: BookCategory;
  form: BookForm;
  genre: string;
  readingLevel: ReadingLevel;
  ageRating: AgeRating;
  pictureBook: boolean;
  audience: string;
  tone: string;
  tools: CraftTool[];
  structures: StructureId[];
}

export const BOOK_KINDS: BookKind[] = [
  { id: 'fiction', label: 'Fiction', category: 'general', form: 'fiction', genre: 'Fiction', readingLevel: 'general', ageRating: '12+', pictureBook: false, audience: 'General readers', tone: 'Clear and vivid', tools: ['characters', 'world', 'plot'], structures: ['three-act', 'heros-journey'] },
  { id: 'childrens', label: "Children's story", category: 'childrens_stories', form: 'fiction', genre: "Children's Stories", readingLevel: 'primary', ageRating: '8+', pictureBook: true, audience: 'Ages 5–7', tone: 'Warm and short', tools: ['characters', 'world', 'plot'], structures: ['picture-12', 'three-act'] },
  { id: 'textbook', label: 'Textbook', category: 'academic', form: 'non-fiction', genre: 'Textbook', readingLevel: 'igcse', ageRating: '14+', pictureBook: false, audience: 'Students in class', tone: 'Exact and calm', tools: ['syllabus', 'glossary', 'references', 'quiz'], structures: ['syllabus'] },
  { id: 'revision', label: 'Revision guide', category: 'academic', form: 'non-fiction', genre: 'Revision', readingLevel: 'igcse', ageRating: '14+', pictureBook: false, audience: 'Students revising', tone: 'Direct', tools: ['syllabus', 'glossary', 'quiz', 'references'], structures: ['syllabus'] },
  { id: 'workbook', label: 'Workbook', category: 'academic', form: 'non-fiction', genre: 'Workbook', readingLevel: 'lower-secondary', ageRating: '12+', pictureBook: false, audience: 'Students practising', tone: 'Step by step', tools: ['syllabus', 'exercises', 'quiz', 'glossary'], structures: ['workbook'] },
  { id: 'nonfiction', label: 'Non-fiction', category: 'general', form: 'non-fiction', genre: 'Non-fiction', readingLevel: 'general', ageRating: '12+', pictureBook: false, audience: 'Curious readers', tone: 'Concrete', tools: ['glossary', 'references'], structures: ['explainer'] },
  { id: 'biography', label: 'Biography', category: 'general', form: 'non-fiction', genre: 'Biography', readingLevel: 'general', ageRating: '12+', pictureBook: false, audience: 'General readers', tone: 'Respectful and specific', tools: ['characters', 'world', 'references'], structures: ['biography'] },
  { id: 'self-help', label: 'Self-help', category: 'general', form: 'non-fiction', genre: 'Self-help', readingLevel: 'general', ageRating: '16+', pictureBook: false, audience: 'Adult readers', tone: 'Practical', tools: ['syllabus', 'exercises'], structures: ['explainer'] },
  { id: 'law', label: 'Law', category: 'academic', form: 'non-fiction', genre: 'Law', readingLevel: 'law', ageRating: '18+', pictureBook: false, audience: 'Law students', tone: 'Precise', tools: ['syllabus', 'glossary', 'references', 'quiz'], structures: ['case-method'] },
  { id: 'medicine', label: 'Medicine', category: 'academic', form: 'non-fiction', genre: 'Medicine', readingLevel: 'professional', ageRating: '18+', pictureBook: false, audience: 'Medical students', tone: 'Clinical and careful', tools: ['syllabus', 'glossary', 'references', 'quiz'], structures: ['clinical'] },
  { id: 'engineering', label: 'Engineering', category: 'academic', form: 'non-fiction', genre: 'Engineering', readingLevel: 'professional', ageRating: '18+', pictureBook: false, audience: 'Engineering students', tone: 'Technical and plain', tools: ['syllabus', 'glossary', 'references', 'quiz', 'exercises'], structures: ['design-cycle'] },
  { id: 'nursing', label: 'Nursing', category: 'academic', form: 'non-fiction', genre: 'Nursing', readingLevel: 'professional', ageRating: '18+', pictureBook: false, audience: 'Nursing students', tone: 'Practical and careful', tools: ['syllabus', 'glossary', 'references', 'quiz', 'exercises'], structures: ['clinical'] },
  { id: 'language', label: 'Language learning', category: 'academic', form: 'non-fiction', genre: 'Language', readingLevel: 'general', ageRating: '8+', pictureBook: false, audience: 'Language learners', tone: 'Encouraging', tools: ['syllabus', 'glossary', 'exercises', 'quiz'], structures: ['language-lesson'] },
];

export const STRUCTURES: { id: StructureId; label: string; beats: string[] }[] = [
  { id: 'three-act', label: 'Three act', beats: ['Setup', 'Rising action', 'Midpoint', 'Crisis', 'Resolution'] },
  { id: 'heros-journey', label: "Hero's journey", beats: ['Ordinary world', 'Call', 'Threshold', 'Tests', 'Ordeal', 'Return'] },
  { id: 'picture-12', label: 'Picture book, 12 spreads', beats: ['Once', 'Want', 'Try', 'Trouble', 'Friend', 'Again', 'Bigger trouble', 'Idea', 'Brave', 'Change', 'Home', 'Last line'] },
  { id: 'syllabus', label: 'Syllabus', beats: ['Why it matters', 'Core idea', 'Worked example', 'Common mistake', 'Check'] },
  { id: 'workbook', label: 'Workbook', beats: ['Teach', 'Model', 'Practice', 'Answers'] },
  { id: 'explainer', label: 'Explainer', beats: ['Question', 'Answer', 'Example', 'So what'] },
  { id: 'biography', label: 'Life', beats: ['Early life', 'Turning point', 'Work', 'Legacy'] },
  { id: 'language-lesson', label: 'Language lesson', beats: ['Sounds', 'Words', 'Dialogue', 'Review'] },
  { id: 'case-method', label: 'Case method', beats: ['Principle', 'Facts', 'Arguments', 'Holding', 'Apply it'] },
  { id: 'clinical', label: 'Clinical', beats: ['Presentation', 'Mechanism', 'Assessment', 'Care', 'Safety check'] },
  { id: 'design-cycle', label: 'Design cycle', beats: ['Need', 'Constraints', 'Options', 'Build', 'Test'] },
];

export const PROMPT_TEMPLATES: { id: string; name: string; kind: string; body: string }[] = [
  { id: 'bedtime', name: 'Bedtime story', kind: 'childrens', body: 'A quiet picture book for an age band. One small problem, the same child on every page, and a last line that settles.' },
  { id: 'adventure', name: 'Adventure', kind: 'fiction', body: 'A journey with a clear want, two setbacks, and a return that changes the hero.' },
  { id: 'mystery', name: 'Mystery', kind: 'fiction', body: 'A fair puzzle. Plant the clue in an early chapter and do not reveal the answer before the last one.' },
  { id: 'curriculum', name: 'Curriculum-linked', kind: 'textbook', body: 'Each chapter serves one learning objective. Define the term, show one worked example, then a short check.' },
  { id: 'biography', name: 'Biography', kind: 'biography', body: 'Stay with what can be said about a life. Separate the record from what we do not know.' },
  { id: 'explainer', name: 'Non-fiction explainer', kind: 'nonfiction', body: 'Open with the question a reader actually has. Answer it before the history.' },
  { id: 'revision', name: 'Revision guide', kind: 'revision', body: 'Short recalls, one mistake students make, and a quiz whose answer is in the chapter.' },
  { id: 'workbook', name: 'Workbook', kind: 'workbook', body: 'Teach, model, then an exercise. Put the answer after the exercise so a teacher can hide it.' },
  { id: 'self-help', name: 'Self-help', kind: 'self-help', body: 'One practice per chapter. Tell the reader what to do this week, not only what to believe.' },
  { id: 'law', name: 'Law note', kind: 'law', body: 'State the rule, the facts, both arguments, and the holding. Do not invent a case name.' },
  { id: 'medicine', name: 'Medicine', kind: 'medicine', body: 'Presentation, mechanism, assessment, and a safety check. Do not invent a dose.' },
  { id: 'engineering', name: 'Engineering', kind: 'engineering', body: 'Need, constraints, options, and a test. Name the units.' },
  { id: 'nursing', name: 'Nursing', kind: 'nursing', body: 'What the patient shows, what the nurse watches, and when to escalate.' },
  { id: 'language', name: 'Language lesson', kind: 'language', body: 'A few sounds, useful words, a short dialogue, and a review. Mark the answer key.' },
];

export const SPARK_COSTS = {
  idea: 2,
  outline: 3,
  chapter: 3,
  portrait: 5,
  audiobook: 4,
  suggestion: 1,
} as const;

export type SparkAction = keyof typeof SPARK_COSTS;

export function bookKind(id: string | undefined): BookKind {
  return BOOK_KINDS.find(kind => kind.id === id) ?? BOOK_KINDS[0];
}

export function structureOf(id: string | undefined) {
  return STRUCTURES.find(structure => structure.id === id) ?? STRUCTURES[0];
}

export function toolsFor(kindId: string | undefined): CraftTool[] {
  return bookKind(kindId).tools;
}

export function hasTool(kindId: string | undefined, tool: CraftTool): boolean {
  return toolsFor(kindId).includes(tool);
}

export function promptsFor(kindId: string | undefined) {
  const kind = bookKind(kindId).id;
  const matched = PROMPT_TEMPLATES.filter(prompt => prompt.kind === kind);
  return matched.length ? matched : PROMPT_TEMPLATES.filter(prompt => prompt.kind === 'explainer' || prompt.kind === 'curriculum');
}

export function languageChoices() {
  return LANGUAGES.map(language => ({ code: language.code, label: language.label, englishName: language.englishName }));
}

/** Fields a kind may set on a book. Price is intentionally absent. */
export function kindShape(kindId: string | undefined): Pick<Book, 'category' | 'form' | 'genre' | 'readingLevel' | 'ageRating' | 'pictureBook' | 'ageBand'> {
  const kind = bookKind(kindId);
  return {
    category: kind.category,
    form: kind.form,
    genre: kind.genre,
    readingLevel: kind.readingLevel,
    ageRating: kind.ageRating,
    pictureBook: kind.pictureBook,
    ageBand: kind.pictureBook ? '5-7' : undefined,
  };
}

export function emptyCraft(kindId = 'fiction'): BookCraft {
  const kind = bookKind(kindId);
  return {
    kind: kind.id,
    idea: '',
    logline: '',
    tone: kind.tone,
    audience: kind.audience,
    titles: [],
    language: 'en',
    styleId: kind.pictureBook ? 'illustrated-kids' : kind.category === 'academic' ? 'academic' : 'novel',
    structure: kind.structures[0],
    characters: [],
    worldName: '',
    worldTime: '',
    worldPlace: '',
    worldRules: '',
    scenes: [],
    objectives: [],
    glossary: [],
    references: [],
    customPrompts: [],
  };
}

export function craftOf(book: { craft?: BookCraft; category?: string; pictureBook?: boolean; genre?: string }): BookCraft {
  if (book.craft) return book.craft;
  const inferred = book.pictureBook || book.category === 'childrens_stories'
    ? 'childrens'
    : book.category === 'academic' ? 'textbook' : 'fiction';
  return emptyCraft(inferred);
}

function titleCase(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Untitled book';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export interface BookProposal {
  titles: string[];
  logline: string;
  genre: string;
  audience: string;
  tone: string;
  ageBand?: string;
}

export function proposeBook(idea: string, kindId: string | undefined): BookProposal {
  const kind = bookKind(kindId);
  const topic = titleCase(idea || kind.label);
  const age = kind.pictureBook ? 'Ages 5–7' : undefined;
  const logline = kind.pictureBook
    ? `${topic} is a picture book for ${age}. The same character appears on every page.`
    : kind.category === 'academic'
      ? `${topic} teaches ${kind.label.toLowerCase()} readers one idea at a time, with a check in each chapter.`
      : `${topic} follows ${kind.audience.toLowerCase()} through ${kind.genre.toLowerCase()}, in a ${kind.tone.toLowerCase()} voice.`;
  return {
    titles: [topic, `${topic}: a ${kind.label.toLowerCase()}`, kind.pictureBook ? `${topic} at home` : `A short ${kind.label.toLowerCase()} of ${topic}`],
    logline,
    genre: kind.genre,
    audience: age ?? kind.audience,
    tone: kind.tone,
    ageBand: kind.pictureBook ? '5-7' : undefined,
  };
}

export interface OutlinePage {
  title: string;
  summary: string;
  exercise?: { prompt: string; answer: string };
  quiz?: { question: string; options: string[]; answer: string };
}

export function buildOutline(input: { idea: string; title: string; kindId: string; structure: string; objectives?: string[] }): OutlinePage[] {
  const kind = bookKind(input.kindId);
  const structure = (kind.structures as string[]).includes(input.structure)
    ? structureOf(input.structure)
    : structureOf(kind.structures[0]);
  const topic = titleCase(input.title || input.idea || kind.label);
  const goals = (input.objectives ?? []).map(goal => goal.trim()).filter(Boolean);
  return structure.beats.map((beat, index) => {
    const goal = goals[index] || goals[0] || beat;
    const summary = chapterSummary(kind, topic, beat, goal);
    const page: OutlinePage = { title: beat, summary };
    if (hasTool(kind.id, 'quiz')) {
      page.quiz = {
        question: `Which point belongs to “${beat}”?`,
        options: [goal, 'A claim this chapter does not make', 'Skip the check'],
        answer: goal,
      };
    }
    if (hasTool(kind.id, 'exercises')) {
      page.exercise = {
        prompt: `Practice: explain “${goal}” in one sentence about ${topic}.`,
        answer: `${goal} is the point of ${beat}.`,
      };
    }
    return page;
  });
}

function chapterSummary(kind: BookKind, topic: string, beat: string, goal: string): string {
  if (kind.pictureBook) return `${beat}. ${topic}. Keep the same child, the same clothes, and a single picture.`;
  if (kind.id === 'law') return `${beat} of ${topic}. State only the rule you were given. Learning point: ${goal}. Do not invent a case name.`;
  if (kind.id === 'medicine' || kind.id === 'nursing') return `${beat} for ${topic}. Learning point: ${goal}. Do not invent a dose.`;
  if (kind.category === 'academic') return `${beat}. ${topic}. Learning objective: ${goal}.`;
  if (kind.id === 'biography') return `${beat} in the life behind ${topic}. Keep rumour out of the record.`;
  return `${beat}. ${topic}. ${goal}.`;
}

export function chaptersFromOutline(pages: OutlinePage[], idPrefix: string): BookChapter[] {
  return pages.map((page, order) => {
    const exercise = page.exercise
      ? `\n\n## Try this\n${page.exercise.prompt}\n\n## Answer\n${page.exercise.answer}`
      : '';
    return {
      id: `${idPrefix}-${order + 1}`,
      order,
      title: page.title,
      markdown: `${page.summary}${exercise}`.trim(),
      preview: order === 0,
      origin: 'ai' as const,
      quiz: page.quiz ? [page.quiz] : undefined,
    };
  });
}

export function reviseProse(text: string, mode: 'regenerate' | 'expand' | 'shorten', idea: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const topic = idea.replace(/\s+/g, ' ').trim();
  if (mode === 'shorten') {
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, 2).join(' ') || clean;
  }
  if (mode === 'expand') {
    const extra = topic
      ? ` The author still checks this passage against the idea: ${topic}.`
      : ' The author still checks this passage before it is approved.';
    return `${clean}${extra}`.trim();
  }
  const lead = topic ? `Draft again from the idea “${topic}”. ` : 'Draft again. ';
  return `${lead}${clean}`.trim();
}

export function portraitPrompt(character: StoryCharacter, styleId: string): string {
  return [
    `Character portrait, style ${styleId}.`,
    character.name,
    character.role,
    character.appearance,
    'The same face, clothes, and colours whenever this person is drawn.',
    'No letters in the picture.',
  ].filter(Boolean).join(' ');
}

export interface ContinuityNote {
  tone: 'ok' | 'warn';
  message: string;
}

export function checkContinuity(book: Pick<Book, 'chapters' | 'craft' | 'pictureBook'>): ContinuityNote[] {
  const notes: ContinuityNote[] = [];
  const craft = book.craft;
  const prose = book.chapters.map(chapter => `${chapter.title}\n${chapter.markdown}`).join('\n');
  if (!book.chapters.length || book.chapters.every(chapter => !chapter.markdown.trim())) {
    notes.push({ tone: 'warn', message: 'The book has no chapter text yet.' });
  }
  if (craft && hasTool(craft.kind, 'characters')) {
    for (const person of craft.characters) {
      if (person.name.trim() && !prose.toLowerCase().includes(person.name.trim().toLowerCase())) {
        notes.push({ tone: 'warn', message: `${person.name} is in the character bible and does not appear in the chapters.` });
      }
    }
  }
  if (craft && hasTool(craft.kind, 'syllabus')) {
    for (const goal of craft.objectives) {
      if (goal.trim() && !prose.toLowerCase().includes(goal.trim().toLowerCase())) {
        notes.push({ tone: 'warn', message: `The objective “${goal}” is not mentioned in a chapter.` });
      }
    }
  }
  if (craft && hasTool(craft.kind, 'glossary')) {
    for (const entry of craft.glossary) {
      if (entry.term.trim() && !prose.toLowerCase().includes(entry.term.trim().toLowerCase())) {
        notes.push({ tone: 'warn', message: `Glossary term “${entry.term}” is not used in the text.` });
      }
    }
  }
  if (craft && hasTool(craft.kind, 'references') && craft.references.every(item => !item.trim())) {
    notes.push({ tone: 'warn', message: 'Add sources before review. Do not invent citations.' });
  }
  if (craft && hasTool(craft.kind, 'quiz')) {
    const bare = book.chapters.filter(chapter => !chapter.quiz?.length || chapter.quiz.some(item => !item.answer.trim()));
    if (bare.length) notes.push({ tone: 'warn', message: 'A chapter is missing a quiz answer.' });
  }
  if (craft && hasTool(craft.kind, 'exercises')) {
    const missing = book.chapters.filter(chapter => !/## Answer/i.test(chapter.markdown));
    if (missing.length) notes.push({ tone: 'warn', message: 'A practice chapter is missing its answer.' });
  }
  if (book.pictureBook && /Year\s+\d/i.test(prose)) {
    notes.push({ tone: 'warn', message: 'A children’s story uses an age band, not a school year.' });
  }
  if (!notes.length) notes.push({ tone: 'ok', message: 'Nothing obvious is missing for this kind of book.' });
  return notes;
}

export function speechText(markdown: string): string {
  return chapterPlain(markdown);
}

export function sparkNote(action: SparkAction, fallback: boolean): string {
  if (fallback) return '0 Sparks. ET AI wrote this on this device because no model key is in use.';
  return `${SPARK_COSTS[action]} Sparks. You still edit and approve the result.`;
}

export function blankCraftBook(kindId = 'fiction', now = Date.now()): Book {
  const kind = bookKind(kindId);
  const craft = emptyCraft(kind.id);
  return {
    id: `book-${now}`,
    title: 'Untitled book',
    author: 'ET AI',
    blurb: '',
    cover: { ...BRAND_COVER },
    ...kindShape(kind.id),
    curriculumTags: [{ programme: kind.category === 'academic' ? 'Academic' : 'General', subject: kind.genre, year: kind.pictureBook ? 'Ages 5–7' : kind.label }],
    status: 'draft',
    version: 1,
    accessMode: 'both',
    minTier: 1,
    priceUsd: seedPricing().defaultBookUsd,
    priceRM: storedBookPriceRM(seedPricing().defaultBookUsd),
    licensable: false,
    programme: kind.category === 'academic' ? 'Academic' : 'General',
    allocateLibrary: false,
    allocateMarketplace: false,
    targets: ['students'],
    chapters: [{ id: `c-${now}`, order: 0, title: 'Chapter 1', markdown: '', preview: true, origin: 'human' }],
    weeklyReads: 0,
    releasedAt: new Date(now).toISOString().slice(0, 10),
    craft,
  };
}

export function newCharacter(now = Date.now()): StoryCharacter {
  return { id: `who-${now}`, name: '', role: '', traits: '', appearance: '', backstory: '', voice: '', relationships: '' };
}

export function newScene(act: string, now = Date.now()): SceneCard {
  return { id: `scene-${now}`, title: '', summary: '', act, twist: false };
}
