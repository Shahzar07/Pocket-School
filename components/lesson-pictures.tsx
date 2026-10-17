'use client';

import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { awardSparks, type LessonMediaAsset } from '@/lib/db';
import { illustrationBrief } from '@/lib/lesson-body';
import { IllustrationPrompt, ImageLibrary, optimiseImage, recordMediaAsset, storeMedia } from '@/components/media';
import type { MediaAsset } from '@/components/media';

const ILLUSTRATION_SPARKS = 15;

/** Optimise and store dropped or pasted pictures. Alt text stays empty until the author fills it. */
export async function filesToAssets(scopeId: string, files: File[]): Promise<LessonMediaAsset[]> {
  const assets: LessonMediaAsset[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const fitted = await optimiseImage(file, 1600);
    const stored = await storeMedia(scopeId, fitted.blob, `${Date.now()}-${file.name || 'image'}.jpg`);
    const asset: LessonMediaAsset = {
      id: `img-${Date.now()}-${assets.length}`,
      src: stored.src,
      alt: '',
      width: fitted.width,
      height: fitted.height,
      ...(stored.storagePath ? { storagePath: stored.storagePath } : {}),
    };
    assets.push(asset);
    void recordMediaAsset(scopeId, asset);
  }
  return assets;
}

export function LessonImageBlock({
  scopeId,
  images,
  onChange,
  onInsert,
}: {
  scopeId: string;
  images: LessonMediaAsset[];
  onChange: (images: LessonMediaAsset[]) => void;
  onInsert: (image: LessonMediaAsset) => void;
}) {
  return (
    <ImageLibrary
      scopeId={scopeId}
      images={images}
      onChange={next => onChange(next.map(toLessonMedia))}
      onInsert={image => onInsert(toLessonMedia(image))}
    />
  );
}

/**
 * AI illustration for a lesson. Sparks are confirmed against the signed-in
 * balance, then the picture joins the same library so alt text is required
 * before it can be placed.
 */
export function LessonIllustrationBlock({
  scopeId,
  images,
  onChange,
  onInsert,
  sparksCost = ILLUSTRATION_SPARKS,
  showLibrary = true,
  lessonText = '',
}: {
  scopeId: string;
  images: LessonMediaAsset[];
  onChange: (images: LessonMediaAsset[]) => void;
  onInsert: (image: LessonMediaAsset) => void;
  sparksCost?: number;
  /** The teacher upload page already shows the Image block, so it can hide this second library. */
  showLibrary?: boolean;
  /** When this is long enough, the prompt starts from the lesson instead of a blank box. */
  lessonText?: string;
}) {
  const { user, profile, fetchProfile } = useAuthSTORE();

  return (
    <div className="space-y-3">
      <IllustrationPrompt
        sparksCost={sparksCost}
        defaultPrompt={illustrationBrief(lessonText)}
        defaultStyle="academic"
        confirmSparks={async ({ cost, reason }) => {
          const balance = profile?.sparksBalance ?? 0;
          if (!user) {
            toast.error('Sign in to spend Sparks.');
            return false;
          }
          if (balance < cost) {
            toast.error(`This needs ${cost} Sparks. You have ${balance}.`);
            return false;
          }
          return window.confirm(`Spend ${cost} Sparks to illustrate “${reason.trim().slice(0, 140)}”?`);
        }}
        onCreated={(asset, note) => {
          void (async () => {
            const saved = await persistGenerated(scopeId, asset);
            onChange([...images, saved]);
            void recordMediaAsset(scopeId, saved);
            toast.message(note);
            if (!user || note.toLowerCase().includes('stand-in')) return;
            void awardSparks(user.uid, -sparksCost, 'ai_studio', 'Lesson illustration')
              .then(() => fetchProfile(user.uid))
              .catch(() => toast.error('The picture was saved, but the Sparks charge did not go through.'));
          })();
        }}
      />
      {showLibrary && (
        <ImageLibrary
          scopeId={scopeId}
          images={images}
          onChange={next => onChange(next.map(toLessonMedia))}
          onInsert={image => onInsert(toLessonMedia(image))}
        />
      )}
    </div>
  );
}

/** Generated pictures go through the same Storage path as an upload. A rejected write keeps a data URL. */
async function persistGenerated(scopeId: string, asset: MediaAsset): Promise<LessonMediaAsset> {
  if (!asset.src.startsWith('data:')) return toLessonMedia(asset);
  try {
    const blob = await (await fetch(asset.src)).blob();
    const svg = asset.src.startsWith('data:image/svg');
    if (svg) {
      const stored = await storeMedia(scopeId, blob, `${asset.id}.svg`);
      return toLessonMedia({ ...asset, src: stored.src, storagePath: stored.storagePath });
    }
    const fitted = await optimiseImage(blob);
    const stored = await storeMedia(scopeId, fitted.blob, `${asset.id}.jpg`);
    return toLessonMedia({
      ...asset,
      src: stored.src,
      width: fitted.width,
      height: fitted.height,
      storagePath: stored.storagePath,
    });
  } catch {
    return toLessonMedia(asset);
  }
}

function toLessonMedia(asset: MediaAsset): LessonMediaAsset {
  return {
    id: asset.id,
    src: asset.src,
    alt: asset.alt,
    width: asset.width,
    height: asset.height,
    ...(asset.caption ? { caption: asset.caption } : {}),
    ...(asset.fullBleed ? { fullBleed: asset.fullBleed } : {}),
    ...(asset.storagePath ? { storagePath: asset.storagePath } : {}),
  };
}
