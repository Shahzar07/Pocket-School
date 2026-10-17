'use client';

import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { documentPdf } from '@/lib/institution-pricing';
import {
  JOIN_LEVELS,
  bulkMove,
  joinReport,
  offboard,
  parseJoinRoster,
  posterLines,
  rollRoster,
  shareLinks,
  type JoinConfig,
  type RosterEntry,
} from '@/lib/institution-join';

function Toggle({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-[#203337]/10 bg-white px-4 py-3">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[#203337]/65">{detail}</span>
      </span>
    </label>
  );
}

export function JoinVerificationSettings({
  institutionName,
  slug,
  initial,
  roster,
  onSave,
  onRoster,
  onRollover,
  onBulk,
  onOffboard,
  busy,
}: {
  institutionName: string;
  slug: string;
  initial: JoinConfig;
  roster: RosterEntry[];
  onSave?: (config: JoinConfig) => Promise<void> | void;
  onRoster?: (csv: string) => Promise<void> | void;
  onRollover?: () => Promise<void> | void;
  onBulk?: (studentIds: string[], level: string, className: string) => Promise<void> | void;
  onOffboard?: (studentIds: string[]) => Promise<void> | void;
  busy?: boolean;
}) {
  const [policy, setPolicy] = useState(initial.policy);
  const [codes, setCodes] = useState(initial.codes);
  const [overage, setOverage] = useState(initial.overage);
  const [inviteCodes] = useState(initial.inviteCodes);
  const [domains, setDomains] = useState(initial.policy.emailDomains.join('\n'));
  const [rows, setRows] = useState(roster);
  const [csv, setCsv] = useState('email,name,role,studentId,dob,level,class,phone,childStudentId\nada@school.edu.my,Ada,student,S-14,2012-04-01,IGCSE,North,,');
  const [notice, setNotice] = useState('');
  const [moveIds, setMoveIds] = useState('S-14');
  const [moveLevel, setMoveLevel] = useState('Lower Secondary');
  const [moveClass, setMoveClass] = useState('South');
  const [code, setCode] = useState(initial.codes[0]?.code ?? 'IGCSE1');
  const [codeLevel, setCodeLevel] = useState(initial.codes[0]?.level ?? 'IGCSE');
  const [codeClass, setCodeClass] = useState(initial.codes[0]?.className ?? 'North');
  const [programmeId, setProgrammeId] = useState(initial.codes[0]?.programmeId ?? 'igcse');
  const joinUrl = `https://poketschool.ai/i/${slug}/join`;
  const links = useMemo(() => shareLinks(joinUrl, institutionName), [joinUrl, institutionName]);
  const report = joinReport(rows);
  const config = (): JoinConfig => ({
    policy: { ...policy, emailDomains: domains.split(/[\s,]+/).map((item) => item.trim().toLowerCase().replace(/^@/, '')).filter(Boolean) },
    codes,
    inviteCodes,
    overage,
  });

  const downloadPoster = () => {
    const bytes = documentPdf(posterLines({ institutionName, joinUrl, code }));
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug}-join.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-[#203337]">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Join settings</p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">{institutionName}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#203337]/75">
          Choose how students and parents join. The rules can run together. Under 13, a parent agrees before any of them approve the account. Everyone else stays an individual.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#203337]/10 bg-white px-4 py-3">
          <p className="text-sm font-semibold">Auto-approve an allowed email domain</p>
          <p className="mt-1 text-xs leading-relaxed text-[#203337]/65">Example: school.edu.my. A matching address opens the account. Leave the list empty to skip this check.</p>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#203337]/60">
          Allowed domains
          <input value={domains} onChange={(event) => setDomains(event.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-[#203337]/15 bg-white px-4 text-sm font-normal normal-case tracking-normal" placeholder="school.edu.my" />
        </label>
        <Toggle checked={policy.acceptInviteCode} label="Auto-approve a class or invite code" detail="A valid code also assigns the class and level name." onChange={(value) => setPolicy({ ...policy, acceptInviteCode: value })} />
        <Toggle checked={policy.rosterMatch} label="Match the uploaded roster" detail="Student ID, or name and date of birth, confirms the person." onChange={(value) => setPolicy({ ...policy, rosterMatch: value })} />
        <Toggle checked={policy.manualFallback} label="Manual approval queue" detail="When none of the automatic checks match, the admin queue decides." onChange={(value) => setPolicy({ ...policy, manualFallback: value })} />
      </section>

      <section className="rounded-[28px] border border-[#203337]/10 bg-white p-5">
        <h2 className="font-heading text-2xl">When the level is full</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setOverage('prompt')} className={`rounded-2xl border px-4 py-3 text-left text-sm ${overage === 'prompt' ? 'border-[#1E6A83] bg-[#E9F7FA]' : 'border-[#203337]/10'}`}>
            <span className="block font-semibold">Queue and ask the admin</span>
            <span className="mt-1 block text-xs leading-relaxed">The student waits for a seat. The admin is prompted to add seats.</span>
          </button>
          <button type="button" onClick={() => setOverage('auto_add')} className={`rounded-2xl border px-4 py-3 text-left text-sm ${overage === 'auto_add' ? 'border-[#1E6A83] bg-[#E9F7FA]' : 'border-[#203337]/10'}`}>
            <span className="block font-semibold">Add one seat</span>
            <span className="mt-1 block text-xs leading-relaxed">The seat is added and the difference is prorated.</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Pending', report.pending],
          ['Joined', report.joined],
          ['Unclaimed', report.unclaimed],
          ['Waiting', report.waiting],
          ['Leavers', report.leavers],
        ].map(([label, count]) => (
          <div key={label} className="rounded-2xl bg-[#203337] px-3 py-3 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E9F7FA]">{label}</p>
            <p className="mt-1 font-heading text-3xl">{count}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 rounded-[28px] border border-[#203337]/10 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="font-heading text-2xl">Poster, QR, and share</h2>
          <p className="mt-1 break-all font-mono text-sm">{joinUrl}</p>
          <p className="mt-1 text-sm">Class code {code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={links.whatsapp} className="inline-flex h-10 items-center rounded-full bg-[#203337] px-4 text-sm font-semibold text-white">WhatsApp</a>
            <a href={links.email} className="inline-flex h-10 items-center rounded-full border border-[#203337]/15 px-4 text-sm font-semibold">Email</a>
            <button type="button" onClick={downloadPoster} className="inline-flex h-10 items-center rounded-full border border-[#203337]/15 px-4 text-sm font-semibold">Printable PDF</button>
          </div>
        </div>
        <div className="flex h-[148px] w-[148px] items-center justify-center rounded-2xl border border-[#203337]/10 bg-[#F6F1E7] p-2">
          <QRCodeSVG value={joinUrl} size={128} fgColor="#203337" bgColor="#F6F1E7" />
        </div>
      </section>

      <section className="rounded-[28px] border border-[#203337]/10 bg-white p-5">
        <h2 className="font-heading text-2xl">Class code</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} aria-label="Class code" className="h-11 rounded-2xl border border-[#203337]/15 px-3" />
          <select value={codeLevel} onChange={(event) => setCodeLevel(event.target.value)} aria-label="Level name" className="h-11 rounded-2xl border border-[#203337]/15 px-3">
            {JOIN_LEVELS.map((level) => <option key={level}>{level}</option>)}
          </select>
          <input value={codeClass} onChange={(event) => setCodeClass(event.target.value)} aria-label="Class name" className="h-11 rounded-2xl border border-[#203337]/15 px-3" />
          <input value={programmeId} onChange={(event) => setProgrammeId(event.target.value)} aria-label="Programme" className="h-11 rounded-2xl border border-[#203337]/15 px-3" />
        </div>
        <button
          type="button"
          className="mt-3 h-10 rounded-full bg-[#203337] px-4 text-sm font-semibold text-white"
          onClick={() => setCodes([{ code, level: codeLevel, className: codeClass, programmeId }, ...codes.filter((item) => item.code !== code)].slice(0, 20))}
        >
          Save code
        </button>
        <ul className="mt-3 space-y-1 text-sm">
          {codes.map((item) => <li key={item.code}>{item.code} · {item.level} · {item.className}</li>)}
        </ul>
      </section>

      <section className="rounded-[28px] border border-[#203337]/10 bg-white p-5">
        <h2 className="font-heading text-2xl">CSV pre-registration</h2>
        <p className="mt-1 text-sm text-[#203337]/70">Each row receives a claim-your-account email. The SMS text is ready to send from the academy’s own number.</p>
        <textarea value={csv} onChange={(event) => setCsv(event.target.value)} rows={4} className="mt-3 w-full rounded-2xl border border-[#203337]/15 px-4 py-3 font-mono text-xs" aria-label="Roster CSV" />
        <button
          type="button"
          disabled={busy}
          className="mt-3 h-10 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]"
          onClick={() => {
            if (onRoster) {
              void onRoster(csv);
              return;
            }
            const parsed = parseJoinRoster(csv, slug);
            setRows(parsed.rows);
            setNotice(parsed.errors[0] ?? `${parsed.rows.length} people are ready to claim.`);
          }}
        >
          Send claim links
        </button>
        {notice && <p className="mt-2 text-sm">{notice}</p>}
      </section>

      <section className="rounded-[28px] border border-[#203337]/10 bg-white p-5">
        <h2 className="font-heading text-2xl">Level moves</h2>
        <p className="mt-1 text-sm text-[#203337]/70">At the end of the year, each class moves to the next level name. Graduation ends academy access and keeps progress.</p>
        <button
          type="button"
          className="mt-3 h-10 rounded-full bg-[#203337] px-4 text-sm font-semibold text-white"
          onClick={() => {
            if (onRollover) {
              void onRollover();
              return;
            }
            setRows(rollRoster(rows).rows);
          }}
        >
          Move to the next level
        </button>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input value={moveIds} onChange={(event) => setMoveIds(event.target.value)} aria-label="Student ids" className="h-11 rounded-2xl border border-[#203337]/15 px-3" />
          <select value={moveLevel} onChange={(event) => setMoveLevel(event.target.value)} aria-label="Move to level" className="h-11 rounded-2xl border border-[#203337]/15 px-3">
            {JOIN_LEVELS.map((level) => <option key={level}>{level}</option>)}
          </select>
          <input value={moveClass} onChange={(event) => setMoveClass(event.target.value)} aria-label="Move to class" className="h-11 rounded-2xl border border-[#203337]/15 px-3" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-10 rounded-full border border-[#203337]/15 px-4 text-sm font-semibold"
            onClick={() => {
              const ids = moveIds.split(/[\s,]+/).filter(Boolean);
              if (onBulk) {
                void onBulk(ids, moveLevel, moveClass);
                return;
              }
              setRows(bulkMove(rows, ids, moveLevel, moveClass));
            }}
          >
            Bulk move
          </button>
          <button
            type="button"
            className="h-10 rounded-full border border-[#E36A4F] px-4 text-sm font-semibold text-[#E36A4F]"
            onClick={() => {
              const ids = moveIds.split(/[\s,]+/).filter(Boolean);
              if (onOffboard) {
                void onOffboard(ids);
                return;
              }
              setRows(offboard(rows, ids));
            }}
          >
            Graduate or leave
          </button>
        </div>
      </section>

      <button
        type="button"
        disabled={busy}
        className="h-12 w-full rounded-2xl bg-[#203337] text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          if (onSave) void onSave(config());
          else setNotice('These rules are ready for the academy.');
        }}
      >
        Save verification settings
      </button>
    </div>
  );
}
