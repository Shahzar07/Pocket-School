'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthSTORE } from '@/hooks/use-auth';
import { createSupportTicket } from '@/lib/db';
import { STARTER_ARTICLES, searchArticles, type HelpArticle } from '@/lib/help-centre';

interface Source {
  id: string;
  title: string;
}

interface Turn {
  role: 'user' | 'et';
  text: string;
  escalate?: boolean;
  sources?: Source[];
  question?: string;
}

export default function HelpCentrePage() {
  const { user, profile } = useAuthSTORE();
  const [articles, setArticles] = useState<HelpArticle[]>(STARTER_ARTICLES);
  const [query, setQuery] = useState('');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/help')
      .then((res) => res.json())
      .then((data: { articles?: HelpArticle[] }) => {
        if (Array.isArray(data.articles) && data.articles.length > 0) setArticles(data.articles);
      })
      .catch(() => setArticles(STARTER_ARTICLES));
  }, []);

  const results = useMemo(() => searchArticles(articles, query), [articles, query]);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 2 || asking) return;
    setAsking(true);
    setTurns((current) => current.concat({ role: 'user', text }));
    setQuestion('');
    try {
      const res = await fetch('/api/help/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json() as { answer?: string; confident?: boolean; sources?: Source[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'ET AI could not answer.');
      setTurns((current) => current.concat({
        role: 'et',
        text: data.answer || 'I could not find this in the help centre.',
        escalate: data.confident === false,
        sources: data.sources,
        question: text,
      }));
    } catch (error) {
      setTurns((current) => current.concat({
        role: 'et',
        text: error instanceof Error ? error.message : 'ET AI could not answer.',
        escalate: true,
        question: text,
      }));
    } finally {
      setAsking(false);
    }
  };

  const openTicket = async (turn: Turn) => {
    if (!user || !turn.question) return;
    try {
      await createSupportTicket({
        userId: user.uid,
        userName: profile?.name ?? 'User',
        userRole: profile?.role ?? 'student',
        subject: turn.question.slice(0, 120),
        description: `${turn.question}\n\nET AI: ${turn.text}`,
        priority: 'normal',
        category: 'general',
        status: 'open',
        createdAt: Timestamp.now(),
      });
      setOpened(turn.question);
      toast.success('Ticket opened. The helpdesk has it from here.');
    } catch {
      toast.error('The ticket could not be opened.');
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Poket School</p>
        <h1 className="text-3xl font-semibold mt-1">Help centre</h1>
        <p className="mt-2 text-muted-foreground">Search the articles, or ask ET AI. A person takes a ticket only when the articles do not cover it.</p>
      </header>
      <section>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search help articles" placeholder="Search help articles" />
        <ul className="mt-4 space-y-3">
          {results.map((article) => (
            <li key={article.id} className="rounded-xl border border-border p-4">
              <h2 className="font-medium">{article.title}</h2>
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{article.body}</p>
            </li>
          ))}
          {results.length === 0 && <li className="text-sm text-muted-foreground">No article matches that search.</li>}
        </ul>
      </section>
      <section className="rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-medium">Ask ET AI</h2>
        <div className="space-y-3">
          {turns.map((turn, index) => (
            <div key={`${turn.role}-${index}`} className="text-sm">
              <p className="font-medium">{turn.role === 'user' ? 'You' : 'ET AI'}</p>
              <p className="whitespace-pre-wrap">{turn.text}</p>
              {turn.sources && turn.sources.length > 0 && (
                <p className="text-muted-foreground">From: {turn.sources.map((source) => source.title).join(', ')}</p>
              )}
              {turn.escalate && turn.question && opened !== turn.question && (
                user ? (
                  <Button className="mt-2" type="button" variant="outline" onClick={() => void openTicket(turn)}>
                    Open a helpdesk ticket
                  </Button>
                ) : (
                  <p className="mt-2">
                    <Link className="underline" href="/login">Sign in</Link> to open a helpdesk ticket.
                  </p>
                )
              )}
              {turn.question && opened === turn.question && <p className="mt-2 text-muted-foreground">Ticket opened.</p>}
            </div>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(event) => void ask(event)}>
          <Input value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Question for ET AI" placeholder="Ask about sign-in, levels, or Sparks" />
          <Button type="submit" disabled={asking}>{asking ? 'Asking…' : 'Ask'}</Button>
        </form>
      </section>
    </main>
  );
}
