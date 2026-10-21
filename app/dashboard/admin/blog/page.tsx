'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { resolveStaffRole } from '@/lib/admin-console';
import { db } from '@/lib/firebase';
import { BLOG_CATEGORIES, SAMPLE_POSTS, slugify, type BlogPost, type BlogStatus } from '@/lib/blog/posts';
import { withSeo } from '@/lib/blog/seo';

export default function BlogDeskPage() {
  const router = useRouter();
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile ? { email: profile.email, role: profile.role, adminRole: profile.adminRole } : null);
  const allowed = staff === 'super_admin';
  const [saved, setSaved] = useState<BlogPost[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState<'All' | BlogStatus>('All');
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const snap = await getDocs(collection(db, 'blogPosts'));
      const rows: BlogPost[] = [];
      snap.forEach((row) => {
        const data = row.data() as Partial<BlogPost>;
        if (typeof data.title !== 'string') return;
        rows.push(withSeo({
          slug: row.id,
          title: data.title,
          excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
          body: typeof data.body === 'string' ? data.body : '',
          category: typeof data.category === 'string' ? data.category : 'Learning',
          tags: Array.isArray(data.tags) ? data.tags : [],
          author: typeof data.author === 'string' ? data.author : 'Poket School',
          coverImage: typeof data.coverImage === 'string' ? data.coverImage : '',
          coverAlt: data.coverAlt,
          thumbnail: data.thumbnail,
          featured: data.featured === true,
          status: data.status || 'draft',
          publishedAt: typeof data.publishedAt === 'number' ? data.publishedAt : null,
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
          ctaTitle: data.ctaTitle || '',
          ctaBody: data.ctaBody || '',
          ctaLinks: Array.isArray(data.ctaLinks) ? data.ctaLinks : [],
          faq: Array.isArray(data.faq) ? data.faq : [],
          affiliate: data.affiliate === true,
          sample: false,
        }));
      });
      setSaved(rows);
      setNotice('');
    } catch {
      setNotice('Saved essays could not be loaded. The site drafts below stay on this page.');
    }
  };

  useEffect(() => { void load(); }, []);

  const posts = useMemo(() => {
    const bySlug = new Map<string, BlogPost>();
    for (const post of SAMPLE_POSTS) bySlug.set(post.slug, post);
    for (const post of saved) bySlug.set(post.slug, post);
    const needle = query.trim().toLowerCase();
    return [...bySlug.values()].filter((post) => {
      if (category !== 'All' && post.category !== category) return false;
      if (status !== 'All' && post.status !== status) return false;
      if (!needle) return true;
      return [post.title, post.excerpt, post.slug, post.category, ...post.tags].join('\n').toLowerCase().includes(needle);
    });
  }, [saved, query, category, status]);

  const duplicate = async (post: BlogPost) => {
    if (!allowed) {
      toast.error('Only a super admin can copy an essay.');
      return;
    }
    const nextSlug = slugify(`${post.slug}-copy`);
    const copy = withSeo({ ...post, slug: nextSlug, title: `${post.title} copy`, status: 'draft', sample: false, updatedAt: Date.now() });
    try {
      await setDoc(doc(db, 'blogPosts', nextSlug), copy);
      router.push(`/dashboard/admin/blog/${nextSlug}/edit`);
    } catch {
      toast.error('That essay could not be copied.');
    }
  };

  const remove = async (post: BlogPost) => {
    if (!allowed) return;
    const stored = saved.some((item) => item.slug === post.slug);
    if (!stored) {
      toast.message('This draft ships with the site. Duplicate it to make your own copy.');
      return;
    }
    if (!window.confirm(`Remove “${post.title}”?`)) return;
    try {
      await deleteDoc(doc(db, 'blogPosts', post.slug));
      await load();
    } catch {
      toast.error('That essay could not be removed.');
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Journal"
        title="Blog"
        description="Write, schedule, and publish. Site drafts stay off the public site until you publish them."
        actions={<Link href="/dashboard/admin/blog/new" className="inline-flex h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337]">New essay</Link>}
      />
      {!allowed ? <p className="rounded-2xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-4 py-3 text-sm text-[#1E6A83]">Only a super admin can save or publish. You can still open a draft.</p> : null}
      {notice ? <p role="status" className="text-sm text-[#1E6A83]">{notice}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-[var(--studio-surface,#fff)] px-3 text-[var(--studio-text,#203337)]" />
        </label>
        <label className="text-sm font-semibold">Category
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-[var(--studio-surface,#fff)] px-3 text-[var(--studio-text,#203337)]">
            <option>All</option>
            {BLOG_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Status
          <select value={status} onChange={(event) => setStatus(event.target.value as 'All' | BlogStatus)} className="mt-1 h-11 w-full rounded-xl border border-border bg-[var(--studio-surface,#fff)] px-3 text-[var(--studio-text,#203337)]">
            <option>All</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {posts.map((post) => (
          <li key={post.slug} className="rounded-2xl border border-border bg-card p-4" data-blog-row={post.slug}>
            <p className="text-[11px] font-bold tracking-wider text-[#1E6A83]">{post.sample ? 'SITE DRAFT' : post.status.toUpperCase()}</p>
            <h2 className="mt-1 font-semibold">{post.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{post.category}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/dashboard/admin/blog/${post.slug}/edit`} className="inline-flex h-11 items-center text-sm font-bold text-[#1E6A83]">Edit</Link>
              <Link href={`/dashboard/admin/blog/${post.slug}/edit#preview`} className="inline-flex h-11 items-center text-sm font-bold text-[#1E6A83]">Preview</Link>
              <button type="button" className="h-11 text-sm font-bold text-[#1E6A83]" onClick={() => void duplicate(post)}>Duplicate</button>
              <button type="button" className="h-11 text-sm font-bold text-[#1E6A83]" onClick={() => void remove(post)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </DashPage>
  );
}
