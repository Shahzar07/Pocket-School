'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import type { Editor } from '@tiptap/react';
import { DashPage } from '@/components/dash-ui';
import { BlogLivePreview } from '@/components/blog/live-preview';
import { CoverEditor } from '@/components/blog/cover-editor';
import { RichEditor } from '@/components/blog/rich-editor';
import { SeoPanel } from '@/components/blog/seo-panel';
import { useAuthSTORE } from '@/hooks/use-auth';
import { resolveStaffRole } from '@/lib/admin-console';
import { db } from '@/lib/firebase';
import { publishImageError } from '@/lib/blog/images';
import { markdownToHtml, storedBody } from '@/lib/blog/richtext';
import { BLOG_CATEGORIES, SAMPLE_POSTS, isCoverPath, slugify, type BlogFaq, type BlogPost, type BlogStatus } from '@/lib/blog/posts';
import { EMPTY_SEO, localSeoSuggestion, withSeo } from '@/lib/blog/seo';
import { authedFetch } from '@/lib/api-client';

const fieldClass = 'mt-1 w-full min-h-11 rounded-xl border border-border bg-[var(--studio-surface,#fff)] px-3 text-[var(--studio-text,#203337)]';

const EMPTY: BlogPost = withSeo({
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  category: 'Learning',
  tags: [],
  author: 'Poket School',
  coverImage: '',
  coverAlt: '',
  thumbnail: '',
  featured: false,
  status: 'draft',
  publishedAt: null,
  updatedAt: 0,
  ctaTitle: 'See how Poket School fits',
  ctaBody: 'Read the offer, then open an account. ET AI stays with the learner from the first lesson.',
  ctaLinks: [
    { label: 'See the offer', href: '/offer' },
    { label: 'Create an account', href: '/signup' },
  ],
  faq: [{ question: '', answer: '' }],
  affiliate: false,
  sample: false,
  ...EMPTY_SEO,
});

function fromStamp(value: number | null): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function draftKey(slug: string): string {
  return `poket-blog-draft:${slug || 'new'}`;
}

