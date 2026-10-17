'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import {
  ImportPanel, VersionHistory, imageMarkdown, pushRevision, readAutosave, useAutosave,
} from '@/components/editor';

import type { ContentRevision, ImportResult } from '@/components/editor';
import {
  CoverArtPicker, IllustrationPrompt, ImageLibrary, optimiseImage, storeMedia,
} from '@/components/media';
import { composeCoverSizes } from '@/components/reads/cover-compose';
import { generateIllustration } from '@/components/media/generate';
import { BOOKS } from '@/lib/reads/seed';
import { publishIssues, screenCoverAge, type CoverBrief, type CoverFont, type CoverPlacement } from '@/lib/reads/cover';
import { bookEpub, bookPdf, chapterPlain } from '@/lib/reads/book-export';
import { blankCraftBook } from '@/lib/reads/creator';
import { storedBookPriceRM } from '@/lib/platform/pricing';
import { snapToStorePricePoint } from '@/lib/pricing';
import { CreatorPanel } from '@/components/reads/creator-panel';
import {
  AGE_BANDS, ageBand, blankChildrensStory, fallbackStory, isPictureBook, storyChapters, storyPublishIssues, storyShape, withPageIllustration, wordsOf,
} from '@/lib/reads/picture-book';
import type { Book, BookChapter, BookStatus } from '@/lib/reads/types';
import { useCoursePlaceholders } from '@/hooks/use-example-course';
import { useReadsT } from '@/lib/reads/i18n';
import { getLanguage } from '@/lib/languages';
import { moveItem } from '@/lib/platform/cms';
import { planLabel } from '@/lib/reads/access';
import { AllocationPicker } from '@/components/allocation-picker';
import { bookFlagsFromTargets, migrateAllocation } from '@/lib/allocation-targets';
import { reportContentChange } from '@/lib/audit/report';

const ContentEditor = dynamic(
  () => import('@/components/editor/content-editor').then(mod => mod.ContentEditor),
  { ssr: false, loading: () => <div className="ps-skeleton h-40 rounded-2xl" aria-hidden="true" /> },
);

const AUTOSAVE_KEY = 'poket-studio-books';

function cloneBooks(): Book[] {
  return BOOKS.map(book => ({ ...book, chapters: book.chapters.map(chapter => ({ ...chapter })), cover: { ...book.cover } }));
}

