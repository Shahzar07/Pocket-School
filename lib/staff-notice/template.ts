/**
 * Confidential staff case card. Blue Poket School palette.
 * Plain text is the fallback when a client does not render HTML.
 */

import { escapeHtml } from '../certificates';

export interface GuardianContact {
  name: string;
  phone: string;
  email: string;
}

export interface CaseCard {
  typeLabel: string;
  fullName: string;
  studentNumber: string;
  classLabel: string;
  photoUrl: string;
  guardians: GuardianContact[];
  description: string;
  location: string;
  atIso: string;
  caseId: string;
  caseUrl: string;
  parentsExcluded: boolean;
}

const FOOTER = 'Confidential, do not forward';

function line(label: string, value: string): string {
  return `${label}: ${value || 'Not on file'}`;
}

export function caseCardText(card: CaseCard): string {
  const guardians = card.guardians.length
    ? card.guardians.map(person => `${person.name || 'Guardian'} · ${person.phone || 'no phone'} · ${person.email || 'no email'}`).join('\n')
    : 'No parent or guardian is linked.';
  const rows = [
    'Confidential. Open this message on a private screen.',
    '',
    line('Type', card.typeLabel),
    line('Child', card.fullName),
    line('Student number', card.studentNumber),
    line('Class', card.classLabel),
    line('Photo', card.photoUrl || 'Not on file'),
    'Parents or guardians:',
    guardians,
    line('Description', card.description),
    line('Location', card.location),
    line('Time', card.atIso),
    line('Case', card.caseId),
    `Open case: ${card.caseUrl}`,
    card.parentsExcluded ? 'Parents were not notified.' : '',
    '',
    FOOTER,
  ];
  return rows.filter(row => row !== '').join('\n');
}

export function caseCardHtml(card: CaseCard): string {
  const photo = card.photoUrl
    ? `<img alt="Photo on file" src="${escapeHtml(card.photoUrl)}" width="72" height="72" style="display:block;border-radius:16px;object-fit:cover;margin:0 0 16px" />`
    : '<p style="margin:0 0 16px;color:#4E6A72;font-size:14px">Photo on file: not on file</p>';
  const guardians = card.guardians.length
    ? card.guardians.map(person => `<li style="margin:0 0 6px">${escapeHtml(person.name || 'Guardian')} · ${escapeHtml(person.phone || 'no phone')} · ${escapeHtml(person.email || 'no email')}</li>`).join('')
    : '<li style="margin:0">No parent or guardian is linked.</li>';
  const location = card.location
    ? `<p style="margin:0 0 8px"><strong>Location.</strong> ${escapeHtml(card.location)}</p>`
    : '';
  const excluded = card.parentsExcluded
    ? '<p style="margin:12px 0 0;color:#1E6A83;font-weight:700">Parents were not notified.</p>'
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#F3F7F8;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #D5E3E7;border-radius:24px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1E6A83 0%,#2786A4 50%,#6FBBCE 100%);color:#ffffff;padding:24px">
        <p style="margin:0;letter-spacing:0.14em;font-size:12px;font-weight:700">POKET SCHOOL</p>
        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2">Confidential case</h1>
        <p style="margin:8px 0 0;font-size:14px">${escapeHtml(card.typeLabel)}</p>
      </div>
      <div style="padding:24px;color:#17343C;font-size:15px;line-height:1.5">
        <p style="margin:0 0 16px">Open this message on a private screen.</p>
        ${photo}
        <p style="margin:0 0 8px"><strong>Child.</strong> ${escapeHtml(card.fullName || 'Not on file')}</p>
        <p style="margin:0 0 8px"><strong>Student number.</strong> ${escapeHtml(card.studentNumber || 'Not on file')}</p>
        <p style="margin:0 0 8px"><strong>Class.</strong> ${escapeHtml(card.classLabel || 'Not on file')}</p>
        <p style="margin:16px 0 8px"><strong>Parents or guardians.</strong></p>
        <ul style="margin:0 0 16px;padding-left:18px">${guardians}</ul>
        <p style="margin:0 0 8px"><strong>Description.</strong> ${escapeHtml(card.description || 'Not on file')}</p>
        ${location}
        <p style="margin:0 0 8px"><strong>Time.</strong> ${escapeHtml(card.atIso)}</p>
        <p style="margin:0 0 16px"><strong>Case.</strong> ${escapeHtml(card.caseId)}</p>
        <a href="${escapeHtml(card.caseUrl)}" style="display:inline-block;min-height:48px;line-height:48px;padding:0 18px;border-radius:14px;background:#2786A4;color:#ffffff;text-decoration:none;font-weight:700">Open case</a>
        ${excluded}
      </div>
      <p style="margin:0;padding:16px 24px;background:#E7F1F4;color:#1E6A83;font-size:13px;font-weight:700">${FOOTER}</p>
    </div>
  </div>`;
}

export function caseCardSubject(typeLabel: string): string {
  return `Confidential: ${typeLabel || 'Safeguarding'}`;
}
