/** Browser-side signal capture. The numbers are stored with the submission for a person to review. */

export interface CaptureState {
  pasteEvents: number;
  largeInsertChars: number;
  focusLosses: number;
  startedAt: number;
  lastLength: number;
}

export type CaptureEvent =
  | { type: 'paste' }
  | { type: 'input'; length: number }
  | { type: 'blur' };

export function emptyCapture(startedAt: number): CaptureState {
  return { pasteEvents: 0, largeInsertChars: 0, focusLosses: 0, startedAt, lastLength: 0 };
}

export function applyCapture(state: CaptureState, event: CaptureEvent): CaptureState {
  if (event.type === 'paste') return { ...state, pasteEvents: state.pasteEvents + 1 };
  if (event.type === 'blur') return { ...state, focusLosses: state.focusLosses + 1 };
  const jump = event.length - state.lastLength;
  return {
    ...state,
    lastLength: event.length,
    largeInsertChars: jump >= 80 ? state.largeInsertChars + jump : state.largeInsertChars,
  };
}

export function captureToSignals(state: CaptureState, now: number) {
  return {
    pasteEvents: state.pasteEvents,
    largeInsertChars: state.largeInsertChars,
    focusLosses: state.focusLosses,
    secondsToAnswer: Math.max(0, Math.round((now - state.startedAt) / 1000)),
  };
}
