'use client';

import { useEffect, useRef, useState } from 'react';
import { authedFetch, postJSON } from '@/lib/authed-fetch';
import { BRAND } from '@/lib/brand';
import { useAuthSTORE } from '@/hooks/use-auth';
import { COMMUNITY_PARTNERS_LINE, SHORT_BODY, UNDER_13_DISCLAIMER, shortHeadline } from '@/lib/safety/disclaimer';

function useUnder13(): boolean {
  const user = useAuthSTORE(state => state.user);
  const ageTier = useAuthSTORE(state => state.profile?.ageTier);
  return Boolean(user) && (ageTier === 'under13' || !ageTier);
}

export function SafetyDisclaimerFooter({ emergencyNumber = '999' }: { emergencyNumber?: string }) {
  const under13 = useUnder13();
  return (
    <footer className="grid gap-2 text-sm text-foreground" data-safety-disclaimer="footer">
      {under13 ? (
        <p>{UNDER_13_DISCLAIMER}</p>
      ) : (
        <>
          <p className="font-semibold">{shortHeadline(emergencyNumber)}</p>
          <p>{SHORT_BODY}</p>
        </>
      )}
      <a className="font-semibold text-primary" href="/safety-terms">Read the full terms</a>
      <p>{COMMUNITY_PARTNERS_LINE}</p>
      <a className="font-semibold text-primary" href="/community-partners">Get involved</a>
    </footer>
  );
}

export function SafetyTermsNotice({
  sample = false,
  emergencyNumber = '999',
  onAcked,
}: {
  sample?: boolean;
  emergencyNumber?: string;
  onAcked?: () => void;
}) {
  const onAckedRef = useRef(onAcked);
  onAckedRef.current = onAcked;
  const [needsAck, setNeedsAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sample) {
      onAckedRef.current?.();
      return;
    }
    let gone = false;
    void authedFetch('/api/safety/terms')
      .then(async (res) => res.json().catch(() => ({})))
      .then((data: { needsAck?: boolean }) => {
        if (gone) return;
        if (data.needsAck === false) {
          setNeedsAck(false);
          onAckedRef.current?.();
        } else {
          setNeedsAck(true);
        }
      })
      .catch(() => {
        if (!gone) setNeedsAck(true);
      });
    return () => { gone = true; };
  }, [sample]);

  const accept = async () => {
    if (sample) {
      setNeedsAck(false);
      onAckedRef.current?.();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await postJSON('/api/safety/terms-ack', {});
      setNeedsAck(false);
      onAckedRef.current?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <SafetyDisclaimerFooter emergencyNumber={emergencyNumber} />
      {needsAck ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void accept()}
          className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold"
          style={{ background: BRAND.cyan, color: BRAND.ink, border: `1px solid ${BRAND.blueDeep}` }}
        >
          I understand
        </button>
      ) : null}
      {error ? <p className="text-sm">{error}</p> : null}
    </section>
  );
}

export function GetInvolvedLink() {
  return (
    <a href="/community-partners" className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold" style={{ background: BRAND.cyan, color: BRAND.ink, border: `1px solid ${BRAND.blueDeep}` }}>
      Get involved
    </a>
  );
}

export function SafetyTermsChildView() {
  const under13 = useUnder13();
  if (!under13) return null;
  return (
    <>
      <p className="text-lg font-semibold text-foreground">{UNDER_13_DISCLAIMER}</p>
      <style>{'#safety-clauses{display:none}'}</style>
    </>
  );
}
