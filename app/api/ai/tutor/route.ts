import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, SMART_MODEL } from '@/lib/openrouter';

export const maxDuration = 60;

const MODE_INSTRUCTIONS: Record<string, string> = {
  k12: 'You are a friendly, encouraging AI tutor for school students (K-12). Use simple, clear language with relatable analogies and everyday examples. Be positive and supportive. Break down complex ideas step by step.',
  college: 'You are a rigorous academic AI tutor for university students. Use precise academic language, reference relevant theories and models, and encourage critical thinking. Structure your responses with logical flow.',
  professional: 'You are a concise, efficient AI tutor for professionals. Get straight to the point. Use industry-standard terminology. Focus on practical application and real-world relevance.',
  legal: 'You are a legal AI tutor. Use the IRAC method (Issue, Rule, Application, Conclusion) for problem questions. Reference relevant legislation and case law. Use OSCOLA citation format.',
};

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  zh: 'Chinese (Simplified)', hi: 'Hindi', ur: 'Urdu', tr: 'Turkish',
  ja: 'Japanese', ko: 'Korean', it: 'Italian', ru: 'Russian', sw: 'Swahili',
};

/** Interactive-classroom protocol: lets the model drop structured quiz and
 * practice-problem blocks that the session UI renders as live cards. */
const WORKBOARD_PROTOCOL = `

You are teaching in an interactive classroom with a shared WORKBOARD. Teach like an experienced, world-class teacher: one concept at a time, short clear explanations, frequent checks for understanding, real examples, and lots of encouragement.

WORKBOARD BLOCKS — when you want the student to practise, embed blocks in EXACTLY these formats (valid JSON on one line inside the fence):

\`\`\`QUIZ
{"question":"...","options":["first option","second option","third option","fourth option"],"answer":"exact text of the correct option","explanation":"why it is correct"}
\`\`\`

\`\`\`PROBLEM
{"prompt":"the exercise or maths problem to solve","hint":"one small hint","solution":"the fully worked solution"}
\`\`\`

Rules:
- After explaining a concept, usually add ONE quiz or problem block to check understanding.
- When the student submits an answer for checking: give a clear verdict first ("Correct!" or "Not quite"), then pinpoint the EXACT step where they went wrong, re-teach just that step with a tiny example, then offer one similar follow-up problem.
- Use LaTeX for all mathematics.
- Keep the prose part conversational and brief — it is spoken aloud.`;

export async function POST(req: NextRequest) {
  try {
    const { message, mode, lessonContext, history, language, persona, workboard, stream } = await req.json();
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

    const modeInstruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.college;
    const contextBlock = lessonContext
      ? `\n\nCurrent lesson context the student is studying: "${lessonContext}"\nWhen relevant, relate your explanations to this topic.`
      : '';

    // A named teacher persona overrides the default POCO identity.
    const identity = persona
      ? `You are ${persona}. Stay fully in character as this teacher — warm, expert, and encouraging.`
      : `You are POCO, Pocket School's intelligent AI learning companion. You are warm, sharp, and genuinely invested in the student's understanding. Refer to yourself as POCO if asked your name.`;

    const langInstruction = language && language !== 'en' && LANG_NAMES[language]
      ? `\n\nIMPORTANT: Reply ENTIRELY in ${LANG_NAMES[language]}. Every sentence of your response must be in ${LANG_NAMES[language]}, unless quoting a technical term that has no translation.`
      : '';

    const systemPrompt = `${identity}\n\n${modeInstruction}${contextBlock}\n\nGuide students to answers using the Socratic method — ask leading questions when appropriate rather than giving direct answers. Be encouraging. Keep replies conversational and not too long.\n\nWhen responding about mathematics, science, or any topic involving equations or formulas, use LaTeX notation: inline math with $...$ and display math with $$...$$. For example: $E = mc^2$, $\\frac{a}{b}$, $$\\int_0^1 f(x)\\,dx$$${workboard ? WORKBOARD_PROTOCOL : ''}${langInstruction}`;

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

    if (stream) {
      // Real-time streaming: proxy OpenRouter SSE deltas as plain text chunks
      // so the client can render the reply token by token.
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY is not set' }, { status: 500 });
      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pocket-school.app',
          'X-Title': 'Pocket School',
        },
        body: JSON.stringify({
          model: SMART_MODEL,
          models: [SMART_MODEL, 'z-ai/glm-4.6', 'google/gemini-2.0-flash-001'],
          reasoning: { effort: 'low' },
          max_tokens: 4096,
          stream: true,
          messages,
        }),
      });
      if (!upstream.ok || !upstream.body) {
        const err = await upstream.text().catch(() => '');
        return NextResponse.json({ error: `Upstream ${upstream.status}: ${err.slice(0, 200)}` }, { status: 502 });
      }

      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      const transformed = new ReadableStream({
        async start(controller) {
          const reader = upstream.body!.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith('data:')) continue;
                const payload = t.slice(5).trim();
                if (payload === '[DONE]') continue;
                try {
                  const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
                  if (delta) controller.enqueue(encoder.encode(delta));
                } catch { /* ignore keep-alive/comment lines */ }
              }
            }
          } finally {
            controller.close();
          }
        },
      });
      return new Response(transformed, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const reply = await callOpenRouter(messages, { model: SMART_MODEL });
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('[tutor]', err);
    return NextResponse.json({ error: err.message || 'AI tutor failed' }, { status: 500 });
  }
}
