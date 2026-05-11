import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, SMART_MODEL } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  const { studentName, courseTitle, avgScore, submissionCount } = await req.json();

  const grade = avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F';

  try {
    const comment = await callOpenRouter([
      { role: 'system', content: 'You are a professional teacher writing short report card comments. Be warm, specific, and encouraging. Write exactly 2-3 sentences. No headings or labels.' },
      { role: 'user', content: `Write a report card comment for:\nStudent: ${studentName}\nCourse: ${courseTitle}\nAverage: ${avgScore.toFixed(1)}% (Grade ${grade})\nAssessments completed: ${submissionCount}` },
    ], { model: SMART_MODEL });
    return NextResponse.json({ comment: comment.trim() });
  } catch {
    return NextResponse.json({ comment: `${studentName} has shown dedication throughout ${courseTitle}. With an average of ${avgScore.toFixed(1)}%, they demonstrate solid understanding of the material and are encouraged to keep building on this foundation.` });
  }
}
