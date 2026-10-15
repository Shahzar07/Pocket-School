'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { authedFetch, ApiError } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { SnapScreen } from '@/components/scope-c/market-screens';

export default function SnapPage() {
  const [result, setResult] = useState<{ answer: string; steps: string[]; similar: string[] } | null>(null);
  const [blocked, setBlocked] = useState('');

  return (
    <FeatureGate flag="snapAndSolve">
      <SnapScreen
        result={result}
        blocked={blocked}
        onSolve={(text, context) => {
          setBlocked('');
          setResult(null);
          authedFetch('/api/snap/solve', { method: 'POST', body: JSON.stringify({ text, context }) })
            .then((data) => setResult({
              answer: String(data.answer ?? ''),
              steps: Array.isArray(data.steps) ? data.steps as string[] : [],
              similar: Array.isArray(data.similar) ? data.similar as string[] : [],
            }))
            .catch((error: Error) => {
              if (error instanceof ApiError) setBlocked(error.message);
              else toast.error(error.message);
            });
        }}
      />
    </FeatureGate>
  );
}
