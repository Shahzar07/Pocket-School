import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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

Grade the student's answer. If it's a multiple-choice question, check if the answers match exactly (case-insensitive). For short-answer questions, check if the student's answer demonstrates understanding of the key concept, even if worded differently.

Respond with ONLY a JSON object with these fields:
- "correct": boolean
- "score": number (0 or 1)
- "feedback": string (1-2 encouraging sentences explaining why the answer is right or wrong and what to remember)`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json(parsed);
    }

    // Fallback: simple string match
    const correct = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    return NextResponse.json({
      correct,
      score: correct ? 1 : 0,
      feedback: correct ? 'Correct! Well done.' : `The correct answer is: ${correctAnswer}. ${explanation || ''}`,
    });
  } catch (err: any) {
    console.error('Quiz grade error:', err);
    return NextResponse.json({ error: err.message || 'Grading failed' }, { status: 500 });
  }
}
