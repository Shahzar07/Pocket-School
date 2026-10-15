/**
 * Shared pictures: upload, crop, library, AI illustration, AI cover art.
 * Book Studio (PR #55) imports this folder. Book-only behaviour (title overlay,
 * series lock, tile/hero/thumb sizes, age check before publish) stays in Book Studio.
 * The documented API is `docs/EDITOR_MEDIA.md`.
 *
 * ```
 * import { ImageLibrary, IllustrationPrompt, CoverArtPicker, storeMedia, recordMediaAsset } from '@/components/media';
 * ```
 *
 * - `ImageLibrary` — drag-drop, paste, required alt, caption, full-bleed flag, crop, shared library
 * - `IllustrationPrompt` — prompt, style, Sparks confirm, then `onCreated`
 * - `CoverArtPicker` — several text-free pictures from a brief and a style preset
 * - `generateIllustration` / `generateCoverArt` — `/api/media/illustrate` and `/api/media/cover`
 * - `storeMedia(scopeId, blob, name)` — Firebase Storage `media/{scopeId}/{name}`, else a data URL
 * - `recordMediaAsset` / `listSharedMedia` — Firestore `media_assets` metadata for reuse
 * - `optimiseImage` — max edge 1600, JPEG
 *
 * Pass `confirmSparks` when the host must check a real Sparks balance.
 * Omitting it still shows the confirm dialog inside `IllustrationPrompt`.
 */
export type { CoverArtOption, CoverStyleOption, MediaAsset, SparksConfirm, SparksConfirmRequest } from './types';
export { COVER_STYLES } from './types';
export { proceduralArt } from './fallback-art';
export { cropImage, optimiseImage } from './optimise';
export { storeMedia } from './store';
export { listSharedMedia, recordMediaAsset } from './catalog';
export { generateCoverArt, generateIllustration } from './generate';
export { ImageLibrary } from './image-library';
export { IllustrationPrompt } from './illustration-prompt';
export { CoverArtPicker } from './cover-art';
