/** Blog image checks. Alt text is required. Bytes stay under the Storage limit. */

export const BLOG_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export interface BlogImage {
  url: string;
  alt: string;
}

export function blogImageError(file: { type: string; size: number }, alt: string): string {
  if (!BLOG_IMAGE_TYPES.includes(file.type as (typeof BLOG_IMAGE_TYPES)[number])) {
    return 'Use a JPEG, PNG, WebP, or GIF image.';
  }
  if (file.size <= 0 || file.size > BLOG_IMAGE_MAX_BYTES) {
    return 'Images must be under 5 MB.';
  }
  const text = alt.trim();
  if (text.length < 2 || text.length > 180) {
    return 'Add alt text between 2 and 180 characters.';
  }
  return '';
}

export function blogCoverReady(coverImage: string, coverAlt: string): string {
  if (!coverImage.trim()) return '';
  if (coverAlt.trim().length < 2) return 'A cover image needs alt text.';
  return '';
}

export function inlineImageMarkdown(image: BlogImage): string {
  const alt = image.alt.trim().replace(/[\[\]]/g, '');
  return `![${alt}](${image.url})`;
}
