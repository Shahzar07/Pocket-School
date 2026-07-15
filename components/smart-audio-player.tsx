'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Headphones, Loader2, Mic, Pause, Play, RefreshCw } from 'lucide-react';
import { AudioPlayer } from '@/components/audio-player';

const VOICES = [
  { id: 'Kore', label: 'Kore · Warm' },
  { id: 'Puck', label: 'Puck · Upbeat' },
  { id: 'Charon', label: 'Charon · Deep' },
  { id: 'Aoede', label: 'Aoede · Breezy' },
  { id: 'Leda', label: 'Leda · Youthful' },
  { id: 'Zephyr', label: 'Zephyr · Bright' },
];

const RATES = [0.75, 1, 1.25, 1.5];

function fmtTime(s: number) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Real AI-voiced audio player. Generates spoken audio via /api/ai/audio
 * (Gemini TTS) and plays it in a full seek-able player with voice + speed
 * controls and download. If the server has no TTS configured, degrades to
 * the browser SpeechSynthesis player so audio always works.
 */
export function SmartAudioPlayer({ script, title, dark }: { script: string; title?: string; dark?: boolean }) {
  const [state, setState] = useState<'idle' | 'generating' | 'ready' | 'fallback'>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voice, setVoice] = useState('Kore');
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const generate = async (v = voice) => {
    setState('generating');
    setPlaying(false);
    try {
      const res = await fetch('/api/ai/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, voice: v }),
      });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('audio')) {
        const blob = await res.blob();
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setAudioUrl(url);
        setState('ready');
        return;
      }
      // JSON fallback response — degrade to browser speech.
      setState('fallback');
    } catch {
      setState('fallback');
    }
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.playbackRate = rate; el.play(); } else { el.pause(); }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setTime(el.currentTime);
  };

  const changeRate = (r: number) => {
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };

  const changeVoice = (v: string) => {
    setVoice(v);
    if (state === 'ready') generate(v);
  };

  if (state === 'fallback') {
    return <AudioPlayer script={script} title={title} />;
  }

  const border = dark ? 'border-white/10' : 'border-border';
  const subtle = dark ? 'text-slate-400' : 'text-muted-foreground';
  const strong = dark ? 'text-white' : 'text-foreground';
  const panel = dark ? 'bg-white/[0.03]' : 'bg-muted/40';

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-5 ${border} ${panel}`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Headphones className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest ${subtle}`}>{title ?? 'Audio Summary'}</p>
              <p className={`text-[10px] ${subtle}`}>AI-voiced narration</p>
            </div>
          </div>
          <select
            value={voice}
            onChange={e => changeVoice(e.target.value)}
            className={`text-xs rounded-lg px-2 py-1.5 border ${border} ${dark ? 'bg-slate-900 text-slate-200' : 'bg-card text-foreground'}`}
            title="Narrator voice"
          >
            {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>

        {state === 'idle' && (
          <Button onClick={() => generate()} className="rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white w-full sm:w-auto">
            <Mic className="w-4 h-4" /> Generate Audio
          </Button>
        )}

        {state === 'generating' && (
          <div className={`flex items-center gap-3 text-sm ${subtle}`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating AI narration… this takes a few seconds.
          </div>
        )}

        {state === 'ready' && audioUrl && (
          <div className="space-y-3">
            <audio
              ref={audioRef}
              src={audioUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onTimeUpdate={e => setTime((e.target as HTMLAudioElement).currentTime)}
              onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0 hover:opacity-90 transition-opacity"
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <span className={`text-[11px] tabular-nums ${subtle}`}>{fmtTime(time)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={time}
                onChange={seek}
                className="flex-1 accent-violet-500 h-1.5"
              />
              <span className={`text-[11px] tabular-nums ${subtle}`}>{fmtTime(duration)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {RATES.map(r => (
                  <button
                    key={r}
                    onClick={() => changeRate(r)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                      rate === r
                        ? 'bg-violet-500/20 text-violet-500'
                        : `${subtle} hover:${dark ? 'bg-white/5' : 'bg-muted'}`
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => generate()} className={`text-[11px] flex items-center gap-1 ${subtle} hover:${strong}`} title="Regenerate">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
                <a href={audioUrl} download="pocket-school-audio.wav" className={`text-[11px] flex items-center gap-1 ${subtle} hover:${strong}`}>
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <details className={`rounded-2xl border p-4 text-sm ${border}`}>
        <summary className={`cursor-pointer text-xs font-semibold uppercase tracking-wider ${subtle}`}>Read transcript</summary>
        <p className={`mt-3 leading-7 whitespace-pre-wrap ${dark ? 'text-slate-300' : 'text-foreground'}`}>{script}</p>
      </details>
    </div>
  );
}
