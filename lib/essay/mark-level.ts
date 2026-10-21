import {
  type DegreeStyle,
  type EssayLevelId,
  type EssayScaleResult,
  ESTIMATE_LABEL,
  coerceWritingType,
  countWords,
  criteriaFor,
  isEssayLevel,
  levelLabel,
  mapEssayScale,
  referencingApplies,
  referencingLabel,
  writingTypeLabel,
} from './scale-config';

export interface CriterionNote {
  id: string;
  label: string;
  score: number;
  scoreLabel: string;
  scoreCaption: string;
  strength: string;
  fix: string;
  quote: string;
}

export interface LevelMark extends EssayScaleResult {
  criteria: CriterionNote[];
  nextSteps: string[];
  improvedParagraph: string;
  feedback: string;
  source: 'local' | 'model';
  degreeStyle?: DegreeStyle;
  writingType: string;
  referencingStyle: string;
}

export interface MarkInput {
  essay: string;
  prompt?: string;
  levelId?: string;
  writingType?: string;
  subject?: string;
  board?: string;
  wordTarget?: number;
  referencing?: string;
  rubric?: string;
  degreeStyle?: DegreeStyle;
}

const CONNECTIVES = ['in contrast', 'for example', 'this means', 'however', 'therefore', 'because', 'although'];
const QUESTION = ['research question', 'this dissertation', 'this paper', 'this study', 'this review'];
const METHOD = ['methodology', 'method', 'interview', 'dataset', 'sample', 'analysis'];
const LITERATURE = ['previous research', 'studies show', 'literature', 'scholars'];
const CONTRIBUTION = ['contribution', 'contribute', 'gap in', 'implication'];

function phraseHits(text: string, phrases: readonly string[]): number {
  let left = text.toLowerCase();
  let count = 0;
  const ordered = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of ordered) {
    if (left.includes(phrase)) {
      count += 1;
      left = left.replace(phrase, ' ');
    }
  }
  return count;
}

function sentencesOf(essay: string): string[] {
  const found: string[] = [];
  const pattern = /[^.!?\n][^.!?\n]{11,}[.!?]/g;
  for (const match of essay.matchAll(pattern)) {
    const sentence = match[0]?.trim() ?? '';
    if (sentence && essay.includes(sentence)) found.push(sentence);
  }
  return found;
}

function clamp(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function scoreLabel(levelId: EssayLevelId, score: number): string {
  if (levelId === 'phd') return `${Math.max(0, Math.min(5, Math.round(score / 20)))} / 5`;
  return String(score);
}

function scoreCaption(levelId: EssayLevelId): string {
  return levelId === 'phd' ? 'Working note' : 'Score';
}

function notesFor(label: string, score: number, styleName: string): { strength: string; fix: string } {
  const name = label.toLowerCase();
  if (label === 'Referencing accuracy' && styleName) {
    return score >= 45
      ? {
        strength: 'Sources are already present in this line.',
        fix: `Check this citation against ${styleName}.`,
      }
      : {
        strength: 'This line is where a source should be doing the work.',
        fix: `Add the source and check it against ${styleName}.`,
      };
  }
  if (score >= 70) {
    return {
      strength: `${label} is already doing useful work in this line.`,
      fix: `Keep ${name} this specific, and add one more checkable detail beside it.`,
    };
  }
  if (score >= 45) {
    return {
      strength: `${label} is present, and this line is the clearest example.`,
      fix: `Tighten ${name} by saying what the example proves.`,
    };
  }
  return {
    strength: `There is a starting point for ${name} in this line.`,
    fix: `Rebuild ${name} so the point, the reason, and the example sit in one place.`,
  };
}

function signals(essay: string, wordTarget: number) {
  const words = countWords(essay);
  const paras = essay.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const sentences = sentencesOf(essay);
  const ratio = wordTarget > 0 ? words / wordTarget : 0;
  const length = wordTarget > 0
    ? (ratio >= 0.6 && ratio <= 1.4 ? 82 : ratio >= 0.35 ? 58 : 36)
    : (words >= 250 ? 82 : words >= 120 ? 64 : 40);
  const structure = paras.length >= 4 ? 84 : paras.length === 3 ? 74 : paras.length === 2 ? 56 : 34;
  const connectives = Math.min(92, 28 + phraseHits(essay, CONNECTIVES) * 16);
  const citations = (essay.match(/\((?:19|20)\d{2}\)/g) ?? []).length;
  const evidence = Math.min(92, 24 + citations * 18);
  const language = sentences.length >= 6 ? 76 : sentences.length >= 3 ? 62 : 40;
  const ends = (essay.match(/[.!?](\s|$)/g) ?? []).length;
  const capitals = (essay.match(/(^|[.!?]\s+)[A-Z]/gm) ?? []).length;
  const spag = Math.min(90, 30 + Math.round((Math.min(ends, 8) / 8) * 40) + (capitals >= 3 ? 20 : 8));
  const tokens = essay.trim().split(/\s+/).filter(Boolean);
  const unique = new Set(tokens.map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean)).size;
  const uniqueRatio = tokens.length ? unique / tokens.length : 0;
  const originality = uniqueRatio >= 0.55 ? 78 : uniqueRatio >= 0.4 ? 64 : 48;
  return {
    length,
    structure,
    connectives,
    evidence,
    language,
    spag,
    originality,
    question: Math.min(90, 30 + phraseHits(essay, QUESTION) * 30),
    method: Math.min(90, 28 + phraseHits(essay, METHOD) * 18),
    literature: Math.min(90, 26 + phraseHits(essay, LITERATURE) * 20 + Math.min(citations, 3) * 8),
    contribution: Math.min(90, 24 + phraseHits(essay, CONTRIBUTION) * 28),
    sentences,
  };
}

