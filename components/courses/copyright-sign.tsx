'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { COPYRIGHT_DECLARATION } from '@/lib/courses/copyright';
import { writeCopyrightSignature } from '@/lib/courses/sign-client';
import { SIGN } from '@/lib/courses/sign-copy';
import type { SignatureContext } from '@/lib/courses/copyright';

export function CopyrightSign({
  uid,
  profileName,
  role,
  context,
  courseId,
  onSigned,
}: {
  uid: string;
  profileName: string;
  role: string;
  context: SignatureContext;
  courseId: string;
  onSigned: (id: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const sign = async () => {
    setBusy(true);
    try {
      const id = await writeCopyrightSignature({
        uid,
        typedFullName: typed,
        profileName,
        role,
        context,
        courseId,
        locale: typeof navigator === 'undefined' ? 'en' : navigator.language,
      });
      onSigned(id);
      setTyped('');
      toast.success(SIGN.signed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : SIGN.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="space-y-3 rounded-2xl border border-[#1E6A83]/30 p-4" data-copyright-sign="1">
      <legend className="px-1 text-sm font-semibold text-[#203337]">{SIGN.title}</legend>
      <p className="text-sm leading-6 text-[#203337]/80">{COPYRIGHT_DECLARATION}</p>
      <p className="text-xs text-[#1E6A83]">{SIGN.body}</p>
      <label className="block text-sm font-semibold text-[#203337]">
        {SIGN.name}
        <input
          value={typed}
          data-copyright-name="1"
          onChange={(event) => setTyped(event.target.value)}
          className="mt-1 w-full min-h-11 rounded-xl border border-[#1E6A83]/30 px-3"
        />
      </label>
      <button type="button" data-copyright-submit="1" disabled={busy} className="min-h-11 rounded-full bg-[#1E6A83] px-4 text-sm font-bold text-white disabled:opacity-40" onClick={() => void sign()}>
        {SIGN.sign}
      </button>
    </fieldset>
  );
}
