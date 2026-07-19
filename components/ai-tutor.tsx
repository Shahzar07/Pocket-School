'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { MathMarkdown } from '@/components/math-markdown';
import { useTutorContext } from '@/hooks/use-tutor-context';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export function AITutor() {
  const { lessonTitle, lessonContext } = useTutorContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hi! I'm your AI Tutor. Ask me anything — I'm here to help you learn!" },
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('k12');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLessonTitle = useRef<string | null>(null);

  useEffect(() => {
    if (lessonTitle && lessonTitle !== prevLessonTitle.current) {
      prevLessonTitle.current = lessonTitle;
      setMessages([{
        role: 'model',
        text: `Hi! I'm your AI Tutor. I can see you're studying **${lessonTitle}**. What would you like to explore or clarify?`,
      }]);
    }
  }, [lessonTitle]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          mode,
          lessonContext: lessonContext ?? '',
          language: (typeof window !== 'undefined' && localStorage.getItem('pocket-school-lang')) || 'en',
          history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        setMessages(prev => [...prev, {
          role: 'model',
          text: `Sorry — ${err.error || `I hit an error (${res.status}). Please try again.`}`,
        }]);
        return;
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'model', text: data.reply ?? 'I did not understand that.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: 'Oops, something went wrong. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="fixed bottom-6 right-6 z-50">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
              <Button
                className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center relative overflow-hidden group"
                onClick={() => setIsOpen(true)}
              >
                <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                <Sparkles className="w-6 h-6 text-white" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] bg-card rounded-3xl shadow-2xl border border-border flex flex-col overflow-hidden max-w-[calc(100vw-2rem)]"
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6" />
                <span className="font-bold text-lg">AI Tutor</span>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href="/ai-studio"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  title="Open in AI Studio"
                >
                  AI Studio ↗
                </a>
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20 rounded-full" onClick={() => setIsOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="p-3 border-b border-border bg-muted/50 flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Tutor Mode:</span>
              <Select value={mode} onValueChange={val => setMode(val ?? 'k12')}>
                <SelectTrigger className="h-8 text-xs rounded-full border-border bg-card">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="k12">🧒 K-12 (Simple)</SelectItem>
                  <SelectItem value="college">🎓 College (Academic)</SelectItem>
                  <SelectItem value="professional">💼 Professional (Concise)</SelectItem>
                  <SelectItem value="legal">⚖️ Legal (OSCOLA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Context notice */}
            {lessonTitle && (
              <div className="px-4 py-2 bg-primary/10 flex items-start gap-2 text-xs text-primary border-b border-border shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Context: <strong>{lessonTitle}</strong></span>
              </div>
            )}

            {/* Chat */}
            <ScrollArea className="flex-1 p-4 bg-background" ref={scrollRef}>
              <div className="space-y-4 pb-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="w-8 h-8 shrink-0">
                      {m.role === 'model' ? (
                        <AvatarFallback className="bg-primary text-primary-foreground"><Bot className="w-4 h-4" /></AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">ME</AvatarFallback>
                      )}
                    </Avatar>
                    <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${m.role === 'user' ? 'bg-muted text-foreground rounded-tr-sm' : 'bg-primary/10 text-foreground rounded-tl-sm'}`}>
                      <div className="prose prose-sm prose-p:my-1 max-w-none text-sm">
                        <MathMarkdown>{m.text}</MathMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground"><Bot className="w-4 h-4" /></AvatarFallback>
                    </Avatar>
                    <div className="p-4 rounded-2xl bg-primary/10 rounded-tl-sm flex items-center gap-1.5 h-10">
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <motion.span key={i} className="w-2 h-2 rounded-full bg-primary" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card shrink-0">
              <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask me anything…"
                  className="rounded-full bg-muted border-transparent h-12"
                />
                <Button type="submit" size="icon" disabled={!input.trim() || isTyping} className="rounded-full w-12 h-12 bg-primary shrink-0">
                  <Send className="w-5 h-5 text-white" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
