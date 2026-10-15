'use client';

import { useEffect } from 'react';
import { auth } from '@/lib/firebase';

/** Attach the signed-in user's token to same-origin API calls. */
export function AuthFetch() {
  useEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const sameOriginApi = url.startsWith('/api/');
      if (!sameOriginApi || !auth.currentUser) return original(input, init);
      const token = await auth.currentUser.getIdToken();
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      return original(input, { ...init, headers });
    };
    return () => {
      window.fetch = original;
    };
  }, []);
  return null;
}
