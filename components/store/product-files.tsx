'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError, bearerHeaders } from '@/lib/api-client';
import { Panel } from '@/components/dash-ui';
import { STORE_COPY } from '@/lib/store/copy';

const field = 'h-10 w-full rounded-xl border border-border bg-card px-3 text-sm';

export function ProductFiles() {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNote('');
    const form = new FormData(event.currentTarget);
    form.set('status', 'draft');
    try {
      const headers = await bearerHeaders();
      const response = await fetch('/api/store/products', { method: 'POST', headers, body: form });
      const body = await response.json() as { ok?: boolean; error?: string; errors?: string[]; code?: string; productId?: string };
      if (!response.ok || body.ok !== true) {
        setNote(body.code === 'SETUP_NEEDED' ? STORE_COPY.setupNote : (body.error || (body.errors ?? []).join(' | ') || STORE_COPY.setupNote));
        return;
      }
      setNote(STORE_COPY.draftSaved);
    } catch (error) {
      setNote(error instanceof ApiError ? error.message : STORE_COPY.setupNote);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <form className="space-y-3" data-product-upload="1" onSubmit={(event) => { void submit(event); }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg">{STORE_COPY.productTitle}</h2>
          <Link href="/dashboard/admin/store/import" className="text-sm underline">{STORE_COPY.openImporter}</Link>
        </div>
        <p className="text-sm text-muted-foreground">{STORE_COPY.productBody}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="sku" required aria-label={STORE_COPY.sku} placeholder={STORE_COPY.sku} className={field} />
          <input name="title" required aria-label={STORE_COPY.title} placeholder={STORE_COPY.title} className={field} />
          <input name="subject" required aria-label={STORE_COPY.subject} placeholder={STORE_COPY.subject} className={field} />
          <input name="level" required aria-label={STORE_COPY.level} placeholder={STORE_COPY.level} className={field} />
          <input name="exam_board" required aria-label={STORE_COPY.board} placeholder={STORE_COPY.board} className={field} />
          <input name="spec_code" aria-label={STORE_COPY.spec} placeholder={STORE_COPY.spec} className={field} />
          <input name="type" required aria-label={STORE_COPY.type} placeholder={STORE_COPY.type} className={field} />
          <select name="access" aria-label={STORE_COPY.access} className={field} defaultValue="paid">
            <option value="paid">paid</option>
            <option value="free">free</option>
          </select>
          <input name="price_usd" required aria-label={STORE_COPY.priceUsd} placeholder={STORE_COPY.priceUsd} className={field} defaultValue="0.00" />
          <input name="price_myr" required aria-label={STORE_COPY.priceMyr} placeholder={STORE_COPY.priceMyr} className={field} defaultValue="0.00" />
        </div>
        <textarea name="description" aria-label={STORE_COPY.description} placeholder={STORE_COPY.description} className="min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
        <input name="tags" aria-label={STORE_COPY.tags} placeholder={STORE_COPY.tags} className={field} />
        <label className="block text-sm">
          {STORE_COPY.paper}
          <input name="paper" type="file" accept="application/pdf" required aria-label={STORE_COPY.paper} className="mt-1 block w-full text-sm" />
        </label>
        <label className="block text-sm">
          {STORE_COPY.markscheme}
          <input name="markscheme" type="file" accept="application/pdf" aria-label={STORE_COPY.markscheme} className="mt-1 block w-full text-sm" />
        </label>
        <label className="block text-sm">
          {STORE_COPY.thumbnail}
          <input name="thumbnail" type="file" accept="image/png" required aria-label={STORE_COPY.thumbnail} className="mt-1 block w-full text-sm" />
        </label>
        <label className="block text-sm">
          {STORE_COPY.previews}
          <input name="preview" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label={STORE_COPY.previews} className="mt-1 block w-full text-sm" />
        </label>
        <button type="submit" disabled={busy} className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{STORE_COPY.saveProduct}</button>
        {note && <p className="text-sm" data-product-result="1">{note}</p>}
      </form>
    </Panel>
  );
}
