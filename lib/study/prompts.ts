import 'server-only';
import { languageInstruction } from '@/lib/languages';

export const LEVEL_HINT = (level?: string) =>
  level ? `The student's level: ${level}. Pitch vocabulary and notation to that level.` : '';

export const lang = (code?: string) => languageInstruction(code ?? 'en');

export const JSON_RULES = `Return ONLY valid JSON — no prose, no code fences. Write maths in LaTeX inside strings using $...$ (inline) or $$...$$ (display), and escape every backslash as \\\\ (for example "$\\\\frac{1}{2}$").`;
