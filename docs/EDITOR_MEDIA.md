# Shared editor and media

Book Studio imports this API. The course CMS uses the same components. There is one implementation, under `components/editor/` and `components/media/`.

## Editor

```ts
import {
  ContentEditor, ImportPanel, VersionHistory,
  useAutosave, readAutosave, writeAutosave, pushRevision,
  importFile, resultFromHtml, resultFromMarkdown,
  htmlToMarkdown, markdownToHtml, splitByHeadings,
} from '@/components/editor';
```

| Export | Role |
|---|---|
| `ContentEditor` | Visual editor. The stored value stays markdown. Paste from Word, Google Docs, or a web page keeps formatting via `htmlToMarkdown`. Two or more headings are returned through `onManuscript` so the host can split them into lessons or sections. Clipboard images go to `onPasteImages`. |
| `ImportPanel` | Drop or pick `.docx`, `.md`, `.txt`, `.pdf`, or `.epub`. |
| `importFile` | Same import, without the panel. |
| `splitByHeadings` | Turns a manuscript into `{ title, body }[]`. |
| `useAutosave(key, value)` | Debounced `localStorage` draft. |
| `readAutosave(key)` | The last device draft, or null. |
| `writeAutosave(key, value)` | Immediate device draft. The CMS calls this when Firestore rejects a save. |
| `pushRevision` / `VersionHistory` | View and restore earlier copies on this device. |

`LessonManuscript` in `components/lesson-manuscript.tsx` is the course host: editor, import, device draft, and version history.

## Media

```ts
import {
  ImageLibrary, IllustrationPrompt, CoverArtPicker,
  storeMedia, recordMediaAsset, listSharedMedia,
  generateIllustration, generateCoverArt, optimiseImage,
} from '@/components/media';
```

| Export | Role |
|---|---|
| `ImageLibrary` | Drag-drop, file picker, and clipboard paste. Crop, caption, full-bleed. Alt text is required before `onInsert`. Lists Firestore pictures for the same `scopeId`. |
| `storeMedia(scopeId, blob, name)` | Uploads to Storage `media/{scopeId}/{name}`. A signed-out session or a rejected write returns a data URL. |
| `recordMediaAsset(scopeId, asset)` | Writes `media_assets/{id}` so another lesson or chapter can reuse the picture. |
| `listSharedMedia(scopeId)` | Reads that library. |
| `IllustrationPrompt` | Prompt and style. Calls `confirmSparks({ cost, reason })` when the host passes it, otherwise `window.confirm`. `onCreated` receives the picture. |
| `CoverArtPicker` | Several text-free covers from a brief and a style. Courses store the choice as `thumbnailUrl`. Books can use the same picker. |
| `optimiseImage` | Longest edge 1600, JPEG. |

Illustration Sparks in the course CMS are 15, charged after a successful picture. A stand-in (the note contains "stand-in") is not charged.

## Who can use it

`hasCmsAddon(profile)` in `lib/entitlements.ts` is true for a platform admin, and for anyone whose permissions include `addon:cms`. Access allocation grants that permission. The price lives with the other add-ons.
