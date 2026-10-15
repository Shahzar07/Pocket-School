'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { ExamScreen, type GuidanceCard, type PaperCard } from '@/components/scope-c/market-screens';

export default function ExamCentrePage() {
  const [papers, setPapers] = useState<PaperCard[]>([]);
  const [suggestions, setSuggestions] = useState<GuidanceCard[]>([]);
  useEffect(() => {
    authedFetch('/api/exam-centre/papers').then((data) => {
      setPapers(Array.isArray(data.papers) ? data.papers as PaperCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
    authedFetch('/api/exam-centre/guidance').then((data) => {
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions as GuidanceCard[] : []);
    }).catch(() => {});
  }, []);

  return (
    <FeatureGate flag="examCentre">
      <ExamScreen
        papers={papers}
        suggestions={suggestions}
        onStart={(paperId) => {
          authedFetch('/api/exam-centre/start', { method: 'POST', body: JSON.stringify({ paperId }) })
            .then((data) => toast.success(`Mock started. It closes at ${new Date(Number(data.endsAtMs)).toLocaleTimeString()}.`))
            .catch((error: Error) => toast.error(error.message));
        }}
        onGuide={(interest) => {
          authedFetch('/api/exam-centre/guidance', {
            method: 'POST',
            body: JSON.stringify({ interests: [interest], predictedGrades: { biology: 'A', chemistry: 'A', maths: 'A', physics: 'B', english: 'B' } }),
          }).then((data) => setSuggestions(Array.isArray(data.suggestions) ? data.suggestions as GuidanceCard[] : []))
            .catch((error: Error) => toast.error(error.message));
        }}
      />
    </FeatureGate>
  );
}
