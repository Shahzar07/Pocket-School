'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { LessonQaScreen } from '@/components/scope-c/market-screens';

export function LessonQa({
  courseId, lessonId, lessonTitle, inAssessment,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  inAssessment?: boolean;
}) {
  const flags = useFeatureFlags();
  const [questions, setQuestions] = useState<{ id: string; body?: string; aiSuggestedReply?: string; publishedReply?: string; status?: string }[]>([]);
  const [suggestion, setSuggestion] = useState('');
  const [canAnswer, setCanAnswer] = useState(false);

  const load = () => {
    authedFetch(`/api/lessons/qa?lessonId=${lessonId}&courseId=${courseId}`).then((data) => {
      setQuestions(Array.isArray(data.questions) ? data.questions as typeof questions : []);
      setCanAnswer(data.canAnswer === true);
    }).catch(() => {});
  };

  useEffect(() => { if (isFeatureEnabled(flags, 'lessonQa')) load(); }, [lessonId, courseId, flags]);

  if (!isFeatureEnabled(flags, 'lessonQa')) return null;
  if (inAssessment) {
    return <p className="text-sm text-muted-foreground mt-6">Questions are paused during this assessment.</p>;
  }

  return (
    <div className="mt-6">
      <LessonQaScreen
        questions={questions}
        suggestion={suggestion}
        onAsk={(body) => {
          authedFetch('/api/lessons/qa', { method: 'POST', body: JSON.stringify({ courseId, lessonId, lessonTitle, body }) })
            .then((data) => { setSuggestion(String(data.aiSuggestedReply ?? '')); load(); })
            .catch((error: Error) => toast.error(error.message));
        }}
        onPublish={canAnswer ? (id, reply) => {
          authedFetch('/api/lessons/qa', { method: 'POST', body: JSON.stringify({ questionId: id, reply }) })
            .then(() => load())
            .catch((error: Error) => toast.error(error.message));
        } : undefined}
      />
    </div>
  );
}
