'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthSTORE } from '@/hooks/use-auth';
import { can, resolveStaffRole } from '@/lib/admin-console';
import { authedFetch } from '@/lib/api-client';
import type { HelpArticle } from '@/lib/help-centre';

export default function HelpArticlesAdminPage() {
  const { profile } = useAuthSTORE();
  const allowed = can(resolveStaffRole(profile), 'content');
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
    if (!allowed) return;
    void load().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not load articles.');
    });
  }, [allowed]);

  const edit = (article: HelpArticle) => {
    setId(article.id);
    setTitle(article.title);
    setBody(article.body);
    setPublished(article.published);
  };

  const save = async () => {
    setSaving(true);
    try {
      await authedFetch('/api/help/admin', {
        method: 'POST',
        body: JSON.stringify({ id, title, body, published }),
      });
      toast.success('Article saved.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the article.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <DashPage>
        <DashHeader eyebrow="Platform" title="Help articles" description="Published articles are what ET AI answers from." />
        <Panel><p className="text-sm text-muted-foreground">This screen is for an admin.</p></Panel>
      </DashPage>
    );
  }

  return (
    <DashPage>
      <DashHeader eyebrow="Platform" title="Help articles" description="Published articles are what the help centre and ET AI answer from." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel>
          <ul className="space-y-2">
            {articles.map((article) => (
              <li key={article.id}>
                <button type="button" className="w-full text-left rounded-lg px-3 py-2 hover:bg-muted" onClick={() => edit(article)}>
                  <span className="font-medium">{article.title}</span>
                  <span className="block text-xs text-muted-foreground">{article.published ? 'Published' : 'Hidden'} · {article.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
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
        </Panel>
      </div>
    </DashPage>
  );
}
