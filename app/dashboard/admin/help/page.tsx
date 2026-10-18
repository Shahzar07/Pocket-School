'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminHelpGuide } from '@/components/admin/admin-help';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthSTORE } from '@/hooks/use-auth';
import { can, resolveStaffRole } from '@/lib/admin-console';
import { authedFetch } from '@/lib/api-client';
import type { HelpArticle } from '@/lib/help-centre';

export default function AdminHelpPage() {
  const { profile } = useAuthSTORE();
  const allowed = can(resolveStaffRole(profile), 'content');
  return (
    <DashPage>
      <DashHeader
        eyebrow="Admin"
        title="Admin help"
        description="Where each Poket School admin tool lives, what your login can do, and which missing keys still say coming soon."
      />
      <AdminHelpGuide />
      {allowed ? <ArticleEditor /> : null}
    </DashPage>
  );
}

function ArticleEditor() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await authedFetch('/api/help/admin');
    setArticles(Array.isArray(data.articles) ? data.articles as HelpArticle[] : []);
  };

  useEffect(() => {
    void load().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not load articles.');
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await authedFetch('/api/help/admin', { method: 'POST', body: JSON.stringify({ id, title, body, published }) });
      toast.success('Article saved.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the article.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <h2 className="font-heading text-xl text-[#203337]">Help articles</h2>
      <p className="mt-1 text-sm text-[#1E6A83]">Published articles are what the help centre and ET AI answer from. OPENROUTER_API_KEY is required for live replies.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2">
          {articles.map((article) => (
            <li key={article.id}>
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted" onClick={() => { setId(article.id); setTitle(article.title); setBody(article.body); setPublished(article.published); }}>
                <span className="font-medium">{article.title}</span>
                <span className="block text-xs text-muted-foreground">{article.published ? 'Published' : 'Hidden'}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-3">
          <Input value={id} onChange={(event) => setId(event.target.value)} aria-label="Article id" placeholder="sign-in" />
          <Input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Title" placeholder="Title" />
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} aria-label="Article body" rows={8} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
            Published
          </label>
          <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save article'}</Button>
        </div>
      </div>
    </Panel>
  );
}
