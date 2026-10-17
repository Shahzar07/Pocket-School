'use client';

import { use, useState } from 'react';

interface SharedItem {
  id: string;
  title: string;
  detail: string;
  when: string;
  source: string;
  verifyUrl: string;
  confirmation: string;
}

interface SharedRecord {
  open: boolean;
  reason?: string;
  name?: string;
  studentNumber?: string;
  items?: SharedItem[];
}

export default function SharedRecordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [visitor, setVisitor] = useState('');
  const [record, setRecord] = useState<SharedRecord | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  function openRecord(itemTitle = '') {
    const query = new URLSearchParams({ token, visitor });
    if (itemTitle) query.set('item', itemTitle);
    void fetch(`/api/record?${query.toString()}`)
      .then((response) => response.json())
      .then((data: SharedRecord) => setRecord(data))
      .catch(() => setRecord({ open: false, reason: 'This record could not be opened.' }));
  }

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-12 text-[#203337]">
      <article className="mx-auto max-w-2xl rounded-[28px] border border-[#203337]/10 bg-white p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Verified record</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">Poket School record</h1>
        <p className="mt-2 text-sm leading-relaxed">This page shows the learner’s verified record. You can add your name or team. Poket School does not collect anything else about you.</p>
        <label className="mt-4 block text-sm">Your name or team
          <input value={visitor} onChange={(event) => setVisitor(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[#203337]/15 px-3" />
        </label>
        <button type="button" className="mt-3 h-11 rounded-full bg-[#203337] px-5 text-sm font-semibold text-white" onClick={() => openRecord()}>
          Open record
        </button>
        {record && !record.open ? <p className="mt-4 text-sm">{record.reason}</p> : null}
        {record?.open ? (
          <div className="mt-6">
            <h2 className="font-heading text-3xl">{record.name}</h2>
            <p className="mt-1 font-mono text-sm">{record.studentNumber}</p>
            <ul className="mt-4 space-y-3 text-sm">
              {(record.items ?? []).map((item) => (
                <li key={item.id} className="rounded-xl border border-[#203337]/10 px-3 py-2">
                  <p className="font-medium">{item.title}</p>
                  <p>{[item.detail, item.when].filter(Boolean).join(' · ')}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1E6A83]">
                    {item.source === 'verified' ? 'Verified by Poket School' : 'Self-reported'}
                    {item.confirmation === 'learner' ? ' · Confirmed by the learner' : ''}
                    {item.confirmation === 'school' ? ' · Confirmed by the school' : ''}
                  </p>
                  {item.verifyUrl ? (
                    <button type="button" className="mt-1 text-[#3C8DFF]" onClick={() => openRecord(item.title)}>Open verified item</button>
                  ) : null}
                  {item.source !== 'verified' ? (
                    <form className="mt-2" onSubmit={(event) => {
                      event.preventDefault();
                      void fetch('/api/record', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'request', token, itemId: item.id, note, visitorLabel: visitor }),
                      })
                        .then((response) => response.json())
                        .then((data: { error?: string }) => setMessage(data.error ?? 'The learner and their school can confirm this item.'))
                        .catch(() => setMessage('Could not send the request.'));
                    }}>
                      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What should they confirm?" className="h-10 w-full rounded-xl border border-[#203337]/15 px-3" />
                      <button type="submit" className="mt-2 text-sm font-semibold">Request verification</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {message ? <p className="mt-3 text-sm">{message}</p> : null}
          </div>
        ) : null}
      </article>
    </main>
  );
}
