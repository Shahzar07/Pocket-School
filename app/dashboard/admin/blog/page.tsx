'use client';

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { resolveStaffRole } from '@/lib/admin-console';
import { db } from '@/lib/firebase';
import { BlogLivePreview } from '@/components/blog/live-preview';
import { BLOG_CATEGORIES, SAMPLE_POSTS, isCoverPath, slugify, type BlogFaq, type BlogPost, type BlogStatus } from '@/lib/blog/posts';

const EMPTY: BlogPost = {
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  category: 'Learning',
  tags: [],
  author: 'Poket School',
  coverImage: '',
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
};

function fromStamp(value: number | null): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function BlogDeskPage() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile ? { email: profile.email, role: profile.role, adminRole: profile.adminRole } : null);
  const allowed = staff === 'super_admin';
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [draft, setDraft] = useState<BlogPost>(EMPTY);
  const [tags, setTags] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const load = async () => {
    try {
      const snap = await getDocs(collection(db, 'blogPosts'));
      const rows: BlogPost[] = [];
      snap.forEach((row) => {
        const data = row.data() as Partial<BlogPost>;
        if (typeof data.title !== 'string') return;
        rows.push({ ...EMPTY, ...data, slug: row.id, sample: false, faq: Array.isArray(data.faq) ? data.faq : [] });
      });
      setPosts(rows);
      setNotice('');
    } catch {
      setNotice('Saved essays could not be loaded. The unpublished drafts below stay on this page.');
    }
  };

  useEffect(() => { void load(); }, []);

  const edit = (post: BlogPost) => {
    const next = { ...post, sample: false };
    setDraft(next);
    setTags(next.tags.join(', '));
  };

  const save = async () => {
    if (!allowed) {
      toast.error('Only a super admin can save the journal.');
      return;
    }
    const slug = slugify(draft.slug || draft.title);
    if (!slug || !draft.title.trim() || !draft.body.trim()) {
      toast.error('A title, a slug, and a body are required.');
      return;
    }
    const faq: BlogFaq[] = draft.faq.filter((item) => item.question.trim() && item.answer.trim()).slice(0, 8);
    const payload: BlogPost = {
      ...draft,
      slug,
      title: draft.title.trim(),
      excerpt: draft.excerpt.trim(),
      body: draft.body,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
      coverImage: isCoverPath(draft.coverImage) ? draft.coverImage : '',
      affiliate: draft.category === 'Book Reviews' || draft.affiliate,
      faq,
      sample: false,
      updatedAt: Date.now(),
    };
    setBusy(true);
    try {
      await setDoc(doc(db, 'blogPosts', slug), payload);
      toast.success(payload.status === 'published' ? 'Published.' : 'Saved.');
      setDraft(payload);
      await load();
    } catch {
      toast.error('The essay could not be saved. Sign in as a super admin and try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slug: string) => {
    if (!allowed) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'blogPosts', slug));
      if (draft.slug === slug) setDraft(EMPTY);
      await load();
    } catch {
      toast.error('That essay could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Journal"
        title="Blog"
        accent="desk."
        description="Super admins write, schedule, and publish. These six drafts stay off the public site until you publish them."
      />
      {!allowed ? <p className="rounded-2xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-4 py-3 text-sm text-[var(--ps-cyan-text)]">Only a super admin can save or publish. You can still read the unpublished drafts.</p> : null}
      {notice ? <p role="status" className="text-sm text-[var(--ps-cyan-text)]">{notice}</p> : null}

      <section aria-labelledby="sample-drafts">
        <h2 id="sample-drafts" className="text-sm font-bold">Unpublished drafts</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SAMPLE_POSTS.map((post) => (
            <li key={post.slug} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] font-bold tracking-wider text-[var(--ps-cyan-text)]">UNPUBLISHED DRAFT</p>
              <h3 className="mt-1 font-semibold">{post.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{post.category}</p>
              <button type="button" className="mt-3 min-h-11 text-sm font-bold text-primary" onClick={() => edit(post)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex justify-end">
        <button type="button" className="h-10 rounded-full border px-4 text-sm font-semibold" onClick={() => setShowPreview((value) => !value)}>
          {showPreview ? 'Hide live preview' : 'Show live preview'}
        </button>
      </div>
      <section className={`grid gap-6 ${showPreview ? 'xl:grid-cols-[1fr_1fr_1fr]' : 'lg:grid-cols-[1fr_1.2fr]'}`}>
        <div>
          <h2 className="text-sm font-bold">Saved essays</h2>
          <ul className="mt-3 space-y-2">
            {posts.length === 0 ? <li className="text-sm text-muted-foreground">No saved essays yet.</li> : null}
            {posts.map((post) => (
              <li key={post.slug} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2">
                <button type="button" className="min-h-11 text-left text-sm font-semibold" onClick={() => edit(post)}>{post.title}</button>
                <span className="text-xs uppercase text-muted-foreground">{post.status}</span>
              </li>
            ))}
          </ul>
        </div>
        <form className="space-y-3 rounded-3xl border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label className="block text-sm font-semibold">Title
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value, slug: draft.slug || slugify(event.target.value) })} className="mt-1 w-full min-h-11 rounded-xl border border-border px-3" />
          </label>
          <label className="block text-sm font-semibold">Slug
            <input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} className="mt-1 w-full min-h-11 rounded-xl border border-border px-3" />
          </label>
          <label className="block text-sm font-semibold">Excerpt
            <textarea value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
          </label>
          <label className="block text-sm font-semibold">Body
            <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={8} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Category
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border border-border px-3">
                {BLOG_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Author
              <input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border border-border px-3" />
            </label>
          </div>
          <label className="block text-sm font-semibold">Tags
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ET AI, families" className="mt-1 w-full min-h-11 rounded-xl border border-border px-3" />
          </label>
          <label className="block text-sm font-semibold">Cover image URL
            <input value={draft.coverImage} onChange={(event) => setDraft({ ...draft, coverImage: event.target.value })} placeholder="/blog/essay.webp or https://" className="mt-1 w-full min-h-11 rounded-xl border border-border px-3" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Status
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as BlogStatus })} className="mt-1 w-full min-h-11 rounded-xl border border-border px-3">
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Publish time
              <input type="datetime-local" value={fromStamp(draft.publishedAt)} onChange={(event) => setDraft({ ...draft, publishedAt: event.target.value ? new Date(event.target.value).getTime() : null })} className="mt-1 w-full min-h-11 rounded-xl border border-border px-3" />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} />
            Featured on the blog
          </label>
          <label className="block text-sm font-semibold">Call to action title
            <input value={draft.ctaTitle} onChange={(event) => setDraft({ ...draft, ctaTitle: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border border-border px-3" />
          </label>
          <label className="block text-sm font-semibold">Call to action text
            <textarea value={draft.ctaBody} onChange={(event) => setDraft({ ...draft, ctaBody: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-border px-3 py-2" />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Questions for the essay</legend>
            {draft.faq.map((item, index) => (
              <div key={index} className="grid gap-2">
                <input aria-label={`Question ${index + 1}`} value={item.question} onChange={(event) => setDraft({ ...draft, faq: draft.faq.map((row, i) => i === index ? { ...row, question: event.target.value } : row) })} placeholder="Question" className="min-h-11 rounded-xl border border-border px-3" />
                <input aria-label={`Answer ${index + 1}`} value={item.answer} onChange={(event) => setDraft({ ...draft, faq: draft.faq.map((row, i) => i === index ? { ...row, answer: event.target.value } : row) })} placeholder="Answer" className="min-h-11 rounded-xl border border-border px-3" />
              </div>
            ))}
            {draft.faq.length < 8 ? (
              <button type="button" className="min-h-11 text-sm font-bold text-primary" onClick={() => setDraft({ ...draft, faq: [...draft.faq, { question: '', answer: '' }] })}>
                Add a question
              </button>
            ) : null}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !allowed} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40">
              {busy ? 'Saving…' : 'Save essay'}
            </button>
            {draft.slug && !draft.sample ? (
              <button type="button" disabled={busy || !allowed} className="min-h-11 rounded-full border border-border px-5 text-sm font-bold" onClick={() => void remove(draft.slug)}>
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">The call to action always links to the offer and to sign-up. A scheduled essay stays hidden until its time.</p>
        </form>
        {showPreview ? (
          <BlogLivePreview post={{ ...draft, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }} />
        ) : null}
      </section>
    </DashPage>
  );
}
