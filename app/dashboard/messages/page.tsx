'use client';

/**
 * Messenger-style chat portal (works for every role).
 * Left: conversation list with avatars, last message, unread badges.
 * Right: live thread with bubbles + composer. Real-time via Firestore
 * onSnapshot on the existing messages collection.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  subscribeUserMessages, sendDirectMessage, markMessageRead, getChatContacts,
  getUser, type Message,
} from '@/lib/db';
import { toast } from 'sonner';
import { Search, Send, ArrowLeft, MessageSquare, Check, CheckCheck, Plus, X } from 'lucide-react';

interface Thread {
  partnerId: string;
  partnerName: string;
  partnerRole: string;
  messages: Message[];
  last?: Message;
  unread: number;
}

const ROLE_COLOR: Record<string, string> = {
  admin: 'from-violet-500 to-fuchsia-600',
  teacher: 'from-emerald-500 to-teal-600',
  parent: 'from-amber-500 to-orange-600',
  student: 'from-blue-500 to-indigo-600',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

function fmtTime(ts?: { toDate?: () => Date }) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MessagesPage() {
  const { user, profile } = useAuthSTORE();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; role: string }[]>([]);
  const [activePartner, setActivePartner] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [nameCache, setNameCache] = useState<Record<string, { name: string; role: string }>>({});
  const endRef = useRef<HTMLDivElement>(null);

  // Live subscription to all my messages
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserMessages(user.uid, msgs => { setMessages(msgs); setLoaded(true); });
    return () => unsub();
  }, [user]);

  // Load who I can start new chats with
  useEffect(() => {
    if (!user || !profile) return;
    getChatContacts(user.uid, profile.role).then(setContacts).catch(() => setContacts([]));
  }, [user, profile]);

  // Resolve names for partners we don't already know (from contacts or message fields)
  useEffect(() => {
    if (!user) return;
    const known = new Set([...contacts.map(c => c.id), ...Object.keys(nameCache)]);
    const unknown = new Set<string>();
    messages.forEach(m => {
      const partner = m.fromId === user.uid ? m.toId : m.fromId;
      if (!known.has(partner)) unknown.add(partner);
    });
    unknown.forEach(async pid => {
      // Prefer the name embedded in a message where the partner was the sender.
      const fromMsg = messages.find(m => m.fromId === pid);
      if (fromMsg) {
        setNameCache(prev => ({ ...prev, [pid]: { name: fromMsg.fromName || 'User', role: fromMsg.fromRole || 'user' } }));
        return;
      }
      const u = await getUser(pid).catch(() => null);
      if (u) setNameCache(prev => ({ ...prev, [pid]: { name: u.name || 'User', role: u.role || 'user' } }));
    });
  }, [messages, contacts, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const partnerInfo = (pid: string): { name: string; role: string } => {
    const c = contacts.find(x => x.id === pid);
    if (c) return { name: c.name, role: c.role };
    if (nameCache[pid]) return nameCache[pid];
    return { name: 'User', role: 'user' };
  };

  // Group messages into threads
  const threads = useMemo<Thread[]>(() => {
    if (!user) return [];
    const map = new Map<string, Message[]>();
    for (const m of messages) {
      const partner = m.fromId === user.uid ? m.toId : m.fromId;
      if (!map.has(partner)) map.set(partner, []);
      map.get(partner)!.push(m);
    }
    const list: Thread[] = [];
    for (const [partnerId, msgs] of map) {
      const info = partnerInfo(partnerId);
      const unread = msgs.filter(m => m.toId === user.uid && !m.read).length;
      list.push({ partnerId, partnerName: info.name, partnerRole: info.role, messages: msgs, last: msgs[msgs.length - 1], unread });
    }
    return list.sort((a, b) => (b.last?.sentAt?.toMillis?.() ?? 0) - (a.last?.sentAt?.toMillis?.() ?? 0));
  }, [messages, user, contacts, nameCache]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeThread = threads.find(t => t.partnerId === activePartner);
  const activeMessages = activeThread?.messages ?? [];

  // Auto-scroll + mark read on active thread
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages.length, activePartner]);
  useEffect(() => {
    if (!user || !activeThread) return;
    activeThread.messages.filter(m => m.toId === user.uid && !m.read).forEach(m => markMessageRead(m.id).catch(() => {}));
  }, [activePartner, activeThread, user]);

  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);

  const startChat = (pid: string) => { setActivePartner(pid); setShowNew(false); };

  const send = async () => {
    const body = input.trim();
    if (!body || !user || !activePartner) return;
    setSending(true);
    setInput('');
    try {
      const info = partnerInfo(activePartner);
      await sendDirectMessage({
        fromId: user.uid,
        fromName: profile?.name ?? 'You',
        fromRole: profile?.role ?? 'user',
        toId: activePartner,
        toName: info.name,
        body,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send.');
      setInput(body);
    } finally {
      setSending(false);
    }
  };

  const newChatContacts = contacts.filter(c =>
    !threads.some(t => t.partnerId === c.id) &&
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredThreads = threads.filter(t => t.partnerName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="-mx-4 sm:-mx-6 -my-2 flex" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* ── Conversation list ── */}
      <div className={`${activePartner ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] shrink-0 flex-col border-r border-border bg-card`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-heading text-2xl text-foreground flex items-center gap-2">
              Messages
              {totalUnread > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">{totalUnread}</span>}
            </h1>
            <button onClick={() => setShowNew(s => !s)} className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90" title="New chat">
              {showNew ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={showNew ? 'Search people…' : 'Search chats…'}
              className="w-full h-10 rounded-xl bg-muted/50 border border-border pl-9 pr-3 text-sm outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showNew ? (
            <div className="p-2">
              <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Start a new chat</p>
              {newChatContacts.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No new contacts to message.</p>}
              {newChatContacts.map(c => (
                <button key={c.id} onClick={() => startChat(c.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                  <Avatar name={c.name} role={c.role} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.role}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : !loaded ? (
            <div className="p-3 space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-16 px-6">
              <MessageSquare className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations yet. Tap <strong>+</strong> to start one.</p>
            </div>
          ) : (
            filteredThreads.map(t => (
              <button
                key={t.partnerId}
                onClick={() => setActivePartner(t.partnerId)}
                className={`w-full flex items-center gap-3 px-3 py-3 border-b border-border/50 text-left transition-colors ${activePartner === t.partnerId ? 'bg-muted' : 'hover:bg-muted/50'}`}
              >
                <Avatar name={t.partnerName} role={t.partnerRole} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{t.partnerName}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(t.last?.sentAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${t.unread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {t.last?.fromId === user?.uid ? 'You: ' : ''}{t.last?.body || t.last?.subject}
                    </p>
                    {t.unread > 0 && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{t.unread}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className={`${activePartner ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%222%22 cy=%222%22 r=%221%22 fill=%22rgba(120,120,120,0.06)%22/></svg>')] bg-muted/10`}>
        {!activeThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-heading text-xl text-foreground mb-1">Your messages</h2>
            <p className="text-sm text-muted-foreground max-w-xs">Pick a conversation or start a new one to chat with teachers and the admin team in real time.</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
              <button onClick={() => setActivePartner(null)} className="md:hidden text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
              <Avatar name={activeThread.partnerName} role={activeThread.partnerRole} />
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">{activeThread.partnerName}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{activeThread.partnerRole}</p>
              </div>
            </div>

            {/* Bubbles */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2">
              <AnimatePresence initial={false}>
                {activeMessages.map(m => {
                  const mine = m.fromId === user?.uid;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18 }}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border text-foreground rounded-bl-md'}`}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{m.body || m.subject}</p>
                        <div className={`flex items-center gap-1 mt-0.5 justify-end ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          <span className="text-[9px]">{fmtTime(m.sentAt)}</span>
                          {mine && (m.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <div className="p-3 border-t border-border bg-card shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 resize-none max-h-32 rounded-2xl bg-muted/50 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary/50"
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 shrink-0 hover:opacity-90 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Avatar({ name, role }: { name: string; role: string }) {
  return (
    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${ROLE_COLOR[role] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
      {initials(name)}
    </div>
  );
}
