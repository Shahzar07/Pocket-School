/** A picture in the shared library. Alt text is required before it can be placed. */
export interface MediaAsset {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
  fullBleed?: boolean;
  storagePath?: string;
}

export interface CoverStyleOption {
  id: string;
  label: string;
}

export interface CoverArtOption {
  id: string;
  styleId: string;
  artSrc: string;
  prompt: string;
  /** True when the model did not return a picture and a drawn stand-in is shown. */
  fallback: boolean;
}

/** Hosts that own a Sparks balance confirm the spend. Returning false cancels generation. */
export interface SparksConfirmRequest {
  cost: number;
  reason: string;
}

export type SparksConfirm = (request: SparksConfirmRequest) => Promise<boolean>;

export const COVER_STYLES: CoverStyleOption[] = [
  { id: 'illustrated-kids', label: "Illustrated kids'" },
  { id: 'photographic', label: 'Photographic' },
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'academic', label: 'Academic' },
  { id: 'novel', label: 'Novel' },
];
