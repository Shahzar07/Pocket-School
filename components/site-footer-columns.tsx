'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FOOTER_COLUMNS, FOOTER_LEGAL, type FooterLink } from '@/lib/marketing/footer-columns';

function Item({ link, label, className }: { link: FooterLink; label: string; className: string }) {
  const external = link.href.startsWith('http') || link.href.startsWith('mailto:');
  if (external) {
    return (
      <a href={link.href} className={className}>{label}</a>
    );
  }
  return <Link href={link.href} className={className}>{label}</Link>;
}

export function FooterColumns({ tone }: { tone: 'ink' | 'glass' }) {
  const { t } = useTranslation();
  const linkClass = tone === 'glass'
    ? 'text-xs text-white/75 hover:text-white'
    : 'block max-w-full break-words text-[13px] text-[#203337] hover:text-[#1E6A83] dark:text-[#E7F4F2] dark:hover:text-[#3FE0D0]';
  const titleClass = tone === 'glass'
    ? 'text-sm font-semibold text-white'
    : 'text-sm font-semibold text-[#203337] dark:text-[#3FE0D0]';
  return (
    <div data-footer-columns className="contents">
      {FOOTER_COLUMNS.map((column) => (
        <div key={column.id}>
          <div className="hidden md:block">
            <h2 className={titleClass}>{t(column.titleKey)}</h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={`${column.id}-${link.href}-${link.labelKey}`}>
                  <Item link={link} label={t(link.labelKey)} className={linkClass} />
                </li>
              ))}
            </ul>
          </div>
          <details className={tone === 'glass'
            ? 'rounded-2xl border border-white/20 bg-white/5 px-4 py-2 md:hidden'
            : 'rounded-2xl border border-[#1E6A83]/15 bg-white px-4 py-2 md:hidden dark:border-[#3FE0D0]/25 dark:bg-[#1A1918]'}>
            <summary className={`cursor-pointer py-2 ${titleClass}`}>{t(column.titleKey)}</summary>
            <ul className="space-y-2 pb-3">
              {column.links.map((link) => (
                <li key={`${column.id}-m-${link.href}-${link.labelKey}`}>
                  <Item link={link} label={t(link.labelKey)} className={linkClass} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
    </div>
  );
}

export function FooterLegalRow({ tone }: { tone: 'ink' | 'glass' }) {
  const { t } = useTranslation();
  const className = tone === 'glass'
    ? 'text-xs text-white/70 hover:text-white'
    : 'text-xs font-semibold text-[#1E6A83] hover:text-[#203337] dark:text-[#3FE0D0] dark:hover:text-[#E7F4F2]';
  return (
    <ul data-footer-legal className="flex flex-wrap gap-x-4 gap-y-2">
      {FOOTER_LEGAL.map((link) => (
        <li key={link.href}>
          <Item link={link} label={t(link.labelKey)} className={className} />
        </li>
      ))}
    </ul>
  );
}
