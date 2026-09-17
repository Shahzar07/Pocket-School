/**
 * Content format templates.
 *
 * The generator used to hard-code "use headers, bullet points, bold key terms"
 * into every lesson prompt, so everything came out as bullets whether or not
 * that suited the subject. Law objectives read as fragments, essay subjects
 * lost their argument, and there was no way to ask for anything else.
 *
 * A template describes the SHAPE of generated content — prose or bullets, the
 * sections it should contain, and any subject conventions. It is chosen once
 * on the course and can be overridden per lesson, so the AI knows what to
 * follow instead of guessing.
 */

export type Density = 'prose' | 'mixed' | 'bulleted';

export interface ContentTemplate {
  id: string;
  name: string;
  /** Shown under the name in the picker. */
  description: string;
  /** Subjects this suits, for the "suggested" hint. Empty means any. */
  suits: string[];
  density: Density;
  /** Section headings the lesson should follow, in order. Empty means free-form. */
  sections: string[];
  /** Extra conventions appended to the prompt verbatim. */
  rules: string[];
  /** How learning objectives should read under this template. */
  objectiveStyle: 'prose' | 'bulleted';
}

const DENSITY_RULES: Record<Density, string> = {
  prose: 
    'Write in connected explanatory prose — full paragraphs that build an argument or an explanation. '
    + 'Do NOT use bullet points anywhere in the body. Use a list only if the source material is genuinely '
    + 'a list of discrete items (a set of statutes, a sequence of steps), and never to break up explanation.',
  mixed:
    'Write mainly in prose paragraphs. Use a short bullet list only where the content is genuinely '
    + 'enumerable — a set of steps, a comparison, or a checklist. Never turn an explanation into bullets.',
  bulleted:
    'Use concise bullet points throughout, grouped under headings. Keep each bullet to one idea and one line '
    + 'where possible. This is revision-note formatting: scannable rather than discursive.',
};

/**
 * Built-in templates. These cover the subject families on the platform; admins
 * can add their own on top.
 */
export const BUILT_IN_TEMPLATES: ContentTemplate[] = [
  {
    id: 'explanatory-prose',
    name: 'Explanatory prose',
    description: 'Flowing paragraphs that teach a concept. The sensible default for most subjects.',
    suits: [],
    density: 'prose',
    sections: ['Introduction', 'Core explanation', 'Worked example', 'Common misconceptions', 'Summary'],
    rules: [
      'Open by saying what the student will be able to do by the end, in one sentence of prose.',
      'Introduce every technical term in a sentence that defines it in context.',
    ],
    objectiveStyle: 'prose',
  },
  {
    id: 'revision-notes',
    name: 'Revision notes',
    description: 'Scannable bullets under clear headings. For summaries and last-minute revision.',
    suits: [],
    density: 'bulleted',
    sections: ['Key ideas', 'Definitions', 'Formulae and facts', 'Exam pointers'],
    rules: [
      'Bold the term being defined at the start of each definition bullet.',
      'Keep bullets to a single line wherever the content allows.',
    ],
    objectiveStyle: 'bulleted',
  },
  {
    id: 'law-irac',
    name: 'Law — IRAC with case law',
    description: 'Issue, Rule, Application, Conclusion. Objectives in prose, cases cited in full.',
    suits: ['Law', 'LLB', 'Legal Studies'],
    density: 'prose',
    sections: ['Issue', 'Rule', 'Key case law', 'Application', 'Conclusion', 'Exam technique'],
    rules: [
      'Structure the analysis as IRAC and label each stage with its heading.',
      'Cite real decided cases in full form — Donoghue v Stevenson [1932] AC 562 — and for each give the '
        + 'material facts, what was held, the ratio decidendi, and why it matters.',
      'Distinguish ratio from obiter explicitly wherever both are discussed.',
      'Write objectives and analysis as continuous prose. Legal reasoning does not survive being bulleted.',
    ],
    objectiveStyle: 'prose',
  },
  {
    id: 'stem-worked',
    name: 'STEM — concept then worked example',
    description: 'Each idea followed immediately by a fully worked example, then practice.',
    suits: ['Mathematics', 'Additional Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'],
    density: 'mixed',
    sections: ['The idea', 'Worked example', 'Method summary', 'Practice', 'Where students go wrong'],
    rules: [
      'Show every step of a worked example, including the step students usually skip.',
      'Use LaTeX for all mathematics — inline with $…$ and display with $$…$$.',
      'State the method as a numbered sequence only in the Method summary section.',
    ],
    objectiveStyle: 'bulleted',
  },
  {
    id: 'language-skills',
    name: 'Languages — vocabulary and usage',
    description: 'Vocabulary, a grammar point in context, then production practice.',
    suits: ['English', 'Malay', 'Modern Languages', 'English Literature'],
    density: 'mixed',
    sections: ['Vocabulary', 'Grammar in context', 'Model text', 'Your turn'],
    rules: [
      'Give every vocabulary item in a full example sentence, not in isolation.',
      'Model texts must be original, never quoted from a copyrighted source.',
    ],
    objectiveStyle: 'prose',
  },
  {
    id: 'case-study',
    name: 'Case study',
    description: 'A scenario, then analysis questions. For Business, Economics and Global Citizenship.',
    suits: ['Business', 'Economics', 'Commerce', 'Global Citizenship', 'Civic Studies'],
    density: 'prose',
    sections: ['The scenario', 'Background', 'Analysis', 'Questions', 'Marking guidance'],
    rules: [
      'Use fictional organisations and people throughout. Never name a real company as the subject.',
      'Questions must climb Bloom’s levels — identify, explain, analyse, then evaluate.',
    ],
    objectiveStyle: 'prose',
  },
];

