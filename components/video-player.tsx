'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Captions, CaptionsOff, Image as ImageIcon, Loader2, Maximize, Minimize, Pause, Play,
  SkipBack, SkipForward, Sparkles, Video,
} from 'lucide-react';
import { parseScenes, type Scene } from '@/components/video-storyboard';

const SCENE_THEMES = [
  'from-indigo-950 via-blue-900 to-slate-950',
  'from-purple-950 via-fuchsia-900 to-slate-950',
  'from-teal-950 via-cyan-900 to-slate-950',
  'from-rose-950 via-red-900 to-slate-950',
  'from-amber-950 via-orange-900 to-slate-950',
  'from-emerald-950 via-green-900 to-slate-950',
];

/** Rough speech duration estimate for browser-voice progress (words ÷ 2.6/s). */
function estimateSeconds(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, words / 2.6);
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Playable video lesson. Renders the AI storyboard as an animated,
 * narrated scene player: each scene shows its title + visual direction on a
 * themed stage while the narration is spoken aloud (browser voice by
 * default, upgradeable to AI HD voice via /api/ai/audio). Scenes advance
 * automatically; the timeline scrubber, captions toggle and fullscreen all
 * work like a normal video player.
 */
export function VideoPlayer({ script, title }: { script: string; title?: string }) {
  const scenes = useMemo(() => parseScenes(script), [script]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [sceneProgress, setSceneProgress] = useState(0); // 0..1 within scene
  const [hdState, setHdState] = useState<'off' | 'generating' | 'on' | 'unavailable'>('off');
  const [hdProgress, setHdProgress] = useState(0);

  // AI-generated scene visuals
  const [images, setImages] = useState<(string | null)[]>(() => scenes.map(() => null));
  const [visualsState, setVisualsState] = useState<'idle' | 'generating' | 'done' | 'unavailable'>('idle');
  const [visualsProgress, setVisualsProgress] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hdClips = useRef<(string | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playingRef = useRef(false);
  const currentRef = useRef(0);

  const durations = useMemo(() => scenes.map(s => estimateSeconds(s.narration || s.title)), [scenes]);
  const totalDuration = useMemo(() => durations.reduce((a, b) => a + b, 0), [durations]);
  const elapsedBefore = useMemo(() => {
    const arr: number[] = [];
    let acc = 0;
    for (const d of durations) { arr.push(acc); acc += d; }
    return arr;
  }, [durations]);

  const stopNarration = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Generate a real illustration for every scene, in order. Runs once per
  // script; each image pops in as it arrives. If the provider can't produce
  // images we quietly fall back to the animated gradient stage.
  const generateVisuals = useCallback(async () => {
    setVisualsState('generating');
    setVisualsProgress(0);
    let anyOk = false;
    for (let i = 0; i < scenes.length; i++) {
      try {
        const res = await fetch('/api/ai/scene-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visual: scenes[i].visual || scenes[i].narration.slice(0, 200), title: scenes[i].title }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.image) {
          anyOk = true;
          setImages(prev => { const next = [...prev]; next[i] = data.image; return next; });
        }
      } catch { /* keep gradient for this scene */ }
      setVisualsProgress((i + 1) / scenes.length);
    }
    setVisualsState(anyOk ? 'done' : 'unavailable');
  }, [scenes]);

  // Reset + kick off visual generation whenever the script changes.
  useEffect(() => {
    setImages(scenes.map(() => null));
    setVisualsState('idle');
    let cancelled = false;
    const t = setTimeout(() => { if (!cancelled) generateVisuals(); }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [scenes, generateVisuals]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      stopNarration();
    };
  }, [stopNarration]);

  const playScene = useCallback((index: number) => {
    stopNarration();
    if (index >= scenes.length) {
      setPlaying(false);
      playingRef.current = false;
      setCurrent(0);
      currentRef.current = 0;
      setSceneProgress(0);
      return;
    }
    setCurrent(index);
    currentRef.current = index;
    setSceneProgress(0);

    const scene = scenes[index];
    const narration = scene.narration || scene.title;
    const advance = () => { if (playingRef.current) playScene(index + 1); };

    const clip = hdClips.current[index];
    if (hdState === 'on' && clip) {
      const audio = new Audio(clip);
      audioRef.current = audio;
      audio.onended = advance;
      audio.onerror = advance;
      audio.ontimeupdate = () => {
        if (audio.duration) setSceneProgress(audio.currentTime / audio.duration);
      };
      audio.play().catch(advance);
      return;
    }

    // Browser-voice narration with time-based progress estimation.
    const est = estimateSeconds(narration);
    const startAt = Date.now();
    timerRef.current = setInterval(() => {
      setSceneProgress(Math.min(1, (Date.now() - startAt) / 1000 / est));
    }, 200);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(narration.replace(/\s+/g, ' '));
      utter.rate = 1;
      utter.onend = advance;
      utter.onerror = advance;
      window.speechSynthesis.speak(utter);
    } else {
      // No speech support — advance on the estimated timer instead.
      setTimeout(advance, est * 1000);
    }
  }, [scenes, hdState, stopNarration]);

  const togglePlay = () => {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      stopNarration();
    } else {
      playingRef.current = true;
      setPlaying(true);
      playScene(currentRef.current);
    }
  };

  const jumpTo = (index: number) => {
    const target = Math.max(0, Math.min(scenes.length - 1, index));
    setCurrent(target);
    currentRef.current = target;
    setSceneProgress(0);
    if (playingRef.current) playScene(target);
    else stopNarration();
  };

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current.requestFullscreen().catch(() => {});
  };

  const generateHd = async () => {
    setHdState('generating');
    setHdProgress(0);
    const clips: (string | null)[] = [];
    for (let i = 0; i < scenes.length; i++) {
      try {
        const res = await fetch('/api/ai/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: scenes[i].narration || scenes[i].title, voice: 'Charon' }),
        });
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && type.includes('audio')) {
          clips.push(URL.createObjectURL(await res.blob()));
        } else {
          // Provider unavailable — abandon HD generation entirely.
          setHdState('unavailable');
          return;
        }
      } catch {
        setHdState('unavailable');
        return;
      }
      setHdProgress((i + 1) / scenes.length);
    }
    hdClips.current = clips;
    setHdState('on');
  };

  const theme = SCENE_THEMES[current % SCENE_THEMES.length];
  const scene: Scene | undefined = scenes[current];
  const elapsed = (elapsedBefore[current] ?? 0) + (durations[current] ?? 0) * sceneProgress;

  if (!scene) return null;

  return (
    <div className="space-y-3">
      {/* Stage */}
      <div
        ref={stageRef}
        className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 select-none group"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`absolute inset-0 bg-gradient-to-br ${theme}`}
          >
            {images[current] ? (
              <>
                {/* AI-generated scene visual with a slow Ken Burns zoom/pan */}
                <motion.img
                  src={images[current]!}
                  alt={scene.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  initial={{ scale: 1.04, x: 0, y: 0 }}
                  animate={{ scale: 1.16, x: current % 2 ? -18 : 18, y: current % 2 ? 12 : -12 }}
                  transition={{ duration: (durations[current] ?? 8) + 2, ease: 'linear' }}
                />
                {/* Legibility gradient for the caption + title zone */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] text-white/70 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                    Scene {current + 1} of {scenes.length}
                  </span>
                </div>
                <div className="absolute top-14 sm:top-16 left-0 right-0 px-6 text-center">
                  <motion.h3
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="font-heading text-lg sm:text-2xl lg:text-3xl text-white leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                  >
                    {scene.title}
                  </motion.h3>
                </div>
              </>
            ) : (
              <>
                {/* Fallback: animated gradient stage (visual still generating / unavailable) */}
                <motion.div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/5 blur-3xl"
                  animate={{ x: [0, 40, 0], y: [0, 24, 0] }} transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }} />
                <motion.div className="absolute -bottom-20 -right-10 w-80 h-80 rounded-full bg-white/5 blur-3xl"
                  animate={{ x: [0, -30, 0], y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 18, ease: 'easeInOut' }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 sm:px-16 text-center">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] text-white/50 mb-3">
                    Scene {current + 1} of {scenes.length}
                  </p>
                  <h3 className="font-heading text-xl sm:text-3xl lg:text-4xl text-white leading-tight max-w-3xl">
                    {scene.title}
                  </h3>
                  {scene.visual && (
                    <p className="mt-4 text-xs sm:text-sm italic text-cyan-200/70 max-w-xl">{scene.visual}</p>
                  )}
                  {visualsState === 'generating' && (
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] text-white/60">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Painting this scene…
                    </span>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Big play overlay when paused */}
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 transition-opacity"
            aria-label="Play video"
          >
            <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-400 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform">
              <Play className="w-7 h-7 sm:w-9 sm:h-9 text-slate-950 ml-1" />
            </span>
          </button>
        )}

        {/* Captions */}
        {captionsOn && playing && scene.narration && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 max-w-[85%] px-4 py-2 rounded-lg bg-black/70 backdrop-blur-sm">
            <p className="text-xs sm:text-sm text-white text-center leading-relaxed line-clamp-3">
              {scene.narration.replace(/\s+/g, ' ').slice(0, 220)}
            </p>
          </div>
        )}

        {/* Control bar */}
        <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-3 pt-8 bg-gradient-to-t from-black/80 to-transparent">
          {/* Segmented scrubber — one segment per scene */}
          <div className="flex items-center gap-1 mb-2.5">
            {scenes.map((_, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden"
                title={`Scene ${i + 1}: ${scenes[i].title}`}
              >
                <div
                  className="h-full bg-amber-400 rounded-full transition-[width] duration-200"
                  style={{ width: i < current ? '100%' : i === current ? `${sceneProgress * 100}%` : '0%' }}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => jumpTo(current - 1)} className="text-white/80 hover:text-white" aria-label="Previous scene">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={togglePlay} className="text-white hover:text-amber-300" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={() => jumpTo(current + 1)} className="text-white/80 hover:text-white" aria-label="Next scene">
              <SkipForward className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-white/70 tabular-nums">
              {fmtTime(elapsed)} / {fmtTime(totalDuration)}
            </span>
            <span className="flex-1" />
            {visualsState === 'generating' && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/70" title="Generating scene visuals">
                <ImageIcon className="w-3.5 h-3.5" /> {Math.round(visualsProgress * 100)}%
              </span>
            )}
            {visualsState === 'unavailable' && (
              <button
                onClick={generateVisuals}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
                title="Retry generating scene visuals"
              >
                <ImageIcon className="w-3.5 h-3.5" /> Retry visuals
              </button>
            )}
            {hdState === 'off' && (
              <button
                onClick={generateHd}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
                title="Generate studio-quality AI narration"
              >
                <Sparkles className="w-3.5 h-3.5" /> HD Voice
              </button>
            )}
            {hdState === 'generating' && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/70">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {Math.round(hdProgress * 100)}%
              </span>
            )}
            {hdState === 'on' && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" /> HD
              </span>
            )}
            <button onClick={() => setCaptionsOn(c => !c)} className="text-white/80 hover:text-white" aria-label="Toggle captions">
              {captionsOn ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />}
            </button>
            <button onClick={toggleFullscreen} className="text-white/80 hover:text-white" aria-label="Fullscreen">
              {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Video className="w-3.5 h-3.5" />
        <span className="font-semibold">{title ?? 'Video Lesson'}</span>
        <span>·</span>
        <span>{scenes.length} scenes</span>
        <span>·</span>
        <span>~{fmtTime(totalDuration)}</span>
        <span>·</span>
        <span>{hdState === 'on' ? 'AI HD narration' : 'Narrated'}</span>
      </div>
    </div>
  );
}
