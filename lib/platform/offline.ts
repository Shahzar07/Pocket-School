export const READS_CACHE = 'poket-reads-v1';

/** Cache the book page and the reader for this device. No-op when the Cache API is missing. */
export async function downloadBookOffline(bookId: string): Promise<{ cached: number; pending: boolean }> {
  if (typeof caches === 'undefined') return { cached: 0, pending: true };
  const cache = await caches.open(READS_CACHE);
  const urls = [`/reads/book/${bookId}`, `/reads/read/${bookId}`];
  let cached = 0;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      await cache.put(url, response);
      cached += 1;
    } catch {
      /* A failed page stays online. The other URL can still cache. */
    }
  }
  return { cached, pending: cached === 0 };
}
