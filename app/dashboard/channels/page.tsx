'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { ChannelsScreen, type ChannelCard, type HubMessage } from '@/components/scope-c/channels-screen';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isTeacherOrAdmin } from '@/lib/roles';

export default function ChannelsPage() {
  const { profile } = useAuthSTORE();
  const [channels, setChannels] = useState<ChannelCard[]>([]);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [activeId, setActiveId] = useState('');
  const [activeTitle, setActiveTitle] = useState('');
  const [quietNote, setQuietNote] = useState('');

  const load = () => {
    authedFetch('/api/messaging/channels').then((data) => {
      setChannels(Array.isArray(data.channels) ? data.channels as ChannelCard[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };
  useEffect(() => { load(); }, []);

  const open = (id: string) => {
    setActiveId(id);
    setActiveTitle(channels.find((channel) => channel.id === id)?.title ?? '');
    authedFetch(`/api/messaging/messages?channelId=${id}`).then((data) => {
      setMessages(Array.isArray(data.messages) ? data.messages as HubMessage[] : []);
    }).catch((error: Error) => toast.error(error.message));
  };

  return (
    <FeatureGate flag="messagingHub">
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
    </FeatureGate>
  );
}