export function EditorDesk({ slug }: { slug?: string }) {
  const router = useRouter();
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile ? { email: profile.email, role: profile.role, adminRole: profile.adminRole } : null);
  const allowed = staff === 'super_admin';
  const [draft, setDraft] = useState<BlogPost>(EMPTY);
  const [tags, setTags] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [ready, setReady] = useState(!slug);
  const editorRef = useRef<Editor | null>(null);
  const original = useRef('');
  const slugTouched = useRef(Boolean(slug));

  useEffect(() => {
    if (!slug) return;
    let cancel = false;
    const load = async () => {
      let next = SAMPLE_POSTS.find((post) => post.slug === slug) || null;
      try {
        const snap = await getDoc(doc(db, 'blogPosts', slug));
        if (snap.exists()) {
          const data = snap.data() as Partial<BlogPost>;
          next = withSeo({ ...EMPTY, ...data, slug: snap.id, sample: false, faq: Array.isArray(data.faq) ? data.faq : [] });
        }
      } catch {
        setNotice('The saved essay could not be loaded. A site draft is open if one matches this address.');
      }
      if (cancel) return;
      if (!next) {
        setNotice('That essay was not found.');
        setReady(true);
        return;
      }
      const base = withSeo({ ...next, sample: false });
      original.current = base.slug;
      slugTouched.current = true;
      let chosen = base;
      try {
        const raw = window.localStorage.getItem(draftKey(base.slug));
        if (raw) {
          const saved = JSON.parse(raw) as BlogPost & { savedAt?: number };
          if ((saved.savedAt || 0) > (base.updatedAt || 0) && saved.body && saved.body !== base.body) {
            chosen = withSeo({ ...base, ...saved, sample: false });
            setNotice('Restored unsaved edits from this browser.');
          }
        }
      } catch {
        /* a bad local copy stays unused */
      }
      setDraft(chosen);
      setTags(chosen.tags.join(', '));
      setReady(true);
    };
    void load();
    return () => { cancel = true; };
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(draftKey(draft.slug || slug || 'new'), JSON.stringify({ ...draft, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), savedAt: Date.now() }));
    }, 800);
    return () => window.clearTimeout(handle);
  }, [draft, tags, ready, slug]);

  const save = async () => {
    if (!allowed) {
      toast.error('Only a super admin can save the journal.');
      return;
    }
    const nextSlug = slugify(draft.slug || draft.title);
    if (!nextSlug || !draft.title.trim() || !draft.body.trim()) {
      toast.error('A title, a slug, and a body are required.');
      return;
    }
    const faq: BlogFaq[] = draft.faq.filter((item) => item.question.trim() && item.answer.trim()).slice(0, 8);
    const coverImage = isCoverPath(draft.coverImage) ? draft.coverImage : '';
    const thumbnail = draft.thumbnail && isCoverPath(draft.thumbnail) ? draft.thumbnail : '';
    if (draft.status === 'published' || draft.status === 'scheduled') {
      const imageError = publishImageError(coverImage, draft.coverAlt || '');
      if (imageError) {
        toast.error(imageError);
        return;
      }
    }
    const payload = withSeo({
      ...draft,
      slug: nextSlug,
      title: draft.title.trim(),
      excerpt: draft.excerpt.trim(),
      body: storedBody(draft.body),
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
      coverImage,
      coverAlt: (draft.coverAlt || '').trim(),
      thumbnail,
      affiliate: draft.category === 'Book Reviews' || draft.affiliate,
      faq,
      takeaways: (draft.takeaways || []).map((item) => item.trim()).filter(Boolean),
      howto: (draft.howto || []).filter((step) => step.name.trim() && step.text.trim()),
      customFields: (draft.customFields || []).filter((field) => field.key.trim()),
      sample: false,
      updatedAt: Date.now(),
    });
    setBusy(true);
    try {
      await setDoc(doc(db, 'blogPosts', nextSlug), payload);
      if (original.current && original.current !== nextSlug && !SAMPLE_POSTS.some((post) => post.slug === original.current)) {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'blogPosts', original.current));
      }
      original.current = nextSlug;
      window.localStorage.removeItem(draftKey(nextSlug));
      toast.success(payload.status === 'published' ? 'Published.' : 'Saved.');
      setDraft(payload);
      if (!slug || slug !== nextSlug) router.replace(`/dashboard/admin/blog/${nextSlug}/edit`);
    } catch {
      toast.error('The essay could not be saved. Sign in as a super admin and try again.');
    } finally {
      setBusy(false);
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const data = await authedFetch('/api/admin/blog/suggest', {
        method: 'POST',
        body: JSON.stringify({ title: draft.title, excerpt: draft.excerpt, body: draft.body }),
      }) as Partial<BlogPost> & { source?: string };
      setDraft((current) => ({ ...current, ...fillEmpty(current, data) }));
      toast.success(data.source === 'openrouter' ? 'Suggestions added where a field was empty.' : 'Empty fields were filled from the essay.');
    } catch {
      const local = localSeoSuggestion(draft);
      setDraft((current) => ({ ...current, ...fillEmpty(current, local) }));
      toast.message('ET AI is not connected. Empty fields were filled from the essay.');
    } finally {
      setSuggesting(false);
    }
  };

  if (!ready) return <DashPage><p className="text-sm">Opening the essay…</p></DashPage>;

  const preview = { ...draft, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) };

  return (
    <DashPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/admin/blog" className="text-sm font-bold text-[#1E6A83]">Back to essays</Link>
          <h1 className="mt-1 font-heading text-3xl tracking-tight text-foreground">{slug ? 'Edit essay' : 'New essay'}</h1>
        </div>
        <button type="button" disabled={busy || !allowed} className="h-11 rounded-full bg-[#3FE0D0] px-5 text-sm font-bold text-[#203337] disabled:opacity-40" onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save essay'}
        </button>
      </div>
      {!allowed ? <p className="rounded-2xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-4 py-3 text-sm text-[#1E6A83]">Only a super admin can save or publish.</p> : null}
      {notice ? <p role="status" className="text-sm text-[#1E6A83]">{notice}</p> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <form className="space-y-3 rounded-3xl border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label className="block text-sm font-semibold">Title
            <input data-blog-title="1" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value, slug: slugTouched.current ? draft.slug : slugify(event.target.value) })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Slug
            <input data-blog-slug="1" value={draft.slug} onChange={(event) => { slugTouched.current = true; setDraft({ ...draft, slug: slugify(event.target.value) }); }} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Excerpt
            <textarea value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} rows={2} className={fieldClass} />
          </label>
          <RichEditor
            markdown={draft.body}
            onChange={(body) => setDraft((current) => current.body === body ? current : { ...current, body })}
            onReady={(editor) => { editorRef.current = editor; }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Category
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className={fieldClass}>
                {BLOG_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Author
              <input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} className={fieldClass} />
            </label>
          </div>
          <label className="block text-sm font-semibold">Tags
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ET AI, families" className={fieldClass} />
          </label>
          <CoverEditor
            postId={slugify(draft.slug || draft.title)}
            coverImage={draft.coverImage}
            thumbnail={draft.thumbnail || ''}
            coverAlt={draft.coverAlt || ''}
            onCover={(next) => setDraft((current) => ({ ...current, ...next }))}
            onInsert={(markdown) => {
              const editor = editorRef.current;
              if (editor) editor.chain().focus().insertContent(markdownToHtml(markdown)).run();
              else setDraft({ ...draft, body: `${draft.body.trim()}\n\n${markdown}\n` });
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Status
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as BlogStatus })} className={fieldClass}>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Publish time
              <input type="datetime-local" value={fromStamp(draft.publishedAt)} onChange={(event) => setDraft({ ...draft, publishedAt: event.target.value ? new Date(event.target.value).getTime() : null })} className={`${fieldClass} [color-scheme:inherit]`} />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} />
            Featured on the blog
          </label>
          <label className="block text-sm font-semibold">Call to action title
            <input value={draft.ctaTitle} onChange={(event) => setDraft({ ...draft, ctaTitle: event.target.value })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Call to action text
            <textarea value={draft.ctaBody} onChange={(event) => setDraft({ ...draft, ctaBody: event.target.value })} rows={2} className={fieldClass} />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Questions for the essay</legend>
            {draft.faq.map((item, index) => (
              <div key={index} className="grid gap-2">
                <input aria-label={`Question ${index + 1}`} value={item.question} onChange={(event) => setDraft({ ...draft, faq: draft.faq.map((row, rowIndex) => rowIndex === index ? { ...row, question: event.target.value } : row) })} placeholder="Question" className={fieldClass} />
                <input aria-label={`Answer ${index + 1}`} value={item.answer} onChange={(event) => setDraft({ ...draft, faq: draft.faq.map((row, rowIndex) => rowIndex === index ? { ...row, answer: event.target.value } : row) })} placeholder="Answer" className={fieldClass} />
              </div>
            ))}
            {draft.faq.length < 8 ? (
              <button type="button" className="h-11 text-sm font-bold text-[#1E6A83]" onClick={() => setDraft({ ...draft, faq: [...draft.faq, { question: '', answer: '' }] })}>Add a question</button>
            ) : null}
          </fieldset>
        </form>
        <SeoPanel post={draft} suggesting={suggesting} onSuggest={() => void suggest()} onChange={(next) => setDraft({ ...draft, ...next })} />
      </div>
      <div id="preview" className="scroll-mt-6">
        <BlogLivePreview post={preview} />
      </div>
    </DashPage>
  );
}

function fillEmpty(current: BlogPost, suggestion: Partial<BlogPost>) {
  const next: Partial<BlogPost> = {};
  if (!current.seoTitle && suggestion.seoTitle) next.seoTitle = suggestion.seoTitle;
  if (!current.seoDescription && suggestion.seoDescription) next.seoDescription = suggestion.seoDescription;
  if (!current.tldr && suggestion.tldr) next.tldr = suggestion.tldr;
  if (!(current.takeaways || []).some((item) => item.trim()) && suggestion.takeaways?.length) next.takeaways = suggestion.takeaways;
  return next;
}
