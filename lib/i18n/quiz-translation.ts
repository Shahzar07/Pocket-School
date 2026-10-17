export interface TranslatableQuizItem {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

/**
 * Zip a translated quiz back onto the English items by index.
 * Grading keeps using the English options; only the labels change.
 * A short or broken translation falls back to the English item.
 */
export function parseQuizTranslation<Q extends TranslatableQuizItem>(
  raw: string,
  source: readonly Q[],
): Q[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== source.length) return null;
    return source.map((item, index) => {
      const next = parsed[index] as Partial<TranslatableQuizItem> | undefined;
      const options = Array.isArray(next?.options) && next.options.length === item.options.length
        ? next.options.map(option => String(option))
        : item.options;
      return {
        ...item,
        question: typeof next?.question === 'string' && next.question.trim() ? next.question : item.question,
        options,
        answer: item.answer,
        explanation: typeof next?.explanation === 'string' && next.explanation.trim()
          ? next.explanation
          : item.explanation,
      };
    });
  } catch {
    return null;
  }
}

export interface TranslatableTrueFalse {
  statement: string;
  explanation: string;
}

export function trueFalsePayload(items: readonly TranslatableTrueFalse[]): string {
  return JSON.stringify(items.map(item => ({
    statement: item.statement,
    explanation: item.explanation,
  })));
}

/** Labels swap by index. The boolean answer stays on the English item. */
export function parseTrueFalseTranslation<T extends TranslatableTrueFalse>(
  raw: string,
  source: readonly T[],
): T[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== source.length) return null;
    return source.map((item, index) => {
      const next = parsed[index] as Partial<TranslatableTrueFalse> | undefined;
      return {
        ...item,
        statement: typeof next?.statement === 'string' && next.statement.trim() ? next.statement : item.statement,
        explanation: typeof next?.explanation === 'string' && next.explanation.trim() ? next.explanation : item.explanation,
      };
    });
  } catch {
    return null;
  }
}

export function quizPayload(items: readonly TranslatableQuizItem[]): string {
  return JSON.stringify(items.map(item => ({
    question: item.question,
    options: item.options,
    answer: item.answer,
    explanation: item.explanation ?? '',
  })));
}
