'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { ExamScreen, type AttemptCard, type GradeCard, type GuidanceCard, type PaperCard } from '@/components/scope-c/market-screens';
import { useAuthSTORE } from '@/hooks/use-auth';

export default function ExamCentrePage() {
  const { profile } = useAuthSTORE();
  const [papers, setPapers] = useState<PaperCard[]>([]);
  const [suggestions, setSuggestions] = useState<GuidanceCard[]>([]);
  const [attempt, setAttempt] = useState<AttemptCard | null>(null);
  const [result, setResult] = useState<GradeCard | null>(null);
  const staff = profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'institution_admin';

  const loadPapers = () => {
    authedFetch('/api/exam-centre/papers').then((data) => {
      setPapers(Array.isArray(data.papers) ? data.papers as PaperCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };

  useEffect(() => {
    loadPapers();
    authedFetch('/api/exam-centre/guidance').then((data) => {
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions as GuidanceCard[] : []);
    }).catch(() => {});
  }, []);

  return (
    <FeatureGate flag="examCentre">
      <ExamScreen
        papers={papers}
        suggestions={suggestions}
        attempt={attempt}
        result={result}
        onStart={(paperId) => {
          setResult(null);
          authedFetch('/api/exam-centre/start', { method: 'POST', body: JSON.stringify({ paperId }) })
            .then((data) => {
              setAttempt({
                paperId,
                attemptId: String(data.id),
                endsAtMs: Number(data.endsAtMs),
                questions: Array.isArray(data.questions) ? data.questions as AttemptCard['questions'] : [],
              });
            })
            .catch((error: Error) => toast.error(error.message));
        }}
        onSubmit={(attemptId, answers) => {
          authedFetch('/api/exam-centre/submit', { method: 'POST', body: JSON.stringify({ attemptId, answers }) })
            .then((data) => setResult({
              score: Number(data.score) || 0,
              maxScore: Number(data.maxScore) || 0,
              predictedGrade: String(data.predictedGrade ?? ''),
            }))
            .catch((error: Error) => toast.error(error.message));
        }}
        onGuide={(interest, grades) => {
          authedFetch('/api/exam-centre/guidance', {
            method: 'POST',
            body: JSON.stringify({ interests: [interest], predictedGrades: grades }),
          }).then((data) => setSuggestions(Array.isArray(data.suggestions) ? data.suggestions as GuidanceCard[] : []))
            .catch((error: Error) => toast.error(error.message));
        }}
        onUpload={staff ? (paper) => {
          authedFetch('/api/exam-centre/papers', {
            method: 'POST',
            body: JSON.stringify({ ...paper, license: 'teacher_upload', publish: true }),
          }).then(() => { toast.success('Paper published.'); loadPapers(); })
            .catch((error: Error) => toast.error(error.message));
        } : undefined}
      />
    </FeatureGate>
  );
}
