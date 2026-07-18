'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  saveAiOutputsToLesson, createCourse, createModule, createLesson, updateCourse,
  getTeacherCourses, getModules, createSupportTicket, Course, Module, AiOutputs,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Sparkles, CheckCircle2, BookOpen, ChevronDown, ChevronUp, ExternalLink,
  FileUp, Upload, Lightbulb, Circle, AlertCircle, Send, HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

const YEAR_GROUPS = ['Year 7', 'Year 8', 'Year 9'];

const FORMATS = [
  { id: 'text', label: 'Lesson Text' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'slides', label: 'Slides' },
  { id: 'notes', label: 'Study Notes' },
  { id: 'summary', label: 'Summary' },
  { id: 'problems', label: 'Practice Problems' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'mindmap', label: 'Mind Map' },
  { id: 'infographic', label: 'Infographic' },
];

interface SessionLesson {
  title: string;
  courseTitle: string;
  moduleTitle: string;
  courseId: string;
  lessonId: string;
}

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

export default function UploadPage() {
  const { user, profile } = useAuthSTORE();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('new');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSubject, setCourseSubject] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState('new');
  const [moduleTitle, setModuleTitle] = useState('');
  const [modulesLoading, setModulesLoading] = useState(false);

  const [lessonTitle, setLessonTitle] = useState('');
  const [content, setContent] = useState('');
  const [generatedOutputs, setGeneratedOutputs] = useState<AiOutputs>({});
  const [progress, setProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({});
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [sessionLessons, setSessionLessons] = useState<SessionLesson[]>([]);
  const [sessionOpen, setSessionOpen] = useState(false);

  // Guided help + admin request box
  const [guideOpen, setGuideOpen] = useState(true);
  const [reqCategory, setReqCategory] = useState('New subject or year group');
  const [reqMessage, setReqMessage] = useState('');
  const [reqSending, setReqSending] = useState(false);
  const [reqSent, setReqSent] = useState(false);

  // Curriculum SOW submission
  const [sowTitle, setSowTitle] = useState('');
  const [sowSubject, setSowSubject] = useState('');
  const [sowYearGroup, setSowYearGroup] = useState(YEAR_GROUPS[0]);
  const [sowFile, setSowFile] = useState<File | null>(null);
  const [sowUploadPct, setSowUploadPct] = useState(0);
  const [sowSubmitting, setSowSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(setCourses).catch(() => toast.error('Failed to load your courses.'));
  }, [user]);

  useEffect(() => {
    if (selectedCourseId === 'new') {
      setModules([]);
      setSelectedModuleId('new');
      return;
    }
    setModulesLoading(true);
    getModules(selectedCourseId).then(mods => {
      setModules(mods);
      setSelectedModuleId(mods.length > 0 ? mods[0].id! : 'new');
    }).catch(() => toast.error('Failed to load subjects for this course.'))
      .finally(() => setModulesLoading(false));
  }, [selectedCourseId]);

  const generateFormat = async (format: string): Promise<unknown> => {
    setProgress(p => ({ ...p, [format]: 'pending' }));
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, format }),
    });
    if (!res.ok) throw new Error(`Failed: ${format}`);
    const data = await res.json();
    setProgress(p => ({ ...p, [format]: 'done' }));
    return data.result;
  };

  const handleGenerate = async () => {
    if (!content.trim() || content.trim().length < 50) {
      toast.error('Please enter at least 50 characters of content.');
      return;
    }
    if (!lessonTitle.trim()) { toast.error('Enter a lesson title.'); return; }

    setGenerating(true);
    setGeneratedOutputs({});
    setProgress({});

    const outputs: AiOutputs = {};
    let failed = 0;
    for (const { id } of FORMATS) {
      try {
        const result = await generateFormat(id);
        (outputs as Record<string, unknown>)[id] = result;
        setGeneratedOutputs({ ...outputs });
      } catch {
        failed++;
        setProgress(p => ({ ...p, [id]: 'error' }));
      }
    }
    setGenerating(false);
    if (failed === 0) {
      toast.success('All formats generated! Review and publish.');
    } else if (failed === FORMATS.length) {
      toast.error('All formats failed to generate. Please try again.');
    } else {
      toast.warning(`${failed} format${failed !== 1 ? 's' : ''} failed — you can regenerate them later.`);
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    if (!lessonTitle.trim()) { toast.error('Enter a lesson title.'); return; }
    if (Object.keys(generatedOutputs).length === 0) { toast.error('Generate content first.'); return; }

    setPublishing(true);
    try {
      let courseId = selectedCourseId;
      let resolvedCourseTitle = courses.find(c => c.id === courseId)?.title ?? courseTitle;

      if (selectedCourseId === 'new') {
        if (!courseTitle.trim()) { toast.error('Enter a course title.'); setPublishing(false); return; }
        courseId = await createCourse({
          title: courseTitle.trim(),
          description: `${courseSubject || 'General'} course`,
          subject: courseSubject || 'General',
          ownerId: user.uid,
          ownerName: profile?.name,
          status: 'published',
          thumbnailUrl: '',
        });
        resolvedCourseTitle = courseTitle.trim();
        const updated = await getTeacherCourses(user.uid);
        setCourses(updated);
        setSelectedCourseId(courseId);
        setCourseTitle('');
      }

      let moduleId = selectedModuleId;
      let resolvedModuleTitle = modules.find(m => m.id === moduleId)?.title ?? moduleTitle;

      if (selectedModuleId === 'new') {
        const mTitle = moduleTitle.trim() || `Subject ${modules.length + 1}`;
        moduleId = await createModule(courseId, {
          title: mTitle,
          description: '',
          courseId,
          order: modules.length + 1,
        });
        resolvedModuleTitle = mTitle;
        const updatedMods = await getModules(courseId);
        setModules(updatedMods);
        setSelectedModuleId(moduleId);
        setModuleTitle('');
      }

      const lessonId = await createLesson(courseId, moduleId, {
        title: lessonTitle.trim(),
        moduleId,
        courseId,
        order: 1,
        contentSources: [{ type: 'text', value: content }],
        status: 'published',
      });

      await saveAiOutputsToLesson(courseId, moduleId, lessonId, generatedOutputs);

      setSessionLessons(prev => [{
        title: lessonTitle.trim(),
        courseTitle: resolvedCourseTitle,
        moduleTitle: resolvedModuleTitle,
        courseId,
        lessonId,
      }, ...prev]);
      setSessionOpen(true);

      // Reset lesson form only — keep course/module selection
      setLessonTitle('');
      setContent('');
      setGeneratedOutputs({});
      setProgress({});

      toast.success("Lesson published! Add another or you're done.");
    } catch (e: any) {
      toast.error('Failed to publish: ' + e.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleSowSubmit = async () => {
    if (!user) return;
    if (!sowTitle.trim()) { toast.error('Enter a subject title.'); return; }
    if (!sowFile) { toast.error('Choose a SOW document to upload.'); return; }

    setSowSubmitting(true);
    try {
      const courseId = await createCourse({
        title: sowTitle.trim(),
        description: `${sowSubject || 'General'} subject — ${sowYearGroup}`,
        subject: sowSubject || 'General',
        ownerId: user.uid,
        ownerName: profile?.name,
        status: 'pending_approval',
        kind: 'curriculum',
        yearGroup: sowYearGroup,
        isPublic: false,
        thumbnailUrl: '',
      });

      const path = `curriculum_docs/${user.uid}/${Date.now()}_${sowFile.name}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, sowFile);
      const sowDocUrl = await new Promise<string>((resolve, reject) => {
        task.on(
          'state_changed',
          snap => setSowUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref))
        );
      });

      await updateCourse(courseId, { sowDocUrl });

      toast.success('Curriculum SOW submitted for admin review!');
      setSowTitle('');
      setSowSubject('');
      setSowYearGroup(YEAR_GROUPS[0]);
      setSowFile(null);
      setSowUploadPct(0);
    } catch (e: any) {
      toast.error('Failed to submit: ' + e.message);
    } finally {
      setSowSubmitting(false);
    }
  };

  const handleAdminRequest = async () => {
    if (!user) return;
    if (!reqMessage.trim()) { toast.error('Describe what you need first.'); return; }
    setReqSending(true);
    try {
      await createSupportTicket({
        userId: user.uid,
        userName: profile?.name ?? 'Teacher',
        userRole: 'teacher',
        subject: `Teacher request: ${reqCategory}`,
        description: reqMessage.trim(),
        category: 'academic',
        priority: 'normal',
        status: 'open',
      });
      setReqSent(true);
      setReqMessage('');
      toast.success('Request sent to the admin team — track replies in Helpdesk.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not send the request.');
    } finally {
      setReqSending(false);
    }
  };

  const totalDone = Object.values(progress).filter(v => v === 'done').length;
  const totalFormats = FORMATS.length;
  const canPublish = totalDone > 0 && !generating;

  // ── Live lesson-quality checklist ──
  const contentLen = content.trim().length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const paragraphs = content.trim() ? content.trim().split(/\n\s*\n/).length : 0;
  const mentionsObjective = /objective|learn|able to|understand|explain|by the end/i.test(content);
  const requiredChecks = [
    { label: 'A clear, descriptive lesson title', help: 'e.g. "Photosynthesis: How Plants Make Food" — not just "Lesson 3"', ok: lessonTitle.trim().length >= 5 },
    { label: 'At least 50 characters of source content', help: 'The AI transforms YOUR material — it needs something to work with', ok: contentLen >= 50 },
  ];
  const recommendedChecks = [
    { label: '300+ characters of content (~a few paragraphs)', help: `Richer input → much better AI output. Currently ${contentLen} characters`, ok: contentLen >= 300 },
    { label: 'A stated learning objective', help: 'One line like "By the end, students will be able to…"', ok: mentionsObjective },
    { label: 'Key terms and definitions included', help: 'Powers the Glossary and Flashcards formats', ok: wordCount >= 120 },
    { label: 'Content split into sections or paragraphs', help: 'Helps the AI structure slides, notes and the mind map', ok: paragraphs >= 2 },
  ];
  const requiredMet = requiredChecks.every(c => c.ok);
  const step1Done = selectedCourseId !== 'new' || courseTitle.trim().length > 0;
  const step2Done = requiredMet;
  const step3Done = totalDone > 0;

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Page header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">
          LESSON STUDIO
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1">
          Create <span className="gradient-text italic">Lessons</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Four steps: choose where the lesson lives, write your content, let the AI build {totalFormats} study formats, publish. Add as many lessons as you want in one session.
        </p>
      </motion.div>

      {/* ── How it works guide ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/60 rounded-3xl overflow-hidden"
      >
        <button onClick={() => setGuideOpen(o => !o)} className="w-full flex items-center justify-between p-5 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shrink-0">
              <Lightbulb className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">How to create a great lesson</p>
              <p className="text-xs text-muted-foreground">A 60-second guide — what to write and what the AI does with it</p>
            </div>
          </div>
          {guideOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>
        <AnimatePresence>
          {guideOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-5 pb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { n: '1', title: 'Place it', desc: 'Pick the course and subject the lesson belongs to — or create new ones inline. Students find lessons through their course page.' },
                  { n: '2', title: 'Write it', desc: 'Give it a descriptive title and paste your source material: notes, a lecture transcript, a chapter summary. Original writing only — no copyrighted textbook scans.' },
                  { n: '3', title: 'Generate', desc: `One click turns your content into ${totalFormats} study formats — lesson text, quiz, flashcards, slides, notes, summary, problems, glossary, mind map and infographic.` },
                  { n: '4', title: 'Publish', desc: 'Review the formats, then publish. The lesson appears instantly for every student enrolled in the course.' },
                ].map(s => (
                  <div key={s.n} className="bg-card/70 rounded-2xl border border-border/60 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">{s.n}</span>
                      <p className="text-sm font-bold text-foreground">{s.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Step 1: Placement ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={2}
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 space-y-5 card-glow"
      >
        <div className="flex items-center gap-3">
          <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${step1Done ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground border border-border'}`}>
            {step1Done ? <CheckCircle2 className="w-4 h-4" /> : '1'}
          </span>
          <div>
            <h2 className="font-bold text-foreground text-sm">Where does this lesson live?</h2>
            <p className="text-xs text-muted-foreground">Choose an existing course & subject, or create new ones — students browse lessons inside their course.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Course</Label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="new">+ Create new course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          {selectedCourseId !== 'new' && (
            <div className="space-y-1.5">
              <Label>
                Subject
                {modulesLoading && <span className="text-xs text-muted-foreground ml-1">(loading...)</span>}
              </Label>
              <select
                value={selectedModuleId}
                onChange={e => setSelectedModuleId(e.target.value)}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                disabled={modulesLoading}
              >
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                <option value="new">+ Create new subject</option>
              </select>
            </div>
          )}
        </div>

        {selectedCourseId === 'new' && (
          <div className="grid sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-2xl border border-dashed border-border">
            <div className="space-y-1.5">
              <Label>New Course Title *</Label>
              <Input value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="e.g. Biology 101" className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Subject Area</Label>
              <Input value={courseSubject} onChange={e => setCourseSubject(e.target.value)} placeholder="e.g. Biology" className="rounded-xl h-11" />
            </div>
          </div>
        )}

        {selectedCourseId !== 'new' && selectedModuleId === 'new' && (
          <div className="p-4 bg-muted/50 rounded-2xl border border-dashed border-border space-y-1.5 sm:max-w-sm">
            <Label>New Subject Title</Label>
            <Input
              value={moduleTitle}
              onChange={e => setModuleTitle(e.target.value)}
              placeholder={`e.g. Subject ${modules.length + 1}`}
              className="rounded-xl h-11"
            />
          </div>
        )}
      </motion.div>

      {/* ── Step 2: Write the lesson + quality checklist ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={3}
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow"
      >
        <div className="flex items-center gap-3 mb-5">
          <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${step2Done ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground border border-border'}`}>
            {step2Done ? <CheckCircle2 className="w-4 h-4" /> : '2'}
          </span>
          <div>
            <h2 className="font-bold text-foreground text-sm">Write your lesson</h2>
            <p className="text-xs text-muted-foreground">The AI transforms what you write — the checklist shows what a strong lesson needs.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_290px] gap-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lesson Title *</Label>
              <Input value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder='e.g. "Cellular Respiration: How Cells Release Energy"' className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Lesson Content *</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={"Paste or write your source material here — notes, a lecture transcript, a chapter outline…\n\nTip: start with one line stating the learning objective, then the material in a few paragraphs, including key terms you want students to master."}
                className="min-h-52 rounded-xl text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{content.length} characters · {wordCount} words</p>
            </div>
          </div>

          {/* Live quality checklist */}
          <aside className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4 h-fit">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-foreground mb-2">A lesson must have</p>
              <ul className="space-y-2">
                {requiredChecks.map(c => (
                  <li key={c.label} className="flex items-start gap-2">
                    {c.ok
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      : <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />}
                    <div>
                      <p className={`text-xs font-semibold ${c.ok ? 'text-foreground' : 'text-muted-foreground'}`}>{c.label}</p>
                      <p className="text-[10px] text-muted-foreground/80 leading-relaxed">{c.help}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-3 border-t border-border/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Strongly recommended</p>
              <ul className="space-y-2">
                {recommendedChecks.map(c => (
                  <li key={c.label} className="flex items-start gap-2">
                    {c.ok
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      : <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />}
                    <div>
                      <p className={`text-xs font-semibold ${c.ok ? 'text-foreground' : 'text-muted-foreground'}`}>{c.label}</p>
                      <p className="text-[10px] text-muted-foreground/80 leading-relaxed">{c.help}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Use your own material or licensed sources — don&apos;t paste copyrighted textbook pages.
              </p>
            </div>
          </aside>
        </div>

        {/* ── Step 3: Generate ── */}
        <div className="mt-5 pt-5 border-t border-border flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${step3Done ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground border border-border'}`}>
            {step3Done ? <CheckCircle2 className="w-4 h-4" /> : '3'}
          </span>
          <div className="flex-1">
            <p className="font-bold text-foreground text-sm">Generate the study formats</p>
            <p className="text-xs text-muted-foreground">{requiredMet ? 'Ready — this takes about a minute.' : 'Complete the required items above to enable generation.'}</p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || !requiredMet}
            className="rounded-full h-11 px-6 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all gap-2 w-full sm:w-auto"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? `Generating... (${totalDone}/${totalFormats})` : `Generate All ${totalFormats} Formats`}
          </Button>
        </div>
      </motion.div>

      {/* Progress card */}
      {Object.keys(progress).length > 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow"
        >
          <h3 className="font-bold text-foreground mb-4">Generation Progress</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FORMATS.map(f => {
              const status = progress[f.id];
              return (
                <div key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
                  status === 'done' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600' :
                  status === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-600' :
                  status === 'pending' ? 'bg-sky-500/10 border border-sky-500/20 text-sky-600 animate-pulse' :
                  'bg-muted border border-border text-muted-foreground'
                }`}>
                  {status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> :
                   status === 'pending' ? <div className="w-3.5 h-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" /> :
                   <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                  {f.label}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Publish banner */}
      {canPublish && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
          className="bg-card border border-emerald-500/20 rounded-3xl p-5 sm:p-6 card-glow flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 bg-emerald-600 text-white">4</span>
            <div>
              <h3 className="font-bold text-foreground">{totalDone}/{totalFormats} formats ready</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Final step — publish to make this lesson available to every enrolled student.</p>
            </div>
          </div>
          <Button
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all shrink-0 gap-2"
          >
            <BookOpen className="w-4 h-4" />
            {publishing ? 'Publishing...' : 'Publish Lesson'}
          </Button>
        </motion.div>
      )}

      {/* Session published accordion */}
      {sessionLessons.length > 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
          className="bg-card border border-border rounded-3xl card-glow overflow-hidden"
        >
          <button
            onClick={() => setSessionOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">Published this session ({sessionLessons.length})</p>
                <p className="text-xs text-muted-foreground">Click to {sessionOpen ? 'collapse' : 'expand'}</p>
              </div>
            </div>
            {sessionOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {sessionOpen && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="border-t border-border divide-y divide-border">
                  {sessionLessons.map((sl, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{sl.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{sl.courseTitle} · {sl.moduleTitle}</p>
                      </div>
                      <Link href="/dashboard/teacher/courses" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" /> View Course
                      </Link>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* SOW section */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={5}
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 space-y-5 card-glow"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">
            CURRICULUM
          </p>
          <h2 className="font-bold text-foreground flex items-center gap-2 mt-1">
            <FileUp className="w-4 h-4 text-emerald-600" /> Submit Curriculum SOW for Review
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Upload a Scheme of Work document for a subject. It will be sent to the
            admin team for review before it appears in students&apos; My Learning.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Subject Title *</Label>
            <Input value={sowTitle} onChange={e => setSowTitle(e.target.value)} placeholder="e.g. Science — Year 7" className="rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={sowSubject} onChange={e => setSowSubject(e.target.value)} placeholder="e.g. Science" className="rounded-xl h-11" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Year / Level</Label>
            <select
              value={sowYearGroup}
              onChange={e => setSowYearGroup(e.target.value)}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              {YEAR_GROUPS.map(yg => <option key={yg} value={yg}>{yg}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>SOW Document *</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={e => setSowFile(e.target.files?.[0] ?? null)}
              className="rounded-xl h-11 file:text-sm file:font-medium"
            />
          </div>
        </div>

        {sowSubmitting && sowUploadPct > 0 && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${sowUploadPct}%` }} />
          </div>
        )}

        <Button
          onClick={handleSowSubmit}
          disabled={sowSubmitting}
          variant="outline"
          className="w-full rounded-full h-11 px-5 font-bold gap-2"
        >
          <Upload className="w-4 h-4" />
          {sowSubmitting ? `Uploading... (${sowUploadPct}%)` : 'Submit for Review'}
        </Button>
      </motion.div>

      {/* ── Request to Admin ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={6}
        className="bg-card border border-violet-200/60 rounded-3xl p-5 sm:p-6 space-y-4 card-glow"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md shrink-0">
            <HelpCircle className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-sm">Missing something? Ask the admin team</h2>
            <p className="text-xs text-muted-foreground">
              Need a subject or year group that isn&apos;t listed, curriculum access, a new content format, or anything else to build your lesson? Send a request — it lands in the admin Helpdesk and you&apos;ll get a reply there.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-[220px_1fr] gap-3">
          <select
            value={reqCategory}
            onChange={e => setReqCategory(e.target.value)}
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
          >
            {[
              'New subject or year group',
              'Curriculum / CMS access',
              'New content format or AI feature',
              'Course approval or publishing issue',
              'Something else',
            ].map(c => <option key={c}>{c}</option>)}
          </select>
          <Textarea
            value={reqMessage}
            onChange={e => { setReqMessage(e.target.value); setReqSent(false); }}
            placeholder='Describe what you need and why — e.g. "Please add Year 10 Chemistry as a subject so I can build the atomic structure unit."'
            className="min-h-11 rounded-xl text-sm resize-none sm:min-h-0"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            Track replies in <Link href="/dashboard/helpdesk" className="underline hover:text-foreground">Helpdesk</Link>.
          </p>
          <Button
            onClick={handleAdminRequest}
            disabled={reqSending || !reqMessage.trim()}
            className="rounded-full h-10 px-5 font-bold gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:shadow-lg hover:shadow-violet-600/25 transition-all"
          >
            {reqSent ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {reqSending ? 'Sending…' : reqSent ? 'Sent ✓' : 'Send Request'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
