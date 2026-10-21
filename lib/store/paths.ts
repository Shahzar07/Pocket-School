export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PDF_MAX_BYTES = 50 * 1024 * 1024;

export function productObjectPaths(productId: string, previewCount: number) {
  const root = `store/products/${productId}`;
  return {
    paper: `${root}/private/paper.pdf`,
    markscheme: `${root}/private/markscheme.pdf`,
    thumb: `${root}/thumbs/cover.webp`,
    previews: Array.from({ length: previewCount }, (_, index) => `${root}/preview/${index + 1}.webp`),
  };
}

export function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  const parts = path.split('/');
  return parts.every(part => part.length > 0 && part !== '.' && part !== '..');
}
