'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  saveAiOutputsToLesson, createCourse, createModule, createLesson, updateCourse,
  getTeacherCourses, getModules, Course, Module, AiOutputs,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Sparkles, CheckCircle2, BookOpen, ChevronDown, ChevronUp, ExternalLink, FileUp, Upload } from 'lucide-react';
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

  // Curriculum SOW submission
  const [sowTitle, setSowTitle] = useState('');
  const [sowSubject, setSowSubject] = useState('');
  const [sowYearGroup, setSowYearGroup] = useState(YEAR_GROUPS[0]);
  const [sowFile, setSowFile] = useState<File | null>(null);
  const [sowUploadPct, setSowUploadPct] = useState(0);
  const [sowSubmitting, setSowSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(setCourses);
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
      setModulesLoading(false);
    });
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
    for (const { id } of FORMATS) {
      try {
        const result = await generateFormat(id);
        (outputs as Record<string, unknown>)[id] = result;
        setGeneratedOutputs({ ...outputs });
      } catch {
        setProgress(p => ({ ...p, [id]: 'error' }));
      }
    }
    setGenerating(false);
    toast.success('All formats generated! Review and publish.');
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
        const mTitle = moduleTitle.trim() || `Module ${modules.length + 1}`;
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
    if (!sowTitle.trim()) { toast.error('Enter a module title.'); return; }
    if (!sowFile) { toast.error('Choose a SOW document to upload.'); return; }

    setSowSubmitting(true);
    try {
      const courseId = await createCourse({
        title: sowTitle.trim(),
        description: `${sowSubject || 'General'} curriculum module — ${sowYearGroup}`,
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

  const totalDone = Object.values(progress).filter(v => v === 'done').length;
  const totalFormats = FORMATS.length;
  const canPublish = totalDone > 0 && !generating;

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
          Paste content, generate {totalFormats} AI formats, and publish. Add as many lessons as you want in one session.
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="bg-card border border-border rounded-3xl p-5 sm:p-6 space-y-5 card-glow"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Lesson Title *</Label>
            <Input value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder="e.g. Cellular Respiration" className="rounded-xl h-11" />
          </div>
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
        </div>

        {selectedCourseId === 'new' && (
          <div className="grid sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-2xl border border-dashed border-border">
            <div className="space-y-1.5">
              <Label>New Course Title *</Label>
              <Input value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="e.g. Biology 101" className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={courseSubject} onChange={e => setCourseSubject(e.target.value)} placeholder="e.g. Biology" className="rounded-xl h-11" />
            </div>
          </div>
        )}

        {selectedCourseId !== 'new' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Module
                {modulesLoading && <span className="text-xs text-muted-foreground ml-1">(loading...)</span>}
              </Label>
              <select
                value={selectedModuleId}
                onChange={e => setSelectedModuleId(e.target.value)}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                disabled={modulesLoading}
              >
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                <option value="new">+ Create new module</option>
              </select>
            </div>
            {selectedModuleId === 'new' && (
              <div className="space-y-1.5">
                <Label>New Module Title</Label>
                <Input
                  value={moduleTitle}
                  onChange={e => setModuleTitle(e.target.value)}
                  placeholder={`e.g. Module ${modules.length + 1}`}
                  className="rounded-xl h-11"
                />
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Lesson Content *</Label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste your lesson text, notes, or lecture content here (minimum 50 characters)..."
            className="min-h-40 rounded-xl text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{content.length} characters</p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || content.trim().length < 50}
          className="w-full rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {generating ? `Generating... (${totalDone}/${totalFormats})` : `Generate All ${totalFormats} Formats with AI`}
        </Button>
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
          <div>
            <h3 className="font-bold text-foreground">{totalDone}/{totalFormats} formats ready</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Publish to make this lesson available to enrolled students.</p>
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
                      <Link href={`/dashboard/student/courses/${sl.courseId}`} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0">
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
            Upload a Scheme of Work document for a curriculum module. It will be sent to the
            admin team for review before it appears in students&apos; My Learning.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Module Title *</Label>
            <Input value={sowTitle} onChange={e => setSowTitle(e.target.value)} placeholder="e.g. Science — Year 7" className="rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={sowSubject} onChange={e => setSowSubject(e.target.value)} placeholder="e.g. Science" className="rounded-xl h-11" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Year Group</Label>
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
    </div>
  );
}
