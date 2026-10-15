'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getChildrenProfiles } from '@/lib/db';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { acknowledgeReport, listReportCards } from '@/lib/insights/client';
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
  acknowledgement?: { status?: string };
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
          {card.acknowledgement?.status === 'acknowledged' ? (
            <p className="text-sm mt-3">Acknowledged.</p>
          ) : (
            <Button className="mt-3" type="button" onClick={async () => {
              if (!user) return;
              await acknowledgeReport(card.id, {
                status: 'acknowledged',
                parentId: user.uid,
                parentName: profile?.name ?? 'Parent',
                at: new Date().toISOString(),
              });
              toast.success('Acknowledged');
              await load();
            }}>Acknowledge</Button>
          )}
        </Panel>
      ))}
    </DashPage>
  );
}
