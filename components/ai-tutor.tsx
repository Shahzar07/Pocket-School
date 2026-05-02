'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { GoogleGenAI } from '@google/genai';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

// Simulate context for RAG
const PAGE_CONTEXT = `Chapter 3: Photosynthesis. Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight and turn it into chemical energy.`;

export function AITutor() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: "Hi! I'm your AI Tutor. I can see you're looking at **Chapter 3: Photosynthesis**. What would you like to explore?" }
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('k12');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      let systemInstruction = `You are a helpful AI tutor. You MUST strictly use the following context to answer questions. If the answer is not in the context, say so. After every factual statement, append [Source: Chapter 3, Photosynthesis].\n\nContext: ${PAGE_CONTEXT}`;
      
      if (mode === 'k12') systemInstruction += "\n\nUse simple language, fun analogies, and emojis. You are talking to a young student.";
      else if (mode === 'college') systemInstruction += "\n\nBe analytical, structured, and academic.";
      else if (mode === 'legal') systemInstruction += "\n\nUse IRAC structure and OSCOLA citation style.";

      const history = messages.filter(m => m.role === 'user' || m.role === 'model').map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // Start a chat session
      const chat = ai.chats.create({
        model: 'gemini-2.5-pro',
        config: { systemInstruction }
      });

      // Send the history (simulated by sending just the last message, because the SDK chat requires history initialization which is a bit different, but we'll just send a single generateContent call for simplicity here if chat state management gets complex, wait, the AI SDK supports chat sessions).
      // Actually to make it reliable:
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        config: { systemInstruction },
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMsg }] }
        ]
      });

      setMessages(prev => [...prev, { role: 'model', text: response.text || 'I did not understand that.' }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: 'Oops, something went wrong with my circuits.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              <Button 
                className="w-14 h-14 rounded-full bg-google-blue shadow-google-hover flex items-center justify-center hover:bg-[#1967D2] relative overflow-hidden group"
                onClick={() => setIsOpen(true)}
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                <div className="absolute inset-0 rounded-full bg-google-blue animate-ping opacity-20"></div>
                <Sparkles className="w-6 h-6 text-white" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] bg-white rounded-3xl shadow-google-hover border border-[#DADCE0] flex flex-col overflow-hidden max-w-[calc(100vw-2rem)]"
          >
            {/* Header */}
            <div className="bg-google-blue text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6" />
                <span className="font-bold text-lg">AI Tutor</span>
              </div>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Mode Selector */}
            <div className="p-3 border-b border-[#DADCE0] bg-[#F8F9FA] flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-[#5F6368] whitespace-nowrap">Tutor Mode:</span>
              <Select value={mode} onValueChange={(val: string | null) => setMode(val || 'college')}>
                <SelectTrigger className="h-8 text-xs rounded-full border-[#DADCE0] bg-white">
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

            {/* Context Awareness Notice */}
            <div className="px-4 py-2 bg-[#E8F0FE] flex items-start gap-2 text-xs text-[#1967D2] border-b border-[#DADCE0] shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>I'm looking at: <strong>Chapter 3: Photosynthesis</strong></span>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-4 bg-white" ref={scrollRef}>
              <div className="space-y-4 pb-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="w-8 h-8 shrink-0">
                      {m.role === 'model' ? (
                        <>
                          <AvatarFallback className="bg-google-blue text-white"><Bot className="w-4 h-4" /></AvatarFallback>
                        </>
                      ) : (
                        <AvatarFallback className="bg-[#F1F3F4] text-[#5F6368]">ME</AvatarFallback>
                      )}
                    </Avatar>
                    <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${m.role === 'user' ? 'bg-[#F1F3F4] text-[#202124] rounded-tr-sm' : 'bg-[#E8F0FE] text-[#202124] rounded-tl-sm'}`}>
                      <div className="markdown-body text-sm prose prose-sm prose-p:my-1">
                         <ReactMarkdown>{m.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-3 flex-row">
                    <Avatar className="w-8 h-8 shrink-0">
                       <AvatarFallback className="bg-google-blue text-white"><Bot className="w-4 h-4" /></AvatarFallback>
                    </Avatar>
                    <div className="p-4 rounded-2xl bg-[#E8F0FE] rounded-tl-sm flex items-center gap-1.5 h-10">
                      <motion.span 
                        className="w-2 h-2 rounded-full bg-[#1967D2]" 
                        animate={{ y: [0, -4, 0] }} 
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      />
                      <motion.span 
                        className="w-2 h-2 rounded-full bg-[#1967D2]" 
                        animate={{ y: [0, -4, 0] }} 
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                      />
                      <motion.span 
                        className="w-2 h-2 rounded-full bg-[#1967D2]" 
                        animate={{ y: [0, -4, 0] }} 
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-[#DADCE0] bg-white shrink-0">
              <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
                <Input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask me anything..." 
                  className="rounded-full bg-[#F1F3F4] border-transparent focus:bg-white h-12"
                />
                <Button type="submit" size="icon" disabled={!input.trim() || isTyping} className="rounded-full w-12 h-12 bg-google-blue hover:bg-[#1967D2] shrink-0">
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
