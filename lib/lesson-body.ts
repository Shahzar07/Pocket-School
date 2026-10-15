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
