'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Atom,
  Calculator,
  PenTool,
  Globe,
  Languages,
  Code2,
  Briefcase,
  Palette,
  ScrollText,
  Mic,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Play,
  GraduationCap,
  Clock,
} from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { subscribeTeacherNotification } from '@/lib/db';
import type { AiTeacher, TeacherIconKey } from '@/lib/ai-teachers';

const ICONS: Record<TeacherIconKey, typeof Atom> = {
  atom: Atom,
  calculator: Calculator,
  pen: PenTool,
  globe: Globe,
  languages: Languages,
  code: Code2,
  briefcase: Briefcase,
  palette: Palette,
  history: ScrollText,
};

interface Props {
  teacher: AiTeacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiTeacherModal({ teacher, open, onOpenChange }: Props) {
  const router = useRouter();
  const user = useAuthSTORE((s) => s.user);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubmitted, setNotifySubmitted] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);

  // Reset state whenever a new teacher is loaded or the modal closes.
  useEffect(() => {
    if (!open) {
      setNotifyEmail('');
      setNotifySubmitted(false);
    }
  }, [open, teacher?.id]);

  if (!teacher) return null;
  const Icon = ICONS[teacher.iconKey];
  const isLive = teacher.status === 'live';

  const sessionPath = `/ai-teachers/${teacher.id}/session`;

  const handleStart = () => {
    if (!isLive) return; // coming-soon uses inline email form
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(sessionPath)}`);
      return;
    }
    window.open(sessionPath, '_blank', 'noopener,noreferrer');
  };

  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail.trim() || !teacher) return;
    setNotifyLoading(true);
    try {
      await subscribeTeacherNotification(teacher.id, notifyEmail.trim());
      setNotifySubmitted(true);
    } catch {
      // fail silently — don't block the user
      setNotifySubmitted(true);
    } finally {
      setNotifyLoading(false);
    }
  };

  const primaryCtaLabel = !isLive
    ? 'Get notified when live'
    : !user
    ? 'Sign in to start session'
    : 'Open full-screen session';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl sm:!max-w-6xl w-[calc(100%-1rem)] max-h-[92vh] overflow-hidden p-0 bg-white">
        <DialogTitle className="sr-only">{teacher.name}</DialogTitle>
        <DialogDescription className="sr-only">{teacher.tagline}</DialogDescription>

        <div className="grid lg:grid-cols-[1.4fr_1fr] max-h-[92vh] overflow-hidden">
          {/* LEFT — iframe or preview */}
          <div className="relative bg-slate-950 lg:min-h-[560px] flex items-center justify-center p-4 lg:p-6">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${teacher.accentColor}40, transparent)`,
              }}
            />

            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 ring-1 ring-white/10">
              <AnimatePresence mode="wait">
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
                  >
                    <div
                      className="absolute inset-0 opacity-90"
                      style={{
                        background: `radial-gradient(circle at 50% 40%, ${teacher.accentColor}55, transparent 70%)`,
                      }}
                    />
                    <div className="relative">
                      <div
                        className="w-32 h-32 lg:w-40 lg:h-40 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-2xl"
                        style={{ background: `linear-gradient(135deg, ${teacher.accentColor}, ${teacher.accentColor}cc)` }}
                      >
                        <Icon className="w-14 h-14 lg:w-16 lg:h-16 text-white" strokeWidth={1.6} />
                      </div>
                      {isLive && (
                        <button
                          onClick={handleStart}
                          className="group inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-white text-slate-900 text-sm font-bold shadow-xl hover:bg-slate-100 transition-all"
                        >
                          <span className="w-7 h-7 rounded-full bg-[#1A73E8] flex items-center justify-center">
                            <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                          </span>
                          {user ? 'Click to talk to ' + teacher.name.split(' ')[0] : 'Sign in to talk live'}
                        </button>
                      )}
                      {!isLive && (
                        <div className="max-w-xs mx-auto text-center">
                          <p className="text-white/80 text-sm font-medium mb-4">
                            Launching soon — be first to know when this AI educator goes live.
                          </p>
                          {!notifySubmitted ? (
                            <form onSubmit={handleNotify} className="flex gap-2">
                              <input
                                type="email"
                                required
                                placeholder="your@email.com"
                                value={notifyEmail}
                                onChange={e => setNotifyEmail(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-sm"
                              />
                              <button
                                type="submit"
                                disabled={notifyLoading}
                                className="px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 transition-colors disabled:opacity-60 whitespace-nowrap"
                              >
                                {notifyLoading ? '...' : 'Notify me'}
                              </button>
                            </form>
                          ) : (
                            <p className="text-white font-semibold text-sm bg-white/20 rounded-lg px-4 py-3 backdrop-blur-sm">
                              ✓ You&apos;re on the list!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
              </AnimatePresence>

              {/* Live pulse badge */}
              {isLive && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="text-[10px] font-bold tracking-widest text-white">LIVE 24/7</span>
                </div>
              )}
              {!isLive && (
                <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-full bg-amber-400/95 backdrop-blur-sm">
                  <span className="text-[10px] font-bold tracking-widest text-amber-950">COMING SOON</span>
                </div>
              )}

              {/* Interaction modes */}
              {isLive && (
                <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white">
                    <Mic className="w-3 h-3" /> VOICE
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white">
                    <MessageSquare className="w-3 h-3" /> TEXT
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — bio panel */}
          <div className="relative overflow-y-auto max-h-[92vh] p-6 lg:p-8 bg-white">
            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${teacher.accentColor}15`, color: teacher.accentColor }}
              >
                <Icon className="w-7 h-7" strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-[#0B1B3F] leading-tight">{teacher.name}</h2>
                <p className="text-sm text-slate-600 leading-snug mt-1">{teacher.title}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {teacher.subjects.map((s) => (
                <span
                  key={s}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-md"
                  style={{ backgroundColor: `${teacher.accentColor}15`, color: teacher.accentColor }}
                >
                  {s}
                </span>
              ))}
            </div>

            {isLive ? (
              <Button
                onClick={handleStart}
                className="w-full rounded-full h-12 text-sm font-bold shadow-md transition-all"
                style={{
                  backgroundColor: teacher.accentColor,
                  color: 'white',
                }}
              >
                {primaryCtaLabel}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            ) : (
              <div className="w-full rounded-full h-12 text-sm font-bold flex items-center justify-center gap-2 border-2 border-dashed"
                style={{ borderColor: teacher.accentColor, color: teacher.accentColor }}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Coming Soon
              </div>
            )}

            {teacher.trainedOn && teacher.trainedOn.length > 0 && (
              <div className="mt-5 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Trained on</span>
                {teacher.trainedOn.map((t) => (
                  <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                    {t}
                  </span>
                ))}
              </div>
            )}

            <hr className="my-6 border-slate-100" />

            <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
              {teacher.bio.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {teacher.sampleQuestions && teacher.sampleQuestions.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Try asking
                </p>
                <div className="flex flex-wrap gap-2">
                  {teacher.sampleQuestions.map((q) => (
                    <span
                      key={q}
                      className="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      “{q}”
                    </span>
                  ))}
                </div>
              </div>
            )}

            {teacher.specialties && teacher.specialties.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-3">Specialties</p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.specialties.map((s) => (
                    <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#EEF3FF] text-[#1E3A8A]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
              {teacher.yearsExperience !== undefined && (
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Experience
                  </p>
                  <p className="font-bold text-[#0B1B3F]">{teacher.yearsExperience}+ years modelled</p>
                </div>
              )}
              {teacher.languages && teacher.languages.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <Languages className="w-3 h-3" /> Languages
                  </p>
                  <p className="font-bold text-[#0B1B3F]">{teacher.languages.join(' · ')}</p>
                </div>
              )}
            </div>

            {teacher.education && teacher.education.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-3 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> Pedagogy
                </p>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {teacher.education.map((e) => (
                    <li key={e} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#1A73E8] mt-1.5 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {teacher.teachingStyle && (
              <div className="mt-6 p-4 rounded-xl bg-[#F8FAFF] border border-slate-100">
                <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-2">Teaching style</p>
                <p className="text-xs text-slate-700 leading-relaxed italic">“{teacher.teachingStyle}”</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
