'use client';

import { useState } from 'react';
import { pdfAroundJpeg } from '@/lib/cards/id-face';
import type { IdCardView } from '@/lib/cards/id-face';
import { IdCard } from './id-card';
import { drawIdCard } from './id-card-draw';

function save(bytes: Blob, name: string) {
  const url = URL.createObjectURL(bytes);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function IdCardPanel({ view }: { view: IdCardView }) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [note, setNote] = useState('');

  const download = async (kind: 'png' | 'pdf') => {
    const canvas = document.createElement('canvas');
    canvas.width = 820;
    canvas.height = 526;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawIdCard(ctx, view, side, canvas.width, canvas.height);
    if (kind === 'png') {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) save(blob, 'poket-student-id.png');
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const pdf = pdfAroundJpeg(jpeg, { width: canvas.width, height: canvas.height }, { width: 242.65, height: 155.65 });
    const copy = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(copy).set(pdf);
    save(new Blob([copy], { type: 'application/pdf' }), 'poket-student-id.pdf');
  };

  return (
    <div className="space-y-3">
      <IdCard view={view} side={side} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]" onClick={() => setSide((current) => current === 'front' ? 'back' : 'front')}>{side === 'front' ? 'Show back' : 'Show front'}</button>
        <button type="button" className="h-10 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" onClick={() => void download('png')}>Download PNG</button>
        <button type="button" className="h-10 rounded-full border border-[#E7EDED] px-4 text-sm font-semibold text-[#203337]" onClick={() => void download('pdf')}>Download PDF</button>
        <button type="button" className="h-10 rounded-full border border-[#E7EDED] px-4 text-sm font-semibold text-[#203337]" onClick={() => setNote('Apple Wallet passes are not issued yet.')}>Add to Apple Wallet</button>
        <button type="button" className="h-10 rounded-full border border-[#E7EDED] px-4 text-sm font-semibold text-[#203337]" onClick={() => setNote('Google Wallet passes are not issued yet.')}>Add to Google Wallet</button>
      </div>
      {note ? <p role="status" className="text-sm text-[#1E6A83]">{note}</p> : null}
    </div>
  );
}
