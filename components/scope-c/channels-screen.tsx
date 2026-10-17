'use client';

import { FormEvent, useState } from 'react';
import { Megaphone, MessagesSquare } from 'lucide-react';
import { DashHeader, DashPage, EmptyState, ListRow, Panel, PanelHeader } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export interface ChannelCard { id: string; title: string; kind: string; ageTier: string }
export interface HubMessage { id: string; senderName?: string; body?: string; bodyTranslated?: string; visibleAtMs?: number }

export function ChannelsScreen({
  channels, messages, activeTitle, quietNote, onOpen, onSend, onAnnounce,
}: {
  channels: ChannelCard[];
  messages: HubMessage[];
  activeTitle?: string;
  quietNote?: string;
  onOpen?: (id: string) => void;
  onSend?: (body: string, language: string) => void;
  onAnnounce?: (body: string) => void;
}) {
  const [body, setBody] = useState('');
  const [language, setLanguage] = useState('ms');
  const [notice, setNotice] = useState('');

  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    onSend?.(body.trim(), language);
    setBody('');
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Messages"
        title="Channels"
        accent="hub"
        description="Class channels, parent channels, and announcements. Minors have no student-to-student direct messages. Quiet hours hold delivery."
      />
      {quietNote && <p className="text-sm text-[var(--ps-cyan-text)] bg-[var(--ps-cyan-soft)] border border-[var(--ps-cyan-border)]/20 rounded-xl px-3 py-2">{quietNote}</p>}
      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <Panel>
          <PanelHeader title="Channels" />
          <div className="space-y-2">
            {channels.length === 0 && <EmptyState icon={MessagesSquare} title="No channels" body="A teacher opens a class or parent channel." />}
            {channels.map((channel) => (
              <ListRow
                key={channel.id}
                title={channel.title}
                subtitle={`${channel.kind} · ${channel.ageTier}`}
                trailing={<button type="button" className="text-[12px] font-semibold text-primary" onClick={() => onOpen?.(channel.id)}>Open</button>}
              />
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title={activeTitle || 'Conversation'} />
          <div className="space-y-2 mb-4">
            {messages.length === 0 && <EmptyState icon={Megaphone} title="No messages yet" />}
            {messages.map((message) => (
              <ListRow
                key={message.id}
                title={message.body || ''}
                subtitle={`${message.senderName || 'Member'}${message.bodyTranslated ? ` · ${message.bodyTranslated}` : ''}`}
              />
            ))}
          </div>
          <form onSubmit={send} className="space-y-2">
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write to this channel" className="rounded-xl min-h-20" />
            <div className="flex flex-wrap gap-2 items-center">
              <label className="text-[12px] text-muted-foreground" htmlFor="channel-lang">Translate to</label>
              <select id="channel-lang" value={language} onChange={(event) => setLanguage(event.target.value)} className="h-9 rounded-xl border border-border bg-card px-2 text-sm">
                <option value="en">English</option>
                <option value="ms">Bahasa Malaysia</option>
                <option value="zh">中文</option>
                <option value="ar">العربية</option>
              </select>
              <Button type="submit" className="rounded-xl" disabled={!onSend}>Send</Button>
              {onAnnounce && (
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => { onAnnounce(notice || body); setNotice(''); }}>
                  Announce
                </Button>
              )}
            </div>
            {onAnnounce && (
              <Input value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="Announcement text" className="rounded-xl" aria-label="Announcement" />
            )}
          </form>
        </Panel>
      </div>
    </DashPage>
  );
}
