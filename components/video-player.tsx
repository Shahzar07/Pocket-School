'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Captions, CaptionsOff, Globe, Image as ImageIcon, Loader2, Maximize, Minimize, Pause, Play,
  SkipBack, SkipForward, Sparkles, Video, Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseScenes, type Scene } from '@/components/video-storyboard';

const SCENE_THEMES = [
  'from-indigo-950 via-blue-900 to-slate-950',
  'from-purple-950 via-fuchsia-900 to-slate-950',
  'from-teal-950 via-cyan-900 to-slate-950',
  'from-rose-950 via-red-900 to-slate-950',
  'from-amber-950 via-orange-900 to-slate-950',
  'from-emerald-950 via-green-900 to-slate-950',
];

/** Languages the video can be translated + narrated into. */
const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ur', label: 'اردو', flag: '🇵🇰' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
];

/** BCP-47 hints for picking a matching browser voice per app language. */
const LANG_BCP47: Record<string, string> = {
  en: 'en', ar: 'ar', es: 'es', fr: 'fr', de: 'de', pt: 'pt', zh: 'zh',
  hi: 'hi', ur: 'ur', tr: 'tr', ja: 'ja', ko: 'ko', it: 'it', ru: 'ru', sw: 'sw',
};

/**
 * Pick the most natural-sounding available browser voice for a language.
 * Prefers cloud / neural / named premium voices over the flat default.
 */
function pickBrowserVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return null;
  const prefix = (LANG_BCP47[lang] ?? 'en').toLowerCase();
  const inLang = all.filter(v => v.lang.toLowerCase().startsWith(prefix));
  const pool = inLang.length ? inLang : all.filter(v => v.lang.toLowerCase().startsWith('en'));
  const preferred = ['Google', 'Natural', 'Neural', 'Premium', 'Enhanced', 'Samantha', 'Serena', 'Karen', 'Daniel', 'Moira', 'Aria'];
  for (const name of preferred) {
    const hit = pool.find(v => v.name.includes(name));
    if (hit) return hit;
  }
  // Prefer non-"compact"/default local voices next.
  return pool.find(v => !/compact/i.test(v.name)) ?? pool[0] ?? all[0] ?? null;
}

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
  // The script actually played — starts as the prop, swapped when translated.
  const [activeScript, setActiveScript] = useState(script);
  const scenes = useMemo(() => parseScenes(activeScript), [activeScript]);

  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [sceneProgress, setSceneProgress] = useState(0); // 0..1 within scene

  // AI narration voice (Gemini TTS) — generated automatically so playback is
  // human-sounding by default, not the robotic browser voice.
  const [voiceState, setVoiceState] = useState<'idle' | 'generating' | 'on' | 'unavailable'>('idle');
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceName, setVoiceName] = useState('Kore');

  // Language / translation
  const initialLang = typeof window !== 'undefined' ? (localStorage.getItem('pocket-school-lang') || 'en') : 'en';
  const [lang, setLang] = useState(initialLang);
  const [langOpen, setLangOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const translationCache = useRef<Record<string, string>>({ en: script });

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
  const voiceGenId = useRef(0); // cancels stale voice generation on lang change

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

  // When the incoming script prop changes, reset language + translation cache.
  useEffect(() => {
    translationCache.current = { en: script };
    setActiveScript(script);
    setLang(initialLang);
  }, [script]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload browser voices (getVoices is async on first call in some browsers).
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.onvoiceschanged = warm;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

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

    // Prefer the real AI voice clip for this scene whenever it's ready.
    const clip = hdClips.current[index];
    if (clip) {
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

    // Browser-voice fallback — pick the most natural available voice and warm
    // it up slightly so it sounds less robotic while the AI clip is still baking.
    const est = estimateSeconds(narration);
    const startAt = Date.now();
    timerRef.current = setInterval(() => {
      setSceneProgress(Math.min(1, (Date.now() - startAt) / 1000 / est));
    }, 200);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(narration.replace(/\s+/g, ' '));
      const v = pickBrowserVoice(lang);
      if (v) { utter.voice = v; utter.lang = v.lang; }
      utter.rate = 0.97;
      utter.pitch = 1.05;
      utter.onend = advance;
      utter.onerror = advance;
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(advance, est * 1000);
    }
  }, [scenes, lang, stopNarration]);

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

  // Generate a real human-sounding AI voice clip per scene (Gemini TTS).
  // Runs automatically so the video is voiced without any button press.
  const generateVoices = useCallback(async (scenesToVoice: Scene[], voice: string) => {
    const genId = ++voiceGenId.current;
    // Free old clips
    hdClips.current.forEach(c => { if (c) URL.revokeObjectURL(c); });
    hdClips.current = scenesToVoice.map(() => null);
    setVoiceState('generating');
    setVoiceProgress(0);
    let anyOk = false;
    for (let i = 0; i < scenesToVoice.length; i++) {
      if (voiceGenId.current !== genId) return; // superseded (language changed)
      try {
        const res = await fetch('/api/ai/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: scenesToVoice[i].narration || scenesToVoice[i].title, voice }),
        });
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && type.includes('audio')) {
          if (voiceGenId.current !== genId) return;
          hdClips.current[i] = URL.createObjectURL(await res.blob());
          anyOk = true;
        }
      } catch { /* keep browser-voice fallback for this scene */ }
      if (voiceGenId.current !== genId) return;
      setVoiceProgress((i + 1) / scenesToVoice.length);
    }
    setVoiceState(anyOk ? 'on' : 'unavailable');
  }, []);

  const changeVoice = (voice: string) => {
    setVoiceName(voice);
    generateVoices(scenes, voice);
  };

  // Auto-generate the human AI voice whenever the (possibly translated) scenes
  // change — so every video is voiced without the user doing anything.
  const voiceNameRef = useRef(voiceName);
  voiceNameRef.current = voiceName;
  useEffect(() => {
    if (!scenes.length) return;
    generateVoices(scenes, voiceNameRef.current);
  }, [scenes, generateVoices]);

  // Switch language: translate the storyboard, then re-voice + re-render.
  const switchLanguage = async (code: string) => {
    setLangOpen(false);
    if (code === lang) return;
    setLang(code);
    // Cancel any narration in flight and reset to the top.
    playingRef.current = false; setPlaying(false); stopNarration();
    setCurrent(0); currentRef.current = 0; setSceneProgress(0);

    if (translationCache.current[code]) {
      setActiveScript(translationCache.current[code]);
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, language: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.result) {
        translationCache.current[code] = data.result;
        setActiveScript(data.result);
      } else {
        toast.error(data.error || 'Translation failed — showing English.');
        setLang('en');
        setActiveScript(script);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Translation failed.');
      setLang('en');
      setActiveScript(script);
    } finally {
      setTranslating(false);
    }
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

            {/* Voice status */}
            {voiceState === 'generating' && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/70" title="Generating human AI voice">
                <Volume2 className="w-3.5 h-3.5" /> {Math.round(voiceProgress * 100)}%
              </span>
            )}
            {voiceState === 'on' && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-emerald-300" title="Human AI narration">
                <Sparkles className="w-3.5 h-3.5" /> AI Voice
              </span>
            )}
            {voiceState === 'unavailable' && (
              <button onClick={() => generateVoices(scenes, voiceName)} className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 hover:text-amber-200" title="Retry AI voice">
                <Volume2 className="w-3.5 h-3.5" /> Retry voice
              </button>
            )}

            {/* Voice picker */}
            <select
              value={voiceName}
              onChange={e => changeVoice(e.target.value)}
              className="hidden sm:block bg-black/40 text-white/80 text-[11px] rounded-md px-1.5 py-1 border border-white/15 outline-none cursor-pointer"
              title="Narrator voice"
            >
              <option value="Kore">Kore · warm</option>
              <option value="Puck">Puck · upbeat</option>
              <option value="Aoede">Aoede · breezy</option>
              <option value="Charon">Charon · deep</option>
              <option value="Leda">Leda · youthful</option>
              <option value="Zephyr">Zephyr · bright</option>
            </select>

            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(o => !o)}
                className="flex items-center gap-1 text-white/80 hover:text-white text-[11px] font-semibold"
                title="Translate video"
              >
                {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                <span className="hidden sm:inline">{LANGUAGES.find(l => l.code === lang)?.flag}</span>
              </button>
              {langOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-40 max-h-60 overflow-y-auto rounded-xl bg-[#15161c] border border-white/10 shadow-2xl py-1 z-30">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => switchLanguage(l.code)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${l.code === lang ? 'bg-white/10 text-white font-semibold' : 'text-white/70 hover:bg-white/5'}`}
                    >
                      <span>{l.flag}</span> {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
        <span>{voiceState === 'on' ? 'Human AI voice' : voiceState === 'generating' ? 'Voicing…' : 'Narrated'}</span>
        {lang !== 'en' && <><span>·</span><span>{LANGUAGES.find(l => l.code === lang)?.label}</span></>}
      </div>
    </div>
  );
}
