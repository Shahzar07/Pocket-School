import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, SMART_MODEL } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  let studentName = 'The student';
  let courseTitle = 'this course';
  let avgScore = 0;
  let submissionCount = 0;
  let period = '';
  try {
    const body = await req.json();
    studentName = body.studentName || studentName;
    courseTitle = body.courseTitle || courseTitle;
    avgScore = Number.isFinite(Number(body.avgScore)) ? Number(body.avgScore) : 0;
    submissionCount = Number(body.submissionCount) || 0;
    period = String(body.period ?? '').slice(0, 80);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const grade = avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F';

  try {
    const comment = await callOpenRouter([
      { role: 'system', content: 'You are a professional teacher writing short report card comments. Be warm, specific, and encouraging. Write exactly 2-3 sentences. No headings or labels.' },
      {
        role: 'user',
        content:
          `Write a report card comment for:\nStudent: ${studentName}\nCourse: ${courseTitle}\n` +
          `Average: ${avgScore.toFixed(1)}% (Grade ${grade})\nAssessments completed: ${submissionCount}` +
          // Without this the comment reads as a whole-year summary even when the
          // teacher scoped the report to a single term.
          (period && period !== 'All time'
            ? `\nReporting period: ${period}\nRefer to this period, not the whole year.`
            : ''),
      },
    ], { model: SMART_MODEL });
    return NextResponse.json({ comment: comment.trim() });
  } catch {
    return NextResponse.json({ comment: `${studentName} has shown dedication throughout ${courseTitle}. With an average of ${avgScore.toFixed(1)}%, they demonstrate solid understanding of the material and are encouraged to keep building on this foundation.` });
  }
}
