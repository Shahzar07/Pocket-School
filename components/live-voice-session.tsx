'use client';

/**
 * Live voice conversation with an AI teacher.
 *
 * Continuous loop: listen (Web Speech API) → transcribe → send to the tutor →
 * speak the reply in that teacher's own voice → listen again. The student can
 * interrupt at any time (barge-in): speaking over the teacher stops playback
 * and starts a new turn immediately, like a real conversation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, PhoneOff, Loader2, Volume2, AlertCircle, Hand } from 'lucide-react';
import type { AiTeacher } from '@/lib/ai-teachers';
import { Speaker } from '@/lib/speech';
/** App language → BCP-47 tag the recogniser expects. */
import { RECOGNITION_LANG } from '@/lib/languages';

/* Minimal typings for the vendor-prefixed Web Speech API. */
interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface LiveVoiceSessionProps {
  teacher: AiTeacher;
  lang: string;
  /**
   * Ask the tutor for a reply. Call `say` with each sentence as it streams in
   * so the teacher starts talking straight away; honour `signal` so an
   * interruption stops the stream. Resolves with the full reply text.
   */
  onAsk: (text: string, say: (sentence: string) => void, signal: AbortSignal) => Promise<string>;
  onClose: () => void;
  /** Show the student's camera beside the teacher during a video session. */
  camera?: boolean;
}

/** Loudness that counts as the student speaking, and for how long. Tuned so
 * the teacher's own voice leaking from laptop speakers doesn't interrupt her. */
const BARGE_RMS = 0.16;
const BARGE_FRAMES = 14; // ~230ms of sustained speech at 60fps
const BARGE_GRACE_MS = 450; // ignore the first moment of each clip

