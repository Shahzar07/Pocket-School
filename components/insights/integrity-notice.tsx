'use client';

import { useState } from 'react';
import { STUDENT_INTEGRITY_NOTICE } from '@/lib/insights/integrity';
import { applyCapture, captureToSignals, emptyCapture, type CaptureState } from '@/lib/insights/integrity-capture';

export function useIntegrityCapture() {
  const [state, setState] = useState<CaptureState>(() => emptyCapture(Date.now()));
  return {
    onPaste: () => setState(current => applyCapture(current, { type: 'paste' })),
    onInput: (length: number) => setState(current => applyCapture(current, { type: 'input', length })),
    onBlur: () => setState(current => applyCapture(current, { type: 'blur' })),
    signals: () => captureToSignals(state, Date.now()),
  };
}

export function IntegrityNotice() {
  return (
    <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground" data-integrity-notice>
      {STUDENT_INTEGRITY_NOTICE}
    </p>
  );
}
