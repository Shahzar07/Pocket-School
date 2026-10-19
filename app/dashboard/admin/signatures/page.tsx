'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { db } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import { resolveStaffRole } from '@/lib/admin-console';
import { SIGN } from '@/lib/courses/sign-copy';
import { signaturesCsv, signaturesPdf, type SignatureRow } from '@/lib/courses/signature-export';

function stamp(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'number') return new Date(value).toISOString();
  return '';
}

export default function SignaturesPage() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile ? { email: profile.email, role: profile.role, adminRole: profile.adminRole } : null);
  const allowed = staff === 'super_admin' || staff === 'admin' || staff === 'support';
  const [rows, setRows] = useState<SignatureRow[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<SignatureRow | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!allowed) return;
    getDocs(collection(db, 'copyright_signatures')).then((snap) => {
      const next: SignatureRow[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        next.push({
          id: doc.id,
          typedFullName: typeof data.typedFullName === 'string' ? data.typedFullName : '',
          context: typeof data.context === 'string' ? data.context : '',
          courseId: typeof data.courseId === 'string' ? data.courseId : '',
          signedAt: stamp(data.signedAt),
          ip: typeof data.ip === 'string' ? data.ip : '',
          userAgent: typeof data.userAgent === 'string' ? data.userAgent : '',
        });
      });
      setRows(next);
    }).catch(() => setNotice(SIGN.empty));
  }, [allowed]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.typedFullName} ${row.courseId} ${row.context} ${row.ip}`.toLowerCase().includes(needle));
  }, [query, rows]);

  const download = (name: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashPage>
      <DashHeader eyebrow="Admin" title={SIGN.page} description={SIGN.pageHelp} />
      {!allowed ? <p className="text-sm text-[#1E6A83]">{SIGN.empty}</p> : null}
      {notice ? <p className="text-sm text-[#1E6A83]">{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        <input value={query} data-signature-search="1" onChange={(event) => setQuery(event.target.value)} aria-label={SIGN.search} placeholder={SIGN.search} className="min-h-11 flex-1 rounded-xl border border-[#1E6A83]/30 px-3" />
        <button type="button" className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => download('signatures.csv', new Blob([signaturesCsv(shown)], { type: 'text/csv' }))}>{SIGN.exportCsv}</button>
        <button type="button" className="min-h-11 rounded-full border px-4 text-sm font-semibold" onClick={() => download('signatures.pdf', new Blob([new Uint8Array(signaturesPdf(shown))], { type: 'application/pdf' }))}>{SIGN.exportPdf}</button>
      </div>
      <ul className="space-y-2" data-signature-list="1">
        {shown.length === 0 ? <li className="text-sm text-[#1E6A83]">{SIGN.empty}</li> : null}
        {shown.map((row) => (
          <li key={row.id}>
            <button type="button" className="w-full rounded-2xl border border-[#1E6A83]/20 bg-white px-4 py-3 text-left" onClick={() => setOpen(row)}>
              <span className="block font-semibold text-[#203337]">{row.typedFullName}</span>
              <span className="text-xs text-[#1E6A83]">{row.context === 'instructor_application' ? SIGN.contextApplication : SIGN.contextCourse} · {row.signedAt} · {row.courseId || '—'}</span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <article className="rounded-3xl border border-[#1E6A83]/20 bg-white p-5 text-sm text-[#203337]" data-signature-detail="1">
          <h2 className="font-heading text-2xl">{open.typedFullName}</h2>
          <p className="mt-2">{open.signedAt}</p>
          <p>{open.ip}</p>
          <p className="break-all text-[#1E6A83]">{open.userAgent}</p>
          <p>{open.courseId}</p>
        </article>
      ) : null}
    </DashPage>
  );
}
