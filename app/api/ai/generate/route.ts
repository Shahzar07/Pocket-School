import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { content, format } = await req.json();
    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

    const prompts: Record<string, string> = {
      text: `You are an expert educator. Transform the following content into a comprehensive, well-structured lesson in Markdown format. Use headings, bullet points, bold key terms, tables where helpful, and practical examples. Make it engaging and thorough.\n\nContent:\n${content}`,
      flashcards: `You are a study expert. Create 6-10 high-quality flashcards from the following content. Return ONLY a valid JSON array of objects with "question" and "answer" fields. Each answer should be 1-3 sentences.\n\nContent:\n${content}\n\nReturn only the JSON array, no other text.`,
      quiz: `You are an assessment expert. Create 4-6 multiple-choice quiz questions from the following content. Return ONLY a valid JSON array of objects with fields: "question" (string), "options" (array of 4 strings), "answer" (string matching one option exactly), "explanation" (string explaining why the answer is correct).\n\nContent:\n${content}\n\nReturn only the JSON array, no other text.`,
      slides: `You are a presentation designer. Create 5-7 presentation slides from the following content. Return ONLY a valid JSON array of objects with "title" (string) and "bullets" (array of 3-5 concise strings) fields.\n\nContent:\n${content}\n\nReturn only the JSON array, no other text.`,
      notes: `You are a study notes expert. Create concise, well-structured study notes from the following content in Markdown format. Include key terms in bold, use bullet points, and add memory aids or mnemonics where helpful.\n\nContent:\n${content}`,
      summary: `You are an expert summariser. Write a concise 3-5 sentence summary of the following content that captures all the essential information. Use clear, accessible language.\n\nContent:\n${content}`,
      problems: `You are a practice problems creator. Create 5 practice problems from the following content. Mix difficulty levels. For each problem, provide the problem statement and a detailed worked solution. Format in Markdown.\n\nContent:\n${content}`,
      glossary: `You are a vocabulary expert. Extract 6-10 key terms from the following content and provide clear, concise definitions. Return ONLY a valid JSON array of objects with "term" and "definition" fields.\n\nContent:\n${content}\n\nReturn only the JSON array, no other text.`,
      mindmap: `You are a mind mapping expert. Create a text-based mind map of the following content using Markdown. Use nested bullet points to show relationships, with the main topic at the top and subtopics branching below.\n\nContent:\n${content}`,
      infographic: `You are a visual learning expert. Create a structured text-based infographic outline for the following content in Markdown. Use clear sections, statistics or key facts in callout boxes (using blockquotes), and visual separators.\n\nContent:\n${content}`,
    };

    const prompt = prompts[format];
    if (!prompt) return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text ?? '';

    // Parse JSON formats
    if (['flashcards', 'quiz', 'slides', 'glossary'].includes(format)) {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ result: parsed });
        } catch {
          return NextResponse.json({ result: text });
        }
      }
    }

    return NextResponse.json({ result: text });
  } catch (err: any) {
    console.error('AI generate error:', err);
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}
