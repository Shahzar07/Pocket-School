import { parseLatexJson } from '@/lib/latex-json';
import { correctIndex } from '@/lib/quiz-answer';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
  voice?: boolean;
}

export interface QuizItem {
  kind: 'quiz';
  id: number;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  chosen?: string;
}

export interface ProblemItem {
  kind: 'problem';
  id: number;
  prompt: string;
  hint?: string;
  solution?: string;
  submitted?: boolean;
}

export type BoardItem = QuizItem | ProblemItem;

/** Pull quiz and problem blocks out of a teacher reply. Malformed JSON stays visible. */
export function extractBoardItems(text: string, nextId: () => number): { prose: string; items: BoardItem[] } {
  const items: BoardItem[] = [];
  const prose = text.replace(/```(QUIZ|PROBLEM)\s*\n?([\s\S]*?)```/g, (full, kind: string, body: string) => {
    try {
      const data = parseLatexJson<{
        question?: string;
        options?: unknown[];
        answer?: string;
        explanation?: string;
        prompt?: string;
        hint?: string;
        solution?: string;
      }>(body.trim());
      if (kind === 'QUIZ' && data.question && Array.isArray(data.options)) {
        const options = data.options.map(String);
        const idx = correctIndex(options, String(data.answer ?? ''));
        items.push({
          kind: 'quiz',
          id: nextId(),
          question: data.question,
          options,
          answer: idx >= 0 ? options[idx] : String(data.answer ?? ''),
          explanation: data.explanation,
        });
        return '';
      }
      if (kind === 'PROBLEM' && data.prompt) {
        items.push({ kind: 'problem', id: nextId(), prompt: data.prompt, hint: data.hint, solution: data.solution });
        return '';
      }
    } catch {
      /* leave a malformed block visible */
    }
    return full;
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { prose, items };
}

export const TEACHER_QUICK_PROMPTS = [
  { id: 'quiz', label: 'Quiz me', prompt: 'Give me a short quiz on what we just covered (or your subject if we just started).' },
  { id: 'problem', label: 'Practice problem', prompt: 'Give me one practice problem to solve on the board.' },
  { id: 'simpler', label: 'Explain simpler', prompt: 'Explain that again more simply, with an everyday example.' },
  { id: 'topic', label: 'New topic', prompt: 'Suggest three topics you could teach me right now, briefly.' },
] as const;

export function transcriptText(teacherName: string, messages: readonly ChatMessage[]): string {
  return messages.map(message => `${message.role === 'user' ? 'Student' : teacherName}: ${message.text}`).join('\n\n');
}
