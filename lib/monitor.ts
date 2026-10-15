/**
 * One place to report a client or server failure.
 * Set `window.__POKET_REPORT_ERROR__` to forward into Sentry or another sink.
 * With no sink, the report stays in the console and nothing else is called.
 */

export interface ErrorReport {
  message: string;
  context?: Record<string, string>;
  at: string;
}

type ReportHook = (report: ErrorReport) => void;

declare global {
  interface Window {
    __POKET_REPORT_ERROR__?: ReportHook;
  }
}

export function reportError(error: unknown, context?: Record<string, string>): ErrorReport {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  const report: ErrorReport = { message, context, at: new Date().toISOString() };
  if (typeof window !== 'undefined' && typeof window.__POKET_REPORT_ERROR__ === 'function') {
    try {
      window.__POKET_REPORT_ERROR__(report);
    } catch {
      // A broken sink must not hide the original failure.
    }
  }
  console.error('[poket]', report.message, report.context ?? '');
  return report;
}
