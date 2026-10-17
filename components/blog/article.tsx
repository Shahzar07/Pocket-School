import Link from 'next/link';
import type { ReactNode } from 'react';
import { AFFILIATE_DISCLOSURE, AFFILIATE_REL, isAffiliateToken, type BlogLink, type BlogPost } from '@/lib/blog/posts';

const INLINE = /\[SHOPEE_AFFILIATE_LINK:\s*([^\]]+)\]|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

function inline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const id = `${key}-${index}`;
    index += 1;
    if (match[1]) {
      const token = match[0];
      nodes.push(<a key={id} href={token} rel={AFFILIATE_REL}>{token}</a>);
    } else if (match[2] && match[3]) {
      nodes.push(<TextLink key={id} href={match[3]}>{inline(match[2], id)}</TextLink>);
    } else if (match[4]) {
      nodes.push(<strong key={id}>{inline(match[4], id)}</strong>);
    } else if (match[5]) {
      nodes.push(<em key={id}>{inline(match[5], id)}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  const className = 'font-semibold text-primary underline-offset-2 hover:underline';
  if (isAffiliateToken(href)) {
    return <a href={href} rel={AFFILIATE_REL} className={className}>{children}</a>;
  }
  if (href.startsWith('/') && !href.startsWith('//')) {
    return <Link href={href} className={className}>{children}</Link>;
  }
  if (href.startsWith('mailto:') || href.startsWith('https://')) {
    return <a href={href} className={className} rel="noopener noreferrer">{children}</a>;
  }
  return <span>{children}</span>;
}

function heading(line: string): { level: 2 | 3 | 4; text: string } | null {
  const match = /^(#{2,4})\s+(.+)$/.exec(line.trim());
  if (!match) return null;
  const level = match[1].length as 2 | 3 | 4;
  return { level, text: match[2] };
}

export function ArticleBody({ post }: { post: BlogPost }) {
  const lines = post.body.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const key = `b-${index}`;
    if (line.trim() === '---') {
      blocks.push(<hr key={key} className="border-[#203337]/15" />);
      index += 1;
      continue;
    }
    const head = heading(line);
    if (head) {
      const className = head.level === 2
        ? 'font-heading text-2xl tracking-tight'
        : 'font-heading text-xl tracking-tight';
      blocks.push(head.level === 2
        ? <h2 key={key} className={className}>{inline(head.text, key)}</h2>
        : head.level === 3
          ? <h3 key={key} className={className}>{inline(head.text, key)}</h3>
          : <h4 key={key} className="text-lg font-semibold">{inline(head.text, key)}</h4>);
      index += 1;
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && (lines[index]?.startsWith('>') || (lines[index]?.trim() === '' && lines[index + 1]?.startsWith('>')))) {
        if (lines[index]?.trim()) quote.push((lines[index] ?? '').replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={key} className="border-l-4 border-[var(--ps-cyan-border)] pl-4 text-[#203337]/80">
          {quote.map((part, quoteIndex) => <p key={`${key}-${quoteIndex}`}>{inline(part, `${key}-${quoteIndex}`)}</p>)}
        </blockquote>,
      );
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^[-*] /, ''));
        index += 1;
      }
      blocks.push(
        <ul key={key} className="list-disc space-y-2 pl-5">
          {items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>)}
        </ul>,
      );
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\d+\. /, ''));
        index += 1;
      }
      blocks.push(
        <ol key={key} className="list-decimal space-y-2 pl-5">
          {items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>)}
        </ol>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && (lines[index] ?? '').trim() && !heading(lines[index] ?? '') && !(lines[index] ?? '').startsWith('>') && !/^[-*] /.test(lines[index] ?? '') && !/^\d+\. /.test(lines[index] ?? '') && (lines[index] ?? '').trim() !== '---') {
      paragraph.push((lines[index] ?? '').trim());
      index += 1;
    }
    blocks.push(<p key={key}>{inline(paragraph.join(' '), key)}</p>);
  }

  return <div className="space-y-5 text-[17px] leading-8 text-[#203337]">{blocks}</div>;
}

export function AffiliateNote({ post }: { post: BlogPost }) {
  if (!post.affiliate && post.category !== 'Book Reviews') return null;
  return (
    <p className="mt-6 rounded-2xl border border-[var(--ps-cyan-border)]/60 bg-[var(--ps-cyan-soft)] px-4 py-3 text-sm leading-6 text-[#203337]">
      <strong>Disclosure. </strong>{AFFILIATE_DISCLOSURE}
    </p>
  );
}

function CtaLink({ link, primary }: { link: BlogLink; primary: boolean }) {
  const className = primary
    ? 'inline-flex min-h-11 items-center rounded-full border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)] px-5 text-sm font-bold text-[#203337]'
    : 'inline-flex min-h-11 items-center rounded-full border border-white/25 px-5 text-sm font-bold';
  if (isAffiliateToken(link.href)) {
    return <a href={link.href} rel={AFFILIATE_REL} className={className}>{link.label}</a>;
  }
  if (link.href.startsWith('/') && !link.href.startsWith('//')) {
    return <Link href={link.href} className={className}>{link.label}</Link>;
  }
  if (link.href.startsWith('mailto:') || link.href.startsWith('https://')) {
    return <a href={link.href} className={className} rel="noopener noreferrer">{link.label}</a>;
  }
  return null;
}

export function ArticleCta({ post }: { post: BlogPost }) {
  const links = post.ctaLinks.length > 0
    ? post.ctaLinks
    : [
      { label: 'See the offer', href: '/offer' },
      { label: 'Create an account', href: '/signup' },
    ];
  return (
    <aside className="mt-10 rounded-3xl bg-[#203337] px-6 py-7 text-white sm:px-8">
      <h2 className="font-heading text-2xl tracking-tight">{post.ctaTitle}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">{post.ctaBody}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {links.map((link, index) => <CtaLink key={`${link.href}-${index}`} link={link} primary={index === 0} />)}
      </div>
    </aside>
  );
}

export function Cover({ post, className = '' }: { post: BlogPost; className?: string }) {
  if (post.coverImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.coverImage} alt="" className={`w-full object-cover ${className}`} />
    );
  }
  return (
    <div className={className} style={{ background: 'var(--ps-hero)' }} aria-hidden />
  );
}
