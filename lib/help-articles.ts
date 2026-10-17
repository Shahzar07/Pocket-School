import 'server-only';

import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { STARTER_ARTICLES, type HelpArticle } from '@/lib/help-centre';

function asArticle(id: string, data: Record<string, unknown>): HelpArticle | null {
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const body = typeof data.body === 'string' ? data.body.trim() : '';
  if (!title || !body) return null;
  return { id, title, body, published: data.published !== false };
}

/** Published articles for the public help centre. Starters fill an empty catalogue. */
export async function listHelpArticles(publishedOnly: boolean): Promise<HelpArticle[]> {
  if (!isAdminConfigured()) return STARTER_ARTICLES.filter((article) => !publishedOnly || article.published);
  try {
    const snap = await adminDb().collection('help_articles').limit(200).get();
    if (snap.empty) return STARTER_ARTICLES;
    const rows = snap.docs
      .map((item) => asArticle(item.id, item.data() as Record<string, unknown>))
      .filter((article): article is HelpArticle => article !== null);
    return publishedOnly ? rows.filter((article) => article.published) : rows;
  } catch (error) {
    console.error('help articles', error);
    return STARTER_ARTICLES;
  }
}
