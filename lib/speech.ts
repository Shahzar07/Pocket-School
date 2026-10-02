'use client';

/**
 * Real-time speech for the AI teachers.
 *
 * The old path waited for the whole reply, sent all of it to TTS, waited for
 * the full WAV, then played it — several seconds of silence before a teacher
 * said a word. This speaks sentence by sentence while the reply is still
 * streaming, and fetches the next sentence's audio while the current one
 * plays, so speech starts after the first sentence and never stalls between
 * them.
 *
 * Every queued sentence belongs to a "turn". Stopping ends the turn: playback
 * halts, pending audio is discarded, `whenIdle()` resolves, and late sentences
 * from the old turn are ignored. That last part matters — without it an
 * interrupted teacher started talking again as the stream caught up.
 */

export interface SpeakerOptions {
  voice?: string;
  style?: string;
  /** BCP-47 tag for the browser-voice fallback. */
  lang?: string;
  onSpeakingChange?: (speaking: boolean) => void;
}

/** Read simple LaTeX the way a teacher would say it, not symbol by symbol. */
export function latexToSpeech(tex: string): string {
  let t = tex;
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, ' $1 over $2 ')
      .replace(/\\sqrt\{([^{}]*)\}/g, ' root of $1 ');
  }
  return t
    .replace(/\^\{?2\}?/g, ' squared ')
    .replace(/\^\{?3\}?/g, ' cubed ')
    .replace(/\^\{([^{}]*)\}|\^(\w)/g, (_, a, b) => ` to the power ${a ?? b} `)
    .replace(/_\{([^{}]*)\}|_(\w)/g, (_, a, b) => ` sub ${a ?? b} `)
    .replace(/\\(times|cdot)/g, ' times ')
    .replace(/\\div/g, ' divided by ')
    .replace(/\\pm/g, ' plus or minus ')
    .replace(/\\(leq?|le)\b/g, ' less than or equal to ')
    .replace(/\\(geq?|ge)\b/g, ' greater than or equal to ')
    .replace(/\\neq?/g, ' not equal to ')
    .replace(/\\(pi|theta|alpha|beta|gamma|lambda|mu|sigma|Delta|delta|infty)/g, ' $1 ')
    .replace(/\\(left|right|,|;|!|quad)/g, ' ')
    .replace(/=/g, ' equals ')
    .replace(/</g, ' less than ').replace(/>/g, ' greater than ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove what should never be read aloud: board blocks, markdown, LaTeX. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => ` ${latexToSpeech(m)} `)
    .replace(/\$([^$\n]*)\$/g, (_, m) => ` ${latexToSpeech(m)} `)
    .replace(/\\[()[\]]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*#`_>|~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a growing stream into speakable sentences. Very short fragments are
 * held back and joined to the next sentence: a TTS round-trip per "Great!"
 * would sound choppy and cost more.
 */
export class SentenceStream {
  private buf = '';
  private inFence = false;
  constructor(private emit: (sentence: string) => void, private minLength = 28) {}

  push(delta: string) {
    this.buf += delta;
    this.drain(false);
  }

  flush() {
    this.drain(true);
  }

  private drain(final: boolean) {
    // Never speak inside a ```QUIZ / ```PROBLEM block — skip it entirely.
    for (;;) {
      if (this.inFence) {
        const end = this.buf.indexOf('```');
        if (end === -1) { if (final) this.buf = ''; return; }
        this.buf = this.buf.slice(end + 3);
        this.inFence = false;
        continue;
      }
      const fence = this.buf.indexOf('```');
      const scan = fence === -1 ? this.buf : this.buf.slice(0, fence);
      const re = /[.!?…]["')\]]?(\s+|$)|\n{2,}/g;
      let cut = -1;
      let m: RegExpExecArray | null;
      while ((m = re.exec(scan))) {
        const end = m.index + m[0].length;
        if (end >= this.minLength && (m[1] !== '' || m[0].startsWith('\n') || final)) { cut = end; break; }
      }
      if (cut !== -1) {
        this.say(this.buf.slice(0, cut));
        this.buf = this.buf.slice(cut);
        continue;
      }
      if (fence !== -1) {
        this.say(this.buf.slice(0, fence));
        this.buf = this.buf.slice(fence + 3);
        this.inFence = true;
        continue;
      }
      if (final) { this.say(this.buf); this.buf = ''; }
      return;
    }
  }

  private say(raw: string) {
    const s = speakable(raw);
    if (s.length > 1) this.emit(s);
  }
}

interface Clip { text: string; audio: Promise<Blob | null> }

export class Speaker {
  private opts: SpeakerOptions;
  private turn = 0;
  private queue: Clip[] = [];
  private playing = false;
  private current: HTMLAudioElement | null = null;
  private resolveCurrent: (() => void) | null = null;
  private idleWaiters: (() => void)[] = [];
  private controllers = new Set<AbortController>();
  private _speaking = false;

  constructor(opts: SpeakerOptions = {}) { this.opts = opts; }

  setOptions(opts: Partial<SpeakerOptions>) { this.opts = { ...this.opts, ...opts }; }

  get speaking() { return this._speaking; }
  /** True once audio is actually coming out of the speakers. */
  get audible() { return !!this.current && !this.current.paused; }

  /** Start a fresh turn and return its id. */
  begin(): number {
    this.stop();
    return this.turn;
  }

  enqueue(text: string, turn = this.turn) {
    if (turn !== this.turn || !text.trim()) return;
    this.queue.push({ text, audio: this.fetchAudio(text) });
    // Audio for later sentences fetches in parallel while earlier ones play;
    // playback order is the queue order regardless of which arrives first.
    if (!this.playing) void this.pump(turn);
  }

  /** Resolves when everything queued for the current turn has been spoken. */
  whenIdle(): Promise<void> {
    if (!this.playing && this.queue.length === 0) return Promise.resolve();
    return new Promise(res => this.idleWaiters.push(res));
  }

  /** Stop speaking now and end the turn. */
  stop() {
    this.turn++;
    this.queue = [];
    this.controllers.forEach(c => c.abort());
    this.controllers.clear();
    if (this.current) { this.current.pause(); this.current = null; }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    // Paused audio never fires 'ended' — resolve the waiter ourselves, or the
    // conversation loop waits forever. This was the voice-call freeze.
    this.resolveCurrent?.();
    this.resolveCurrent = null;
    this.playing = false;
    this.setSpeaking(false);
    this.flushIdle();
  }

  private setSpeaking(v: boolean) {
    if (this._speaking === v) return;
    this._speaking = v;
    this.opts.onSpeakingChange?.(v);
  }

  private flushIdle() {
    const w = this.idleWaiters;
    this.idleWaiters = [];
    w.forEach(r => r());
  }

  private async fetchAudio(text: string): Promise<Blob | null> {
    const ctrl = new AbortController();
    this.controllers.add(ctrl);
    try {
      const res = await fetch('/api/ai/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: text, voice: this.opts.voice, style: this.opts.style }),
        signal: ctrl.signal,
      });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('audio')) return await res.blob();
    } catch { /* aborted or offline — fall back to the browser voice */ }
    finally { this.controllers.delete(ctrl); }
    return null;
  }

  private async pump(turn: number) {
    this.playing = true;
    this.setSpeaking(true);
    while (this.queue.length && turn === this.turn) {
      const clip = this.queue.shift()!;
      const blob = await clip.audio;
      if (turn !== this.turn) return;
      await (blob ? this.playBlob(blob) : this.playBrowser(clip.text));
    }
    if (turn !== this.turn) return;
    this.playing = false;
    this.setSpeaking(false);
    this.flushIdle();
  }

  private playBlob(blob: Blob): Promise<void> {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        if (this.current === audio) this.current = null;
        this.resolveCurrent = null;
        resolve();
      };
      this.resolveCurrent = done;
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    });
  }

  private playBrowser(text: string): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      if (this.opts.lang) u.lang = this.opts.lang;
      const done = () => { this.resolveCurrent = null; resolve(); };
      this.resolveCurrent = done;
      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
    });
  }
}
