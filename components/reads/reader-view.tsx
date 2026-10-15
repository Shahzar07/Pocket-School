'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Bookmark, Headphones, Highlighter, Languages, List, MessageCircle, Pause, Type,
} from 'lucide-react';
import { useShelfProfile } from '@/components/shelf/profile-bar';
import { SAMPLE_OWNED, SAMPLE_READER, checkBookAccess } from '@/lib/reads/access';
import { useReadsT } from '@/lib/reads/i18n';
import { chapterProgress, paginateChapter, sentencesOf } from '@/lib/reads/paginate';
import { QUIET_LABEL, isQuietHour } from '@/lib/reads/quiet';
import { bookById } from '@/lib/reads/seed';
import type { Book, BookChapter, LanguageVersion } from '@/lib/reads/types';
import { getLanguage } from '@/lib/languages';
import {
  addNote, addSessionSeconds, bookmarks, notesFor, progressMap, readerPrefs, saveProgress,
  saveReaderPrefs, toggleBookmark, type ReaderPrefs,
} from '@/lib/shelf/storage';

const THEMES = {
  light: { bg: '#F7F6F3', fg: '#1C2422', muted: '#5E6B68', paper: '#FFFFFF' },
  sepia: { bg: '#F3E6D0', fg: '#3E2F1C', muted: '#7A6550', paper: '#F8F0E2' },
  dark: { bg: '#14181C', fg: '#E7E1D6', muted: '#A39B90', paper: '#1C2228' },
} as const;

