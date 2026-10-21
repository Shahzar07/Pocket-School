'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import { CloseControl, useLayerDismiss } from '@/components/ui/close-control';
import {
  addWallComment,
  publishWallPost,
  reportWallPost,
  setWallReaction,
  uploadWallPhoto,
  watchHandle,
  wallNotice,
  watchWall,
  type WallActor,
} from '@/lib/wall/live';
import { wallHandle } from '@/lib/wall/live-shape';
import {
  BadgeCheck, Bell, Bookmark, CalendarDays, Globe2, ImagePlus, Lock, MapPin,
  MessageCircle, MoreHorizontal, School, Send, Share2, Smile, Users,
} from 'lucide-react';
import {
  audienceChoices, audienceLabel, emptyReactions, filterFeed, gridSpans, parseTokens,
  personByHandle, postsByAuthor, reactionTotal, relativeTime, rochfordWall, screenWallDraft,
  sortFeed, toggleReaction, type Audience, type FeedFilter, type Reaction, type WallComment,
  type WallPost, type WallViewer,
} from '@/lib/wall/model';

const NOW = Date.UTC(2026, 9, 18, 8, 0, 0);
const PAGE = 3;
const VIEWER: WallViewer = { handle: 'amina', ageTier: 'teen', schoolId: 'rochford' };

const REACTION_META: { id: Reaction; label: string; glyph: string; ink: string }[] = [
  { id: 'like', label: 'Like', glyph: '👍', ink: '#1E6A83' },
  { id: 'love', label: 'Love', glyph: '💙', ink: '#1E6A83' },
  { id: 'celebrate', label: 'Celebrate', glyph: '🎉', ink: '#1F8A70' },
  { id: 'insightful', label: 'Insightful', glyph: '💡', ink: '#1E6A83' },
  { id: 'support', label: 'Support', glyph: '🤝', ink: '#203337' },
];

function AudienceIcon({ audience }: { audience: Audience }) {
  const className = 'h-3.5 w-3.5';
  if (audience === 'public') return <Globe2 className={className} aria-hidden />;
  if (audience === 'class') return <Users className={className} aria-hidden />;
  if (audience === 'group') return <Users className={className} aria-hidden />;
  if (audience === 'only-me') return <Lock className={className} aria-hidden />;
  return <School className={className} aria-hidden />;
}

function RichBody({ body }: { body: string }) {
  const parts = body.split(/(@[a-z0-9-]+|#[a-z0-9-]+)/gi);
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#203337]">
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const handle = part.slice(1).toLowerCase();
          return <Link key={`${part}-${index}`} href={`/u/${handle}`} className="font-semibold text-[#1E6A83]">{part}</Link>;
        }
        if (part.startsWith('#')) return <span key={`${part}-${index}`} className="font-semibold text-[#1E6A83]">{part}</span>;
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </p>
  );
}

