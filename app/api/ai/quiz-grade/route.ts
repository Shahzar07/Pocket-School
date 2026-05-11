import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, FAST_MODEL } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  try {
    const { question, correctAnswer, studentAnswer, explanation } = await req.json();
    if (!question || !correctAnswer || studentAnswer === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // Fallback: simple string match
    const correct = String(studentAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
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
