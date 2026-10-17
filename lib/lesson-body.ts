import { imageMarkdown } from '@/components/editor/markdown';
import type { ContentBlock } from '@/components/editor/types';
import type { AiOutputs } from '@/lib/db';

interface BodySource {
  contentSources?: { type: string; value: string }[] | null;
  aiOutputs?: { text?: string } | null;
}

/**
 * The lesson body the editor, generators, and students share.
 * An edited or generated `aiOutputs.text` wins. The content-source text is
 * the same body once the editor has saved, and the fallback for lessons that
 * only have a manuscript.
 */
export function readLessonBody(lesson: BodySource | null | undefined): string {
  const edited = lesson?.aiOutputs?.text?.trim() ?? '';
  if (edited) return lesson?.aiOutputs?.text ?? '';
  return lesson?.contentSources?.find(source => source.type === 'text')?.value ?? '';
}

/** Keep the manuscript and the student-facing text on the same string. */
export function lessonBodyPatch<T extends { aiOutputs?: AiOutputs | null }>(
  lesson: T,
  body: string,
): { contentSources: { type: 'text' | 'url'; value: string }[]; aiOutputs: AiOutputs } {
  const rest = ((lesson as BodySource).contentSources ?? []).filter(source => source.type !== 'text');
  return {
    contentSources: [{ type: 'text', value: body }, ...rest.map(source => ({
      type: source.type === 'url' ? 'url' as const : 'text' as const,
      value: source.value,
    }))],
    aiOutputs: { ...(lesson.aiOutputs ?? {}), text: body },
  };
}

/** Headings from an import become sections of one lesson body. */
export function manuscriptToMarkdown(blocks: Pick<ContentBlock, 'title' | 'body'>[]): string {
  return blocks.map(block => {
    const title = block.title.trim();
    const body = block.body.trim();
    if (!title || title === 'Opening') return body;
    return body ? `## ${title}\n\n${body}` : `## ${title}`;
  }).filter(Boolean).join('\n\n');
}

/** Place a picture that already has alt text. Full-page pictures use the `!full` marker. */
export function appendImageMarkdown(
  body: string,
  image: { alt: string; src: string; caption?: string; fullBleed?: boolean },
): string {
  const line = imageMarkdown(image.alt, image.src, image.caption, Boolean(image.fullBleed));
  return body.trim() ? `${body.trim()}\n\n${line}` : line;
}

/** The illustration prompt starts from the lesson. Short notes stay blank so the author writes the scene. */
export function illustrationBrief(lessonText: string): string {
  const text = lessonText.replace(/\s+/g, ' ').trim();
  if (text.length < 40) return '';
  return text.slice(0, 700);
}

export function bodyHasImage(body: string, src: string | undefined): boolean {
  const url = src?.trim();
  if (!url) return false;
  return body.includes(url);
}

export interface LessonLibraryImage {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
  fullBleed?: boolean;
  storagePath?: string;
}

interface LegacyVisual {
  url?: string;
  alt?: string;
  caption?: string;
}

/**
 * Pictures saved on the old image block (`aiOutputs.image` / `illustration`)
 * join the shared library so they can be placed in the lesson text.
 */
export function includeLegacyVisuals<T extends LessonLibraryImage>(
  images: T[],
  visuals: (LegacyVisual | null | undefined)[],
): T[] {
  const next = [...images];
  for (const visual of visuals) {
    const url = visual?.url?.trim();
    if (!url || next.some(image => image.src === url)) continue;
    const caption = visual?.caption?.trim();
    next.push({
      id: `legacy-${stableId(url)}`,
      src: url,
      alt: visual?.alt?.trim() ?? '',
      width: 1200,
      height: 800,
      ...(caption ? { caption } : {}),
    } as T);
  }
  return next;
}

/**
 * Insert a library picture into the lesson body.
 * When that picture was the old before/after figure, drop the old field
 * so the student does not see it twice.
 */
export function placeImageInLesson<T extends BodySource>(
  lesson: T,
  image: { alt: string; src: string; caption?: string; fullBleed?: boolean },
): { contentSources: { type: 'text' | 'url'; value: string }[]; aiOutputs: AiOutputs } {
  const patched = lessonBodyPatch(lesson, appendImageMarkdown(readLessonBody(lesson), image));
  const outputs: AiOutputs = { ...patched.aiOutputs };
  const imageUrl = (outputs.image as { url?: string } | undefined)?.url;
  const illustrationUrl = (outputs.illustration as { url?: string } | undefined)?.url;
  if (imageUrl && imageUrl === image.src) delete outputs.image;
  if (illustrationUrl && illustrationUrl === image.src) delete outputs.illustration;
  return { ...patched, aiOutputs: outputs };
}

function stableId(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}
