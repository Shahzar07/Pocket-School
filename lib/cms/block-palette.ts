export interface BlockDef {
  id: string;
  icon: string;
  label: string;
  sparks?: number;
  group: 'Lesson' | 'Practice' | 'Visual';
}

export const BLOCK_DEFS: BlockDef[] = [
  { id: 'objectives', icon: '🎯', label: 'Objectives', group: 'Lesson' },
  { id: 'video', icon: '🎬', label: 'Video', sparks: 15, group: 'Lesson' },
  { id: 'text', icon: '📝', label: 'Lesson Text', group: 'Lesson' },
  { id: 'vocabulary', icon: '📖', label: 'Vocabulary', sparks: 5, group: 'Lesson' },
  { id: 'audio', icon: '🎧', label: 'Audio', sparks: 10, group: 'Lesson' },
  { id: 'slides', icon: '🖼️', label: 'Slides', sparks: 10, group: 'Lesson' },
  { id: 'notes', icon: '🗒️', label: 'Study Notes', sparks: 5, group: 'Lesson' },
  { id: 'summary', icon: '⚡', label: 'Summary', group: 'Lesson' },
  { id: 'activity', icon: '✏️', label: 'Activity', group: 'Practice' },
  { id: 'quiz', icon: '✅', label: 'Quiz', sparks: 5, group: 'Practice' },
  { id: 'assignment', icon: '📋', label: 'Assignment', group: 'Practice' },
  { id: 'assessment', icon: '🏅', label: 'Assessment', group: 'Practice' },
  { id: 'flashcards', icon: '🃏', label: 'Flashcards', sparks: 5, group: 'Practice' },
  { id: 'problems', icon: '🧮', label: 'Problems', sparks: 5, group: 'Practice' },
  { id: 'glossary', icon: '📚', label: 'Glossary', sparks: 5, group: 'Practice' },
  { id: 'unitTest', icon: '🧪', label: 'Unit Test', group: 'Practice' },
  { id: 'image', icon: '🏞️', label: 'Image', group: 'Visual' },
  { id: 'illustration', icon: '🎨', label: 'Illustration', sparks: 15, group: 'Visual' },
  { id: 'mindmap', icon: '🧠', label: 'Mind Map', sparks: 10, group: 'Visual' },
  { id: 'infographic', icon: '📊', label: 'Infographic', sparks: 15, group: 'Visual' },
  { id: 'mindmapImage', icon: '🗺️', label: 'Mind Map image', group: 'Visual' },
  { id: 'comic', icon: '💬', label: 'Comic strip', group: 'Visual' },
  { id: 'infographicImage', icon: '📌', label: 'Infographic image', group: 'Visual' },
  { id: 'revisionPoster', icon: '📰', label: 'Unit revision poster', group: 'Visual' },
  { id: 'gallery', icon: '🎠', label: 'Gallery', group: 'Visual' },
  { id: 'audioChant', icon: '🎵', label: 'Audio chant', group: 'Visual' },
];

/** One entry per block id, grouped for the add-a-block grid. */
export function blockPalette(): { group: BlockDef['group']; defs: BlockDef[] }[] {
  const seen = new Set<string>();
  const groups = new Map<BlockDef['group'], BlockDef[]>();
  for (const def of BLOCK_DEFS) {
    if (seen.has(def.id)) continue;
    seen.add(def.id);
    const list = groups.get(def.group) ?? [];
    list.push(def);
    groups.set(def.group, list);
  }
  return (['Lesson', 'Practice', 'Visual'] as const)
    .filter(group => groups.has(group))
    .map(group => ({ group, defs: groups.get(group) ?? [] }));
}
