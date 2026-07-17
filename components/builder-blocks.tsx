'use client';

/**
 * Content Builder — centre-panel block editors.
 * Each block edits one slice of the Lesson draft and calls onChange with a
 * partial patch. AI actions are delegated up via the `ai` helper so the page
 * owns loading state and Firestore writes.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Lesson, AiOutputs } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VideoPlayer } from '@/components/video-player';
import { SmartAudioPlayer } from '@/components/smart-audio-player';
import {
  AlertTriangle, Check, Copy, GripVertical, Loader2, Plus, Sparkles, Trash2, X,
} from 'lucide-react';

/* ── Shared bits ────────────────────────────────────────────── */

export const BLOOMS = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'];
export const BLOOM_SHORT: Record<string, string> = {
  Remember: 'R', Understand: 'U', Apply: 'Ap', Analyse: 'An', Evaluate: 'Ev', Create: 'C',
};

export interface BlockDef {
  id: string;
  icon: string;
  label: string;
  sparks?: number;
}

export const BLOCK_DEFS: BlockDef[] = [
  { id: 'objectives', icon: '🎯', label: 'Objectives' },
  { id: 'video', icon: '🎬', label: 'Video', sparks: 15 },
  { id: 'text', icon: '📝', label: 'Lesson Text' },
  { id: 'vocabulary', icon: '📖', label: 'Vocabulary', sparks: 5 },
  { id: 'activity', icon: '✏️', label: 'Activity' },
  { id: 'quiz', icon: '✅', label: 'Quiz', sparks: 5 },
  { id: 'assignment', icon: '📋', label: 'Assignment' },
  { id: 'assessment', icon: '🏅', label: 'Assessment' },
  { id: 'flashcards', icon: '🃏', label: 'Flashcards', sparks: 5 },
  { id: 'mindmap', icon: '🧠', label: 'Mind Map', sparks: 10 },
  { id: 'audio', icon: '🎧', label: 'Audio', sparks: 10 },
  { id: 'infographic', icon: '📊', label: 'Infographic', sparks: 15 },
  { id: 'slides', icon: '🖼️', label: 'Slides', sparks: 10 },
  { id: 'notes', icon: '🗒️', label: 'Study Notes', sparks: 5 },
  { id: 'summary', icon: '⚡', label: 'Summary' },
  { id: 'problems', icon: '🧮', label: 'Problems', sparks: 5 },
];

export type AiRunner = (format: string, extraBrief?: string) => Promise<void>;

export interface BlockShellProps {
  def: BlockDef;
  bloom?: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  children: React.ReactNode;
}

/** Card chrome shared by every block: drag handle, icon, label, bloom pill,
 * action buttons, teal selection ring. */
