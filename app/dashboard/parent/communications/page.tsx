'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getMessages, getSentMessages, sendMessage, getTeacherCourses, getChildrenProfiles, Message, Course, UserProfile } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, MessageSquare, Inbox, Plus, X } from 'lucide-react';

type Tab = 'inbox' | 'sent';

export default function ParentCommunications() {
  const { user, profile } = useAuthSTORE();
  const [tab, setTab] = useState<Tab>('inbox');
  const [inbox, setInbox] = useState<Message[]>([]);
  const [sent, setSent] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [children, setChildren] = useState<{ id: string; data: UserProfile }[]>([]);
  const [compose, setCompose] = useState({ toId: '', toName: '', subject: '', body: '' });

  const load = async () => {
    if (!user) return;
    const [msgs, sentMsgs, childProfiles] = await Promise.all([
      getMessages(user.uid),
      getSentMessages(user.uid),
      getChildrenProfiles(user.uid),
    ]);
    setInbox(msgs);
    setSent(sentMsgs);
    setChildren(childProfiles);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleSend = async () => {
    if (!user || !compose.toId || !compose.subject.trim() || !compose.body.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        fromId: user.uid,
        toId: compose.toId,
        fromRole: 'parent',
        toRole: 'teacher',
        subject: compose.subject.trim(),
        body: compose.body.trim(),
      });
      toast.success('Message sent!');
      setCompose({ toId: '', toName: '', subject: '', body: '' });
      setShowCompose(false);
      await load();
    } catch (e: any) {
      toast.error('Failed to send: ' + e.message);
    }
    setSending(false);
  };

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const currentMessages = tab === 'inbox' ? inbox : sent;

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Communications</h1>
          <p className="text-muted-foreground text-sm mt-1">Message teachers and view correspondence.</p>
        </div>
        <Button onClick={() => setShowCompose(true)} className="rounded-xl gap-2 bg-primary text-white">
          <Plus className="w-4 h-4" /> New Message
        </Button>
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-foreground">New Message</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCompose(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>To (Teacher ID or Name)</Label>
                <Input
                  value={compose.toId}
                  onChange={e => setCompose(c => ({ ...c, toId: e.target.value }))}
                  placeholder="Enter teacher's user ID"
                  className="rounded-xl h-11"
                />
                <p className="text-xs text-muted-foreground">Note: Enter the teacher's UID from the platform.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input value={compose.subject} onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))} placeholder="e.g. Question about homework" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Message *</Label>
                <Textarea value={compose.body} onChange={e => setCompose(c => ({ ...c, body: e.target.value }))} rows={5} placeholder="Write your message…" className="rounded-xl text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCompose(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl bg-primary text-white gap-2" onClick={handleSend} disabled={sending}>
                <Send className="w-4 h-4" />{sending ? 'Sending…' : 'Send Message'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl w-fit">
        {(['inbox', 'sent'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors capitalize ${tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'inbox' ? <><Inbox className="w-3.5 h-3.5 inline mr-1.5" />Inbox {inbox.length > 0 && <span className="ml-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">{inbox.length}</span>}</> : <><Send className="w-3.5 h-3.5 inline mr-1.5" />Sent</>}
          </button>
        ))}
      </div>

      {/* Messages list */}
      {currentMessages.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No {tab === 'inbox' ? 'messages' : 'sent messages'} yet.</p>
          {tab === 'inbox' && <p className="text-sm mt-1">Teachers will appear here when they message you.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {currentMessages.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`bg-card border rounded-2xl p-5 ${!msg.read && tab === 'inbox' ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
            >
              <div className="flex items-start gap-4">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold text-sm">
                    {(tab === 'inbox' ? msg.fromId : msg.toId)?.charAt(0)?.toUpperCase() ?? 'T'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-foreground text-sm">{msg.subject}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!msg.read && tab === 'inbox' && <Badge className="rounded-full bg-primary text-white text-[10px] px-2">New</Badge>}
                      <span className="text-xs text-muted-foreground">{formatTime(msg.sentAt)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    {tab === 'inbox' ? `From: ${msg.fromRole}` : `To: ${msg.toRole}`}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{msg.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