export function LiveVoiceSession({ teacher, lang, onAsk, onClose, camera = false }: LiveVoiceSessionProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [interim, setInterim] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0); // 0..1 mic loudness, drives the orb

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(true);      // session still open
  const busyRef = useRef(false);       // a turn is in flight
  const bargedRef = useRef(false);     // the student cut in during this turn
  const mutedRef = useRef(false);
  const finalRef = useRef('');         // accumulated final transcript
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speakStartRef = useRef(0);

  /*
   * Callbacks from the parent change identity on every render — and the
   * parent re-renders on every streamed token. Reading them through refs
   * keeps the recogniser and microphone alive for the whole call; before,
   * they were torn down and rebuilt dozens of times per reply.
   */
  const onAskRef = useRef(onAsk);
  useEffect(() => { onAskRef.current = onAsk; }, [onAsk]);

  const speakerRef = useRef<Speaker | null>(null);
  if (!speakerRef.current) {
    speakerRef.current = new Speaker({
      voice: teacher.voice,
      style: teacher.voiceStyle,
      lang: RECOGNITION_LANG[lang] ?? 'en-GB',
      onSpeakingChange: (on) => {
        if (on) speakStartRef.current = performance.now();
        if (!activeRef.current) return;
        if (on) setState('speaking');
      },
    });
  }
  useEffect(() => {
    speakerRef.current?.setOptions({ voice: teacher.voice, style: teacher.voiceStyle, lang: RECOGNITION_LANG[lang] ?? 'en-GB' });
  }, [teacher.voice, teacher.voiceStyle, lang]);

  /** Cut the teacher off: stop audio, cancel the stream, hand the floor back. */
  const interrupt = useCallback(() => {
    bargedRef.current = true;
    abortRef.current?.abort();
    speakerRef.current?.stop();
    if (activeRef.current && !mutedRef.current) setState('listening');
  }, []);

  /* ── Mic level meter (also powers barge-in detection) ── */
  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: camera ? { facingMode: 'user' } : false,
      });
      streamRef.current = stream;
      if (camera && cameraRef.current) {
        cameraRef.current.srcObject = stream;
        await cameraRef.current.play().catch(() => undefined);
      }
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let loudFrames = 0;
      let lastLevel = -1;

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Only re-render when the orb would visibly change.
        const lvl = Math.round(Math.min(1, rms * 4) * 20) / 20;
        if (lvl !== lastLevel) { lastLevel = lvl; setLevel(lvl); }

        // Barge-in needs sustained speech, not one loud frame — otherwise
        // the teacher's own voice through the speakers cut her off.
        const sp = speakerRef.current;
        const talking = sp?.audible && performance.now() - speakStartRef.current > BARGE_GRACE_MS;
        loudFrames = talking && rms > BARGE_RMS ? loudFrames + 1 : 0;
        if (loudFrames >= BARGE_FRAMES && !mutedRef.current) {
          loudFrames = 0;
          interrupt();
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch {
      setError('Microphone access was blocked. Allow it in your browser to talk to your teacher.');
      return false;
    }
  }, [camera, interrupt]);

  /* ── One conversational turn ── */
  const handleUtterance = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || busyRef.current || !activeRef.current) return;
    busyRef.current = true;
    bargedRef.current = false;
    finalRef.current = '';
    setInterim('');
    setState('thinking');
    const speaker = speakerRef.current!;
    const turn = speaker.begin();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const reply = await onAskRef.current(clean, (sentence) => speaker.enqueue(sentence, turn), ctrl.signal);
      if (!activeRef.current) return;
      if (!bargedRef.current) setLastReply(reply);
      await speaker.whenIdle();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError') && !bargedRef.current) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      busyRef.current = false;
      if (activeRef.current) setState(mutedRef.current ? 'idle' : 'listening');
    }
  }, []);

  /* ── Continuous recognition loop — lives for the whole call ── */
  useEffect(() => {
    activeRef.current = true;
    const rec = getRecognition();
    if (!rec) {
      setError('Live voice needs the Web Speech API — try Chrome, Edge or Safari.');
      return;
    }
    recognitionRef.current = rec;
    rec.lang = RECOGNITION_LANG[lang] ?? 'en-GB';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      if (mutedRef.current) return;
      // While the teacher is mid-turn, what the mic hears is mostly her own
      // voice — unless the student has cut in, in which case we listen.
      if (busyRef.current && !bargedRef.current) return;
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += ' ' + r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText || finalRef.current.trim());

      // Send once the student pauses — an end-of-utterance heuristic.
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        const said = (finalRef.current + ' ' + interimText).trim();
        if (said.length > 1 && !busyRef.current) handleUtterance(said);
      }, 850);
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission denied. Enable it to talk to your teacher.');
        activeRef.current = false;
      }
      // 'no-speech' / 'aborted' are normal — onend restarts us.
    };

    rec.onend = () => {
      // Chrome ends recognition periodically; restart while the session is open.
      if (activeRef.current) { try { rec.start(); } catch { /* already started */ } }
    };

    (async () => {
      const ok = await startMeter();
      if (!ok || !activeRef.current) return;
      try { rec.start(); setState('listening'); } catch { /* already running */ }
    })();

    const speaker = speakerRef.current;
    return () => {
      activeRef.current = false;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      try { rec.onend = null; rec.abort(); } catch { /* noop */ }
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      abortRef.current?.abort();
      speaker?.stop();
    };
  }, [lang, handleUtterance, startMeter]);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      finalRef.current = '';
      setInterim('');
      if (!busyRef.current) setState('idle');
    } else if (!busyRef.current) setState('listening');
  };

  const accent = teacher.accentColor;
  const statusLabel =
    error ? 'Connection issue'
    : muted ? 'Muted — tap the mic to talk'
    : state === 'listening' ? 'Listening…'
    : state === 'thinking' ? `${teacher.name} is thinking…`
    : state === 'speaking' ? `${teacher.name} is speaking…`
    : 'Starting…';

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#07070E]/95 backdrop-blur-md px-6">
      {/* Orb */}
      <div className="relative mb-8">
        {/* Reactive rings — expand with mic level while listening */}
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: accent }}
            animate={{
              scale: state === 'listening' ? 1 + level * (0.35 + i * 0.22) + i * 0.12
                   : state === 'speaking' ? [1 + i * 0.14, 1.14 + i * 0.14, 1 + i * 0.14]
                   : 1 + i * 0.1,
              opacity: state === 'idle' ? 0.08 : 0.32 - i * 0.09,
            }}
            transition={state === 'speaking'
              ? { repeat: Infinity, duration: 1.5, delay: i * 0.18 }
              : { type: 'spring', damping: 18, stiffness: 220 }}
          />
        ))}
        {camera && (
          <video
            ref={cameraRef}
            muted
            playsInline
            className="absolute -right-16 top-2 z-10 w-24 h-32 rounded-2xl object-cover border border-white/20 bg-black"
          />
        )}
        <motion.div
          className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden ring-2 shadow-2xl"
          style={{ boxShadow: `0 0 90px -10px ${accent}`, borderColor: accent }}
          animate={{ scale: state === 'speaking' ? [1, 1.04, 1] : 1 }}
          transition={{ repeat: state === 'speaking' ? Infinity : 0, duration: 0.7 }}
        >
          <img src={teacher.avatarUrl} alt={teacher.name} className="w-full h-full object-cover" style={{ background: `${accent}22` }} />
          {state === 'thinking' && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          )}
        </motion.div>
      </div>

      <h2 className="font-heading text-2xl sm:text-3xl text-white mb-1">{teacher.name}</h2>
      <p className="text-sm mb-1" style={{ color: accent }}>{statusLabel}</p>
      <p className="text-[11px] text-white/35 mb-6">Voice: {teacher.voice} · speak any time to interrupt</p>

      {/* Live captions */}
      <div className="w-full max-w-xl min-h-[76px] mb-8">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </motion.div>
          ) : interim ? (
            <motion.p key="interim" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="text-center text-lg text-white/90 leading-relaxed">
              {interim}
              <motion.span className="inline-block w-2 h-5 ml-1 align-middle" style={{ background: accent }}
                animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.7 }} />
            </motion.p>
          ) : lastReply ? (
            <motion.p key="reply" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm text-white/55 leading-relaxed line-clamp-3">
              <Volume2 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" style={{ color: accent }} />
              {lastReply.replace(/[*#`_$]/g, '').slice(0, 260)}
            </motion.p>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center text-sm text-white/40">
              Just start talking — ask a question, or say “teach me something new”.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === 'speaking' && (
          <button
            onClick={interrupt}
            className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/15 transition-colors"
            title="Interrupt — your turn to talk"
          >
            <Hand className="w-6 h-6" />
          </button>
        )}
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 ${
            muted ? 'bg-white/10 text-white/60' : 'text-black'
          }`}
          style={muted ? undefined : { background: accent }}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button
          onClick={() => { activeRef.current = false; abortRef.current?.abort(); speakerRef.current?.stop(); onClose(); }}
          className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-105 transition-transform"
          title="End voice call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>

      <p className="text-[11px] text-white/25 mt-6 text-center max-w-sm">
        Everything you both say is added to the lesson transcript.
      </p>
    </div>
  );
}
