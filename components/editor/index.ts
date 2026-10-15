/**
 * Shared manuscript editor.
 *
 * PR #52 owns this folder (`components/editor/`). Poket Reads consumes it
 * from Book Studio and does not keep a second editor. The course CMS should
 * adopt the same imports:
 *
 * ```
 * import { ContentEditor, ImportPanel, VersionHistory, useAutosave } from '@/components/editor';
 * import { pushRevision } from '@/components/editor';
 * ```
 *
 * Map a lesson body onto `ContentBlock` (`title` + markdown `body`).
 * `Lesson.contentSources` text is that body. Replace `components/rich-text-editor.tsx`
 * at the call site when the CMS is ready; do not fork these files.
 *
 * Public surface:
 * - `ContentEditor` — WYSIWYG markdown, paste from Word/Docs/HTML, image paste hook
 * - `ImportPanel` — file drop (.docx .md .txt .pdf .epub) and paste, cleanup preview, heading split
 * - `importFile` / `resultFromHtml` / `resultFromMarkdown`
 * - `htmlToMarkdown`, `markdownToHtml`, `splitByHeadings`, `cleanupMarkdown`, `imageMarkdown`
 * - `useAutosave`, `readAutosave`, `pushRevision`, `VersionHistory`
 */
export type { ContentBlock, ContentOrigin, ContentRevision, ImportResult, ImportWarning } from './types';
export { cleanupMarkdown, htmlToMarkdown, imageMarkdown, importWarnings, looksLikeManuscript, markdownToHtml, splitByHeadings } from './markdown';
export { importFile, resultFromHtml, resultFromMarkdown } from './import-file';
export { ContentEditor } from './content-editor';
export { ImportPanel } from './import-panel';
export { VersionHistory } from './version-history';
export { useAutosave, readAutosave } from './use-autosave';
export { pushRevision } from './versions';