export function StudioView() {
  const t = useReadsT();
  const placeholders = useCoursePlaceholders();
  const [books, setBooks] = useState<Book[]>(cloneBooks);
  const [id, setId] = useState('monsoon-market');
  const [tab, setTab] = useState<'details' | 'create' | 'write' | 'import' | 'pictures' | 'cover'>('details');
  const [chapterId, setChapterId] = useState('mm-1');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [replaceImport, setReplaceImport] = useState(false);
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<ContentRevision<Book>[]>([]);
  const book = books.find(item => item.id === id) ?? books[0];
  const chapter = book.chapters.find(item => item.id === chapterId) ?? book.chapters[0];
  const bookRef = useRef(book);
  bookRef.current = book;
  const savedAt = useAutosave(AUTOSAVE_KEY, books);

  useEffect(() => {
    const saved = readAutosave<Book[]>(AUTOSAVE_KEY);
    if (saved && saved.length > 0) setBooks(saved);
  }, []);

  useEffect(() => {
    setPriceDraft(null);
  }, [book.id]);

  useEffect(() => {
    if (!savedAt) return;
    const current = bookRef.current;
    setRevisions(list => pushRevision(list, current, current.title));
  }, [savedAt]);

  const update = (patch: Partial<Book>) => {
    setBooks(list => list.map(item => item.id === book.id ? { ...item, ...patch } : item));
  };

  const setStatus = (status: BookStatus) => {
    if (book.status === 'draft' && status === 'published') return;
    if (book.status === 'published' && status === 'draft') return;
    if (status === 'published') {
      const issue = [...publishIssues(book), ...storyPublishIssues(book)][0];
      if (issue) {
        toast.error(issue);
        return;
      }
    }
    const previous = book.status;
    update({ status, version: status === 'published' ? book.version + 1 : book.version });
    reportContentChange({
      action: status === 'published' ? 'content.publish' : 'content.edit',
      targetType: 'book',
      targetId: book.id,
      targetLabel: book.title,
      before: { status: previous },
      after: { status },
    });
    toast.success(t('reads.studio.savedLocal'));
  };

  const generate = async () => {
    try {
      const res = await fetch('/api/reads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'outline',
          title: book.title,
          category: book.category,
          form: book.form,
          genre: book.genre,
          ageRating: book.ageRating,
          readingLevel: book.readingLevel,
        }),
      });
      const data = await res.json() as { error?: string; title?: string; blurb?: string; chapters?: { title: string; summary: string }[] };
      if (!res.ok) throw new Error(data.error || t('reads.studio.generateFail'));
      const extra: BookChapter[] = (data.chapters ?? []).map((item, index) => ({
        id: `ai-${Date.now()}-${index}`,
        order: book.chapters.length + index,
        title: item.title,
        markdown: item.summary,
        origin: 'ai',
      }));
      update({
        blurb: data.blurb || book.blurb,
        title: data.title || book.title,
        chapters: extra.length ? [...book.chapters, ...extra] : book.chapters,
      });
      if (extra[0]) setChapterId(extra[0].id);
      toast.success(extra.length ? 'Outline chapters added. Existing chapters were kept.' : t('reads.studio.savedLocal'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('reads.studio.generateFail'));
    }
  };

  const writeStory = async () => {
    const band = ageBand(book.ageBand);
    const local = fallbackStory(book.blurb || book.title, band.id);
    let title = local.title;
    let blurb = local.blurb;
    let pages = local.chapters;
    let fallback = true;
    try {
      const res = await fetch('/api/reads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'story',
          title: book.title,
          blurb: book.blurb,
          ageBand: band.label,
          category: 'childrens_stories',
          form: 'fiction',
          genre: "Children's Stories",
          ageRating: band.ageRating,
          readingLevel: 'primary',
        }),
      });
      const data = await res.json() as {
        title?: string;
        blurb?: string;
        chapters?: { title?: string; summary?: string; illustration?: string }[];
      };
      if (res.ok && data.chapters?.length) {
        fallback = false;
        title = data.title || title;
        blurb = data.blurb || blurb;
        pages = data.chapters.filter(page => page.title).map(page => ({
          title: page.title || 'Page',
          text: page.summary || '',
          illustration: page.illustration || page.summary || page.title || '',
        }));
      }
    } catch {
      fallback = true;
    }
    const chapters = storyChapters(pages, `page-${Date.now()}`);
    update({
      ...storyShape(band.id),
      title: book.title.trim() && book.title !== 'Untitled story' ? book.title : title,
      blurb,
      chapters,
      curriculumTags: [{ programme: 'Primary', subject: 'English', year: band.label }],
      coverBrief: { placement: 'bottom', font: 'rounded', brand: true, ...book.coverBrief, styleId: book.coverBrief?.styleId || 'illustrated-kids' },
    });
    if (chapters[0]) setChapterId(chapters[0].id);
    setTab('write');
    toast.success(fallback
      ? `ET AI wrote a local story for ${band.label}. No school year is used. Edit every page, then add the pictures.`
      : `ET AI drafted a story for ${band.label}. Edit every page before you approve it.`);
  };

  const illustratePages = async () => {
    const styleId = book.coverBrief?.styleId || 'illustrated-kids';
    const lock = `Children's picture book, style ${styleId}. The same child, the same clothes, and the same colours on every page. No letters in the picture.`;
    const images = [...(book.images ?? [])];
    const chapters: BookChapter[] = [];
    let fallback = false;
    for (const chapter of book.chapters) {
      const picture = await generateIllustration(`${lock} ${chapter.title}. ${chapter.markdown.replace(/!full?\[[^\]]*\]\([^)]*\)/g, ' ').slice(0, 280)}`, styleId);
      fallback = fallback || picture.fallback;
      const alt = chapter.title || 'Illustration';
      chapters.push({ ...chapter, markdown: withPageIllustration(chapter.markdown, alt, picture.src) });
      images.push({
        id: `page-${chapter.id}`,
        src: picture.src,
        alt,
        width: 800,
        height: 1200,
        fullBleed: true,
      });
    }
    update({
      chapters,
      images,
      pictureBook: true,
      coverBrief: { placement: 'bottom', font: 'rounded', brand: true, ...book.coverBrief, styleId },
    });
    toast.success(fallback
      ? 'Each page has a picture in this book’s style. Drawn on this device, so it costs 0 Sparks.'
      : 'Each page has an illustration in the same style.');
  };

  const applyImport = (result: ImportResult) => {
    const stamp = Date.now();
    const imported: BookChapter[] = result.blocks.map((block, index) => ({
      id: `${book.id}-${block.id}-${stamp}`,
      order: index,
      title: block.title,
      markdown: block.body,
      origin: 'import',
      preview: index === 0,
    }));
    const chapters = (replaceImport ? imported : [...book.chapters, ...imported]).map((item, order) => ({
      ...item,
      order,
      preview: order === 0 ? true : item.preview,
    }));
    update({ chapters });
    if (imported[0]) setChapterId(imported[0].id);
    setTab('write');
  };

  const placeImage = (alt: string, src: string, caption?: string, full?: boolean) => {
    if (!chapter) return;
    const line = imageMarkdown(alt, src, caption, full);
    const markdown = chapter.markdown.trim() ? `${chapter.markdown.trim()}\n\n${line}` : line;
    update({ chapters: book.chapters.map(item => item.id === chapter.id ? { ...item, markdown } : item) });
    setTab('write');
  };

  const addFiles = async (files: File[]) => {
    const next = [...(book.images ?? [])];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const fitted = await optimiseImage(file);
      const stored = await storeMedia(book.id, fitted.blob, `${Date.now()}-${file.name || 'image'}.jpg`);
      next.push({
        id: `img-${Date.now()}-${next.length}`,
        src: stored.src,
        alt: '',
        width: fitted.width,
        height: fitted.height,
        storagePath: stored.storagePath,
      });
    }
    update({ images: next });
    setTab('pictures');
    toast.message('Added to the picture library. Write the alt text before placing it.');
  };

  const paintCover = async (artSrc: string, styleId: string, prompt: string, patch?: Partial<CoverBrief>) => {
    const placement = patch?.placement ?? book.coverBrief?.placement ?? 'bottom';
    const font = patch?.font ?? book.coverBrief?.font ?? 'serif';
    const brand = patch?.brand ?? book.coverBrief?.brand ?? true;
    try {
      const sizes = await composeCoverSizes({
        artSrc,
        title: book.title,
        author: 'ET AI',
        placement,
        font,
        brand,
      });
      update({
        cover: { ...book.cover, image: sizes.tile, hero: sizes.hero, thumb: sizes.thumb },
        coverBrief: { styleId, artSrc, prompt, placement, font, brand },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The cover could not be drawn.');
    }
  };

  const counts = useMemo(() => ({
    draft: books.filter(item => item.status === 'draft').length,
    review: books.filter(item => item.status === 'review').length,
    published: books.filter(item => item.status === 'published').length,
  }), [books]);

  const lockedStyle = seriesStyleId(book, books);
  const brief = [book.title, book.genre, book.ageRating, book.blurb].filter(Boolean).join('. ');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-[40px] tracking-[-0.04em] sm:text-[52px]">{t('reads.studio.title')}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('reads.studio.lead')}</p>
        <p className="mt-3 rounded-2xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-4 py-3 text-[13px] text-[var(--ps-cyan-text)]">{t('reads.studio.preview')}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">{savedAt ? `${t('reads.studio.savedDevice')} · ${new Date(savedAt).toLocaleTimeString()}` : t('reads.studio.pending')}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <p className="px-1 text-[12px] text-muted-foreground">{counts.draft} {t('reads.studio.draft')} · {counts.review} {t('reads.studio.review')} · {counts.published} {t('reads.studio.published')}</p>
          <button
            type="button"
            className="h-10 w-full rounded-full border border-border text-sm font-semibold"
            onClick={() => {
              const created = blankChildrensStory();
              setBooks(list => [created, ...list]);
              setId(created.id);
              setChapterId(created.chapters[0]?.id ?? '');
              setTab('details');
            }}
          >
            New children’s story
          </button>
          <button
            type="button"
            className="h-10 w-full rounded-full bg-foreground text-sm font-semibold text-background"
            onClick={() => {
              const created = blankCraftBook();
              setBooks(list => [created, ...list]);
              setId(created.id);
              setChapterId(created.chapters[0]?.id ?? '');
              setTab('create');
            }}
          >
            New book with ET AI
          </button>
          {books.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setId(item.id); setChapterId(item.chapters[0]?.id ?? ''); }}
              className={`w-full rounded-2xl border px-3 py-3 text-left ${item.id === book.id ? 'border-foreground bg-card' : 'border-border'}`}
            >
              <span className="block text-sm font-semibold">{item.title}</span>
              <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{item.status}</span>
            </button>
          ))}
        </aside>
        <section className="space-y-5 rounded-[28px] border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Step active={book.status === 'draft'} label={t('reads.studio.draft')} />
            <Step active={book.status === 'review'} label={t('reads.studio.review')} />
            <Step active={book.status === 'published'} label={t('reads.studio.published')} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Tab on={tab === 'details'} label={t('reads.studio.tabDetails')} onClick={() => setTab('details')} />
            <Tab on={tab === 'create'} label="Create" onClick={() => setTab('create')} />
            <Tab on={tab === 'write'} label={t('reads.studio.tabWrite')} onClick={() => setTab('write')} />
            <Tab on={tab === 'import'} label={t('reads.studio.tabImport')} onClick={() => setTab('import')} />
            <Tab on={tab === 'pictures'} label={t('reads.studio.tabPictures')} onClick={() => setTab('pictures')} />
            <Tab on={tab === 'cover'} label={t('reads.studio.tabCover')} onClick={() => setTab('cover')} />
          </div>

          {tab === 'details' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">Type
                  <select
                    value={isPictureBook(book) ? 'childrens_story' : 'reader'}
                    onChange={event => {
                      if (event.target.value === 'childrens_story') {
                        const band = ageBand(book.ageBand);
                        update({
                          ...storyShape(band.id),
                          curriculumTags: [{ programme: 'Primary', subject: book.curriculumTags[0]?.subject || 'English', year: band.label }],
                          coverBrief: { placement: 'bottom', font: 'rounded', brand: true, ...book.coverBrief, styleId: book.coverBrief?.styleId || 'illustrated-kids' },
                        });
                      } else {
                        update({ pictureBook: false, ageBand: undefined, category: book.category === 'childrens_stories' ? 'general' : book.category });
                      }
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal"
                  >
                    <option value="reader">Reader</option>
                    <option value="childrens_story">Children&apos;s story</option>
                  </select>
                </label>
                {isPictureBook(book) && (
                  <label className="text-sm font-semibold">Age band
                    <select
                      value={ageBand(book.ageBand).id}
                      onChange={event => {
                        const band = ageBand(event.target.value);
                        update({
                          ...storyShape(band.id),
                          curriculumTags: [{ programme: 'Primary', subject: 'English', year: band.label }],
                        });
                      }}
                      className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal"
                    >
                      {AGE_BANDS.map(band => <option key={band.id} value={band.id}>{band.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {isPictureBook(book) && <p className="text-sm text-muted-foreground">ET AI writes for the age band. School years are not used. One illustration belongs on every page, in the same style.</p>}
              <label className="block text-sm font-semibold">{t('reads.studio.fieldTitle')}
                <input value={book.title} onChange={e => update({ title: e.target.value })} placeholder={placeholders.title} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal" />
              </label>
              <label className="block text-sm font-semibold">{t('reads.studio.fieldBlurb')}
                <textarea value={book.blurb} onChange={e => update({ blurb: e.target.value })} rows={3} placeholder={placeholders.description} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">{t('reads.studio.price')}
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={priceDraft ?? book.priceUsd}
                    onFocus={() => setPriceDraft(String(book.priceUsd))}
                    onChange={event => setPriceDraft(event.target.value)}
                    onBlur={() => {
                      const typed = priceDraft?.trim() ?? '';
                      setPriceDraft(null);
                      if (typed === '') return;
                      const raw = Number(typed);
                      if (!Number.isFinite(raw) || raw === book.priceUsd) return;
                      const priceUsd = snapToStorePricePoint(raw);
                      update({ priceUsd, priceRM: storedBookPriceRM(priceUsd) });
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal"
                  />
                  <span className="mt-1 block font-normal text-muted-foreground">{t('reads.studio.priceHint')}</span>
                </label>
                <label className="text-sm font-semibold">{t('reads.studio.tier')}
                  <input type="number" min={0} max={6} value={book.minTier} onChange={e => update({ minTier: Number(e.target.value) as Book['minTier'] })} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal" />
                  <span className="mt-1 block font-normal text-muted-foreground">{planLabel(book.minTier)}</span>
                </label>
              </div>
              <AllocationPicker
                label={t('reads.studio.targets')}
                value={migrateAllocation({
                  targets: book.targets,
                  allocateLibrary: book.allocateLibrary,
                  allocateMarketplace: book.allocateMarketplace,
                })}
                onChange={targets => update({ targets, ...bookFlagsFromTargets(targets) })}
              />
              <div className="flex flex-wrap gap-2">
                <Link href={`/reads/read/${book.id}?preview=1`} className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold">Preview as a reader</Link>
                <button type="button" onClick={() => downloadBook(book, 'pdf')} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">Download PDF</button>
                <button type="button" onClick={() => downloadBook(book, 'epub')} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">Download EPUB</button>
                {isPictureBook(book) ? (
                  <button type="button" onClick={() => void writeStory()} className="h-10 rounded-full bg-secondary px-4 text-sm font-bold text-secondary-foreground">Write story</button>
                ) : (
                  <button type="button" onClick={() => void generate()} className="h-10 rounded-full bg-secondary px-4 text-sm font-bold text-secondary-foreground">{t('reads.studio.generate')}</button>
                )}
                {book.status === 'draft' && <button type="button" onClick={() => setStatus('review')} className="h-10 rounded-full bg-foreground px-4 text-sm font-bold text-background">{t('reads.studio.toReview')}</button>}
                {book.status === 'review' && <button type="button" onClick={() => setStatus('published')} className="h-10 rounded-full bg-foreground px-4 text-sm font-bold text-background">{t('reads.studio.publish')}</button>}
                {book.status === 'review' && <button type="button" onClick={() => setStatus('draft')} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">{t('reads.studio.back')}</button>}
                {book.status === 'published' && <button type="button" onClick={() => setStatus('review')} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">{t('reads.studio.unpublish')}</button>}
              </div>
              <div>
                <h2 className="font-heading text-[22px]">{t('reads.studio.languages')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('reads.studio.languagesLead')}</p>
                <ul className="mt-3 space-y-2">
                  {(book.languageVersions ?? []).map(version => (
                    <li key={version.language} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                      <span>
                        <strong>{getLanguage(version.language).label}</strong>
                        <span className="ml-2 text-muted-foreground">{version.status} · v{version.sourceVersion}{version.aiTranslated ? ' · AI' : ''}</span>
                      </span>
                      {version.status !== 'approved' && (
                        <button
                          type="button"
                          className="h-9 rounded-full bg-secondary px-3 text-[12px] font-bold"
                          onClick={() => update({
                            languageVersions: (book.languageVersions ?? []).map(v => v.language === version.language ? { ...v, status: 'approved' } : v),
                          })}
                        >
                          {t('reads.studio.approve')}
                        </button>
                      )}
                    </li>
                  ))}
                  {(book.languageVersions ?? []).length === 0 && <li className="text-sm text-muted-foreground">{t('reads.studio.source')}</li>}
                </ul>
              </div>
            </>
          )}

          {tab === 'create' && (
            <CreatorPanel book={book} onChange={update} onStatus={setStatus} />
          )}

          {tab === 'write' && chapter && (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-[22px]">{t('reads.studio.chapters')}</h2>
                <button
                  type="button"
                  className="h-9 rounded-full border border-border px-3 text-sm font-semibold"
                  onClick={() => {
                    const created: BookChapter = {
                      id: `ch-${Date.now()}`,
                      order: book.chapters.length,
                      title: 'New chapter',
                      markdown: '',
                      origin: 'human',
                    };
                    update({ chapters: [...book.chapters, created] });
                    setChapterId(created.id);
                  }}
                >
                  {t('reads.studio.addChapter')}
                </button>
              </div>
              <ol className="space-y-2">
                {book.chapters.map((item, index) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={() => setDragFrom(index)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={() => {
                      if (dragFrom == null) return;
                      const chapters = moveItem(book.chapters, dragFrom, index).map((row, order) => ({ ...row, order }));
                      update({ chapters });
                      setDragFrom(null);
                    }}
                    className={`cursor-grab rounded-xl border p-3 text-sm active:cursor-grabbing ${item.id === chapter.id ? 'border-foreground' : 'border-border'}`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => setChapterId(item.id)}>
                      <span className="font-semibold">{index + 1}. {item.title}</span>
                      {item.origin && <OriginBadge origin={item.origin} />}
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{item.markdown || 'Empty chapter'}</p>
                    </button>
                  </li>
                ))}
              </ol>
              <label className="block text-sm font-semibold">Chapter title
                <input
                  value={chapter.title}
                  onChange={event => update({ chapters: book.chapters.map(item => item.id === chapter.id ? { ...item, title: event.target.value, origin: item.origin ?? 'human' } : item) })}
                  className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal"
                />
              </label>
              <ContentEditor
                key={chapter.id}
                value={chapter.markdown}
                onChange={markdown => update({
                  chapters: book.chapters.map(item => item.id === chapter.id ? { ...item, markdown, origin: item.origin ?? 'human' } : item),
                })}
                onManuscript={applyImport}
                onPasteImages={files => { void addFiles(files); }}
              />
              <ReadAloud text={chapter.markdown} />
              <div>
                <h2 className="font-heading text-[22px]">Version history</h2>
                <div className="mt-2">
                  <VersionHistory
                    revisions={revisions.filter(revision => revision.value.id === book.id)}
                    onRestore={revision => update(revision.value)}
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'import' && (
            <>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={replaceImport} onChange={event => setReplaceImport(event.target.checked)} />
                {t('reads.studio.replaceChapters')}
              </label>
              <ImportPanel onApply={applyImport} />
            </>
          )}

          {tab === 'pictures' && (
            <div className="space-y-4">
              {isPictureBook(book) && (
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-sm font-semibold">One illustration per page</p>
                  <p className="mt-1 text-sm text-muted-foreground">ET AI keeps the same child, clothes, and colours. The style stays with this book. Without an image key, each page is drawn here and costs nothing.</p>
                  <button type="button" className="mt-3 h-10 rounded-full bg-secondary px-4 text-sm font-bold text-secondary-foreground" onClick={() => void illustratePages()}>
                    Illustrate every page
                  </button>
                </div>
              )}
              <IllustrationPrompt
                onCreated={(asset, note) => {
                  update({ images: [...(book.images ?? []), asset] });
                  toast.message(note);
                }}
              />
              <ImageLibrary
                scopeId={book.id}
                images={book.images ?? []}
                onChange={images => update({ images })}
                onInsert={image => placeImage(image.alt, image.src, image.caption, image.fullBleed)}
              />
            </div>
          )}

          {tab === 'cover' && (
            <div className="space-y-4">
              {lockedStyle && <p className="text-sm text-muted-foreground">{t('reads.studio.seriesLock')}</p>}
              <CoverArtPicker
                brief={brief}
                lockedStyleId={lockedStyle}
                onSelect={option => { void paintCover(option.artSrc, option.styleId, option.prompt); }}
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                {t('reads.studio.uploadCover')}
                <input
                  type="file"
                  accept="image/*"
                  className="text-xs font-normal"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    void optimiseImage(file).then(async fitted => {
                      const stored = await storeMedia(book.id, fitted.blob, `cover-${Date.now()}.jpg`);
                      await paintCover(stored.src, book.coverBrief?.styleId ?? lockedStyle ?? 'novel', 'Uploaded cover');
                    }).catch(err => toast.error(err instanceof Error ? err.message : 'That picture could not be used.'));
                  }}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-semibold">Title placement
                  <select
                    value={book.coverBrief?.placement ?? 'bottom'}
                    onChange={event => {
                      const placement = event.target.value as CoverPlacement;
                      if (book.coverBrief?.artSrc) void paintCover(book.coverBrief.artSrc, book.coverBrief.styleId ?? 'novel', book.coverBrief.prompt ?? '', { placement });
                      else update({ coverBrief: { ...(book.coverBrief ?? { font: 'serif', brand: true }), placement } });
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-border px-2 font-normal"
                  >
                    <option value="top">Top</option>
                    <option value="center">Centre</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">Font
                  <select
                    value={book.coverBrief?.font ?? 'serif'}
                    onChange={event => {
                      const font = event.target.value as CoverFont;
                      if (book.coverBrief?.artSrc) void paintCover(book.coverBrief.artSrc, book.coverBrief.styleId ?? 'novel', book.coverBrief.prompt ?? '', { font });
                      else update({ coverBrief: { ...(book.coverBrief ?? { placement: 'bottom', brand: true }), font } });
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-border px-2 font-normal"
                  >
                    <option value="serif">Serif</option>
                    <option value="sans">Sans</option>
                    <option value="rounded">Rounded</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={book.coverBrief?.brand ?? true}
                    onChange={event => {
                      const brand = event.target.checked;
                      if (book.coverBrief?.artSrc) void paintCover(book.coverBrief.artSrc, book.coverBrief.styleId ?? 'novel', book.coverBrief.prompt ?? '', { brand });
                      else update({ coverBrief: { ...(book.coverBrief ?? { placement: 'bottom', font: 'serif' }), brand } });
                    }}
                  />
                  Poket Reads
                </label>
              </div>
              {book.coverBrief?.artSrc && (
                <button type="button" className="h-9 rounded-full border border-border px-3 text-sm font-semibold" onClick={() => void paintCover(book.coverBrief!.artSrc!, book.coverBrief?.styleId ?? 'novel', book.coverBrief?.prompt ?? '')}>
                  {t('reads.studio.redraw')}
                </button>
              )}
              {(book.cover.image || book.cover.hero || book.cover.thumb) && (
                <div className="flex flex-wrap items-end gap-4">
                  {book.cover.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover.image} alt={`${book.title} tile`} className="h-64 w-44 rounded-lg object-cover shadow" />
                  )}
                  {book.cover.hero && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover.hero} alt={`${book.title} banner`} className="h-28 w-64 rounded-lg object-cover shadow" />
                  )}
                  {book.cover.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover.thumb} alt={`${book.title} thumbnail`} className="h-24 w-16 rounded-lg object-cover shadow" />
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="h-10 rounded-full bg-foreground px-4 text-sm font-bold text-background"
                  onClick={() => {
                    const screen = screenCoverAge(book.ageRating, `${book.title}\n${book.blurb}\n${book.coverBrief?.prompt ?? ''}`);
                    update({
                      coverBrief: {
                        placement: 'bottom',
                        font: 'serif',
                        brand: true,
                        ...book.coverBrief,
                        ageOk: screen.ok,
                        ageNote: screen.note,
                      },
                    });
                  }}
                >
                  {t('reads.studio.ageCheck')}
                </button>
                {book.coverBrief?.ageNote && (
                  <p className={`text-sm ${book.coverBrief.ageOk ? 'text-emerald-800' : 'text-red-700'}`}>{book.coverBrief.ageNote}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">The author line is always ET AI. The picture itself has no lettering; the title is drawn on top.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function downloadBook(book: Book, kind: 'pdf' | 'epub') {
  const year = new Date().getFullYear();
  const bytes = kind === 'pdf' ? bookPdf(book, year) : bookEpub(book, year);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: kind === 'pdf' ? 'application/pdf' : 'application/epub+zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${book.id || 'book'}.${kind}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ReadAloud({ text }: { text: string }) {
  const spoken = chapterPlain(text);
  const words = wordsOf(spoken);
  const [on, setOn] = useState(false);
  const [at, setAt] = useState(-1);
  const stop = () => {
    window.speechSynthesis?.cancel();
    setOn(false);
    setAt(-1);
  };
  const play = () => {
    if (on) { stop(); return; }
    if (!spoken || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.rate = 0.92;
    utter.onboundary = (event) => {
      if (event.name !== 'word') return;
      const heard = spoken.slice(0, event.charIndex).split(/\s+/).filter(Boolean).length;
      setAt(Math.min(heard, Math.max(0, words.length - 1)));
    };
    utter.onend = () => { setOn(false); setAt(-1); };
    utter.onerror = () => { setOn(false); setAt(-1); };
    setOn(true);
    setAt(0);
    window.speechSynthesis.speak(utter);
  };
  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Read this chapter aloud</p>
        <button type="button" onClick={play} className="h-9 rounded-full bg-secondary px-3 text-sm font-bold text-secondary-foreground">{on ? 'Stop' : 'Play'}</button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">This browser’s voice. No speech key, and nothing is charged.</p>
      {words.length > 0 && (
        <p className="mt-3 text-sm leading-relaxed">
          {words.map((token, index) => (
            <span key={`${index}-${token}`} className={on && index === at ? 'rounded bg-[#E7C27D] px-0.5' : ''}>{token} </span>
          ))}
        </p>
      )}
    </div>
  );
}

function seriesStyleId(book: Book, books: Book[]): string | undefined {
  if (!book.series) return undefined;
  const sibling = books.find(item => item.id !== book.id && item.series?.id === book.series?.id && item.coverBrief?.styleId);
  return sibling?.coverBrief?.styleId ?? book.coverBrief?.styleId ?? (book.series.id === 'straits' ? 'novel' : undefined);
}

function OriginBadge({ origin }: { origin: 'ai' | 'human' | 'import' }) {
  const label = origin === 'ai' ? 'AI' : origin === 'import' ? 'Imported' : 'Human';
  return <span className="ml-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{label}</span>;
}

function Step({ active, label }: { active: boolean; label: string }) {
  return <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{label}</span>;
}

function Tab({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`h-9 rounded-full px-3 text-sm font-semibold ${on ? 'bg-foreground text-background' : 'border border-border'}`}>
      {label}
    </button>
  );
}