export function Reader({ bookId, initialLang }: { bookId: string; initialLang?: string }) {
  const t = useReadsT();
  const router = useRouter();
  const book = bookById(bookId);
  const { profile, ready } = useShelfProfile();
  const [prefs, setPrefs] = useState<ReaderPrefs>({ theme: 'sepia', font: 19, spacing: 1.75, dyslexia: false });
  const [chapterIndex, setChapterIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [panel, setPanel] = useState<'none' | 'type' | 'contents' | 'notes' | 'ask'>('none');
  const [lang, setLang] = useState(initialLang || 'en');
  const [listening, setListening] = useState(false);
  const [sentence, setSentence] = useState(-1);
  const [timer, setTimer] = useState<'counting' | 'idle' | 'hidden' | 'quiet'>('counting');
  const [seconds, setSeconds] = useState(0);
  const [marks, setMarks] = useState<ReturnType<typeof bookmarks>>([]);
  const [notes, setNotes] = useState<ReturnType<typeof notesFor>>([]);
  const [selection, setSelection] = useState('');
  const [definition, setDefinition] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [quizPick, setQuizPick] = useState<Record<number, string>>({});
  const idle = useRef(Date.now());
  const spoken = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const stored = readerPrefs();
    if (initialLang) stored.lang = initialLang;
    setPrefs(stored);
    setLang(stored.lang || initialLang || 'en');
  }, [initialLang]);

  useEffect(() => {
    if (!ready || !book) return;
    const saved = progressMap(profile.id)[book.id];
    if (saved) {
      setChapterIndex(saved.chapterIndex);
      setPageIndex(saved.pageIndex);
    }
    setMarks(bookmarks(profile.id, book.id));
    setNotes(notesFor(profile.id, book.id));
    try {
      localStorage.setItem(`poket-offline:${book.id}`, JSON.stringify({ id: book.id, title: book.title, savedAt: Date.now() }));
    } catch { /* private mode */ }
  }, [ready, profile.id, book]);

  const version: LanguageVersion | undefined = book?.languageVersions?.find(v => v.language === lang);
  const chapters: BookChapter[] = useMemo(() => {
    if (!book) return [];
    if (!version) return book.chapters;
    return book.chapters.map(chapter => {
      const translated = version.chapters.find(c => c.id === chapter.id);
      return translated ? { ...chapter, title: translated.title, markdown: translated.markdown } : chapter;
    });
  }, [book, version]);

  const chapter = chapters[chapterIndex];
  const pages = useMemo(() => paginateChapter(chapter?.markdown ?? ''), [chapter]);
  const page = pages[Math.min(pageIndex, pages.length - 1)] ?? '';
  const access = book && chapter ? checkBookAccess(book, SAMPLE_READER, { ownedIds: SAMPLE_OWNED, chapter }) : null;
  const locked = access ? !access.allowed : true;
  const theme = THEMES[prefs.theme];
  const percent = book ? chapterProgress(chapterIndex, pageIndex, chapters.length, pages.length) : 0;
  const marked = marks.some(m => m.chapterIndex === chapterIndex && m.pageIndex === pageIndex);

  const persist = useCallback((c: number, p: number) => {
    if (!book || !ready) return;
    const nextPercent = chapterProgress(c, p, chapters.length, paginateChapter(chapters[c]?.markdown ?? '').length);
    saveProgress(profile.id, book.id, { chapterIndex: c, pageIndex: p, percent: nextPercent, updatedAt: Date.now() });
  }, [book, chapters, profile.id, ready]);

  const go = (c: number, p: number, direction: 1 | -1) => {
    setDir(direction);
    setChapterIndex(c);
    setPageIndex(p);
    setSentence(-1);
    persist(c, p);
    stopListen();
  };

  const next = () => {
    if (pageIndex < pages.length - 1) go(chapterIndex, pageIndex + 1, 1);
    else if (chapterIndex < chapters.length - 1) go(chapterIndex + 1, 0, 1);
  };
  const prev = () => {
    if (pageIndex > 0) go(chapterIndex, pageIndex - 1, -1);
    else if (chapterIndex > 0) {
      const prevPages = paginateChapter(chapters[chapterIndex - 1]?.markdown ?? '');
      go(chapterIndex - 1, Math.max(0, prevPages.length - 1), -1);
    }
  };

  useEffect(() => {
    const bump = () => { idle.current = Date.now(); };
    const onKey = (e: KeyboardEvent) => {
      bump();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', onKey);
    const id = window.setInterval(() => {
      const quiet = isQuietHour();
      const hidden = document.visibilityState !== 'visible';
      const bored = Date.now() - idle.current > 45000;
      if (quiet) setTimer('quiet');
      else if (hidden) setTimer('hidden');
      else if (bored) setTimer('idle');
      else {
        setTimer('counting');
        setSeconds(s => s + 1);
      }
    }, 1000);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', onKey);
      window.clearInterval(id);
    };
    // next/prev close over page state; the interval only needs the latest via setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIndex, pageIndex, pages.length]);

  useEffect(() => {
    if (!ready || seconds === 0 || seconds % 30 !== 0) return;
    const counted = timer === 'counting';
    addSessionSeconds(profile.id, bookId, 30, counted);
    void fetch('/api/reads/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, activeSeconds: 30, localHour: new Date().getHours(), counted }),
    }).catch(() => {});
  }, [seconds, timer, ready, profile.id, bookId]);

  const stopListen = () => {
    window.speechSynthesis?.cancel();
    spoken.current = null;
    setListening(false);
    setSentence(-1);
  };

  const listen = () => {
    if (listening) { stopListen(); return; }
    if (!window.speechSynthesis) return;
    const parts = sentencesOf(page);
    setListening(true);
    let i = 0;
    const speak = () => {
      if (i >= parts.length) { setListening(false); setSentence(-1); return; }
      const utter = new SpeechSynthesisUtterance(parts[i]);
      utter.rate = 0.96;
      const langCode = getLanguage(lang).bcp47;
      utter.lang = langCode;
      setSentence(i);
      utter.onend = () => { i += 1; speak(); };
      spoken.current = utter;
      window.speechSynthesis.speak(utter);
    };
    speak();
  };

  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const captureSelection = () => {
    const text = window.getSelection()?.toString().trim() ?? '';
    if (text && text.length < 240) setSelection(text);
  };

  const defineWord = async () => {
    const word = (selection || window.getSelection()?.toString() || '').trim().split(/\s+/)[0]?.replace(/[^a-zA-Z'-]/g, '');
    if (!word) return;
    setDefinition('…');
    try {
      const res = await fetch(`/api/reads/define?word=${encodeURIComponent(word)}`);
      const data = await res.json();
      setDefinition(data.definition || t('reads.reader.noDefine'));
    } catch {
      setDefinition(t('reads.reader.noDefine'));
    }
  };

  const saveHighlight = () => {
    const quote = selection.trim();
    if (!quote || !book) return;
    const note = window.prompt(t('reads.reader.notePlaceholder')) ?? '';
    addNote(profile.id, { id: `${Date.now()}`, bookId: book.id, chapterIndex, quote, note, at: Date.now() });
    setNotes(notesFor(profile.id, book.id));
    setSelection('');
  };

  const ask = async (prompt: string) => {
    if (!book || !chapter) return;
    setQuestion(prompt);
    const local = chapter.guide?.find(g => g.q === prompt);
    if (local) { setAnswer(local.a); return; }
    setAsking(true);
    setAnswer('');
    try {
      const res = await fetch('/api/reads/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: book.title,
          fiction: book.form === 'fiction',
          chapterTitle: chapter.title,
          chapterText: chapter.markdown,
          question: prompt,
        }),
      });
      const data = await res.json();
      setAnswer(data.answer || data.error || t('reads.reader.askFail'));
    } catch {
      setAnswer(t('reads.reader.askFail'));
    } finally {
      setAsking(false);
    }
  };

  if (!book || !chapter) {
    return <p className="p-8 text-sm">This book is not on the shelf.</p>;
  }

  const timerLabel = timer === 'counting' ? t('reads.reader.counting')
    : timer === 'idle' ? t('reads.reader.idle')
    : timer === 'hidden' ? t('reads.reader.hidden')
    : t('reads.reader.quiet');

  const sentences = sentencesOf(page);
  const highlighted = notes.some(n => page.includes(n.quote));

  return (
    <div className="min-h-screen" style={{ background: theme.bg, color: theme.fg }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500&display=swap" />
      <header className="sticky top-0 z-20 flex items-center gap-2 px-3 py-3 sm:px-6" style={{ background: theme.bg }}>
        <button type="button" onClick={() => router.push(`/reads/book/${book.id}`)} className="grid h-11 w-11 place-items-center rounded-full" aria-label={t('reads.nav.home')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{version?.title ?? book.title}</p>
          <p className="truncate text-[11px]" style={{ color: theme.muted }}>{chapter.title}</p>
        </div>
        <span className="hidden text-[12px] font-semibold sm:inline" aria-live="polite">{timerLabel} · {formatClock(seconds)}</span>
        <Tool label={t('reads.reader.contents')} onClick={() => setPanel(panel === 'contents' ? 'none' : 'contents')}><List className="h-5 w-5" /></Tool>
        <Tool label={t('reads.reader.font')} onClick={() => setPanel(panel === 'type' ? 'none' : 'type')}><Type className="h-5 w-5" /></Tool>
        <Tool label={listening ? t('reads.reader.stop') : t('reads.reader.listen')} onClick={listen}><Headphones className="h-5 w-5" /></Tool>
        <Tool label={t('reads.reader.ask')} onClick={() => setPanel(panel === 'ask' ? 'none' : 'ask')}><MessageCircle className="h-5 w-5" /></Tool>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-28 lg:grid-cols-[1fr_280px] lg:px-6">
        <article
          key={`${chapterIndex}-${pageIndex}`}
          className="mx-auto w-full"
          style={{
            maxWidth: prefs.dyslexia ? '38rem' : '40rem',
            animation: `${dir > 0 ? 'reads-next' : 'reads-prev'} 280ms ease`,
          }}
          onMouseUp={captureSelection}
          aria-label={chapter.title}
        >
          {version && (
            <p className="mb-4 text-[12px] font-semibold" style={{ color: theme.muted }}>
              {version.status === 'approved' ? t('reads.detail.versionApproved') : t('reads.detail.versionReview')}
            </p>
          )}
          {locked ? (
            <div className="rounded-3xl border p-8" style={{ borderColor: theme.muted }}>
              <h2 className="font-heading text-[32px]">{chapter.title}</h2>
              <p className="mt-4 leading-relaxed">{t('reads.reader.locked')}</p>
              <Link href={`/reads/book/${book.id}`} className="mt-6 inline-flex h-11 items-center rounded-full px-5 text-sm font-bold text-white" style={{ background: '#203337' }}>
                {t('reads.reader.lockedCta')}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-heading text-[34px] leading-tight tracking-[-0.03em]">{chapter.title}</h2>
              <div
                className="mt-6"
                style={{
                  fontFamily: prefs.dyslexia ? 'Lexend, Verdana, sans-serif' : '"Instrument Serif", Georgia, serif',
                  fontSize: prefs.font,
                  lineHeight: prefs.dyslexia ? 1.85 : prefs.spacing,
                  letterSpacing: prefs.dyslexia ? '0.02em' : undefined,
                }}
              >
                {listening ? sentences.map((s, i) => (
                  <span key={i} style={{ background: i === sentence ? '#E7C27D' : undefined, color: i === sentence ? '#1C2422' : undefined }}>{s} </span>
                )) : page.split(/\n{2,}/).map(para => (
                  <p key={para.slice(0, 32)} className="mb-[1em]">{renderQuote(para, notes.map(n => n.quote))}</p>
                ))}
              </div>
              {selection && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={saveHighlight} className="inline-flex h-10 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold" style={{ borderColor: theme.muted }}>
                    <Highlighter className="h-4 w-4" /> {t('reads.reader.highlight')}
                  </button>
                  <button type="button" onClick={defineWord} className="inline-flex h-10 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold" style={{ borderColor: theme.muted }}>
                    {t('reads.reader.define')}
                  </button>
                </div>
              )}
              {definition && <p className="mt-3 text-sm leading-relaxed" role="status">{definition}</p>}
              {pageIndex === pages.length - 1 && chapter.quiz && chapter.quiz.length > 0 && (
                <section className="mt-10 rounded-3xl p-5" style={{ background: theme.paper }} aria-label={t('reads.reader.quiz')}>
                  <h3 className="font-heading text-[26px]">{t('reads.reader.quiz')}</h3>
                  <p className="mt-1 text-sm" style={{ color: theme.muted }}>{t('reads.reader.quizLead')}</p>
                  <ol className="mt-4 space-y-4">
                    {chapter.quiz.map((q, qi) => (
                      <li key={q.question}>
                        <p className="font-semibold">{q.question}</p>
                        <div className="mt-2 grid gap-2">
                          {q.options.map(option => {
                            const picked = quizPick[qi] === option;
                            const right = picked && option === q.answer;
                            const wrong = picked && option !== q.answer;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setQuizPick(s => ({ ...s, [qi]: option }))}
                                className="rounded-xl border px-3 py-2 text-left text-sm"
                                style={{ borderColor: right ? '#1F7A4D' : wrong ? '#A33B32' : theme.muted }}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}
          <p className="mt-8 text-[12px]" style={{ color: theme.muted }}>
            {t('reads.reader.page', { page: pageIndex + 1, pages: pages.length })}
            {highlighted ? '' : ''} · {t('reads.reader.saved')}
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full" style={{ background: theme.paper }} aria-label={t('reads.reader.progress')}>
            <div className="h-full bg-[#2786A4]" style={{ width: `${percent}%` }} />
          </div>
        </article>

        {panel !== 'none' && (
          <aside className="rounded-3xl p-4 lg:sticky lg:top-20 lg:self-start" style={{ background: theme.paper }}>
            {panel === 'type' && (
              <TypePanel prefs={prefs} onChange={nextPrefs => { setPrefs(nextPrefs); saveReaderPrefs(nextPrefs); }} book={book} lang={lang} onLang={code => { setLang(code); saveReaderPrefs({ ...prefs, lang: code }); }} />
            )}
            {panel === 'contents' && (
              <ol className="space-y-2">
                {chapters.map((c, i) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => go(i, 0, i > chapterIndex ? 1 : -1)} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold" style={{ background: i === chapterIndex ? theme.bg : 'transparent' }}>
                      {i + 1}. {c.title}
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {panel === 'notes' && (
              <ul className="space-y-3 text-sm">
                {notes.length === 0 && <li style={{ color: theme.muted }}>{t('reads.reader.notes')}</li>}
                {notes.map(n => (
                  <li key={n.id} className="rounded-xl p-3" style={{ background: theme.bg }}>
                    <p className="font-semibold">“{n.quote}”</p>
                    {n.note && <p className="mt-1">{n.note}</p>}
                  </li>
                ))}
              </ul>
            )}
            {panel === 'ask' && (
              <div>
                <p className="text-sm leading-relaxed">{t('reads.reader.askLead')}</p>
                <div className="mt-3 grid gap-2">
                  {(chapter.guide ?? []).map(g => (
                    <button key={g.q} type="button" onClick={() => ask(g.q)} className="rounded-xl border px-3 py-2 text-left text-sm" style={{ borderColor: theme.muted }}>{g.q}</button>
                  ))}
                </div>
                <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); if (question.trim()) void ask(question); }}>
                  <input value={question} onChange={e => setQuestion(e.target.value)} placeholder={t('reads.reader.askPlaceholder')} className="h-11 flex-1 rounded-full border bg-transparent px-3 text-sm" style={{ borderColor: theme.muted }} />
                  <button type="submit" className="h-11 rounded-full px-4 text-sm font-bold text-white" style={{ background: '#203337' }} disabled={asking}>{t('reads.reader.askSend')}</button>
                </form>
                {answer && <p className="mt-3 text-sm leading-relaxed" role="status">{answer}</p>}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t px-3 py-3 sm:px-6" style={{ background: theme.bg, borderColor: theme.paper }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <button type="button" onClick={prev} className="h-12 rounded-full px-4 text-sm font-bold" aria-label={t('reads.reader.prev')}>{t('reads.reader.prev')}</button>
          <div className="flex items-center gap-1">
            <Tool label={marked ? t('reads.reader.bookmarked') : t('reads.reader.bookmark')} onClick={() => book && setMarks(toggleBookmark(profile.id, { bookId: book.id, chapterIndex, pageIndex }))}>
              <Bookmark className="h-5 w-5" fill={marked ? 'currentColor' : 'none'} />
            </Tool>
            <Tool label={t('reads.reader.notes')} onClick={() => setPanel(panel === 'notes' ? 'none' : 'notes')}><Highlighter className="h-5 w-5" /></Tool>
            <Tool label={listening ? t('reads.reader.stop') : t('reads.reader.listen')} onClick={listen}>
              {listening ? <Pause className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
            </Tool>
          </div>
          <button type="button" onClick={next} className="h-12 rounded-full px-4 text-sm font-bold" aria-label={t('reads.reader.next')}>{t('reads.reader.next')}</button>
        </div>
        <p className="sr-only">{QUIET_LABEL}</p>
      </footer>
      <style>{`@keyframes reads-next { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } } @keyframes reads-prev { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid h-11 w-11 place-items-center rounded-full">
      {children}
    </button>
  );
}

function TypePanel({
  prefs, onChange, book, lang, onLang,
}: {
  prefs: ReaderPrefs;
  onChange: (p: ReaderPrefs) => void;
  book: Book;
  lang: string;
  onLang: (code: string) => void;
}) {
  const t = useReadsT();
  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2">
        {([
          ['light', 'reads.reader.light'],
          ['sepia', 'reads.reader.sepia'],
          ['dark', 'reads.reader.dark'],
        ] as const).map(([theme, key]) => (
          <button key={theme} type="button" aria-pressed={prefs.theme === theme} onClick={() => onChange({ ...prefs, theme })} className="h-10 flex-1 rounded-full border font-semibold" style={{ borderColor: 'currentColor' }}>
            {t(key)}
          </button>
        ))}
      </div>
      <label className="block">{t('reads.reader.font')}
        <input type="range" min={16} max={26} value={prefs.font} onChange={e => onChange({ ...prefs, font: Number(e.target.value) })} className="mt-2 w-full" />
      </label>
      <label className="block">{t('reads.reader.spacing')}
        <input type="range" min={1.45} max={2.1} step={0.05} value={prefs.spacing} onChange={e => onChange({ ...prefs, spacing: Number(e.target.value) })} className="mt-2 w-full" />
      </label>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={prefs.dyslexia} onChange={e => onChange({ ...prefs, dyslexia: e.target.checked })} />
        {t('reads.reader.dyslexia')}
      </label>
      <div>
        <p className="mb-2 inline-flex items-center gap-1 font-semibold"><Languages className="h-4 w-4" /> {t('reads.detail.languages')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onLang('en')} aria-pressed={lang === 'en'} className="rounded-full border px-3 py-1">English</button>
          {(book.languageVersions ?? []).map(v => (
            <button key={v.language} type="button" onClick={() => onLang(v.language)} aria-pressed={lang === v.language} className="rounded-full border px-3 py-1">
              {getLanguage(v.language).label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderQuote(para: string, quotes: string[]) {
  const hit = quotes.find(q => q && para.includes(q));
  if (!hit) return para;
  const [before, after] = para.split(hit);
  return <>{before}<mark className="rounded bg-[#E7C27D] px-0.5 text-[#1C2422]">{hit}</mark>{after}</>;
}

function formatClock(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
