'use client';

/**
 * Pip — the in-app onboarding guide.
 *
 * Spotlights real elements rather than showing screenshots: it navigates to the
 * step's route, waits for `[data-tour="…"]` to exist, then cuts a hole in a dim
 * overlay around it. A step whose target never appears is skipped instead of
 * leaving people staring at an arrow pointing nowhere.
 *
 * The ask box sends a typed question to /api/ai/tour, which picks and orders
 * steps from the real catalogue — so a generated walkthrough can never point at
 * a screen that does not exist.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, ArrowRight, ArrowLeft, Loader2, Send, RotateCcw } from 'lucide-react';
import {
  defaultTour, getStep, matchSteps, type TourRole, type TourStep,
} from '@/lib/tour-steps';

const SEEN_KEY = 'poket-pip-onboarded';

/* ── The character ─────────────────────────────────────────────── */

/**
 * Pip, drawn inline so it needs no asset, scales cleanly and can react.
 * `mood` drives the eyes and mouth; `size` keeps one drawing usable as both a
 * 40px button and a 96px guide.
 */
export function PipCharacter({
  size = 72, mood = 'happy', className = '',
}: { size?: number; mood?: 'happy' | 'thinking' | 'waving'; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 120 120" className={className}
      role="img" aria-label="Pip, your guide"
    >
      <defs>
        <linearGradient id="pip-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5B8DEF" />
          <stop offset="55%" stopColor="#2786A4" />
          <stop offset="100%" stopColor="#1E6A83" />
        </linearGradient>
        <radialGradient id="pip-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* antenna */}
      <line x1="60" y1="24" x2="60" y2="12" stroke="#1E6A83" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="9" r="6" fill="#E2AF4D">
        <animate attributeName="r" values="6;7;6" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* body */}
      <rect x="18" y="24" width="84" height="74" rx="26" fill="url(#pip-body)" />
      <rect x="18" y="24" width="84" height="74" rx="26" fill="url(#pip-glow)" />

      {/* face plate */}
      <rect x="30" y="38" width="60" height="40" rx="18" fill="#203337" opacity="0.92" />

      {/* eyes */}
      {mood === 'thinking' ? (
        <>
          <rect x="41" y="55" width="12" height="4" rx="2" fill="#7FD7FF" />
          <rect x="67" y="55" width="12" height="4" rx="2" fill="#7FD7FF" />
        </>
      ) : (
        <>
          <circle cx="47" cy="56" r="6" fill="#7FD7FF">
            <animate attributeName="ry" values="6;6;0.6;6;6" dur="4.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="73" cy="56" r="6" fill="#7FD7FF">
            <animate attributeName="ry" values="6;6;0.6;6;6" dur="4.5s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* mouth */}
      {mood === 'thinking' ? (
        <circle cx="60" cy="69" r="3" fill="#7FD7FF" opacity="0.85" />
      ) : (
        <path d="M52 67 Q60 74 68 67" stroke="#7FD7FF" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}

      {/* cheeks */}
      <circle cx="36" cy="66" r="4" fill="#EC4899" opacity="0.5" />
      <circle cx="84" cy="66" r="4" fill="#EC4899" opacity="0.5" />

      {/* arms */}
      <rect x="6" y="52" width="12" height="26" rx="6" fill="#2786A4" />
      {mood === 'waving' ? (
        <g style={{ transformOrigin: '108px 58px' }}>
          <rect x="102" y="40" width="12" height="26" rx="6" fill="#1E6A83">
            <animateTransform attributeName="transform" type="rotate"
              values="0 108 58; -22 108 58; 0 108 58" dur="1.4s" repeatCount="indefinite" />
          </rect>
        </g>
      ) : (
        <rect x="102" y="52" width="12" height="26" rx="6" fill="#1E6A83" />
      )}

      {/* feet */}
      <rect x="34" y="96" width="20" height="10" rx="5" fill="#203337" opacity="0.8" />
      <rect x="66" y="96" width="20" height="10" rx="5" fill="#203337" opacity="0.8" />
    </svg>
  );
}

/* ── Spotlight geometry ────────────────────────────────────────── */

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 10;

function rectOf(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: Math.max(0, r.top - PAD),
    left: Math.max(0, r.left - PAD),
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

/** Wait for an element to exist, polling because routes render asynchronously. */
function waitForTarget(selector: string, timeout = 2500): Promise<Rect | null> {
  return new Promise(resolve => {
    const started = Date.now();
    const tick = () => {
      const r = rectOf(selector);
      if (r) return resolve(r);
      if (Date.now() - started > timeout) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/* ── The guide ─────────────────────────────────────────────────── */

export function PipGuide({ role }: { role: TourRole }) {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [moving, setMoving] = useState(false);

  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [intro, setIntro] = useState<string | null>(null);

  const cancelled = useRef(false);

  const step = steps[index];

  /* First-run: offer the tour once, after the dashboard has settled. */
  useEffect(() => {
    let seen = true;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* private mode */ }
    if (seen) return;
    const t = setTimeout(() => { startTour(defaultTour(role)); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ } };

  const startTour = useCallback((list: TourStep[], introText?: string) => {
    if (!list.length) return;
    cancelled.current = false;
    setSteps(list);
    setIndex(0);
    setIntro(introText ?? null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    cancelled.current = true;
    setOpen(false);
    setRect(null);
    setAsking(false);
    setIntro(null);
    markSeen();
  }, []);

  /* Move to the current step: navigate, wait, spotlight. */
  useEffect(() => {
    if (!open || !step) return;
    let stale = false;
    setMoving(true);

    (async () => {
      if (step.route && pathname !== step.route) {
        router.push(step.route);
        // Give the route a moment to commit before hunting for the target.
        await new Promise(r => setTimeout(r, 450));
      }
      if (stale || cancelled.current) return;

      if (!step.target) { setRect(null); setMoving(false); return; }

      const found = await waitForTarget(`[data-tour="${step.target}"]`);
      if (stale || cancelled.current) return;

      if (!found) {
        // Target absent for this role or plan — skip rather than point at nothing.
        setMoving(false);
        setIndex(i => (i + 1 < steps.length ? i + 1 : i));
        return;
      }
      document.querySelector(`[data-tour="${step.target}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setRect(found);
      setMoving(false);
    })();

    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, step?.id]);

  /* Keep the cutout glued to the element while things move. */
  useEffect(() => {
    if (!open || !step?.target) return;
    const sync = () => setRect(rectOf(`[data-tour="${step.target}"]`));
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [open, step?.target]);

  /* Keyboard: Escape closes, arrows move. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (asking) return;
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, steps.length, asking, close]);

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    try {
      const res = await fetch('/api/ai/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, role }),
      });
      const data = await res.json().catch(() => ({}));
      const planned = (Array.isArray(data.steps) ? data.steps : [])
        .map((s: { id: string; note?: string }) => ({ step: getStep(s.id), note: s.note }))
        .filter((x: { step?: TourStep }) => !!x.step) as { step: TourStep; note?: string }[];

      const list = planned.length ? planned.map(p => p.step) : matchSteps(q, role);
      setNotes(Object.fromEntries(planned.filter(p => p.note).map(p => [p.step.id, p.note!])));
      setQuestion('');
      startTour(list, typeof data.intro === 'string' ? data.intro : undefined);
    } catch {
      // Never leave the ask box spinning — fall back to keyword matching.
      setNotes({});
      startTour(matchSteps(q, role));
      setQuestion('');
    } finally {
      setAsking(false);
    }
  };

  /* Card position: beside the spotlight when there is room, else centred. */
  const cardStyle = useMemo((): React.CSSProperties => {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const vw = window.innerWidth, vh = window.innerHeight;
    const CARD_W = 372, CARD_H = 260;
    const below = rect.top + rect.height + 16;
    const top = below + CARD_H < vh ? below : Math.max(16, rect.top - CARD_H - 16);
    const left = Math.min(Math.max(16, rect.left), vw - CARD_W - 16);
    return { top, left };
  }, [rect]);

  const isLast = index >= steps.length - 1;

  return (
    <>
      {/* Trigger — top-left of the dashboard chrome */}
      <button
        onClick={() => (open ? close() : startTour(defaultTour(role)))}
        data-tour="pip-trigger"
        title="Show me around"
        aria-label="Open the guided tour"
        className="relative flex items-center gap-2 h-9 pl-1 pr-3 rounded-full border border-border bg-card hover:bg-muted transition-colors group"
      >
        <PipCharacter size={28} mood="waving" />
        <span className="text-xs font-bold text-foreground hidden sm:inline">Show me around</span>
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#E2AF4D] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
          >
            {/* Dim with a cutout. Four panels rather than an SVG mask so the
                hole stays crisp and the element underneath stays clickable. */}
            {rect ? (
              <>
                <div className="absolute bg-black/65 left-0 right-0" style={{ top: 0, height: rect.top }} onClick={close} />
                <div className="absolute bg-black/65 left-0" style={{ top: rect.top, height: rect.height, width: rect.left }} onClick={close} />
                <div className="absolute bg-black/65 right-0" style={{ top: rect.top, height: rect.height, left: rect.left + rect.width }} onClick={close} />
                <div className="absolute bg-black/65 left-0 right-0 bottom-0" style={{ top: rect.top + rect.height }} onClick={close} />
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                  className="absolute rounded-2xl ring-4 ring-[#E2AF4D] pointer-events-none"
                  style={{ ...rect, boxShadow: '0 0 0 9999px rgba(0,0,0,0)' }}
                />
              </>
            ) : (
              <div className="absolute inset-0 bg-black/70" onClick={close} />
            )}

            {/* The card */}
            <motion.div
              key={step?.id ?? 'ask'}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="absolute w-[372px] max-w-[calc(100vw-32px)] bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
              style={cardStyle}
            >
              {/* header */}
              <div className="flex items-start gap-3 p-5 pb-3 bg-gradient-to-br from-[#2786A4]/8 to-[#1E6A83]/8">
                <div className="shrink-0 -mt-1">
                  <PipCharacter size={56} mood={moving || asking ? 'thinking' : 'happy'} />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1E6A83]">
                    Pip · your guide
                  </p>
                  <h3 className="font-heading text-lg text-foreground leading-snug mt-0.5">
                    {step?.title ?? 'What would you like to know?'}
                  </h3>
                </div>
                <button onClick={close} aria-label="Close the tour"
                  className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 pb-4">
                {intro && index === 0 && (
                  <p className="text-xs text-[#1E6A83] font-semibold mb-2">{intro}</p>
                )}
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {(step && notes[step.id]) || step?.body}
                </p>

                {/* Ask box */}
                <div className="mt-4 flex items-center gap-2">
                  <input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ask(); } }}
                    placeholder="Ask me anything — e.g. how do I add a course?"
                    aria-label="Ask Pip what you want to learn"
                    disabled={asking}
                    className="flex-1 min-w-0 h-9 rounded-full border border-border bg-background px-3.5 text-xs outline-none focus:border-[#1E6A83] disabled:opacity-60"
                  />
                  <button
                    onClick={ask} disabled={asking || !question.trim()}
                    aria-label="Build my walkthrough"
                    className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-gradient-to-br from-[#2786A4] to-[#1E6A83] text-white disabled:opacity-40"
                  >
                    {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* footer */}
              <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-muted/30">
                <div className="flex items-center gap-1.5 flex-1">
                  {steps.map((s, i) => (
                    <span key={s.id}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? 'w-5 bg-[#1E6A83]' : i < index ? 'w-1.5 bg-[#1E6A83]/40' : 'w-1.5 bg-border'
                      }`} />
                  ))}
                </div>

                {index > 0 && (
                  <button onClick={() => setIndex(i => Math.max(0, i - 1))}
                    className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                    aria-label="Previous step">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}

                {isLast ? (
                  <button onClick={close}
                    className="h-9 px-4 rounded-full text-xs font-bold bg-foreground text-background">
                    Got it
                  </button>
                ) : (
                  <button onClick={() => setIndex(i => i + 1)} disabled={moving}
                    className="h-9 px-4 rounded-full text-xs font-bold bg-gradient-to-r from-[#2786A4] to-[#1E6A83] text-white flex items-center gap-1.5 disabled:opacity-60">
                    {moving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Next <ArrowRight className="w-3.5 h-3.5" /></>}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
