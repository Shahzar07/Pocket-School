'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getMessages, getSentMessages, sendMessage, getEnrolledCourses, getChildrenProfiles, markMessageRead, Message, UserProfile } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, MessageSquare, Inbox, Plus, X } from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

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
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [compose, setCompose] = useState({ toId: '', subject: '', body: '' });

  const teacherName = (uid: string) => teachers.find(t => t.id === uid)?.name ?? 'Teacher';

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

    const enrollmentsByChild = await Promise.all(childProfiles.map(c => getEnrolledCourses(c.id)));
    const teacherMap = new Map<string, string>();
    enrollmentsByChild.flat().forEach(({ course }) => {
      if (course.ownerId) teacherMap.set(course.ownerId, course.ownerName || 'Teacher');
    });
    setTeachers(Array.from(teacherMap, ([id, name]) => ({ id, name })));
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
        fromName: profile?.name ?? 'Parent',
        fromRole: 'parent',
        toId: compose.toId,
        subject: compose.subject.trim(),
        body: compose.body.trim(),
      });
      toast.success('Message sent!');
      setCompose({ toId: '', subject: '', body: '' });
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
    <div className="max-w-5xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600 flex items-center gap-2">
            <span className="w-5 h-px bg-amber-600 inline-block" /> Teacher messaging
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            Your <span className="gradient-text italic">communications</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Message teachers and view correspondence.</p>
        </div>
        <Button onClick={() => setShowCompose(true)}
          className="rounded-full h-11 px-5 gap-2 font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white shrink-0"
        >
          <Plus className="w-4 h-4" /> New Message
        </Button>
      </motion.header>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-3xl p-7 max-w-lg w-full space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl text-foreground">New Message</h2>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowCompose(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">To</Label>
                {teachers.length > 0 ? (
                  <Select value={compose.toId} onValueChange={v => setCompose(c => ({ ...c, toId: v ?? '' }))}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No teachers found — your child needs to be enrolled in a course first.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Subject *</Label>
                <Input value={compose.subject} onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))} placeholder="e.g. Question about homework" className="rounded-xl h-11 bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Message *</Label>
                <Textarea value={compose.body} onChange={e => setCompose(c => ({ ...c, body: e.target.value }))} rows={5} placeholder="Write your message…" className="rounded-xl text-sm resize-none bg-muted/50" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-full h-11 font-semibold" onClick={() => setShowCompose(false)}>Cancel</Button>
              <Button className="flex-1 rounded-full h-11 font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white gap-2" onClick={handleSend} disabled={sending}>
                <Send className="w-4 h-4" />{sending ? 'Sending…' : 'Send Message'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl w-fit">
        {(['inbox', 'sent'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors capitalize ${tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'inbox' ? <><Inbox className="w-3.5 h-3.5" />Inbox {inbox.length > 0 && <span className="bg-amber-500/10 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{inbox.length}</span>}</> : <><Send className="w-3.5 h-3.5" />Sent</>}
          </button>
        ))}
      </div>

      {/* Messages list */}
      {currentMessages.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="relative text-center py-16 bg-card rounded-[2rem] border border-border overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/8 blur-[80px]" />
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-amber-600/40" />
          <h3 className="font-heading text-2xl text-foreground mb-1.5">No {tab === 'inbox' ? 'messages' : 'sent messages'} yet</h3>
          <p className="text-sm text-muted-foreground">{tab === 'inbox' ? 'Teachers will appear here when they message you.' : 'Send your first message to a teacher.'}</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {currentMessages.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
              className={`bg-card border rounded-2xl p-5 card-glow ${!msg.read && tab === 'inbox' ? 'border-amber-500/40 bg-amber-500/5 cursor-pointer' : 'border-border'}`}
              onClick={() => {
                if (msg.read || tab !== 'inbox') return;
                markMessageRead(msg.id).catch(() => {});
                setInbox(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
              }}
            >
              <div className="flex items-start gap-4">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-sm">
                    {(tab === 'inbox' ? teacherName(msg.fromId) : teacherName(msg.toId)).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-foreground text-sm">{msg.subject}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!msg.read && tab === 'inbox' && <Badge className="rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] px-2">New</Badge>}
                      <span className="text-xs text-muted-foreground">{formatTime(msg.sentAt)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    {tab === 'inbox' ? `From: ${teacherName(msg.fromId)}` : `To: ${teacherName(msg.toId)}`}
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
