import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODE_INSTRUCTIONS: Record<string, string> = {
  'k12': 'You are a friendly, encouraging AI tutor for school students (K-12). Use simple, clear language. Include relatable analogies and examples from everyday life. Use emojis sparingly to keep it engaging. Break down complex ideas into small steps. Always be positive and supportive.',
  'college': 'You are a rigorous academic AI tutor for university students. Use precise academic language. Reference relevant theories, models, and scholarly concepts. Structure your responses clearly with logical flow. Encourage critical thinking.',
  'professional': 'You are a concise, efficient AI tutor for professionals. Get straight to the point. Use industry-standard terminology. Focus on practical application and real-world relevance. Be direct and time-efficient.',
  'legal': 'You are a legal AI tutor. Use the IRAC method (Issue, Rule, Application, Conclusion) for problem questions. Use OSCOLA citation format. Be precise and reference relevant legislation, case law, and legal principles. Maintain professional legal tone.',
};

export async function POST(req: NextRequest) {
  try {
    const { message, mode, lessonContext, history } = await req.json();
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

    const modeInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS['college'];
    const contextBlock = lessonContext
      ? `\n\nCurrent lesson context: "${lessonContext}"\nWhen relevant, relate your explanations to this topic.`
      : '';

    const systemInstruction = `${modeInstruction}${contextBlock}\n\nIMPORTANT: Guide students to answers using the Socratic method — ask leading questions rather than giving answers directly when appropriate. After providing information, always add: [Source: based on the lesson material provided]`;

    const contents = [
      ...(history || []).map((h: { role: string; text: string }) => ({
        role: h.role as 'user' | 'model',
        parts: [{ text: h.text }],
      })),
      { role: 'user' as const, parts: [{ text: message }] },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: { systemInstruction },
    });

    return NextResponse.json({ reply: response.text ?? '' });
  } catch (err: any) {
    console.error('AI tutor error:', err);
    return NextResponse.json({ error: err.message || 'AI tutor failed' }, { status: 500 });
  }
}
