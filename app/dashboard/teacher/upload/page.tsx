'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import { saveAiOutputsToLesson, createCourse, createModule, createLesson, getTeacherCourses, Course, AiOutputs } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, CheckCircle2, Upload, BookOpen, Plus } from 'lucide-react';
import { useEffect } from 'react';

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

export default function UploadPage() {
  const { user, profile } = useAuthSTORE();
  const [content, setContent] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSubject, setCourseSubject] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('new');
  const [generatedOutputs, setGeneratedOutputs] = useState<AiOutputs>({});
  const [progress, setProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({});
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(setCourses);
  }, [user]);

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
    setPublished(false);

    const outputs: AiOutputs = {};
    const formatIds = FORMATS.map(f => f.id);

    for (const format of formatIds) {
      try {
        const result = await generateFormat(format);
        (outputs as Record<string, unknown>)[format] = result;
        setGeneratedOutputs({ ...outputs });
      } catch {
        setProgress(p => ({ ...p, [format]: 'error' }));
      }
    }

    setGenerating(false);
    toast.success('All formats generated! Review and publish.');
  };

  const handlePublish = async () => {
    if (!user) return;
    if (!lessonTitle.trim()) { toast.error('Enter a lesson title.'); return; }

    setPublishing(true);
    try {
      let courseId = selectedCourseId;

      if (selectedCourseId === 'new') {
        if (!courseTitle.trim()) { toast.error('Enter a course title.'); setPublishing(false); return; }
        courseId = await createCourse({
          title: courseTitle.trim(),
          description: `${courseSubject} course`,
          subject: courseSubject || 'General',
          ownerId: user.uid,
          ownerName: profile?.name,
          status: 'published',
          thumbnailUrl: '',
        });
      }

      const moduleId = await createModule(courseId, {
        title: 'Module 1',
        description: '',
        courseId,
        order: 1,
      });

      const lessonId = await createLesson(courseId, moduleId, {
        title: lessonTitle.trim(),
        moduleId,
        courseId,
        order: 1,
        contentSources: [{ type: 'text', value: content }],
        status: 'published',
      });

      await saveAiOutputsToLesson(courseId, moduleId, lessonId, generatedOutputs);

      setPublished(true);
      toast.success('Lesson published! Students can now access it.');
    } catch (e: any) {
      toast.error('Failed to publish: ' + e.message);
    } finally {
      setPublishing(false);
    }
  };

  const totalDone = Object.values(progress).filter(v => v === 'done').length;
  const totalFormats = FORMATS.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">AI Lesson Generator</h1>
        <p className="text-muted-foreground text-sm mt-1">Paste your lesson content and AI will transform it into {totalFormats} learning formats.</p>
      </div>

      {/* Input */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Lesson Title *</Label>
            <Input value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder="e.g. Cellular Respiration" className="rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Publish to Course</Label>
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
          <div className="grid sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-xl border border-dashed border-border">
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

        <div className="space-y-1.5">
          <Label>Lesson Content *</Label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste your lesson text, notes, or lecture content here (minimum 50 characters)…"
            className="min-h-40 rounded-xl text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{content.length} characters</p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || content.trim().length < 50}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {generating ? `Generating… (${totalDone}/${totalFormats})` : `Generate All ${totalFormats} Formats with AI`}
        </Button>
      </div>

      {/* Progress */}
      {Object.keys(progress).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-bold text-foreground mb-4">Generation Progress</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FORMATS.map(f => {
              const status = progress[f.id];
              return (
                <div key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
                  status === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  status === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                  status === 'pending' ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse' :
                  'bg-muted border-border text-muted-foreground'
                }`}>
                  {status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> :
                   status === 'pending' ? <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" /> :
                   <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                  {f.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Publish */}
      {totalDone > 0 && !published && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 flex items-center justify-between gap-4"
        >
          <div>
            <h3 className="font-bold text-foreground">{totalDone}/{totalFormats} formats ready</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Publish to make this lesson available to enrolled students.</p>
          </div>
          <Button onClick={handlePublish} disabled={publishing} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
            {publishing ? 'Publishing…' : 'Publish Lesson'}
          </Button>
        </motion.div>
      )}

      {published && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-bold text-foreground text-lg">Lesson Published!</h3>
          <p className="text-sm text-muted-foreground mt-1">Students enrolled in this course can now access all {totalDone} generated formats.</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => { setPublished(false); setContent(''); setLessonTitle(''); setGeneratedOutputs({}); setProgress({}); }}>
            <Plus className="w-4 h-4 mr-2" /> Create Another Lesson
          </Button>
        </div>
      )}
    </div>
  );
}
