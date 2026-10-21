/** Visual lesson blocks. Alt text is required before a lesson can be published. */

export const INTELLIGENCES = [
  'Linguistic',
  'Logical-Mathematical',
  'Spatial',
  'Bodily-Kinaesthetic',
  'Musical',
  'Interpersonal',
  'Intrapersonal',
  'Naturalistic',
] as const;

export type Intelligence = (typeof INTELLIGENCES)[number];

export const VISUAL_BLOCK_IDS = [
  'mindmapImage',
  'comic',
  'infographicImage',
  'revisionPoster',
  'gallery',
  'audioChant',
] as const;

export type VisualBlockId = (typeof VISUAL_BLOCK_IDS)[number];

export const VISUAL_LABELS: Record<VisualBlockId, string> = {
  mindmapImage: 'Mind Map image',
  comic: 'Comic strip',
  infographicImage: 'Infographic image',
  revisionPoster: 'Unit revision poster',
  gallery: 'Gallery',
  audioChant: 'Audio chant',
};

export interface VisualMedia {
  src: string;
  alt: string;
  caption?: string;
}

interface VisualBase {
  intelligence?: Intelligence;
}

export interface MindMapImageBlock extends VisualBase {
  kind: 'mindmapImage';
  alt: string;
  src: string;
  caption?: string;
}

export interface ComicBlock extends VisualBase {
  kind: 'comic';
  alt: string;
  title?: string;
  panels: VisualMedia[];
}

export interface InfographicImageBlock extends VisualBase {
  kind: 'infographicImage';
  alt: string;
  src: string;
  caption?: string;
}

export interface RevisionPosterBlock extends VisualBase {
  kind: 'revisionPoster';
  alt: string;
  src: string;
  caption?: string;
}

export interface GalleryBlock extends VisualBase {
  kind: 'gallery';
  alt: string;
  items: VisualMedia[];
}

export interface AudioChantBlock extends VisualBase {
  kind: 'audioChant';
  alt: string;
  src: string;
  transcript: string;
  title?: string;
}

export type VisualBlock =
  | MindMapImageBlock
  | ComicBlock
  | InfographicImageBlock
  | RevisionPosterBlock
  | GalleryBlock
  | AudioChantBlock;

export function isIntelligence(value: string | undefined): value is Intelligence {
  return !!value && (INTELLIGENCES as readonly string[]).includes(value);
}

export function isVisualBlockId(value: string): value is VisualBlockId {
  return (VISUAL_BLOCK_IDS as readonly string[]).includes(value);
}

export function emptyVisualBlock(kind: VisualBlockId): VisualBlock {
  if (kind === 'comic') return { kind, alt: '', panels: [{ src: '', alt: '', caption: '' }] };
  if (kind === 'gallery') return { kind, alt: '', items: [{ src: '', alt: '', caption: '' }] };
  if (kind === 'audioChant') return { kind, alt: '', src: '', transcript: '', title: '' };
  return { kind, alt: '', src: '', caption: '' };
}

export function upsertVisualBlock(blocks: VisualBlock[] | undefined, next: VisualBlock): VisualBlock[] {
  const list = blocks ?? [];
  const index = list.findIndex((block) => block.kind === next.kind);
  if (index < 0) return [...list, next];
  const copy = list.slice();
  copy[index] = next;
  return copy;
}

function missing(label: string, alt: string | undefined): string | null {
  return alt && alt.trim() ? null : `${label} needs alt text before it can be published.`;
}

export function visualPublishErrors(lesson: {
  blocksOrder?: string[];
  visualBlocks?: VisualBlock[];
} | null | undefined): string[] {
  if (!lesson) return [];
  const order = lesson.blocksOrder ?? [];
  const blocks = lesson.visualBlocks ?? [];
  const errors: string[] = [];
  for (const id of order) {
    if (!isVisualBlockId(id)) continue;
    const label = VISUAL_LABELS[id];
    const block = blocks.find((item) => item.kind === id);
    if (!block) {
      errors.push(`${label} needs alt text before it can be published.`);
      continue;
    }
    const top = missing(label, block.alt);
    if (top) errors.push(top);
    if (block.kind === 'comic') {
      block.panels.forEach((panel, index) => {
        const panelAlt = missing(`${label} panel ${index + 1}`, panel.alt);
        if (panelAlt) errors.push(panelAlt);
      });
    }
    if (block.kind === 'gallery') {
      block.items.forEach((item, index) => {
        const itemAlt = missing(`${label} image ${index + 1}`, item.alt);
        if (itemAlt) errors.push(itemAlt);
      });
    }
  }
  return errors;
}