export const DEFAULT_TEMPLATE_ID = 'explanatory-prose';

export function getTemplate(
  id: string | null | undefined,
  custom: ContentTemplate[] = [],
): ContentTemplate {
  const all = [...BUILT_IN_TEMPLATES, ...custom];
  return all.find(t => t.id === id) ?? all.find(t => t.id === DEFAULT_TEMPLATE_ID) ?? BUILT_IN_TEMPLATES[0];
}

/** Templates whose `suits` list mentions this subject, best matches first. */
export function templatesForSubject(
  subject: string | null | undefined,
  custom: ContentTemplate[] = [],
): ContentTemplate[] {
  const all = [...BUILT_IN_TEMPLATES, ...custom];
  if (!subject) return all;
  const s = subject.toLowerCase();
  const matches = (t: ContentTemplate) =>
    t.suits.some(x => s.includes(x.toLowerCase()) || x.toLowerCase().includes(s));
  return [...all.filter(matches), ...all.filter(t => !matches(t))];
}

/** The best template for a subject, used to preselect one on a new course. */
export function suggestTemplateId(subject: string | null | undefined): string {
  if (!subject) return DEFAULT_TEMPLATE_ID;
  const s = subject.toLowerCase();
  const hit = BUILT_IN_TEMPLATES.find(t =>
    t.suits.some(x => s.includes(x.toLowerCase()) || x.toLowerCase().includes(s)));
  return hit?.id ?? DEFAULT_TEMPLATE_ID;
}

/**
 * The template rendered as prompt text.
 *
 * This is what replaces the old hard-coded "use bullet points" instruction, so
 * the model follows the chosen shape rather than a single baked-in one.
 */
export function formatDirective(template: ContentTemplate): string {
  const parts: string[] = [];
  parts.push(`CONTENT FORMAT — "${template.name}". Follow it exactly.`);
  parts.push(DENSITY_RULES[template.density]);
  if (template.sections.length) {
    parts.push(
      'Structure the lesson under these headings, in this order, using "## " for each: '
      + template.sections.map(x => `"${x}"`).join(', ')
      + '. Omit a heading only when the source material genuinely has nothing for it.',
    );
  }
  for (const r of template.rules) parts.push(r);
  return parts.join('\n') + '\n\n';
}

/** How objectives should be written under this template. */
export function objectiveDirective(template: ContentTemplate): string {
  return template.objectiveStyle === 'prose'
    ? 'Write each objective as a complete sentence of prose, not as a fragment or a bullet.'
    : 'Write each objective as a single concise line.';
}
