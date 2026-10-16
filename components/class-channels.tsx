'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { ChannelsScreen, type ChannelCard, type HubMessage } from '@/components/scope-c/channels-screen';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isTeacherOrAdmin } from '@/lib/roles';
import { channelSummaryPrompt } from '@/lib/community-assist';

export function ClassChannels() {
  const { profile } = useAuthSTORE();
  const [channels, setChannels] = useState<ChannelCard[]>([]);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [activeId, setActiveId] = useState('');
  const [activeTitle, setActiveTitle] = useState('');
  const [quietNote, setQuietNote] = useState('');
  const [summary, setSummary] = useState('');
  const [summarising, setSummarising] = useState(false);

  const load = () => {
    authedFetch('/api/messaging/channels').then((data) => {
      setChannels(Array.isArray(data.channels) ? data.channels as ChannelCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };
  useEffect(() => { load(); }, []);

  const open = (id: string) => {
    setActiveId(id);
    setSummary('');
    setActiveTitle(channels.find((channel) => channel.id === id)?.title ?? '');
    authedFetch(`/api/messaging/messages?channelId=${id}`).then((data) => {
      setMessages(Array.isArray(data.messages) ? data.messages as HubMessage[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };

  const summarise = () => {
    const prompt = channelSummaryPrompt(messages.map((message) => String(message.body ?? '')));
    if (!prompt) { toast.error('Open a channel that has messages first.'); return; }
    setSummarising(true);
    authedFetch('/api/ai/tutor', { method: 'POST', body: JSON.stringify({ message: prompt, mode: 'k12' }) })
      .then((data) => setSummary(typeof data.reply === 'string' ? data.reply : ''))
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setSummarising(false));
  };

  return (
    <FeatureGate flag="messagingHub">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Class channels live here, beside community spaces.</p>
          <button type="button" onClick={summarise} disabled={summarising} className="h-9 px-4 rounded-full border border-border text-xs font-semibold">
            {summarising ? 'ET AI is reading…' : 'ET AI summary'}
          </button>
        </div>
        {summary && <p className="text-sm bg-card border border-border rounded-2xl p-4 whitespace-pre-wrap">{summary}</p>}
        <ChannelsScreen
          channels={channels}
          messages={messages}
          activeTitle={activeTitle}
          quietNote={quietNote}
          onOpen={open}
          onSend={(body, language) => {
            if (!activeId) { toast.error('Open a channel first.'); return; }
            authedFetch('/api/messaging/send', { method: 'POST', body: JSON.stringify({ channelId: activeId, body, language }) })
              .then((data) => {
                if (typeof data.visibleAtMs === 'number' && data.visibleAtMs > Date.now()) {
                  setQuietNote('Quiet hours are on. This message waits until they end.');
                } else setQuietNote('');
                open(activeId);
              })
              .catch((error: Error) => toast.error(error.message));
          }}
          onAnnounce={isTeacherOrAdmin(profile) ? (body) => {
            if (!activeId || !body.trim()) return;
            authedFetch('/api/messaging/announce', { method: 'POST', body: JSON.stringify({ channelId: activeId, body }) })
              .then(() => open(activeId))
              .catch((error: Error) => toast.error(error.message));
          } : undefined}
        />
      </div>
    </FeatureGate>
  );
}
