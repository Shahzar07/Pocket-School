import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, FAST_MODEL } from '@/lib/openrouter';

/** Legacy quizzes stored letter answers ("A") while students select option
 * text — resolve either form to the same comparable string. */
function normalizeAnswer(answer: string, options?: string[]): string {
  const a = String(answer ?? '').trim();
  if (options && Array.isArray(options)) {
    const exact = options.find(o => String(o).trim().toLowerCase() === a.toLowerCase());
    if (exact) return String(exact).trim().toLowerCase();
    const idx = 'ABCD'.indexOf(a.toUpperCase());
    if (a.length === 1 && idx >= 0 && idx < options.length) {
      return String(options[idx]).trim().toLowerCase();
    }
  }
  return a.toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const { question, correctAnswer, studentAnswer, explanation, options } = await req.json();
    if (!question || !correctAnswer || studentAnswer === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Deterministic path first: if the normalized answers match (or clearly
    // don't, for multiple-choice with known options), no AI call is needed.
    const normCorrect = normalizeAnswer(correctAnswer, options);
    const normStudent = normalizeAnswer(studentAnswer, options);
    if (normStudent === normCorrect) {
      return NextResponse.json({ correct: true, score: 1, feedback: 'Correct! Well done.' });
    }
    if (options && Array.isArray(options) && options.length > 0) {
      return NextResponse.json({
        correct: false,
        score: 0,
        feedback: `Not quite. The correct answer is: ${correctAnswer}. ${explanation ?? ''}`.trim(),
      });
    }

    const prompt = `You are a fair, encouraging quiz grader.

Question: "${question}"
Correct Answer: "${correctAnswer}"
Student's Answer: "${studentAnswer}"
${explanation ? `Explanation: "${explanation}"` : ''}

Grade the student's answer. For multiple-choice, check if the answers match exactly (case-insensitive). For short-answer, check if the student demonstrates understanding of the key concept, even if worded differently.

Respond with ONLY a JSON object — no other text:
{"correct":true,"score":1,"feedback":"...1-2 encouraging sentences..."}`;

    const text = await callOpenRouter(
      [{ role: 'user', content: prompt }],
      { model: FAST_MODEL, temperature: 0.3 }
    );

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      } catch { /* fall through */ }
    }

    // Fallback: normalized string match
    const correct = normStudent === normCorrect;
    return NextResponse.json({
      correct,
      score: correct ? 1 : 0,
      feedback: correct ? 'Correct! Well done.' : `The correct answer is: ${correctAnswer}. ${explanation ?? ''}`,
    });
  } catch (err: any) {
    console.error('[quiz-grade]', err);
    return NextResponse.json({ error: err.message || 'Grading failed' }, { status: 500 });
  }
}
