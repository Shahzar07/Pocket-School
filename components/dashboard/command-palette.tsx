'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { CloseControl, useLayerDismiss } from '@/components/ui/close-control';
import { CATEGORY_STYLE, searchLinks, type DashRole } from '@/lib/dashboard/home';
import { CategoryIcon } from './icons';

export function CommandPalette({ role }: { role: DashRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!command) return;
      const el = document.activeElement;
      const typing = el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useLayerDismiss(open, () => setOpen(false));
  if (!open) return null;
  const hits = searchLinks(role, query);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 px-4 pt-[12vh]" role="presentation" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Search the dashboard"
        className="relative mx-auto w-full max-w-lg rounded-[24px] border border-border bg-card p-3 pe-16 shadow-[var(--shadow-card)]"
        onClick={event => event.stopPropagation()}
      >
        <CloseControl onClose={() => setOpen(false)} className="absolute top-2 right-2" />
        <label className="flex h-12 items-center gap-2 rounded-[18px] border border-border px-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search this home"
            aria-label="Search this home"
            className="h-12 w-full bg-transparent text-sm outline-none"
            onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}
          />
        </label>
        <ul className="mt-2 max-h-80 overflow-y-auto">
          {hits.map(hit => (
            <li key={hit.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 rounded-[18px] px-2 text-start text-sm hover:bg-muted"
                onClick={() => { setOpen(false); setQuery(''); router.push(hit.href); }}
              >
                <span style={{ color: CATEGORY_STYLE[hit.category].ink }}><CategoryIcon category={hit.category} /></span>
                <span className="font-semibold">{hit.label}</span>
                <span className="text-muted-foreground">{CATEGORY_STYLE[hit.category].label}</span>
              </button>
            </li>
          ))}
          {hits.length === 0 ? <li className="px-2 py-4 text-sm text-muted-foreground">Nothing matches that.</li> : null}
        </ul>
      </div>
    </div>
  );
}
