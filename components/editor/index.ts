/**
 * Shared manuscript editor. Book Studio (PR #55) imports this folder.
 * Do not add a second editor under `app/reads` or `components/reads`.
 * The documented API is `docs/EDITOR_MEDIA.md`.
 *
 * ```
 * import { ContentEditor, ImportPanel, VersionHistory, useAutosave, writeAutosave } from '@/components/editor';
 * import { pushRevision } from '@/components/editor';
 * ```
 *
 * Map a lesson or chapter body onto `ContentBlock` (`title` + markdown `body`).
 * The stored value stays markdown.
 *
 * Public surface:
 * - `ContentEditor` — WYSIWYG markdown, paste from Word/Docs/HTML, image paste hook
 * - `ImportPanel` — file drop (.docx .md .txt .pdf .epub) and paste, cleanup preview, heading split
 * - `importFile` / `resultFromHtml` / `resultFromMarkdown`
 * - `htmlToMarkdown`, `markdownToHtml`, `splitByHeadings`, `cleanupMarkdown`, `imageMarkdown`
 * - `useAutosave`, `readAutosave`, `writeAutosave`, `pushRevision`, `VersionHistory`
 */
export type { ContentBlock, ContentOrigin, ContentRevision, ImportResult, ImportWarning } from './types';
export { cleanupMarkdown, htmlToMarkdown, imageMarkdown, importWarnings, looksLikeManuscript, markdownToHtml, splitByHeadings } from './markdown';
export { importFile, resultFromHtml, resultFromMarkdown } from './import-file';
export { ContentEditor } from './content-editor';
export { ImportPanel } from './import-panel';
export { VersionHistory } from './version-history';
export { useAutosave, readAutosave, writeAutosave } from './use-autosave';
export { pushRevision } from './versions';