export function BlockShell({
  def, bloom, selected, onSelect, onDelete, onMoveUp, onMoveDown, onDuplicate,
  onRegenerate, regenerating, children,
}: BlockShellProps) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onSelect}
      className={`rounded-2xl border bg-card transition-shadow ${
        selected
          ? 'border-teal-400 shadow-[0_0_0_3px_rgba(45,212,191,0.25)]'
          : 'border-border hover:border-teal-400/40'
      }`}
    >
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
        <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab shrink-0" />
        <span className="text-base leading-none">{def.icon}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{def.label}</span>
        {bloom && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">
            {BLOOM_SHORT[bloom] ?? bloom}
          </span>
        )}
        <span className="flex-1" />
        {onRegenerate && (
          <button
            onClick={e => { e.stopPropagation(); onRegenerate(); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-violet-600 hover:bg-violet-50"
            title="AI regenerate"
            disabled={regenerating}
          >
            {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          </button>
        )}
        {onDuplicate && (
          <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" title="Duplicate">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        {onMoveUp && (
          <button onClick={e => { e.stopPropagation(); onMoveUp(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-bold" title="Move up">↑</button>
        )}
        {onMoveDown && (
          <button onClick={e => { e.stopPropagation(); onMoveDown(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-bold" title="Move down">↓</button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Remove block">
          <X className="w-3.5 h-3.5" />
        </button>
      </header>
      <div className="p-4">{children}</div>
    </motion.section>
  );
}

/* ── Objectives ─────────────────────────────────────────────── */

export function ObjectivesBlock({ value, onChange }: {
  value: { text: string; bloom: string }[];
  onChange: (v: { text: string; bloom: string }[]) => void;
}) {
  const rows = value.length ? value : [];
  const update = (i: number, patch: Partial<{ text: string; bloom: string }>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {rows.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={o.bloom}
            onChange={e => update(i, { bloom: e.target.value })}
            className="text-[10px] font-bold rounded-lg border border-violet-200 bg-violet-50 text-violet-700 px-1.5 py-1.5 shrink-0"
            title="Bloom's level"
          >
            {BLOOMS.map(b => <option key={b} value={b}>{BLOOM_SHORT[b]}</option>)}
          </select>
          <Input
            value={o.text}
            onChange={e => update(i, { text: e.target.value })}
            placeholder="Students will be able to…"
            className="h-9 rounded-xl text-sm"
          />
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-600 shrink-0" title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs"
        onClick={() => onChange([...rows, { text: '', bloom: 'Understand' }])}>
        <Plus className="w-3 h-3" /> Add Objective
      </Button>
    </div>
  );
}

/* ── Video ──────────────────────────────────────────────────── */

const VIDEO_TYPES = [
  { id: 'voiceover', label: 'Voiceover + Slides', sparks: 10, available: true },
  { id: 'ai', label: 'AI Avatar', sparks: 15, available: false },
  { id: 'embed', label: 'Upload / Embed', sparks: 0, available: true },
] as const;

export function VideoBlock({ lesson, videoConfig, onConfig, script, onScriptChange, ai, generating }: {
  lesson: Lesson;
  videoConfig: NonNullable<Lesson['videoConfig']>;
  onConfig: (v: NonNullable<Lesson['videoConfig']>) => void;
  script?: string;
  onScriptChange: (s: string) => void;
  ai: AiRunner;
  generating: boolean;
}) {
  const [prompt, setPrompt] = useState(videoConfig.prompt ?? '');
  const [editingScript, setEditingScript] = useState(false);
  const type = videoConfig.type ?? 'voiceover';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VIDEO_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => t.available && onConfig({ ...videoConfig, type: t.id })}
            disabled={!t.available}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              type === t.id
                ? 'border-teal-400 bg-teal-50 text-teal-700'
                : t.available
                  ? 'border-border text-muted-foreground hover:border-teal-300'
                  : 'border-border text-muted-foreground/50 cursor-not-allowed'
            }`}
          >
            {t.label}
            {t.sparks > 0 && <span className="ml-1.5 text-amber-500">⚡{t.sparks}</span>}
            {!t.available && <span className="ml-1.5 text-[9px] uppercase">soon</span>}
          </button>
        ))}
      </div>

      {type === 'embed' ? (
        <div className="space-y-2">
          <Input
            value={videoConfig.embedUrl ?? ''}
            onChange={e => onConfig({ ...videoConfig, embedUrl: e.target.value })}
            placeholder="YouTube / Vimeo / MP4 URL"
            className="h-10 rounded-xl text-sm"
          />
          {videoConfig.embedUrl && (
            <VideoEmbed url={videoConfig.embedUrl} />
          )}
        </div>
      ) : (
        <>
          {script ? (
            <>
              <VideoPlayer script={script} title={lesson.title} />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs" disabled={generating}
                  onClick={() => ai('videoScript', prompt || undefined)}>
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Regenerate
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => setEditingScript(s => !s)}>
                  {editingScript ? 'Close script' : 'Edit Script'}
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 aspect-video flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-sm text-slate-300">No video yet — describe it and hit Generate.</p>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={e => { setPrompt(e.target.value); onConfig({ ...videoConfig, prompt: e.target.value }); }}
              placeholder='e.g. "Explain atomic structure with animated diagrams aimed at Year 10 students"'
              className="h-10 rounded-xl text-sm"
            />
            <Button className="rounded-xl gap-1.5 shrink-0 bg-gradient-to-r from-red-500 to-rose-600 text-white" disabled={generating}
              onClick={() => ai('videoScript', prompt || undefined)}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate
            </Button>
          </div>
        </>
      )}
      {editingScript && script !== undefined && (
        <div className="space-y-2">
          <Textarea
            value={script}
            onChange={e => onScriptChange(e.target.value)}
            className="min-h-40 rounded-xl text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            Edit scenes using “### Scene N — title”, “[VISUAL: …]” and narration lines. Changes save with the lesson.
          </p>
        </div>
      )}
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  const src = yt ? `https://www.youtube.com/embed/${yt[1]}` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
  if (src) {
    return <iframe src={src} className="w-full aspect-video rounded-xl border border-border" allowFullScreen title="Embedded video" />;
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
    return <video src={url} controls className="w-full aspect-video rounded-xl bg-black" />;
  }
  return <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Unrecognised video URL — use YouTube, Vimeo or a direct MP4 link.</p>;
}

/* ── Lesson text ────────────────────────────────────────────── */

export function LessonTextBlock({ value, onChange, ai, generating }: {
  value: string;
  onChange: (v: string) => void;
  ai: AiRunner;
  generating: boolean;
}) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Don’t paste copyrighted textbook content. Write original material or use licensed sources — AI checks flag verbatim textbook passages.
      </div>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Write or generate the core lesson text…"
        className="min-h-44 rounded-xl text-sm leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{words} words · ~{Math.max(1, Math.round(words / 200))} min read</span>
        <span className="flex-1" />
        <Button size="sm" variant="outline" className="rounded-xl h-7 text-[11px] gap-1" disabled={generating}
          onClick={() => ai('text', 'Expand the existing lesson text with more depth, worked examples and clearer explanations. Keep the same structure.')}>
          <Sparkles className="w-3 h-3" /> AI Expand
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl h-7 text-[11px] gap-1" disabled={generating}
          onClick={() => ai('text', 'Simplify the existing lesson text for a younger reading level while keeping all key facts.')}>
          <Sparkles className="w-3 h-3" /> Simplify
        </Button>
      </div>
    </div>
  );
}

/* ── Vocabulary (glossary) ──────────────────────────────────── */

export function VocabularyBlock({ value, onChange }: {
  value: { term: string; definition: string }[];
  onChange: (v: { term: string; definition: string }[]) => void;
}) {
  const update = (i: number, patch: Partial<{ term: string; definition: string }>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {value.map((v, i) => (
        <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
          <Input value={v.term} onChange={e => update(i, { term: e.target.value })} placeholder="Term" className="h-9 rounded-xl text-sm font-semibold" />
          <Input value={v.definition} onChange={e => update(i, { definition: e.target.value })} placeholder="Definition" className="h-9 rounded-xl text-sm" />
          <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-600" title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs"
        onClick={() => onChange([...value, { term: '', definition: '' }])}>
        <Plus className="w-3 h-3" /> Add Term
      </Button>
    </div>
  );
}

/* ── Activity ───────────────────────────────────────────────── */

const ACTIVITY_TYPES = ['Individual', 'Pair', 'Group', 'Calculation', 'Problem solving'];

export function ActivityBlock({ value, onChange }: {
  value: NonNullable<Lesson['activity']>;
  onChange: (v: NonNullable<Lesson['activity']>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input value={value.title ?? ''} onChange={e => onChange({ ...value, title: e.target.value })} placeholder="Activity title" className="h-9 rounded-xl text-sm" />
        <select value={value.type ?? 'Individual'} onChange={e => onChange({ ...value, type: e.target.value })}
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm">
          {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <Textarea value={value.instructions ?? ''} onChange={e => onChange({ ...value, instructions: e.target.value })}
        placeholder="Full activity instructions (can be multi-part)…" className="min-h-28 rounded-xl text-sm" />
      <div className="grid sm:grid-cols-2 gap-3">
        <Input type="number" value={value.marks ?? ''} onChange={e => onChange({ ...value, marks: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="Marks" className="h-9 rounded-xl text-sm" />
        <select value={value.bloom ?? 'Apply'} onChange={e => onChange({ ...value, bloom: e.target.value })}
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm">
          {BLOOMS.map(b => <option key={b}>{b}</option>)}
        </select>
      </div>
      <Textarea value={value.modelAnswer ?? ''} onChange={e => onChange({ ...value, modelAnswer: e.target.value })}
        placeholder="Teacher model answer (never shown to students)…" className="min-h-20 rounded-xl text-sm" />
      <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        Student responses to activities are flagged for AI-teacher review automatically.
      </p>
    </div>
  );
}

/* ── Quiz ───────────────────────────────────────────────────── */

type QuizQ = NonNullable<AiOutputs['quiz']>[number];

export function QuizBlock({ value, onChange, ai, generating, settings, onSettings }: {
  value: QuizQ[];
  onChange: (v: QuizQ[]) => void;
  ai: AiRunner;
  generating: boolean;
  settings: { passMark: number; attempts: number; randomise: boolean };
  onSettings: (s: { passMark: number; attempts: number; randomise: boolean }) => void;
}) {
  const update = (i: number, patch: Partial<QuizQ>) =>
    onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs bg-muted/40 rounded-xl px-3 py-2">
        <span className="font-semibold text-foreground">{value.length} questions</span>
        <label className="flex items-center gap-1.5">Pass mark
          <Input type="number" value={settings.passMark} onChange={e => onSettings({ ...settings, passMark: Number(e.target.value) || 0 })} className="h-7 w-16 rounded-lg text-xs" />%
        </label>
        <label className="flex items-center gap-1.5">Attempts
          <Input type="number" value={settings.attempts} onChange={e => onSettings({ ...settings, attempts: Number(e.target.value) || 1 })} className="h-7 w-14 rounded-lg text-xs" />
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={settings.randomise} onChange={e => onSettings({ ...settings, randomise: e.target.checked })} className="accent-teal-500" />
          Randomise
        </label>
      </div>

      {value.map((q, i) => (
        <div key={i} className="rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-muted-foreground mt-2 shrink-0">Q{i + 1}</span>
            <Textarea value={q.question} onChange={e => update(i, { question: e.target.value })} className="min-h-9 rounded-lg text-sm" placeholder="Question text" />
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-600 mt-2 shrink-0" title="Delete question">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {(q.options ?? []).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2 pl-6">
              <button
                onClick={() => update(i, { answer: opt })}
                title="Mark as correct"
                className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                  opt === q.answer ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/40 hover:border-emerald-400'
                }`}
              >
                {opt === q.answer && <Check className="w-3 h-3 text-white" />}
              </button>
              <Input
                value={opt}
                onChange={e => {
                  const options = q.options.map((o, j) => (j === oi ? e.target.value : o));
                  update(i, { options, ...(opt === q.answer ? { answer: e.target.value } : {}) });
                }}
                className="h-8 rounded-lg text-sm"
              />
            </div>
          ))}
          <div className="pl-6">
            <Input
              value={q.explanation ?? ''}
              onChange={e => update(i, { explanation: e.target.value })}
              placeholder="Explanation shown to students after answering"
              className="h-8 rounded-lg text-xs text-muted-foreground"
            />
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs"
          onClick={() => onChange([...value, { question: '', options: ['', '', '', ''], answer: '' }])}>
          <Plus className="w-3 h-3" /> Add Question
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs" disabled={generating} onClick={() => ai('quiz')}>
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI Generate Questions
        </Button>
      </div>
    </div>
  );
}

/* ── Assignment ─────────────────────────────────────────────── */

const SUBMISSION_TYPES = ['Written', 'File upload', 'Both', 'Presentation', 'Video recording'];
const LATE_POLICIES = ['Accept with penalty', 'Accept without penalty', 'Do not accept'];

export function AssignmentBlock({ value, onChange }: {
  value: NonNullable<Lesson['assignmentConfig']>;
  onChange: (v: NonNullable<Lesson['assignmentConfig']>) => void;
}) {
  const rubric = value.rubric ?? [];
  const updateRubric = (i: number, patch: Partial<{ criterion: string; descriptor: string; marks: number; bloom?: string }>) =>
    onChange({ ...value, rubric: rubric.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input value={value.title ?? ''} onChange={e => onChange({ ...value, title: e.target.value })} placeholder="Assignment title" className="h-9 rounded-xl text-sm" />
        <select value={value.submissionType ?? 'Written'} onChange={e => onChange({ ...value, submissionType: e.target.value })}
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm">
          {SUBMISSION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input type="number" value={value.dueInDays ?? ''} onChange={e => onChange({ ...value, dueInDays: e.target.value ? Number(e.target.value) : undefined })} placeholder="Due in (days)" className="h-9 rounded-xl text-sm" />
        <Input type="number" value={value.totalMarks ?? ''} onChange={e => onChange({ ...value, totalMarks: e.target.value ? Number(e.target.value) : undefined })} placeholder="Total marks" className="h-9 rounded-xl text-sm" />
        <Input type="number" value={value.passMark ?? ''} onChange={e => onChange({ ...value, passMark: e.target.value ? Number(e.target.value) : undefined })} placeholder="Pass mark" className="h-9 rounded-xl text-sm" />
        <select value={value.latePolicy ?? LATE_POLICIES[0]} onChange={e => onChange({ ...value, latePolicy: e.target.value })}
          className="h-9 rounded-xl border border-border bg-card px-2 text-xs">
          {LATE_POLICIES.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <Textarea value={value.brief ?? ''} onChange={e => onChange({ ...value, brief: e.target.value })}
        placeholder="Full assignment brief students will see…" className="min-h-28 rounded-xl text-sm" />

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marking rubric</p>
        {rubric.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_70px_70px_auto] gap-2 items-center">
            <Input value={r.criterion} onChange={e => updateRubric(i, { criterion: e.target.value })} placeholder="Criterion" className="h-8 rounded-lg text-xs" />
            <Input value={r.descriptor} onChange={e => updateRubric(i, { descriptor: e.target.value })} placeholder="Descriptor" className="h-8 rounded-lg text-xs" />
            <Input type="number" value={r.marks} onChange={e => updateRubric(i, { marks: Number(e.target.value) || 0 })} placeholder="Marks" className="h-8 rounded-lg text-xs" />
            <select value={r.bloom ?? 'Apply'} onChange={e => updateRubric(i, { bloom: e.target.value })} className="h-8 rounded-lg border border-border bg-card px-1 text-[10px]">
              {BLOOMS.map(b => <option key={b} value={b}>{BLOOM_SHORT[b]}</option>)}
            </select>
            <button onClick={() => onChange({ ...value, rubric: rubric.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-red-600" title="Remove">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-7 text-[11px]"
          onClick={() => onChange({ ...value, rubric: [...rubric, { criterion: '', descriptor: '', marks: 5, bloom: 'Apply' }] })}>
          <Plus className="w-3 h-3" /> Add Criterion
        </Button>
      </div>
    </div>
  );
}

/* ── Assessment ─────────────────────────────────────────────── */

const ASSESSMENT_KINDS = [
  { id: 'chapter_test', label: 'Chapter Test' },
  { id: 'unit_assessment', label: 'Unit Assessment' },
  { id: 'mock_exam', label: 'Mock Exam' },
] as const;

export function AssessmentBlock({ value, onChange, ai, generating }: {
  value: NonNullable<Lesson['assessmentConfig']>;
  onChange: (v: NonNullable<Lesson['assessmentConfig']>) => void;
  ai: AiRunner;
  generating: boolean;
}) {
  const sections = value.sections ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {ASSESSMENT_KINDS.map(k => (
          <button key={k.id} onClick={() => onChange({ ...value, kind: k.id })}
            className={`px-2 py-3 rounded-xl border text-xs font-semibold text-center transition-colors ${
              (value.kind ?? 'unit_assessment') === k.id
                ? 'border-teal-400 bg-teal-50 text-teal-700'
                : 'border-border text-muted-foreground hover:border-teal-300'
            }`}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Input value={value.title ?? ''} onChange={e => onChange({ ...value, title: e.target.value })} placeholder="Assessment title" className="h-9 rounded-xl text-sm col-span-2 sm:col-span-1" />
        <Input type="number" value={value.totalMarks ?? ''} onChange={e => onChange({ ...value, totalMarks: e.target.value ? Number(e.target.value) : undefined })} placeholder="Total marks" className="h-9 rounded-xl text-sm" />
        <Input type="number" value={value.timeAllowedMinutes ?? ''} onChange={e => onChange({ ...value, timeAllowedMinutes: e.target.value ? Number(e.target.value) : undefined })} placeholder="Time (min)" className="h-9 rounded-xl text-sm" />
        <Input type="number" value={value.passThreshold ?? ''} onChange={e => onChange({ ...value, passThreshold: e.target.value ? Number(e.target.value) : undefined })} placeholder="Pass %" className="h-9 rounded-xl text-sm" />
        <Input type="number" value={value.attempts ?? ''} onChange={e => onChange({ ...value, attempts: e.target.value ? Number(e.target.value) : undefined })} placeholder="Attempts" className="h-9 rounded-xl text-sm" />
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={value.certificateOnPass ?? false} onChange={e => onChange({ ...value, certificateOnPass: e.target.checked })} className="accent-teal-500" />
          Certificate on pass
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section structure</p>
        {sections.map((s, i) => (
          <div key={i} className="grid grid-cols-[100px_1fr_70px_auto] gap-2 items-center">
            <select value={s.bloom} onChange={e => onChange({ ...value, sections: sections.map((x, j) => j === i ? { ...x, bloom: e.target.value } : x) })}
              className="h-8 rounded-lg border border-border bg-card px-1 text-[11px]">
              {BLOOMS.map(b => <option key={b}>{b}</option>)}
            </select>
            <Input value={s.description} onChange={e => onChange({ ...value, sections: sections.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })}
              placeholder="Section description" className="h-8 rounded-lg text-xs" />
            <Input type="number" value={s.marks} onChange={e => onChange({ ...value, sections: sections.map((x, j) => j === i ? { ...x, marks: Number(e.target.value) || 0 } : x) })}
              className="h-8 rounded-lg text-xs" />
            <button onClick={() => onChange({ ...value, sections: sections.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-red-600" title="Remove">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-7 text-[11px]"
            onClick={() => onChange({ ...value, sections: [...sections, { bloom: 'Remember', description: '', marks: 10 }] })}>
            <Plus className="w-3 h-3" /> Add Manually
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-7 text-[11px]" disabled={generating} onClick={() => ai('quiz')}>
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI Generate All Questions
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">AI-generated questions are stored on this lesson’s Quiz block for review before publishing.</p>
      </div>
    </div>
  );
}

/* ── Audio (simple preview using SmartAudioPlayer) ─────────── */

export function AudioBlock({ script, ai, generating }: { script?: string; ai: AiRunner; generating: boolean }) {
  if (!script) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">No audio summary yet.</p>
        <Button size="sm" className="rounded-xl gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white" disabled={generating} onClick={() => ai('audioScript')}>
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate Audio Script
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <SmartAudioPlayer script={script} title="Audio Summary" />
      <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs" disabled={generating} onClick={() => ai('audioScript')}>
        {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Regenerate script
      </Button>
    </div>
  );
}
