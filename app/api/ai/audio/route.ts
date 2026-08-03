import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

/** Gemini TTS returns raw 16-bit PCM at 24 kHz mono — wrap it in a WAV
 * container so browsers can play it natively. */
function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Strip markdown so the voice doesn't read symbols aloud. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[VISUAL:[^\]]*\]/gi, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\$\$?[^$]*\$\$?/g, (m) => m.replace(/[\\${}^_]/g, ' '))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Prebuilt Gemini TTS voices. Each AI teacher is pinned to one of these so
 * students can recognise who is speaking without looking at the screen. */
const VOICES = [
  'Kore', 'Puck', 'Charon', 'Aoede', 'Leda', 'Zephyr',
  'Fenrir', 'Orus', 'Iapetus',
] as const;

/**
 * POST /api/ai/audio — generate real spoken audio for a script with Gemini TTS.
 *
 * Body: { script: string, voice?: string, style?: string }
 * `style` is a natural-language delivery direction ("warm, unhurried…") that
 * Gemini TTS applies to the reading — it is never spoken aloud.
 * Success → streamed audio/wav binary.
 * No GEMINI_API_KEY or provider failure → 200 JSON { fallback: true } so the
 * client can degrade to browser SpeechSynthesis instead of erroring.
 */
export async function POST(req: NextRequest) {
  let script = '';
  let voice: string = 'Kore';
  let style = '';
  try {
    const body = await req.json();
    script = (body.script ?? '').toString();
    if (body.voice && (VOICES as readonly string[]).includes(body.voice)) voice = body.voice;
    style = (body.style ?? '').toString().slice(0, 300);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!script.trim()) return NextResponse.json({ error: 'script is required' }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ fallback: true, reason: 'TTS not configured' });
  }

  const spoken = cleanForSpeech(script).slice(0, 6000);
  // Style direction goes in as an instruction prefix, which the TTS model
  // interprets as delivery guidance rather than content to read out.
  const text = style ? `${style}\n\nSay this:\n${spoken}` : spoken;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });

    const b64 = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!b64) {
      return NextResponse.json({ fallback: true, reason: 'No audio returned by provider' });
    }

    const wav = pcmToWav(Buffer.from(b64, 'base64'));

    // Stream the WAV so large responses aren't buffered (Vercel 4.5 MB limit
    // applies only to buffered bodies).
    const stream = new ReadableStream({
      start(controller) {
        const CHUNK = 256 * 1024;
        for (let i = 0; i < wav.length; i += CHUNK) {
          controller.enqueue(wav.subarray(i, i + CHUNK));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(wav.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[ai/audio]', err?.message || err);
    // Quota/model errors shouldn't brick the UI — let the client fall back.
    return NextResponse.json({ fallback: true, reason: err?.message || 'TTS failed' });
  }
}
