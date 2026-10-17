'use client';

import { FormEvent, useState } from 'react';
import { Compass, MessageCircle, Search } from 'lucide-react';
import { DashHeader, DashPage, EmptyState, ListRow, Panel, PanelHeader, Segmented } from '@/components/dash-ui';
import { SafetyShieldLink } from '@/components/safety/surfaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export interface SpaceCard {
  id: string;
  title: string;
  kind: string;
  ageTier: string;
}

export interface PostCard {
  id: string;
  kind?: string;
  body?: string;
  authorName?: string;
  moderation?: string;
  bestAnswerId?: string;
}

export function CommunityScreen({
  ageTier, explore, dateOfBirth, spaces, posts, spaceTitle,
  onSaveDob, onOpenSpace, onPost, onSearch,
}: {
  ageTier: string;
  explore: boolean;
  dateOfBirth?: string;
  spaces: SpaceCard[];
  posts: PostCard[];
  spaceTitle?: string;
  onSaveDob?: (dob: string) => void;
  onOpenSpace?: (id: string) => void;
  onPost?: (kind: 'win' | 'question', body: string) => void;
  onSearch?: (q: string) => void;
}) {
  const [dob, setDob] = useState(dateOfBirth ?? '');
  const [kind, setKind] = useState<'win' | 'question'>('win');
  const [body, setBody] = useState('');
  const [q, setQ] = useState('');

  const submitPost = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    onPost?.(kind, body.trim());
    setBody('');
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow={explore ? 'Explore · adults' : 'Your school'}
        title="Community"
        accent={ageTier === 'adult' ? 'adult' : 'school'}
        actions={<SafetyShieldLink />}
        description={explore
          ? 'Adult spaces, public profiles, and opt-in messages. Minors and minor spaces stay out of Explore.'
          : 'Wins and questions with people in your age tier. Student-to-student direct messages stay off.'}
      />

      {!dateOfBirth && (
        <Panel>
          <PanelHeader title="Date of birth" meta="Set on the server" />
          <p className="text-sm text-muted-foreground mb-3">
            Your age tier is worked out here and cannot be edited from the app. Under 18 is a minor account.
          </p>
          <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); onSaveDob?.(dob); }}>
            <Input type="date" value={dob} onChange={(event) => setDob(event.target.value)} className="rounded-xl max-w-[200px]" aria-label="Date of birth" />
            <Button type="submit" className="rounded-xl">Save</Button>
          </form>
        </Panel>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <Panel>
          <PanelHeader title="Spaces" />
          <div className="space-y-2">
            {spaces.length === 0 && <EmptyState icon={Compass} title="No spaces yet" body="A teacher opens a class, subject, or school space." />}
            {spaces.map((space) => (
              <ListRow
                key={space.id}
                title={space.title}
                subtitle={`${space.kind} · ${space.ageTier}`}
                trailing={<button type="button" className="text-[12px] font-semibold text-primary" onClick={() => onOpenSpace?.(space.id)}>Open</button>}
              />
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title={spaceTitle || 'Feed'} action={
              <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); onSearch?.(q); }}>
                <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search your tier" className="rounded-xl h-9 w-40" aria-label="Search community" />
                <Button type="submit" variant="outline" size="sm" className="rounded-xl"><Search className="w-3.5 h-3.5" /></Button>
              </form>
            } />
            <form onSubmit={submitPost} className="space-y-3 mb-4">
              <Segmented
                value={kind}
                onChange={setKind}
                options={[{ id: 'win', label: 'Win' }, { id: 'question', label: 'Question' }]}
              />
              <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share a win or ask a question" className="rounded-xl min-h-24" />
              <Button type="submit" className="rounded-xl" disabled={!onPost}>Post</Button>
            </form>
            <div className="space-y-2">
              {posts.length === 0 && <EmptyState icon={MessageCircle} title="Nothing here yet" body="Posts are checked by the moderation route before they go up." />}
              {posts.map((post) => (
                <ListRow
                  key={post.id}
                  title={post.body || 'Post'}
                  subtitle={`${post.authorName || 'Member'} · ${post.kind || 'win'}${post.moderation && post.moderation !== 'allow' ? ` · ${post.moderation}` : ''}${post.bestAnswerId ? ' · best answer chosen' : ''}`}
                />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </DashPage>
  );
}
