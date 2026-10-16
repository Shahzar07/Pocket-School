'use client';

import { useRef, useState } from 'react';
import { wrapSelection, type DeliveryChannel } from '@/lib/compose';
import { authedFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const TOOLS = [
  { label: 'B', before: '**', after: '**' },
  { label: 'I', before: '*', after: '*' },
  { label: 'List', before: '\n- ', after: '' },
] as const;

export function RichComposer({
  value,
  onChange,
  channels,
  onChannels,
  schedule,
  onSchedule,
}: {
  value: string;
  onChange: (value: string) => void;
  channels: DeliveryChannel[];
  onChannels: (channels: DeliveryChannel[]) => void;
  schedule: string;
  onSchedule: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');

  const apply = (before: string, after: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = wrapSelection(value, start, end, before, after);
    onChange(next.text);
  };

  const toggle = (channel: DeliveryChannel) => {
    onChannels(channels.includes(channel) ? channels.filter((item) => item !== channel) : [...channels, channel]);
  };

  const draft = async () => {
    setDrafting(true);
    setDraftError('');
    try {
      const data = await authedFetch('/api/ai/draft', { method: 'POST', body: JSON.stringify({ prompt }) });
      const text = typeof data.text === 'string' ? data.text : '';
      if (text) onChange(text);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'ET AI could not draft that.');
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TOOLS.map((tool) => (
          <button key={tool.label} type="button" onClick={() => apply(tool.before, tool.after)} className="h-8 px-3 rounded-full border border-border text-xs font-semibold">
            {tool.label}
          </button>
        ))}
      </div>
      <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Message" className="rounded-xl min-h-28 text-sm bg-muted/50" />
      <div className="flex flex-wrap gap-2 items-center">
        <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask ET AI to draft this" aria-label="Draft prompt" className="rounded-full h-10 max-w-sm" />
        <Button type="button" variant="outline" className="rounded-full h-10" disabled={drafting || !prompt.trim()} onClick={draft}>
          {drafting ? 'Drafting…' : 'ET AI draft'}
        </Button>
      </div>
      {draftError && <p className="text-xs text-destructive">{draftError}</p>}
      <div className="flex flex-wrap gap-3 text-sm">
        {(['in_app', 'email', 'push'] as const).map((channel) => (
          <label key={channel} className="inline-flex items-center gap-2">
            <input type="checkbox" checked={channels.includes(channel)} onChange={() => toggle(channel)} />
            {channel === 'in_app' ? 'In app' : channel === 'email' ? 'Email' : 'Push'}
          </label>
        ))}
        <label className="inline-flex items-center gap-2">
          Schedule
          <input type="datetime-local" value={schedule} onChange={(e) => onSchedule(e.target.value)} className="h-9 rounded-full border border-border bg-card px-3 text-xs" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">In-app posts immediately. Email needs SMTP_PASS. Push needs the web push keys. A future time is stored and waits.</p>
    </div>
  );
}
