'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BLOOMS } from '@/components/builder-blocks';
import { INTELLIGENCES, isIntelligence, type Intelligence } from '@/lib/visual-blocks';
import {
  emptyUnitTest, parseUnitTestImport, type UnitTestContent, type UnitTestQuestion, type UnitTestVersion,
} from '@/lib/unit-test';
import type { Lesson } from '@/lib/db';

function blankQuestion(index: number): UnitTestQuestion {
  return {
    id: `q-${Date.now().toString(36)}-${index}`,
    prompt: '',
    options: [
      { id: 'opt:0', text: '' },
      { id: 'opt:1', text: '' },
      { id: 'opt:2', text: '' },
      { id: 'opt:3', text: '' },
    ],
    answerId: 'opt:0',
    marks: 1,
    bloom: 'Understand',
    lessonId: '',
  };
}

export function UnitTestEditor({
  value, lessons, coursePassMark, unitPassMark, finalAssessment, onChange, onUnitPassMark, onFinalAssessment,
}: {
  value: UnitTestContent | undefined;
  lessons: Lesson[];
  coursePassMark: number;
  unitPassMark?: number;
  finalAssessment?: boolean;
  onChange: (value: UnitTestContent) => void;
  onUnitPassMark: (value: number | null) => void;
  onFinalAssessment: (value: boolean) => void;
}) {
  const content = value ?? emptyUnitTest();
  const [raw, setRaw] = useState('');
  const [notice, setNotice] = useState('');
  const lessonChoices = lessons.filter((lesson) => lesson.lessonType !== 'unit_test' && !lesson.isUnitQuiz);

  const setVersion = (version: UnitTestVersion, questions: UnitTestQuestion[]) => {
    onChange({ ...content, [version === 'A' ? 'versionA' : 'versionB']: questions });
  };

  const applyImport = async (text: string) => {
    const parsed = parseUnitTestImport(text);
    if (parsed.errors.length) {
      setNotice(parsed.errors[0] ?? 'Import failed.');
      return;
    }
    onChange({ ...content, ...parsed.content, versionA: parsed.content.versionA, versionB: parsed.content.versionB });
    if (parsed.passMark != null) onUnitPassMark(parsed.passMark);
    setNotice(`Imported ${parsed.content.versionA.length} Version A and ${parsed.content.versionB.length} Version B questions.`);
  };

  const readFile = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      await applyImport(result.value);
      return;
    }
    await applyImport(await file.text());
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Questions carry marks, a Bloom level, and the lesson they revise. Version A is the first paper. A fail locks this test until those lessons are completed again, then the learner sits Version B.
      </p>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={finalAssessment === true} onChange={(e) => onFinalAssessment(e.target.checked)} className="accent-teal-500" />
        Course final assessment. A certificate is issued only when this is passed and every unit is passed.
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Unit pass mark %
          <Input
            type="number"
            min={1}
            max={100}
            value={unitPassMark ?? ''}
            placeholder={String(coursePassMark)}
            onChange={(event) => onUnitPassMark(event.target.value ? Number(event.target.value) : null)}
            className="mt-1 h-9 w-24 rounded-xl text-sm"
          />
        </label>
        <p className="text-[11px] text-muted-foreground pb-2">Blank uses the course mark ({coursePassMark}%).</p>
        <label className="text-xs text-muted-foreground flex-1 min-w-48">
          Multiple intelligence (optional)
          <select
            value={content.intelligence ?? ''}
            onChange={(event) => onChange({
              ...content,
              ...(isIntelligence(event.target.value) ? { intelligence: event.target.value as Intelligence } : { intelligence: undefined }),
            })}
            className="mt-1 w-full h-9 rounded-xl border border-border bg-card px-2 text-sm"
          >
            <option value="">No tag</option>
            {INTELLIGENCES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <VersionList label="Version A" questions={content.versionA} lessons={lessonChoices} onChange={(rows) => setVersion('A', rows)} />
      <VersionList label="Version B" questions={content.versionB} lessons={lessonChoices} onChange={(rows) => setVersion('B', rows)} />

      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bulk import</p>
        <p className="text-[11px] text-muted-foreground">JSON, CSV, or a DOCX that contains that JSON. Schema: docs/unit-test-schema.md.</p>
        <Textarea value={raw} onChange={(event) => setRaw(event.target.value)} placeholder="Paste JSON or CSV" className="min-h-24 rounded-xl text-xs font-mono" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => void applyImport(raw)}>Import pasted text</Button>
          <label className="text-xs font-semibold px-3 py-2 rounded-xl border border-border cursor-pointer">
            Upload file
            <input
              type="file"
              accept=".json,.csv,.txt,.docx,application/json,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>
        </div>
        {notice && <p className="text-xs text-foreground">{notice}</p>}
      </div>
    </div>
  );
}

function VersionList({
  label, questions, lessons, onChange,
}: {
  label: string;
  questions: UnitTestQuestion[];
  lessons: Lesson[];
  onChange: (questions: UnitTestQuestion[]) => void;
}) {
  const patch = (index: number, next: Partial<UnitTestQuestion>) => {
    onChange(questions.map((question, i) => (i === index ? { ...question, ...next } : question)));
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</h3>
        <Button type="button" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => onChange([...questions, blankQuestion(questions.length)])}>
          Add question
        </Button>
      </div>
      {questions.length === 0 && <p className="text-xs text-muted-foreground">No questions yet.</p>}
      {questions.map((question, index) => (
        <div key={question.id} className="rounded-xl border border-border p-3 space-y-2">
          <Textarea value={question.prompt} onChange={(event) => patch(index, { prompt: event.target.value })} placeholder={`Question ${index + 1}`} className="min-h-16 rounded-xl text-sm" />
          <div className="grid sm:grid-cols-2 gap-2">
            {question.options.map((option, optionIndex) => (
              <label key={option.id} className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name={`${question.id}-answer`}
                  checked={question.answerId === option.id}
                  onChange={() => patch(index, { answerId: option.id })}
                />
                <Input
                  value={option.text}
                  onChange={(event) => patch(index, {
                    options: question.options.map((item, i) => (i === optionIndex ? { ...item, text: event.target.value } : item)),
                  })}
                  placeholder={`Option ${optionIndex + 1}`}
                  className="h-8 rounded-lg text-xs"
                />
              </label>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input type="number" min={1} value={question.marks} onChange={(event) => patch(index, { marks: Number(event.target.value) || 1 })} className="h-8 rounded-lg text-xs" />
            <select value={question.bloom} onChange={(event) => patch(index, { bloom: event.target.value })} className="h-8 rounded-lg border border-border bg-card px-2 text-xs">
              {BLOOMS.map((bloom) => <option key={bloom}>{bloom}</option>)}
            </select>
            <select value={question.lessonId} onChange={(event) => patch(index, { lessonId: event.target.value })} className="h-8 rounded-lg border border-border bg-card px-2 text-xs">
              <option value="">Lesson this question revises</option>
              {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </div>
          <Button type="button" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => onChange(questions.filter((_, i) => i !== index))}>
            Remove
          </Button>
        </div>
      ))}
    </section>
  );
}
