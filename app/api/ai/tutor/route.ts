import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, SMART_MODEL } from '@/lib/openrouter';

const MODE_INSTRUCTIONS: Record<string, string> = {
  k12: 'You are a friendly, encouraging AI tutor for school students (K-12). Use simple, clear language with relatable analogies and everyday examples. Be positive and supportive. Break down complex ideas step by step.',
  college: 'You are a rigorous academic AI tutor for university students. Use precise academic language, reference relevant theories and models, and encourage critical thinking. Structure your responses with logical flow.',
  professional: 'You are a concise, efficient AI tutor for professionals. Get straight to the point. Use industry-standard terminology. Focus on practical application and real-world relevance.',
  legal: 'You are a legal AI tutor. Use the IRAC method (Issue, Rule, Application, Conclusion) for problem questions. Reference relevant legislation and case law. Use OSCOLA citation format.',
};

export async function POST(req: NextRequest) {
  try {
    const { message, mode, lessonContext, history } = await req.json();
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

    const modeInstruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.college;
    const contextBlock = lessonContext
      ? `\n\nCurrent lesson context the student is studying: "${lessonContext}"\nWhen relevant, relate your explanations to this topic.`
      : '';

    const systemPrompt = `You are POCO, Pocket School's intelligent AI learning companion. You are warm, sharp, and genuinely invested in the student's understanding. Refer to yourself as POCO if asked your name.\n\n${modeInstruction}${contextBlock}\n\nGuide students to answers using the Socratic method — ask leading questions when appropriate rather than giving direct answers. Be encouraging.\n\nWhen responding about mathematics, science, or any topic involving equations or formulas, use LaTeX notation: inline math with $...$ and display math with $$...$$. For example: $E = mc^2$, $\\frac{a}{b}$, $$\\int_0^1 f(x)\\,dx$$`;

    // Cap history so long chats can't blow past the model context / budget.
    const cappedHistory = (Array.isArray(history) ? history : []).slice(-12);
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...cappedHistory.map((h: { role: string; text: string }) => ({
        role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: String(h.text ?? '').slice(0, 4000),
      })),
      { role: 'user', content: String(message).slice(0, 8000) },
    ];

    const reply = await callOpenRouter(messages, { model: SMART_MODEL });
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('[tutor]', err);
    return NextResponse.json({ error: err.message || 'AI tutor failed' }, { status: 500 });
  }
}
