'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Camera, Sparkles } from 'lucide-react';
import { CloseControl, useLayerDismiss } from '@/components/ui/close-control';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import { tutorModeFor } from '@/lib/learner-level';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useTutorContext } from '@/hooks/use-tutor-context';
import { ET_AI_TUTOR } from '@/lib/ai-teachers';
import { TeacherConversation } from '@/components/teacher-conversation';

/** Dashboard dock. The conversation itself is the shared teacher component. */
export function AITutor() {
  const { lessonTitle, lessonContext } = useTutorContext();
  const { profile } = useAuthSTORE();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<string>(() => tutorModeFor(profile?.level));
  const modeTouched = useRef(false);

  useEffect(() => {
    if (!modeTouched.current && profile?.level) setMode(tutorModeFor(profile.level));
  }, [profile?.level]);

  useLayerDismiss(isOpen, () => setIsOpen(false));

  const context = [
    lessonTitle ? `The student is studying: ${lessonTitle}.` : '',
    lessonContext ?? '',
  ].filter(Boolean).join('\n');

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="fixed bottom-6 right-6 z-50">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
              <Button
                className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center relative overflow-hidden group"
                onClick={() => setIsOpen(true)}
                aria-label="Open ET AI"
              >
                <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                <Sparkles className="w-6 h-6 text-primary-foreground" />
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
            className="fixed bottom-6 right-6 z-50 w-[420px] h-[min(720px,calc(100dvh-3rem))] max-w-[calc(100vw-2rem)] rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col bg-[#07070E]"
          >
            <div className="bg-primary text-primary-foreground px-3 py-2 flex items-center justify-between shrink-0">
              <span className="font-bold">ET AI</span>
              <div className="flex items-center gap-1">
                <Link
                  href="/dashboard/studio/maths"
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors inline-flex items-center gap-1"
                  title="Scan a maths problem"
                >
                  <Camera className="w-3 h-3" /> Maths
                </Link>
                <Link
                  href="/dashboard/studio/teachers"
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  title="Open AI Teachers"
                >
                  AI Teachers
                </Link>
                <CloseControl onClose={() => setIsOpen(false)} className="text-[#203337] hover:bg-black/10" />
              </div>
            </div>
            <div className="px-3 py-2 border-b border-white/10 bg-white/5 flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-white/60 whitespace-nowrap">Tutor mode</span>
              <Select value={mode} onValueChange={val => { modeTouched.current = true; setMode(val ?? 'k12'); }}>
                <SelectTrigger className="h-8 text-xs rounded-full border-white/15 bg-transparent text-white">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="k12">School (simple)</SelectItem>
                  <SelectItem value="college">IGCSE & A-Level</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="legal">Law & Medicine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lessonTitle && (
              <div className="px-3 py-2 bg-primary/15 flex items-start gap-2 text-xs text-white border-b border-white/10 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Context: <strong>{lessonTitle}</strong></span>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <TeacherConversation
                teacher={ET_AI_TUTOR}
                variant="dock"
                tutorMode={mode}
                lessonContext={context}
                onClose={() => setIsOpen(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
