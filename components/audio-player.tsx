'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Headphones, Pause, Play, Square } from 'lucide-react';

const RATES = [0.75, 1, 1.25, 1.5];

/**
 * Zero-cost audio playback for AI-generated audio scripts using the browser
 * SpeechSynthesis API. Reads sentence by sentence so the current sentence can
 * be highlighted while it plays.
 */
export function AudioPlayer({ script, title }: { script: string; title?: string }) {
  const [supported, setSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [currentSentence, setCurrentSentence] = useState(-1);
  const cancelled = useRef(false);

  const sentences = script
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
    }
    return () => {
      cancelled.current = true;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakFrom = (startIndex: number, atRate: number) => {
    window.speechSynthesis.cancel();
    cancelled.current = false;
    setPlaying(true);
    setPaused(false);

    const speakNext = (i: number) => {
      if (cancelled.current || i >= sentences.length) {
        setPlaying(false);
        setCurrentSentence(-1);
        return;
      }
      setCurrentSentence(i);
      const utterance = new SpeechSynthesisUtterance(sentences[i]);
      utterance.rate = atRate;
      utterance.onend = () => speakNext(i + 1);
      utterance.onerror = () => speakNext(i + 1);
      window.speechSynthesis.speak(utterance);
    };
    speakNext(startIndex);
  };

  const handlePlayPause = () => {
    if (!playing) {
      speakFrom(0, rate);
    } else if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };

  const handleStop = () => {
    cancelled.current = true;
    window.speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
    setCurrentSentence(-1);
  };

  const handleRate = (r: number) => {
    setRate(r);
    if (playing && currentSentence >= 0) {
      // restart from the current sentence at the new speed
      speakFrom(currentSentence, r);
    }
  };

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Audio playback is not supported in this browser. You can read the script below.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handlePlayPause} className="rounded-xl gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          {!playing || paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {!playing ? 'Play' : paused ? 'Resume' : 'Pause'}
        </Button>
        {playing && (
          <Button variant="outline" onClick={handleStop} className="rounded-xl gap-2">
            <Square className="w-3.5 h-3.5" /> Stop
          </Button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {RATES.map(r => (
            <button
              key={r}
              onClick={() => handleRate(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                rate === r ? 'bg-blue-100 text-blue-700' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>

      <div className="bg-muted/40 border border-border rounded-2xl p-5 text-sm leading-7">
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Headphones className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">{title ?? 'Audio Summary'}</span>
        </div>
        <p>
          {sentences.map((s, i) => (
            <span
              key={i}
              className={i === currentSentence ? 'bg-amber-100 text-amber-900 rounded px-0.5' : undefined}
            >
              {s}{' '}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
