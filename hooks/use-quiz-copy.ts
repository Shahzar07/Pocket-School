'use client';

import { useMemo } from 'react';
import { useContentTranslation } from '@/hooks/use-content-translation';
import { parseQuizTranslation, quizPayload, type TranslatableQuizItem } from '@/lib/i18n/quiz-translation';

/** English quiz items stay the source of truth. Labels swap in when a translation is ready. */
export function useQuizCopy<Q extends TranslatableQuizItem>(id: string, questions: readonly Q[], language: string) {
  const packed = useMemo(() => quizPayload(questions), [questions]);
  const translation = useContentTranslation(
    id,
    { quiz: packed },
    language,
    language !== 'en' && questions.length > 0,
  );
  const display = useMemo(() => {
    const parsed = parseQuizTranslation(translation.values.quiz ?? packed, questions);
    return parsed ?? questions;
  }, [packed, questions, translation.values.quiz]);
  return { display, translation };
}
