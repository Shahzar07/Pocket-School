'use client';

/**
 * Plays a revision podcast in two voices. The script is synthesised in
 * small chunks, each fetched while the previous one plays, so it starts in
 * a couple of seconds rather than after the whole episode is rendered.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, SkipForward, SkipBack, Loader2, Headphones } from 'lucide-react';
import type { PodcastAsset } from '@/lib/study/types';

const CHUNK = 5;
const SPEEDS = [1, 1.25, 1.5];

export function PodcastPlayer({ podcast, onComplete }: { podcast: PodcastAsset; onComplete?: () => void }) {
  const chunks = useRef<PodcastAsset['lines'][]>([]);
  if (!chunks.current.length) {
    for (let i = 0; i < podcast.lines.length; i += CHUNK) chunks.current.push(podcast.lines.slice(i, i + CHUNK));
  }
  const total = chunks.current.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [finished, setFinished] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<number, Promise<string | null>>());
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; if (audio.current) audio.current.playbackRate = speed; }, [speed]);

  const fetchChunk = (i: number) => {
    if (i >= total) return Promise.resolve(null);
    if (!cache.current.has(i)) {
      cache.current.set(i, fetch('/api/ai/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dialogue: chunks.current[i], voices: { A: 'Kore', B: 'Puck' } }),
      }).then(async r => (r.ok && (r.headers.get('content-type') ?? '').includes('audio') ? URL.createObjectURL(await r.blob()) : null)).catch(() => null));
    }
    return cache.current.get(i)!;
  };

  const playBrowser = (i: number) => new Promise<void>(resolve => {
    if (!('speechSynthesis' in window)) return resolve();
    const lines = chunks.current[i];
    let k = 0;
    const voices = window.speechSynthesis.getVoices();
    const next = () => {
      if (k >= lines.length) return resolve();
      const u = new SpeechSynthesisUtterance(lines[k].text);
      u.rate = speedRef.current;
      const v = voices.filter(x => x.lang.startsWith('en'));
      if (v.length > 1) u.voice = lines[k].speaker === 'B' ? v[1] : v[0];
      u.onend = () => { k++; next(); };
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    };
    next();
  });

  const playFrom = async (i: number) => {
    if (i >= total) { setPlaying(false); setFinished(true); onComplete?.(); return; }
    setIdx(i);
    setLoading(true);
    const url = await fetchChunk(i);
    void fetchChunk(i + 1); // prefetch while this one plays
    setLoading(false);
    if (!playingRef.current) return;
    if (url) {
      const a = new Audio(url);
      a.playbackRate = speedRef.current;
      audio.current = a;
      a.onended = () => { if (playingRef.current) void playFrom(i + 1); };
      await a.play().catch(() => setPlaying(false));
    } else {
      await playBrowser(i);
      if (playingRef.current) void playFrom(i + 1);
    }
  };

  const playingRef = useRef(false);
  const toggle = () => {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      audio.current?.pause();
      window.speechSynthesis?.cancel();
    } else {
      playingRef.current = true;
      setPlaying(true);
      setFinished(false);
      if (audio.current && !audio.current.ended && audio.current.currentTime > 0) audio.current.play();
      else void playFrom(idx);
    }
  };
  const jump = (i: number) => {
    audio.current?.pause();
    audio.current = null;
    window.speechSynthesis?.cancel();
    const target = Math.max(0, Math.min(total - 1, i));
    setIdx(target);
    if (playingRef.current) void playFrom(target);
  };

  useEffect(() => () => {
    playingRef.current = false;
    audio.current?.pause();
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    cache.current.forEach(p => p.then(u => u && URL.revokeObjectURL(u)));
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-[#0f2f3a] to-[#174a5a] text-white p-6 sm:p-8 shadow-lg">
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-2xl bg-white/10 grid place-items-center shrink-0"><Headphones className="w-7 h-7" /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">{podcast.style} · {podcast.lines.length} lines</p>
            <p className="font-heading text-xl leading-tight truncate">{podcast.title}</p>
          </div>
        </div>
        <div className="flex gap-1 mt-6">
          {chunks.current.map((_, i) => (
            <button key={i} onClick={() => jump(i)} className={`h-1.5 flex-1 rounded-full transition-colors ${i < idx ? 'bg-white' : i === idx ? 'bg-white/70' : 'bg-white/20'}`} aria-label={`Part ${i + 1}`} />
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-6">
          <button onClick={() => jump(idx - 1)} className="w-10 h-10 rounded-full grid place-items-center hover:bg-white/10" aria-label="Previous part"><SkipBack className="w-5 h-5" /></button>
          <button onClick={toggle} className="w-16 h-16 rounded-full bg-white text-[#0f2f3a] grid place-items-center hover:scale-105 transition-transform" aria-label={playing ? 'Pause' : 'Play'}>
            {loading && playing ? <Loader2 className="w-7 h-7 animate-spin" /> : playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
          <button onClick={() => jump(idx + 1)} className="w-10 h-10 rounded-full grid place-items-center hover:bg-white/10" aria-label="Next part"><SkipForward className="w-5 h-5" /></button>
          <button onClick={() => setSpeed(s => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} className="ml-2 h-8 px-3 rounded-full bg-white/10 text-[12px] font-bold tabular-nums">{speed}×</button>
        </div>
        {finished && <p className="text-center text-[13px] text-white/70 mt-4">Episode finished — nice listening. 🎧</p>}
      </div>
      <div className="mt-5 space-y-2.5">
        {podcast.lines.map((l, i) => {
          const active = Math.floor(i / CHUNK) === idx && playing;
          return (
            <motion.p key={i} animate={{ opacity: active || !playing ? 1 : 0.45 }}
              className={`text-[15px] leading-relaxed rounded-xl px-3 py-1.5 ${active ? 'bg-primary/[0.06]' : ''}`}>
              <span className={`text-[11px] font-bold uppercase tracking-wider mr-2 ${l.speaker === 'B' ? 'text-[var(--ps-cyan-text)]' : 'text-primary'}`}>{l.speaker === 'B' ? 'Guest' : 'Host'}</span>
              {l.text}
            </motion.p>
          );
        })}
      </div>
    </div>
  );
}
