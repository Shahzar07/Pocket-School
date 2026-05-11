import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, SMART_MODEL } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  const { content, assignmentTitle } = await req.json();

  if (!content || content.trim().length < 50) {
    return NextResponse.json({ aiScore: 0, plagiarismScore: 0, flags: [], recommendation: 'Content too short to analyse.' });
  }

  try {
    const raw = await callOpenRouter([
      { role: 'system', content: 'You are an academic integrity analysis tool. Respond only with valid JSON, no markdown.' },
      { role: 'user', content: `Analyse this student submission for academic integrity concerns.\n\nAssignment: ${assignmentTitle ?? 'Unknown'}\nSubmission:\n"""\n${content.slice(0, 3000)}\n"""\n\nReturn JSON:\n{"aiScore":<0-100>,"plagiarismScore":<0-100>,"flags":[<up to 4 strings>],"recommendation":"<one sentence>"}` },
    ], { model: SMART_MODEL, temperature: 0.2 });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      aiScore: Math.min(100, Math.max(0, result.aiScore ?? 0)),
      plagiarismScore: Math.min(100, Math.max(0, result.plagiarismScore ?? 0)),
      flags: Array.isArray(result.flags) ? result.flags.slice(0, 4) : [],
      recommendation: result.recommendation ?? 'Manual review recommended.',
    });
  } catch {
    return NextResponse.json({ aiScore: 0, plagiarismScore: 0, flags: ['Analysis failed'], recommendation: 'Please review manually.' });
  }
}
