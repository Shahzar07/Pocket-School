export interface HelpArticle {
  id: string;
  title: string;
  body: string;
  published: boolean;
}

export const STARTER_ARTICLES: HelpArticle[] = [
  {
    id: 'sign-in',
    title: 'Sign in and verification codes',
    body: 'Use the email on your Poket School account. A verification code arrives by email, or by WhatsApp when that number is on the account and WhatsApp is configured. The code expires in 10 minutes. If it does not arrive, wait a moment and request another.',
    published: true,
  },
  {
    id: 'levels',
    title: 'Levels',
    body: 'Poket School organises learning by level: Primary, Lower Secondary, IGCSE, and A-Level. Your level is set on your profile. It is not a year number.',
    published: true,
  },
  {
    id: 'privacy',
    title: 'Download or delete your data',
    body: 'Open Profile, then Privacy and your data. Download my data saves a JSON copy. Delete account waits 14 days so you can cancel. Invoices stay for tax records with your name removed. This covers the Malaysian PDPA and the GDPR.',
    published: true,
  },
  {
    id: 'sparks',
    title: 'Sparks',
    body: 'Sparks are the learning credits inside Poket School. An institution pool is shared by that school. Sparks cannot buy a marketplace course.',
    published: true,
  },
];

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

export function searchArticles(articles: readonly HelpArticle[], query: string): HelpArticle[] {
  const words = tokens(query);
  const live = articles.filter((article) => article.published && article.title.trim() && article.body.trim());
  if (words.length === 0) return live;
  return live
    .map((article) => {
      const hay = tokens(`${article.title} ${article.body}`);
      const score = words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
      return { article, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.article);
}

export interface HelpAnswer {
  confident: boolean;
  answer: string;
  sources: { id: string; title: string }[];
}

/** ET AI answers only from published help articles. A weak match asks for a ticket. */
export function answerFromArticles(question: string, articles: readonly HelpArticle[]): HelpAnswer {
  const matches = searchArticles(articles, question);
  const words = tokens(question);
  if (matches.length === 0 || words.length === 0) {
    return {
      confident: false,
      answer: 'I could not find this in the help centre. Open a helpdesk ticket and a person will take it from here.',
      sources: [],
    };
  }
  const top = matches[0];
  const hay = tokens(`${top.title} ${top.body}`);
  const score = words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
  if (score < 2 && !tokens(top.title).some((word) => words.includes(word))) {
    return {
      confident: false,
      answer: 'I could not find a clear article for that. Open a helpdesk ticket and a person will take it from here.',
      sources: matches.slice(0, 2).map((article) => ({ id: article.id, title: article.title })),
    };
  }
  return {
    confident: true,
    answer: top.body,
    sources: [{ id: top.id, title: top.title }],
  };
}