function ImageGrid({ images, onOpen }: { images: string[]; onOpen: (index: number) => void }) {
  const shown = images.slice(0, 5);
  const extra = images.length - shown.length;
  const spans = gridSpans(shown.length);
  return (
    <div className={`grid gap-1 ${shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {shown.map((src, index) => (
        <button
          key={src}
          type="button"
          className={`relative overflow-hidden bg-[#E7EDED] ${spans[index] === 2 ? 'col-span-2' : ''} ${shown.length === 1 ? 'max-h-[420px]' : 'h-44 sm:h-52'}`}
          onClick={() => onOpen(index)}
        >
          <img src={src} alt="" className="h-full w-full object-cover" />
          {index === shown.length - 1 && extra > 0 ? (
            <span className="absolute inset-0 grid place-items-center bg-[#203337]/55 text-2xl font-semibold text-white">+{extra}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function WallScreen({
  surface = 'all',
  profileHandle = '',
}: {
  surface?: FeedFilter;
  profileHandle?: string;
}) {
  const { user, profile: account } = useAuthSTORE();
  const actor = useMemo<WallActor | null>(() => {
    if (!user) return null;
    const name = account?.displayName || account?.name || 'Learner';
    return {
      uid: user.uid,
      name,
      schoolId: account?.institutionId || '',
      ageTier: account?.ageTier || 'teen',
      adult: (account?.ageTier || 'teen') === 'adult',
    };
  }, [user, account]);
  const viewer: WallViewer = actor
    ? { handle: wallHandle(actor.name, actor.uid), ageTier: actor.ageTier === 'under13' || actor.ageTier === 'adult' ? actor.ageTier : 'teen', schoolId: actor.schoolId }
    : VIEWER;
  const seed = useMemo(() => rochfordWall(NOW), []);
  const [posts, setPosts] = useState<WallPost[]>(() => seed.posts.filter((post) => post.id !== 'pond'));
  const [liveReady, setLiveReady] = useState(false);
  const [incoming, setIncoming] = useState<WallPost[]>(() => seed.posts.filter((post) => post.id === 'pond'));
  const [filter, setFilter] = useState<FeedFilter>(surface === 'all' ? 'all' : surface);
  const [sort, setSort] = useState<'top' | 'recent'>('recent');
  const [count, setCount] = useState(8);
  const [notice, setNotice] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  useLayerDismiss(lightbox !== null, () => setLightbox(null));
  const [menu, setMenu] = useState('');
  const [thread, setThread] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);

  const profile = profileHandle ? personByHandle(seed.people, profileHandle) : undefined;
  const missingProfile = Boolean(profileHandle) && !profile && !actor;
  const visible = useMemo(() => {
    if (missingProfile) return [];
    const base = profileHandle
      ? postsByAuthor(posts, profileHandle, viewer)
      : filterFeed(posts, filter, viewer);
    const saved = savedOnly ? base.filter((post) => post.saved) : base;
    return sortFeed(saved, sort);
  }, [posts, filter, sort, profileHandle, viewer, savedOnly, missingProfile]);
  const page = visible.slice(0, count);

  useEffect(() => {
    if (!actor) return undefined;
    setLiveReady(false);
    const onPosts = (rows: WallPost[]) => {
      setPosts(rows);
      setIncoming([]);
      setLiveReady(true);
    };
    const onError = (message: string) => setNotice(message);
    const stop = profileHandle
      ? watchHandle(actor, profileHandle, onPosts, onError)
      : watchWall(actor, onPosts, onError);
    return stop;
  }, [actor, profileHandle]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setCount((value) => value + PAGE);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [page.length]);

  const patch = (id: string, map: (post: WallPost) => WallPost) => {
    setPosts((current) => current.map((post) => post.id === id ? map(post) : post));
  };

  return (
    <div className="mx-auto grid max-w-[1180px] gap-4 px-3 py-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside className="hidden space-y-3 lg:block">
        <ProfileMini people={seed.people} viewer={viewer} onSaved={() => { setSavedOnly(true); setFilter('all'); }} />
        <nav className="rounded-2xl border border-[#E7EDED] bg-white p-2 shadow-[0_8px_24px_rgba(32,51,55,0.04)]">
          {([
            ['all', 'All posts'],
            ['school', 'School'],
            ['class', 'My class'],
            ['group', 'My groups'],
            ['alumni', 'Alumni'],
            ['event', 'Events'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setFilter(id); setSavedOnly(false); setCount(PAGE); }} className={`flex h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold ${filter === id && !savedOnly ? 'bg-[#D4F6F2] text-[#203337]' : 'text-[#203337]'}`}>
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 space-y-3">
        {missingProfile ? (
          <div className="rounded-2xl border border-dashed border-[#1E6A83] bg-white px-6 py-12 text-center">
            <p className="font-heading text-2xl text-[#203337]">No profile for this name</p>
            <p className="mt-2 text-sm text-[#1E6A83]">This timeline only shows people in your school.</p>
          </div>
        ) : null}
        {profile ? <ProfileHero person={profile} /> : null}
        {!profile && !missingProfile ? (
          <Composer
            viewer={viewer}
            actor={actor}
            onPublish={async (post, files) => {
              if (!actor) {
                setPosts((current) => [post, ...current]);
                setNotice('Sign in to keep this post. This preview stays on this screen only.');
                return;
              }
              const images: string[] = [];
              for (const file of files) images.push(await uploadWallPhoto(actor.uid, file));
              const saved = await publishWallPost(actor, {
                body: post.body,
                audience: post.audience,
                feed: post.feed,
                images: images.length ? images : post.images.filter((src) => src.startsWith('http')),
                feeling: post.feeling,
                tags: post.tags,
                locationOn: post.locationOn,
              });
              setNotice(saved.moderation === 'hold' ? 'ET AI is holding this for the Safety Desk.' : 'Posted to your school wall.');
            }}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-full bg-white p-1">
            {(['recent', 'top'] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setSort(mode)} className={`h-9 rounded-full px-4 text-sm font-semibold ${sort === mode ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'text-[#1E6A83]'}`}>
                {mode === 'recent' ? 'Recent' : 'Top'}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#1E6A83]">Under-18 posts stay inside this school.</p>
        </div>
        {incoming.length > 0 && !profile ? (
          <button type="button" className="mx-auto block rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]" onClick={() => { setPosts((current) => [...incoming, ...current]); setIncoming([]); }}>
            {incoming.length} new post{incoming.length === 1 ? '' : 's'}
          </button>
        ) : null}
        {notice ? <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#203337]">{notice}</p> : null}
        {actor && !liveReady ? <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#203337]">Loading saved posts…</p> : null}
        {page.length === 0 && (!actor || liveReady) ? (
          <div className="rounded-2xl border border-dashed border-[#1E6A83] bg-white px-6 py-12 text-center">
            <p className="font-heading text-2xl text-[#203337]">Nothing on this wall yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#1E6A83]">Posts from your school, class, and groups show up here. Public posts stay with adults.</p>
          </div>
        ) : null}
        {page.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            people={seed.people}
            shared={post.sharedId ? posts.find((item) => item.id === post.sharedId) : undefined}
            open={thread === post.id}
            menu={menu === post.id}
            onMenu={() => setMenu(menu === post.id ? '' : post.id)}
            onReact={(reaction) => {
              const current = posts.find((item) => item.id === post.id);
              const previous = current?.mine || '';
              const next = previous === reaction ? '' : reaction;
              patch(post.id, (item) => toggleReaction(item, reaction));
              if (actor && !post.id.startsWith('local-') && !post.id.startsWith('share-')) {
                void setWallReaction(post.id, actor.uid, previous, next).catch((error: Error) => setNotice(wallNotice(error)));
              }
            }}
            onToggleComments={() => setThread(thread === post.id ? '' : post.id)}
            onSave={() => patch(post.id, (item) => ({ ...item, saved: !item.saved }))}
            onHide={() => { patch(post.id, (item) => ({ ...item, hidden: true })); setNotice('Post hidden.'); }}
            onReport={() => {
              if (!actor) {
                setNotice('Sign in to send a report.');
                return;
              }
              void reportWallPost(actor, post.id, 'Reported from the school wall')
                .then(() => setNotice('Report sent to the Safety Desk.'))
                .catch((error: Error) => setNotice(wallNotice(error)));
            }}
            onDelete={() => setPosts((current) => current.filter((item) => item.id !== post.id))}
            viewerHandle={viewer.handle}
            onShare={() => {
              const copy: WallPost = {
                ...post, id: `share-${post.id}-${posts.length}`, sharedId: post.id, body: 'Sharing this with the class.', images: [], poll: undefined, event: undefined, comments: [], createdAt: Date.now(), mine: '', reactions: emptyReactions(), shares: 0, pinned: false, authorHandle: viewer.handle, schoolId: viewer.schoolId,
              };
              setPosts((current) => [copy, ...current]);
              patch(post.id, (item) => ({ ...item, shares: item.shares + 1 }));
              if (actor) {
                void publishWallPost(actor, { body: copy.body, audience: 'school', feed: 'school', images: [], tags: [], locationOn: false }).catch((error: Error) => setNotice(wallNotice(error)));
              }
            }}
            onComment={(body, image) => {
              patch(post.id, (item) => ({
                ...item,
                comments: [...item.comments, { id: `local-${item.comments.length}`, authorHandle: viewer.handle, body, createdAt: Date.now(), image, replies: [] }],
              }));
              if (actor && !post.id.startsWith('local-')) void addWallComment(actor, post.id, body).catch((error: Error) => setNotice(wallNotice(error)));
            }}
            onReply={(commentId, body) => {
              patch(post.id, (item) => ({
                ...item,
                comments: item.comments.map((comment) => comment.id === commentId ? {
                  ...comment,
                  replies: [...comment.replies, { id: `reply-${comment.replies.length}`, authorHandle: viewer.handle, body, createdAt: Date.now(), replies: [] }],
                } : comment),
              }));
              if (actor && !post.id.startsWith('local-')) void addWallComment(actor, post.id, body, commentId).catch((error: Error) => setNotice(wallNotice(error)));
            }}
            onVote={(optionId) => patch(post.id, (item) => item.poll ? {
              ...item,
              poll: {
                ...item.poll,
                voted: optionId,
                options: item.poll.options.map((option) => option.id === optionId ? { ...option, votes: option.votes + 1 } : option),
              },
            } : item)}
            onOpen={(index) => setLightbox({ images: post.images, index })}
          />
        ))}
        <div ref={sentinel} className="h-8" />
      </section>

      <aside className="hidden space-y-3 xl:block">
        <SideCard title="Upcoming">
          {seed.side.events.map((event) => (
            <p key={event.id} className="py-2 text-sm text-[#203337]"><span className="font-semibold">{event.title}</span><span className="block text-[#1E6A83]">{event.when} · {event.place}</span></p>
          ))}
        </SideCard>
        <SideCard title="Suggested groups">
          {seed.side.groups.map((group) => (
            <p key={group.id} className="flex items-center justify-between py-2 text-sm text-[#203337]"><span>{group.name}</span><span className="text-[#1E6A83]">{group.members}</span></p>
          ))}
        </SideCard>
        <SideCard title="Birthdays and achievements">
          {seed.side.moments.map((moment) => (
            <p key={moment.id} className="py-2 text-sm text-[#203337]"><span className="font-semibold">{moment.name}</span><span className="block text-[#1E6A83]">{moment.detail}</span></p>
          ))}
        </SideCard>
        <SideCard title="Online in your school">
          {seed.side.online.map((person) => (
            <Link key={person.handle} href={`/u/${person.handle}`} className="flex items-center gap-2 py-2 text-sm font-semibold text-[#203337]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1F8A70]" aria-hidden />
              {person.name}
            </Link>
          ))}
          <p className="pt-1 text-xs text-[#1E6A83]">Classmates outside your school are hidden.</p>
        </SideCard>
        <SideCard title="Poket SafeLine">
          <p className="text-sm text-[#203337]">Report a post, or open SafeLine if something feels wrong.</p>
          <p className="mt-2 text-xs font-semibold text-[#203337]">Not an emergency service. In danger? Call 999.</p>
          <Link href="/safety-terms" className="mt-2 inline-flex text-sm font-semibold text-[#1E6A83]">Safety terms</Link>
        </SideCard>
        <SideCard title="Notifications">
          <p className="flex gap-2 py-2 text-sm text-[#203337]"><Bell className="mt-0.5 h-4 w-4 text-[#1E6A83]" aria-hidden /> Wei Lin liked your pond notes.</p>
          <p className="flex gap-2 py-2 text-sm text-[#203337]"><Bell className="mt-0.5 h-4 w-4 text-[#1E6A83]" aria-hidden /> Priya Shah mentioned you in class.</p>
        </SideCard>
      </aside>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#203337]/80 p-4"
          role="dialog"
          aria-label="Photo"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}
        >
          <CloseControl onClose={() => setLightbox(null)} className="absolute top-3 right-3 z-10 bg-white text-[#203337] hover:bg-white" />
          <img src={lightbox.images[lightbox.index]} alt="" className="max-h-[80vh] max-w-full rounded-2xl object-contain" />
          <div className="absolute bottom-6 flex gap-2">
            {lightbox.images.map((src, index) => (
              <button key={src} type="button" aria-label={`Photo ${index + 1}`} className={`h-12 w-12 overflow-hidden rounded-lg ${index === lightbox.index ? 'ring-2 ring-[#3FE0D0]' : ''}`} onClick={() => setLightbox({ images: lightbox.images, index })}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileMini({ people, viewer, onSaved }: { people: ReturnType<typeof rochfordWall>['people']; viewer: WallViewer; onSaved: () => void }) {
  const me = personByHandle(people, viewer.handle) ?? personByHandle(people, VIEWER.handle);
  if (!me) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7EDED] bg-white shadow-[0_8px_24px_rgba(32,51,55,0.04)]">
      <div className="h-16" style={{ background: 'var(--ps-hero)' }} />
      <div className="-mt-6 px-4 pb-4">
        <Link href={`/u/${me.handle}`} className="grid h-12 w-12 place-items-center rounded-full border-2 border-white text-sm font-bold text-[#203337]" style={{ background: me.tint }}>{me.initials}</Link>
        <p className="mt-2 font-semibold text-[#203337]">{me.name}</p>
        <p className="text-xs text-[#1E6A83]">{me.role}</p>
        <div className="mt-3 space-y-1 text-sm">
          <Link href="/dashboard/student/network" className="block rounded-lg px-2 py-1.5 text-[#203337] hover:bg-[#F4F6F6]">My class</Link>
          <Link href="/dashboard/alumni" className="block rounded-lg px-2 py-1.5 text-[#203337] hover:bg-[#F4F6F6]">Alumni</Link>
          <Link href="/dashboard/network/groups" className="block rounded-lg px-2 py-1.5 text-[#203337] hover:bg-[#F4F6F6]">Groups</Link>
          <Link href="/dashboard/student/career" className="block rounded-lg px-2 py-1.5 text-[#203337] hover:bg-[#F4F6F6]">Events</Link>
          <button type="button" onClick={onSaved} className="block w-full rounded-lg px-2 py-1.5 text-left text-[#203337] hover:bg-[#F4F6F6]">Saved</button>
        </div>
      </div>
    </div>
  );
}

function ProfileHero({ person }: { person: ReturnType<typeof rochfordWall>['people'][number] }) {
  const [tab, setTab] = useState<'posts' | 'photos' | 'about' | 'groups'>('posts');
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7EDED] bg-white">
      <div className="h-36 bg-cover bg-center sm:h-48" style={{ backgroundImage: `linear-gradient(180deg, rgba(32,51,55,0.05), rgba(32,51,55,0.25)), url(${person.cover})` }} />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          <span className="grid h-16 w-16 place-items-center rounded-full border-4 border-white text-lg font-bold text-[#203337]" style={{ background: person.tint }}>{person.initials}</span>
          <div>
            <h1 className="flex items-center gap-1 font-heading text-3xl text-[#203337]">{person.name}{person.verified ? <BadgeCheck className="h-5 w-5 text-[#1E6A83]" aria-label="Verified" /> : null}</h1>
            <p className="text-sm text-[#1E6A83]">@{person.handle} · {person.role} · {person.school}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {(['posts', 'photos', 'about', 'groups'] as const).map((id) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`h-9 rounded-full px-3 text-sm font-semibold capitalize ${tab === id ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'text-[#1E6A83]'}`}>{id}</button>
          ))}
        </div>
        {tab === 'about' ? <p className="mt-4 text-sm leading-6 text-[#203337]">{person.about}</p> : null}
        {tab === 'groups' ? <ul className="mt-4 space-y-1 text-sm text-[#203337]">{person.groups.map((group) => <li key={group}>{group}</li>)}</ul> : null}
        {tab === 'photos' ? (
          <div className="mt-4 grid grid-cols-3 gap-1">{person.photos.map((src) => <img key={src} src={src} alt="" className="h-24 w-full rounded-lg object-cover" />)}</div>
        ) : null}
        {tab !== 'posts' ? null : <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#1E6A83]">Posts</p>}
      </div>
    </div>
  );
}

function Composer({ viewer, actor, onPublish }: { viewer: WallViewer; actor: WallActor | null; onPublish: (post: WallPost, files: File[]) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('school');
  const [feeling, setFeeling] = useState('');
  const [tags, setTags] = useState('');
  const [locationOn, setLocationOn] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [poll, setPoll] = useState(false);
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [eventOn, setEventOn] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [error, setError] = useState('');
  const choices = audienceChoices(viewer.ageTier);

  const publish = (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text && images.length === 0) return;
    const decision = screenWallDraft({ body: text || 'photo', ageTier: viewer.ageTier, audience, authorSchoolId: viewer.schoolId || actor?.schoolId || '', hasImage: images.length > 0 });
    if (decision.decision === 'block') {
      setError(decision.reason);
      return;
    }
    setError('');
    const tokens = parseTokens(text);
    void onPublish({
      id: `local-${Date.now()}`,
      authorHandle: viewer.handle,
      body: text,
      audience,
      feed: audience === 'class' ? 'class' : audience === 'group' ? 'group' : 'school',
      createdAt: NOW,
      feeling: feeling || undefined,
      tags: [...tokens.mentions, ...tags.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)],
      locationOn,
      location: locationOn ? 'School atrium' : undefined,
      images,
      poll: poll && optionA && optionB ? { question: text || 'Poll', options: [{ id: 'a', label: optionA, votes: 0 }, { id: 'b', label: optionB, votes: 0 }] } : undefined,
      event: eventOn && eventTitle ? { title: eventTitle, when: 'This week', place: 'School' } : undefined,
      schoolId: viewer.schoolId,
      reactions: emptyReactions(),
      mine: '',
      comments: [],
      shares: 0,
      saved: false,
      hidden: false,
      moderation: decision.decision,
    }, files).catch((error: Error) => setError(error.message));
    setBody('');
    setImages([]);
    setFiles([]);
    setOpen(false);
  };

  return (
    <form onSubmit={publish} className="rounded-2xl border border-[#E7EDED] bg-white p-4 shadow-[0_8px_24px_rgba(32,51,55,0.04)]">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#D4F6F2] text-xs font-bold text-[#203337]">AR</span>
        <button type="button" onClick={() => setOpen(true)} className="h-10 flex-1 rounded-full bg-[#F4F6F6] px-4 text-left text-sm text-[#1E6A83]">What&apos;s on your mind?</button>
      </div>
      {open ? (
        <div className="mt-3 space-y-3">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} aria-label="Post" placeholder="Share something with your school" className="min-h-24 w-full resize-none rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm text-[#203337]" />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-[#E7EDED] px-3 text-xs font-semibold text-[#1E6A83]">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden /> Photo or video
              <input type="file" accept="image/*,video/mp4,video/webm" multiple className="sr-only" onChange={(event) => {
                const picked = [...(event.target.files ?? [])].slice(0, 4);
                const rejected = picked.map((file) => {
                  if (!file.type.startsWith('image/')) return 'Photos need to be an image file.';
                  if (file.size >= 5 * 1024 * 1024) return 'Photos need to be under 5 MB.';
                  return '';
                }).find(Boolean);
                if (rejected) {
                  setError(rejected);
                  return;
                }
                setFiles(picked);
                setImages(picked.map((file) => URL.createObjectURL(file)));
              }} />
            </label>
            <label className="inline-flex h-9 items-center gap-1 rounded-full border border-[#E7EDED] px-3 text-xs font-semibold text-[#1E6A83]">
              <Smile className="h-3.5 w-3.5" aria-hidden />
              <select aria-label="Feeling" value={feeling} onChange={(event) => setFeeling(event.target.value)} className="bg-transparent">
                <option value="">Feeling</option>
                <option value="focused">Focused</option>
                <option value="proud">Proud</option>
                <option value="curious">Curious</option>
              </select>
            </label>
            <label className="inline-flex h-9 items-center gap-1 rounded-full border border-[#E7EDED] px-3 text-xs font-semibold text-[#1E6A83]">
              Tag
              <input aria-label="Tag classmates" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="amina, wei" className="w-24 bg-transparent outline-none" />
            </label>
            <button type="button" onClick={() => setPoll((value) => !value)} className="h-9 rounded-full border border-[#E7EDED] px-3 text-xs font-semibold text-[#1E6A83]">Poll</button>
            <button type="button" onClick={() => setEventOn((value) => !value)} className="h-9 rounded-full border border-[#E7EDED] px-3 text-xs font-semibold text-[#1E6A83]">Event</button>
            <label className="inline-flex h-9 items-center gap-1 rounded-full border border-[#E7EDED] px-3 text-xs font-semibold text-[#1E6A83]">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              <input type="checkbox" checked={locationOn} onChange={(event) => setLocationOn(event.target.checked)} />
              Location
            </label>
            <label className="inline-flex h-9 items-center gap-1 rounded-full border border-[#1E6A83] px-3 text-xs font-semibold text-[#203337]">
              <AudienceIcon audience={audience} />
              <select aria-label="Audience" value={audience} onChange={(event) => setAudience(event.target.value as Audience)} className="bg-transparent">
                {choices.map((choice) => <option key={choice} value={choice}>{audienceLabel(choice)}</option>)}
              </select>
            </label>
          </div>
          {poll ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input aria-label="Poll option one" value={optionA} onChange={(event) => setOptionA(event.target.value)} placeholder="Option one" className="h-10 rounded-xl border border-[#E7EDED] px-3 text-sm" />
              <input aria-label="Poll option two" value={optionB} onChange={(event) => setOptionB(event.target.value)} placeholder="Option two" className="h-10 rounded-xl border border-[#E7EDED] px-3 text-sm" />
            </div>
          ) : null}
          {eventOn ? <input aria-label="Event title" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Event title" className="h-10 w-full rounded-xl border border-[#E7EDED] px-3 text-sm" /> : null}
          {images.length > 0 ? <ImageGrid images={images} onOpen={() => undefined} /> : null}
          {error ? <p className="text-sm text-[#203337]">{error}</p> : null}
          <p className="text-xs text-[#1E6A83]">Location stays off unless you tick it. Photos are resized on this device and location data is removed.</p>
          <button type="submit" className="h-10 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-5 text-sm font-semibold text-[#203337]">Post</button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2 border-t border-[#E7EDED] pt-3 text-xs font-semibold text-[#1E6A83]">
          <span className="inline-flex items-center gap-1"><ImagePlus className="h-3.5 w-3.5" aria-hidden /> Photo</span>
          <span className="inline-flex items-center gap-1"><Smile className="h-3.5 w-3.5" aria-hidden /> Feeling</span>
          <span>Poll</span>
          <span>Event</span>
        </div>
      )}
    </form>
  );
}

function PostCard(props: {
  post: WallPost;
  people: ReturnType<typeof rochfordWall>['people'];
  shared?: WallPost;
  open: boolean;
  menu: boolean;
  onMenu: () => void;
  onReact: (reaction: Reaction) => void;
  onToggleComments: () => void;
  onSave: () => void;
  onHide: () => void;
  onReport: () => void;
  onDelete: () => void;
  viewerHandle: string;
  onShare: () => void;
  onComment: (body: string, image?: string) => void;
  onReply: (commentId: string, body: string) => void;
  onVote: (optionId: string) => void;
  onOpen: (index: number) => void;
}) {
  const { post, people } = props;
  const author = personByHandle(people, post.authorHandle);
  const [more, setMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [reply, setReply] = useState('');
  const long = post.body.length > 180;
  const showImages = post.images.length > 0 && !post.sharedId;
  const body = more || !long ? post.body : `${post.body.slice(0, 180)}…`;
  const total = reactionTotal(post);
  const pollTotal = post.poll ? post.poll.options.reduce((sum, option) => sum + option.votes, 0) : 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#E7EDED] bg-white shadow-[0_8px_24px_rgba(32,51,55,0.04)]">
      <header className="flex items-start gap-3 p-4">
        <Link href={`/u/${post.authorHandle}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold text-[#203337]" style={{ background: author?.tint ?? '#D4F6F2' }}>{author?.initials ?? 'PS'}</Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1 text-sm font-semibold text-[#203337]">
            <Link href={`/u/${post.authorHandle}`}>{author?.name ?? post.authorHandle}</Link>
            {author?.verified ? <BadgeCheck className="h-4 w-4 text-[#1E6A83]" aria-label="Verified" /> : null}
            {post.feeling ? <span className="font-normal text-[#1E6A83]">is feeling {post.feeling}</span> : null}
          </p>
          <p className="flex items-center gap-1 text-xs text-[#1E6A83]">
            {author?.role} · {author?.school}
            <span aria-hidden>·</span>
            {relativeTime(post.createdAt, NOW)}
            <span aria-hidden>·</span>
            <AudienceIcon audience={post.audience} />
            <span className="sr-only">{audienceLabel(post.audience)}</span>
          </p>
        </div>
        {post.pinned ? <span className="rounded-full bg-[#D4F6F2] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#203337]">Pinned</span> : null}
        <div className="relative">
          <button type="button" aria-label="Post menu" onClick={props.onMenu} className="rounded-full p-2 text-[#203337]"><MoreHorizontal className="h-4 w-4" /></button>
          {props.menu ? (
            <div className="absolute right-0 z-10 w-52 rounded-xl border border-[#E7EDED] bg-white p-1 text-sm shadow-lg">
              <button type="button" className="block w-full rounded-lg px-3 py-2 text-left" onClick={props.onSave}>{post.saved ? 'Unsave' : 'Save'}</button>
              <button type="button" className="block w-full rounded-lg px-3 py-2 text-left" onClick={props.onHide}>Hide</button>
              <button type="button" className="block w-full rounded-lg px-3 py-2 text-left" onClick={props.onReport}>Report</button>
              <button type="button" className="block w-full rounded-lg px-3 py-2 text-left" onClick={() => undefined}>Turn off notifications</button>
              {post.authorHandle === props.viewerHandle ? <button type="button" className="block w-full rounded-lg px-3 py-2 text-left" onClick={props.onDelete}>Delete</button> : null}
            </div>
          ) : null}
        </div>
      </header>
      <div className="space-y-3 px-4 pb-3">
        {post.body ? <RichBody body={body} /> : null}
        {long ? <button type="button" className="text-sm font-semibold text-[#1E6A83]" onClick={() => setMore((value) => !value)}>{more ? 'See less' : 'See more'}</button> : null}
        {showImages ? <ImageGrid images={post.images} onOpen={props.onOpen} /> : null}
        {post.link ? (
          <a className="flex overflow-hidden rounded-xl border border-[#E7EDED]" href={`https://${post.link.domain}`}>
            {post.link.image ? <img src={post.link.image} alt="" className="h-24 w-28 object-cover" /> : null}
            <span className="p-3 text-sm"><span className="block text-xs text-[#1E6A83]">{post.link.domain}</span><span className="font-semibold text-[#203337]">{post.link.title}</span></span>
          </a>
        ) : null}
        {post.poll ? (
          <div className="space-y-2">
            {post.poll.options.map((option) => (
              <button key={option.id} type="button" disabled={Boolean(post.poll?.voted)} onClick={() => props.onVote(option.id)} className="block w-full overflow-hidden rounded-xl border border-[#E7EDED] text-left text-sm">
                <span className="block h-10" style={{ background: `linear-gradient(90deg, #D4F6F2 ${pollTotal ? (option.votes / pollTotal) * 100 : 0}%, transparent 0)` }}>
                  <span className="flex h-10 items-center justify-between px-3 text-[#203337]"><span>{option.label}</span><span>{option.votes}</span></span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {post.event ? (
          <div className="rounded-xl border border-[#E7EDED] p-3 text-sm text-[#203337]">
            <p className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-[#1E6A83]" aria-hidden />{post.event.title}</p>
            <p className="text-[#1E6A83]">{post.event.when}</p>
            <p>{post.event.place}</p>
          </div>
        ) : null}
        {props.shared ? (
          <div className="rounded-xl border border-[#E7EDED] p-3">
            <p className="text-sm font-semibold text-[#203337]">{personByHandle(people, props.shared.authorHandle)?.name}</p>
            <p className="mt-1 text-sm text-[#203337]">{props.shared.body}</p>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between px-4 pb-2 text-xs text-[#1E6A83]">
        <p>{total > 0 ? `${total} reactions` : 'Be the first to react'}</p>
        <p>{post.comments.length} comments · {post.shares} shares</p>
      </div>
      <div className="grid grid-cols-4 border-t border-[#E7EDED] text-sm font-semibold text-[#203337]">
        <div className="group relative">
          <button type="button" className="flex h-11 w-full items-center justify-center gap-1" onClick={() => props.onReact(post.mine || 'like')}>
            {post.mine ? REACTION_META.find((item) => item.id === post.mine)?.glyph : '👍'} {post.mine ? REACTION_META.find((item) => item.id === post.mine)?.label : 'Like'}
          </button>
          <div className="absolute bottom-11 left-2 hidden gap-1 rounded-full border border-[#E7EDED] bg-white p-1 shadow-lg group-hover:flex">
            {REACTION_META.map((item) => (
              <button key={item.id} type="button" aria-label={item.label} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4F6F6]" onClick={() => props.onReact(item.id)}>{item.glyph}</button>
            ))}
          </div>
        </div>
        <button type="button" className="flex h-11 items-center justify-center gap-1" onClick={props.onToggleComments}><MessageCircle className="h-4 w-4" aria-hidden /> Comment</button>
        <button type="button" className="flex h-11 items-center justify-center gap-1" onClick={props.onShare}><Share2 className="h-4 w-4" aria-hidden /> Share</button>
        <button type="button" className="flex h-11 items-center justify-center gap-1" onClick={props.onSave}><Bookmark className="h-4 w-4" aria-hidden /> {post.saved ? 'Saved' : 'Save'}</button>
      </div>
      {props.open ? (
        <div className="space-y-3 border-t border-[#E7EDED] bg-[#F4F6F6] p-4">
          {post.comments.map((comment) => (
            <CommentBlock key={comment.id} comment={comment} people={people} replyTo={replyTo} reply={reply} setReplyTo={setReplyTo} setReply={setReply} onReply={props.onReply} />
          ))}
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!draft.trim()) return; props.onComment(draft.trim()); setDraft(''); }}>
            <input aria-label="Write a comment" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a comment" className="h-10 flex-1 rounded-full border border-[#E7EDED] bg-white px-3 text-sm" />
            <button type="submit" aria-label="Send comment" className="grid h-10 w-10 place-items-center rounded-full border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function CommentBlock({
  comment, people, replyTo, reply, setReplyTo, setReply, onReply,
}: {
  comment: WallComment;
  people: ReturnType<typeof rochfordWall>['people'];
  replyTo: string;
  reply: string;
  setReplyTo: (id: string) => void;
  setReply: (value: string) => void;
  onReply: (commentId: string, body: string) => void;
}) {
  const author = personByHandle(people, comment.authorHandle);
  return (
    <div className="text-sm">
      <p className="font-semibold text-[#203337]">{author?.name ?? comment.authorHandle}</p>
      <RichBody body={comment.body} />
      {comment.image ? <img src={comment.image} alt="" className="mt-2 h-24 rounded-lg object-cover" /> : null}
      <button type="button" className="mt-1 text-xs font-semibold text-[#1E6A83]" onClick={() => setReplyTo(comment.id)}>Reply</button>
      {replyTo === comment.id ? (
        <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!reply.trim()) return; onReply(comment.id, reply.trim()); setReply(''); setReplyTo(''); }}>
          <input aria-label="Write a reply" value={reply} onChange={(event) => setReply(event.target.value)} className="h-9 flex-1 rounded-full border border-[#E7EDED] bg-white px-3 text-sm" />
          <button type="submit" className="h-9 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-3 text-xs font-semibold text-[#203337]">Reply</button>
        </form>
      ) : null}
      {comment.replies.length > 0 ? (
        <ul className="mt-2 space-y-2 border-l-2 border-[#D4F6F2] pl-3">
          {comment.replies.map((item) => (
            <li key={item.id}>
              <p className="font-semibold text-[#203337]">{personByHandle(people, item.authorHandle)?.name}</p>
              <RichBody body={item.body} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E7EDED] bg-white p-4 shadow-[0_8px_24px_rgba(32,51,55,0.04)]">
      <h2 className="text-sm font-bold text-[#203337]">{title}</h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}
