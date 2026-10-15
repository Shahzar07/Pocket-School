'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getChildrenProfiles } from '@/lib/db';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { acknowledgeReport, listReportCards } from '@/lib/insights/client';
import { parentSign } from '@/lib/insights/report-card-model';
import { toast } from 'sonner';

interface Card {
  id: string;
  studentName?: string;
  courseTitle?: string;
  grade?: string;
  heading?: string;
  termId?: string;
  year?: number;
  comment?: string;
  acknowledgement?: { status?: string; reply?: string };
  integrityNote?: string;
  comparison?: { courseTitle?: string; previous?: number; current?: number; delta?: number }[];
}

export default function ParentReportsPage() {
  const { user, profile } = useAuthSTORE();
  const [cards, setCards] = useState<Card[]>([]);

  const load = async () => {
    if (!user) return;
    const children = await getChildrenProfiles(user.uid).catch(() => []);
    const lists = await Promise.all(children.map(child => listReportCards('studentId', child.id).catch(() => [])));
    setCards(lists.flat() as Card[]);
  };

  useEffect(() => { load(); }, [user]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Family"
        title="Report cards"
        description="Acknowledge a card once you have read the comment. The acknowledgement is stored with your name."
      />
      {cards.length === 0 && <p className="text-sm text-muted-foreground">No report cards yet.</p>}
      {cards.map(card => (
        <Panel key={card.id}>
          <p className="font-semibold">{card.heading} · {card.courseTitle}</p>
          <p className="text-sm text-muted-foreground">{card.studentName} · {card.termId} {card.year} · grade {card.grade}</p>
          {card.comment && <p className="text-sm mt-2">{card.comment}</p>}
          {card.integrityNote && <p className="text-sm mt-2">{card.integrityNote}</p>}
          {card.comparison?.map(row => (
            <p key={row.courseTitle} className="text-sm text-muted-foreground">Last term {row.courseTitle}: {row.previous}% to {row.current}%.</p>
          ))}
          {card.acknowledgement?.status === 'acknowledged' ? (
            <p className="text-sm mt-3">Acknowledged{card.acknowledgement.reply ? `: ${card.acknowledgement.reply}` : ''}.</p>
          ) : (
            <ParentSign cardId={card.id} parentId={user?.uid ?? ''} parentName={profile?.name ?? 'Parent'} onDone={load} />
          )}
        </Panel>
      ))}
    </DashPage>
  );
}

function ParentSign({ cardId, parentId, parentName, onDone }: { cardId: string; parentId: string; parentName: string; onDone: () => Promise<void> }) {
  const [reply, setReply] = useState('Read and signed.');
  if (!parentId) return null;
  return (
    <form className="mt-3 space-y-2" onSubmit={async event => {
      event.preventDefault();
      await acknowledgeReport(cardId, parentSign({ parentId, parentName, reply, at: new Date().toISOString() }));
      toast.success('Acknowledged');
      await onDone();
    }}>
      <textarea className="w-full rounded-xl border border-border p-3 text-sm" rows={2} value={reply} onChange={event => setReply(event.target.value)} aria-label="Parent reply" />
      <Button type="submit">Acknowledge and e-sign</Button>
    </form>
  );
}
