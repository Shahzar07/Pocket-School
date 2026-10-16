'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { generateIllustration } from '@/components/media/generate';
import { COVER_STYLES } from '@/components/media/types';
import { moveItem } from '@/lib/platform/cms';
import { getLanguage } from '@/lib/languages';
import {
  BOOK_KINDS, PROMPT_TEMPLATES, SPARK_COSTS, STRUCTURES, bookKind, buildOutline, chaptersFromOutline, checkContinuity, craftOf, emptyCraft, hasTool, kindShape, languageChoices, newCharacter, newScene, portraitPrompt, promptsFor, proposeBook, reviseProse, sparkNote, speechText, structureOf, type SparkAction,
} from '@/lib/reads/creator';
import type { Book, BookCraft, BookStatus, ReadingLevel, SavedPrompt } from '@/lib/reads/types';

const PROMPT_KEY = 'poket-studio-prompts';
const LEVELS: ReadingLevel[] = ['primary', 'lower-secondary', 'igcse', 'a-level', 'general', 'professional', 'law'];

export function CreatorPanel({
  book,
  onChange,
  onStatus,
}: {
  book: Book;
  onChange: (patch: Partial<Book>) => void;
  onStatus: (status: BookStatus) => void;
}) {
  const craft = craftOf(book);
  const kind = bookKind(craft.kind);
  const [suggestion, setSuggestion] = useState('');
  const [chapterId, setChapterId] = useState(book.chapters[0]?.id ?? '');
  const [customName, setCustomName] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [saved, setSaved] = useState<SavedPrompt[]>([]);
  const chapter = book.chapters.find(item => item.id === chapterId) ?? book.chapters[0];
  const notes = checkContinuity({ ...book, craft });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROMPT_KEY);
      if (raw) setSaved(JSON.parse(raw) as SavedPrompt[]);
    } catch { /* ignore a bad local copy */ }
  }, []);

  const writeCraft = (patch: Partial<BookCraft>, bookPatch: Partial<Book> = {}) => {
    onChange({ ...bookPatch, craft: { ...craft, ...patch } });
  };

  const setKind = (kindId: string) => {
    const next = bookKind(kindId);
    const base = emptyCraft(next.id);
    onChange({
      ...kindShape(next.id),
      genre: next.genre,
      curriculumTags: [{ programme: next.category === 'academic' ? 'Academic' : 'General', subject: next.genre, year: next.pictureBook ? 'Ages 5–7' : next.label }],
      craft: { ...base, idea: craft.idea, language: craft.language, customPrompts: craft.customPrompts },
    });
  };

  const run = async (action: SparkAction, task: string, apply: (remote: CraftReply | null) => void) => {
    const remote = await requestCraft({
      task,
      idea: craft.idea || book.title,
      title: book.title,
      bookKind: craft.kind,
      structure: craft.structure,
      language: craft.language,
      tone: craft.tone,
      audience: craft.audience,
      chapter: chapter ? { title: chapter.title, markdown: chapter.markdown } : undefined,
    });
    apply(remote);
    toast.success(sparkNote(action, !remote));
  };

  const propose = () => void run('idea', 'propose', remote => {
    const local = proposeBook(craft.idea || book.title, craft.kind);
    const proposal = remote?.titles?.length ? {
      titles: remote.titles,
      logline: remote.logline || local.logline,
      genre: remote.genre || local.genre,
      audience: remote.audience || local.audience,
      tone: remote.tone || local.tone,
    } : local;
    writeCraft({
      titles: proposal.titles,
      logline: proposal.logline,
      tone: proposal.tone,
      audience: proposal.audience,
    }, {
      blurb: proposal.logline,
      genre: proposal.genre,
      title: book.title === 'Untitled book' ? proposal.titles[0] : book.title,
    });
  });

  const outline = () => void run('outline', 'outline', remote => {
    const local = buildOutline({
      idea: craft.idea,
      title: book.title,
      kindId: craft.kind,
      structure: craft.structure,
      objectives: craft.objectives,
    });
    const pages = remote?.chapters?.length
      ? remote.chapters.map(page => ({ title: page.title, summary: page.summary || page.title }))
      : local;
    const chapters = chaptersFromOutline(pages, `ch-${Date.now()}`);
    const scenes = pages.map((page, index) => ({
      id: `scene-${Date.now()}-${index}`,
      title: page.title,
      summary: page.summary,
      act: structureOf(craft.structure).label,
      twist: false,
    }));
    onChange({ chapters, craft: { ...craft, scenes: hasTool(craft.kind, 'plot') || craft.kind === 'biography' ? scenes : craft.scenes } });
    if (chapters[0]) setChapterId(chapters[0].id);
  });

  const revise = (mode: 'regenerate' | 'expand' | 'shorten') => {
    if (!chapter) return;
    void run('chapter', mode, remote => {
      const next = remote?.text?.trim() || reviseProse(chapter.markdown, mode, craft.idea || book.title);
      setSuggestion(next);
    });
  };

  const accept = () => {
    if (!chapter || !suggestion.trim()) return;
    onChange({
      chapters: book.chapters.map(item => item.id === chapter.id ? { ...item, markdown: suggestion, origin: 'human' } : item),
    });
    setSuggestion('');
  };

  const paint = async (id: string) => {
    const person = craft.characters.find(item => item.id === id);
    if (!person) return;
    const picture = await generateIllustration(portraitPrompt(person, craft.styleId), craft.styleId);
    writeCraft({
      characters: craft.characters.map(item => item.id === id ? { ...item, portrait: picture.src } : item),
    });
    toast.success(picture.fallback ? sparkNote('portrait', true) : sparkNote('portrait', false));
  };

  const speak = (markdown: string) => {
    const text = speechText(markdown);
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.96;
    utter.lang = getLanguage(craft.language).bcp47;
    window.speechSynthesis.speak(utter);
    toast.message(sparkNote('audiobook', true));
  };

  const storePrompt = () => {
    if (!customName.trim() || !customBody.trim()) return;
    const prompt = { id: `prompt-${Date.now()}`, name: customName.trim(), body: customBody.trim() };
    const next = [prompt, ...saved];
    setSaved(next);
    writeCraft({ customPrompts: [prompt, ...craft.customPrompts] });
    localStorage.setItem(PROMPT_KEY, JSON.stringify(next));
    setCustomName('');
    setCustomBody('');
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-[28px]">Create with ET AI</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start from one line. The tools change with the kind of book. You edit and approve every page. Prices stay on the Details tab.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Kind of book
          <select value={craft.kind} onChange={event => setKind(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal">
            {BOOK_KINDS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Structure
          <select value={craft.structure} onChange={event => writeCraft({ structure: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal">
            {STRUCTURES.filter(item => kind.structures.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">{toolBlurb(craft.kind)}</p>

      <label className="block text-sm font-semibold">One-line idea
        <textarea value={craft.idea} onChange={event => writeCraft({ idea: event.target.value })} rows={2} placeholder="A market that opens only when the rain starts" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={propose} className="h-10 rounded-full bg-secondary px-4 text-sm font-bold text-secondary-foreground">Propose titles · {SPARK_COSTS.idea} Sparks</button>
        <button type="button" onClick={outline} className="h-10 rounded-full bg-foreground px-4 text-sm font-bold text-background">Build chapters · {SPARK_COSTS.outline} Sparks</button>
      </div>
      {craft.titles.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-sm font-semibold">ET AI proposed</p>
          <div className="flex flex-wrap gap-2">
            {craft.titles.map(title => (
              <button key={title} type="button" onClick={() => onChange({ title })} className="rounded-full border border-border px-3 py-1 text-sm">{title}</button>
            ))}
          </div>
          <p className="text-sm">{craft.logline}</p>
          <p className="text-xs text-muted-foreground">{book.genre} · {craft.audience} · {craft.tone}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">Reading level
          <select value={book.readingLevel} onChange={event => onChange({ readingLevel: event.target.value as ReadingLevel })} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal">
            {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Language
          <select value={craft.language} onChange={event => writeCraft({ language: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal">
            {languageChoices().map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Illustration style
          <select value={craft.styleId} onChange={event => writeCraft({ styleId: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal">
            {COVER_STYLES.map(style => <option key={style.id} value={style.id}>{style.label}</option>)}
          </select>
        </label>
      </div>

      <section className="space-y-2">
        <h3 className="font-heading text-[22px]">Prompt library</h3>
        <div className="flex flex-wrap gap-2">
          {promptsFor(craft.kind).map(prompt => (
            <button key={prompt.id} type="button" onClick={() => writeCraft({ idea: prompt.body })} className="rounded-full border border-border px-3 py-1 text-sm">{prompt.name}</button>
          ))}
          {saved.map(prompt => (
            <button key={prompt.id} type="button" onClick={() => writeCraft({ idea: prompt.body })} className="rounded-full border border-border px-3 py-1 text-sm">{prompt.name}</button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
          <input value={customName} onChange={event => setCustomName(event.target.value)} placeholder="Prompt name" className="h-10 rounded-xl border border-border px-3 text-sm" />
          <input value={customBody} onChange={event => setCustomBody(event.target.value)} placeholder="Custom prompt" className="h-10 rounded-xl border border-border px-3 text-sm" />
          <button type="button" onClick={storePrompt} className="h-10 rounded-full border border-border px-3 text-sm font-semibold">Save prompt</button>
        </div>
      </section>

      {hasTool(craft.kind, 'characters') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-[22px]">{craft.kind === 'biography' ? 'Subject' : 'Character bible'}</h3>
            <button type="button" onClick={() => writeCraft({ characters: [...craft.characters, newCharacter()] })} className="h-9 rounded-full border border-border px-3 text-sm font-semibold">Add</button>
          </div>
          {craft.characters.map(person => (
            <div key={person.id} className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-2">
              <Field label="Name" value={person.name} onChange={value => writeCraft({ characters: patchPerson(craft, person.id, { name: value }) })} />
              <Field label="Role" value={person.role} onChange={value => writeCraft({ characters: patchPerson(craft, person.id, { role: value }) })} />
              <Field label="Traits" value={person.traits} onChange={value => writeCraft({ characters: patchPerson(craft, person.id, { traits: value }) })} />
              <Field label="Appearance" value={person.appearance} onChange={value => writeCraft({ characters: patchPerson(craft, person.id, { appearance: value }) })} />
              <Field label="Backstory" value={person.backstory} onChange={value => writeCraft({ characters: patchPerson(craft, person.id, { backstory: value }) })} />
              <Field label="Voice" value={person.voice} onChange={value => writeCraft({ characters: patchPerson(craft, person.id, { voice: value }) })} />
              <Field label="Relationships" value={person.relationships} onChange={value => writeCraft({ characters: patchPerson(craft, person.id, { relationships: value }) })} />
              <div>
                <button type="button" onClick={() => void paint(person.id)} className="h-10 rounded-full bg-secondary px-3 text-sm font-bold text-secondary-foreground">Portrait · {SPARK_COSTS.portrait} Sparks</button>
                {person.portrait && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.portrait} alt={person.name || 'Character portrait'} className="mt-2 h-28 w-20 rounded-lg object-cover" />
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {hasTool(craft.kind, 'world') && (
        <section className="grid gap-2 sm:grid-cols-2">
          <h3 className="font-heading text-[22px] sm:col-span-2">{craft.kind === 'biography' ? 'Era and places' : 'World'}</h3>
          <Field label="Name" value={craft.worldName} onChange={value => writeCraft({ worldName: value })} />
          <Field label="Time" value={craft.worldTime} onChange={value => writeCraft({ worldTime: value })} />
          <Field label="Place" value={craft.worldPlace} onChange={value => writeCraft({ worldPlace: value })} />
          <Field label="Rules" value={craft.worldRules} onChange={value => writeCraft({ worldRules: value })} />
        </section>
      )}

      {(hasTool(craft.kind, 'plot') || craft.kind === 'biography') && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-[22px]">{craft.kind === 'biography' ? 'Life cards' : 'Scene cards'}</h3>
            <button type="button" onClick={() => writeCraft({ scenes: [...craft.scenes, newScene(structureOf(craft.structure).label)] })} className="h-9 rounded-full border border-border px-3 text-sm font-semibold">Add card</button>
          </div>
          <ol className="space-y-2">
            {craft.scenes.map((scene, index) => (
              <li
                key={scene.id}
                draggable
                onDragStart={event => event.dataTransfer.setData('text/plain', String(index))}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  const from = Number(event.dataTransfer.getData('text/plain'));
                  writeCraft({ scenes: moveItem(craft.scenes, from, index) });
                }}
                className="cursor-grab rounded-xl border border-border p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input value={scene.title} onChange={event => writeCraft({ scenes: craft.scenes.map(item => item.id === scene.id ? { ...item, title: event.target.value } : item) })} placeholder="Scene" className="h-10 rounded-xl border border-border px-3 text-sm" />
                  <input value={scene.summary} onChange={event => writeCraft({ scenes: craft.scenes.map(item => item.id === scene.id ? { ...item, summary: event.target.value } : item) })} placeholder="What changes" className="h-10 rounded-xl border border-border px-3 text-sm" />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={scene.twist} onChange={event => writeCraft({ scenes: craft.scenes.map(item => item.id === scene.id ? { ...item, twist: event.target.checked } : item) })} />
                    Twist
                  </label>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {hasTool(craft.kind, 'syllabus') && (
        <ListEditor
          title="Learning objectives"
          values={craft.objectives}
          placeholder="Name the parts of a cell"
          onChange={objectives => writeCraft({ objectives })}
        />
      )}
      {hasTool(craft.kind, 'glossary') && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-[22px]">Glossary</h3>
            <button type="button" onClick={() => writeCraft({ glossary: [...craft.glossary, { term: '', meaning: '' }] })} className="h-9 rounded-full border border-border px-3 text-sm font-semibold">Add term</button>
          </div>
          {craft.glossary.map((entry, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-2">
              <input value={entry.term} onChange={event => writeCraft({ glossary: craft.glossary.map((item, itemIndex) => itemIndex === index ? { ...item, term: event.target.value } : item) })} placeholder="Term" className="h-10 rounded-xl border border-border px-3 text-sm" />
              <input value={entry.meaning} onChange={event => writeCraft({ glossary: craft.glossary.map((item, itemIndex) => itemIndex === index ? { ...item, meaning: event.target.value } : item) })} placeholder="Meaning" className="h-10 rounded-xl border border-border px-3 text-sm" />
            </div>
          ))}
        </section>
      )}
      {hasTool(craft.kind, 'references') && (
        <ListEditor title="References" values={craft.references} placeholder="Source the author can check. Do not invent one." onChange={references => writeCraft({ references })} />
      )}

      <section className="space-y-3">
        <h3 className="font-heading text-[22px]">Co-writing</h3>
        <div className="flex flex-wrap gap-2">
          {book.chapters.map(item => (
            <button key={item.id} type="button" onClick={() => { setChapterId(item.id); setSuggestion(''); }} className={`rounded-full px-3 py-1 text-sm ${item.id === chapter?.id ? 'bg-foreground text-background' : 'border border-border'}`}>{item.title}</button>
          ))}
        </div>
        {chapter && (
          <>
            <textarea
              value={chapter.markdown}
              onChange={event => onChange({ chapters: book.chapters.map(item => item.id === chapter.id ? { ...item, markdown: event.target.value, origin: item.origin ?? 'human' } : item) })}
              rows={8}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => revise('regenerate')} className="h-9 rounded-full border border-border px-3 text-sm font-semibold">Regenerate · {SPARK_COSTS.chapter} Sparks</button>
              <button type="button" onClick={() => revise('expand')} className="h-9 rounded-full border border-border px-3 text-sm font-semibold">Expand · {SPARK_COSTS.suggestion} Sparks</button>
              <button type="button" onClick={() => revise('shorten')} className="h-9 rounded-full border border-border px-3 text-sm font-semibold">Shorten · {SPARK_COSTS.suggestion} Sparks</button>
            </div>
            {suggestion && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-semibold">ET AI suggestion</p>
                <p className="mt-1 whitespace-pre-wrap">{suggestion}</p>
                <button type="button" onClick={accept} className="mt-2 h-9 rounded-full bg-foreground px-3 text-sm font-bold text-background">Accept into the chapter</button>
              </div>
            )}
            {hasTool(craft.kind, 'quiz') && (
              <p className="text-xs text-muted-foreground">Quiz answer: {chapter.quiz?.[0]?.answer || 'none yet'}. Add one before review.</p>
            )}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-heading text-[22px]">Continuity</h3>
        <ul className="space-y-1 text-sm">
          {notes.map(note => <li key={note.message} className={note.tone === 'warn' ? 'text-amber-900' : 'text-emerald-800'}>{note.message}</li>)}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-heading text-[22px]">Audiobook</h3>
        <p className="text-sm text-muted-foreground">ET AI prepares a spoken script from each chapter. Playback uses this browser, so it costs 0 Sparks without a speech key.</p>
        {book.chapters.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
            <span className="text-sm">{item.title}</span>
            <button type="button" onClick={() => speak(item.markdown)} className="h-9 rounded-full bg-secondary px-3 text-sm font-bold text-secondary-foreground">Play · {SPARK_COSTS.audiobook} Sparks shown, 0 if local</button>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {book.status === 'draft' && <button type="button" onClick={() => onStatus('review')} className="h-10 rounded-full bg-foreground px-4 text-sm font-bold text-background">Send for review</button>}
        {book.status === 'review' && <button type="button" onClick={() => onStatus('published')} className="h-10 rounded-full bg-foreground px-4 text-sm font-bold text-background">Approve and publish</button>}
      </div>
      <p className="text-xs text-muted-foreground">Templates include {PROMPT_TEMPLATES.length} starting points. The language list is the platform catalog ({languageChoices().length} languages).</p>
    </div>
  );
}

function toolBlurb(kindId: string): string {
  const kind = bookKind(kindId);
  if (kind.tools.includes('plot')) return 'Fiction tools: characters, world, and plot. A picture book uses age bands, not a school year.';
  if (kind.tools.includes('syllabus')) return 'Academic tools: learning objectives, chapter checks, and sources you can verify. ET AI does not invent cases, doses, or citations.';
  if (kind.id === 'biography') return 'Biography tools: a subject, the era, and sources. Rumour stays out of the record.';
  return 'This kind uses an explainer outline, a glossary, and sources.';
}

function patchPerson(craft: BookCraft, id: string, patch: Partial<BookCraft['characters'][number]>) {
  return craft.characters.map(item => item.id === id ? { ...item, ...patch } : item);
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-semibold">{label}
      <input value={value} onChange={event => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border px-3 font-normal" />
    </label>
  );
}

function ListEditor({ title, values, placeholder, onChange }: { title: string; values: string[]; placeholder: string; onChange: (values: string[]) => void }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-[22px]">{title}</h3>
        <button type="button" onClick={() => onChange([...values, ''])} className="h-9 rounded-full border border-border px-3 text-sm font-semibold">Add</button>
      </div>
      {values.map((value, index) => (
        <input key={index} value={value} placeholder={placeholder} onChange={event => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="h-10 w-full rounded-xl border border-border px-3 text-sm" />
      ))}
    </section>
  );
}

interface CraftReply {
  titles?: string[];
  logline?: string;
  genre?: string;
  audience?: string;
  tone?: string;
  text?: string;
  chapters?: { title: string; summary?: string }[];
}

async function requestCraft(body: Record<string, unknown>): Promise<CraftReply | null> {
  try {
    const res = await fetch('/api/reads/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'craft', ...body }),
    });
    if (!res.ok) return null;
    return await res.json() as CraftReply;
  } catch {
    return null;
  }
}