function scoreFor(id: string, signal: ReturnType<typeof signals>): number {
  if (id === 'content') return clamp((signal.length + signal.connectives) / 2);
  if (id === 'structure') return signal.structure;
  if (id === 'language' || id === 'style') return signal.language;
  if (id === 'spag') return signal.spag;
  if (id === 'argument') return clamp((signal.connectives + signal.length) / 2);
  if (id === 'analysis') return signal.connectives;
  if (id === 'evidence' || id === 'referencing') return signal.evidence;
  if (id === 'originality') return signal.originality;
  if (id === 'question') return signal.question;
  if (id === 'literature') return signal.literature;
  if (id === 'methodology') return signal.method;
  if (id === 'contribution') return signal.contribution;
  const pool = [signal.length, signal.structure, signal.connectives, signal.evidence, signal.language, signal.originality];
  const index = Math.abs(id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0));
  return pool[index % pool.length] ?? signal.length;
}

function modelParagraph(sentence: string, prompt: string): string {
  const core = sentence.replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const topic = (prompt || 'the task').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${core}, because this answers “${topic}” with one reason a reader can check.`;
}

function levelStep(levelId: EssayLevelId, styleName: string): string {
  if (levelId === 'phd' || levelId === 'masters') return 'Keep the research question visible in the next draft.';
  if ((levelId === 'degree' || levelId === 'professional') && styleName) return `Check the ${styleName} style on every source you use.`;
  if (levelId === 'degree' || levelId === 'professional') return 'Check the referencing style on every source you use.';
  return 'Return to the task in the last paragraph.';
}

export function markEssayAtLevel(input: MarkInput): LevelMark {
  const levelId: EssayLevelId = isEssayLevel(input.levelId) ? input.levelId : 'igcse';
  const essay = String(input.essay ?? '').slice(0, 12_000);
  const prompt = String(input.prompt ?? '').slice(0, 2_000);
  const degreeStyle: DegreeStyle | undefined = levelId === 'degree'
    ? (input.degreeStyle === 'cgpa' ? 'cgpa' : 'uk')
    : undefined;
  const writingType = coerceWritingType(levelId, input.writingType);
  const styleName = referencingApplies(levelId) ? referencingLabel(input.referencing) : '';
  const definitions = criteriaFor(levelId, input.rubric);
  const signal = signals(essay, Number(input.wordTarget) || 0);
  const quotes = signal.sentences.length
    ? signal.sentences
    : [essay.trim().slice(0, 180) || 'The essay is still too short to quote.'];
  const criteria: CriterionNote[] = definitions.map((definition, index) => {
    const score = scoreFor(definition.id, signal);
    const quote = quotes[index % quotes.length] ?? quotes[0]!;
    const notes = notesFor(definition.label, score, styleName);
    return {
      id: definition.id,
      label: definition.label,
      score,
      scoreLabel: scoreLabel(levelId, score),
      scoreCaption: scoreCaption(levelId),
      quote,
      strength: notes.strength,
      fix: notes.fix,
    };
  });
  const average = criteria.length
    ? clamp(criteria.reduce((sum, item) => sum + item.score, 0) / criteria.length)
    : 0;
  const scale = mapEssayScale(levelId, average, { degreeStyle });
  const ranked = [...criteria].sort((a, b) => a.score - b.score);
  const nextSteps = ranked.slice(0, 3).map((item) => item.fix);
  const extra = levelStep(levelId, styleName);
  if (!nextSteps.includes(extra)) nextSteps.push(extra);
  const weakest = ranked[0];
  const improvedParagraph = modelParagraph(weakest?.quote || quotes[0]!, prompt);
  const typeLabel = writingTypeLabel(writingType);
  const where = [levelLabel(levelId), typeLabel].filter(Boolean).join(' ');
  const subject = String(input.subject ?? '').trim();
  const feedback = [
    `Marked as ${where}${subject ? ` in ${subject}` : ''}.`,
    scale.showsPercentage ? `${scale.headline}. ${scale.percentage}%.` : `${scale.headline}.`,
    nextSteps[0] ?? '',
  ].filter(Boolean).join(' ');
  return {
    ...scale,
    criteria,
    nextSteps,
    improvedParagraph,
    feedback,
    source: 'local',
    degreeStyle,
    writingType,
    referencingStyle: styleName,
    estimateLabel: ESTIMATE_LABEL,
  };
}

function averageScore(criteria: CriterionNote[]): number {
  if (!criteria.length) return 0;
  return criteria.reduce((sum, item) => sum + item.score, 0) / criteria.length;
}

function rescale(criteria: CriterionNote[], target: number, levelId: EssayLevelId, styleName: string): CriterionNote[] {
  const current = averageScore(criteria) || 1;
  const factor = target / current;
  return criteria.map((item) => {
    const score = clamp(item.score * factor);
    const notes = notesFor(item.label, score, styleName);
    return {
      ...item,
      score,
      scoreLabel: scoreLabel(levelId, score),
      scoreCaption: scoreCaption(levelId),
      strength: notes.strength,
      fix: notes.fix,
    };
  });
}

function reusesEssay(text: string, essay: string): boolean {
  const clean = text.trim();
  if (!clean || clean.length > 600 || clean.includes('\n\n')) return false;
  if (clean.split(/\s+/).length > 90) return false;
  const essayWords = essay.toLowerCase().split(/\s+/);
  const grams = new Set<string>();
  for (let index = 0; index < essayWords.length - 3; index += 1) {
    grams.add(essayWords.slice(index, index + 4).join(' '));
  }
  const words = clean.toLowerCase().split(/\s+/);
  for (let index = 0; index < words.length - 3; index += 1) {
    if (grams.has(words.slice(index, index + 4).join(' '))) return true;
  }
  return false;
}

export function mergeModelMark(local: LevelMark, essay: string, raw: unknown): LevelMark {
  if (!raw || typeof raw !== 'object') return local;
  const body = raw as {
    mark?: unknown;
    feedback?: unknown;
    improvedParagraph?: unknown;
  };
  let next = local;
  const mark = typeof body.mark === 'number' ? body.mark : Number(body.mark);
  if (Number.isFinite(mark) && String(body.mark ?? '').trim() !== '') {
    const criteria = rescale(local.criteria, clamp(mark), local.levelId, local.referencingStyle);
    const scale = mapEssayScale(local.levelId, mark, { degreeStyle: local.degreeStyle });
    const ranked = [...criteria].sort((a, b) => a.score - b.score);
    const nextSteps = ranked.slice(0, 3).map((item) => item.fix);
    const extra = levelStep(local.levelId, local.referencingStyle);
    if (!nextSteps.includes(extra)) nextSteps.push(extra);
    next = {
      ...local,
      ...scale,
      criteria,
      nextSteps,
      source: 'model',
    };
  }
  if (typeof body.feedback === 'string' && body.feedback.trim()) {
    next = { ...next, feedback: body.feedback.trim().slice(0, 2_000) };
  }
  if (typeof body.improvedParagraph === 'string' && reusesEssay(body.improvedParagraph, essay)) {
    next = { ...next, improvedParagraph: body.improvedParagraph.trim() };
  }
  return { ...next, estimateLabel: ESTIMATE_LABEL };
}
