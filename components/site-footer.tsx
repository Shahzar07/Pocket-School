'use client';

/**
 * Global site footer — legal links, company identity and the mandatory
 * examination-board non-affiliation disclaimer. Hidden inside the dashboard
 * and immersive AI surfaces, which have their own chrome.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, Instagram, Linkedin, Youtube, Mail } from 'lucide-react';
import { LEGAL_ENTITY, LEGAL_COMPANY_NO } from '@/lib/legal-content';

const HIDDEN_PREFIXES = ['/dashboard', '/ai-studio', '/ai-teachers/', '/onboarding', '/verify'];

const PLATFORM_LINKS = [
  { label: 'AI Studio (Quill)', href: '/ai-studio' },
  { label: 'AI Teachers (Ayla)', href: '/ai-teachers' },
  { label: 'Marketplace', href: '/courses' },
  { label: 'Pricing', href: '/pricing' },
];

const LEGAL_LINKS = [
  { label: 'Terms of Service', href: '/legal?doc=terms' },
  { label: 'Privacy Policy', href: '/legal?doc=privacy' },
  { label: 'Cookie Policy', href: '/legal?doc=cookies' },
  { label: 'Creator Agreement', href: '/legal?doc=creator' },
  { label: 'Acceptable Use', href: '/legal?doc=aup' },
];

const CONTACT_LINKS = [
  { label: 'Support', href: 'mailto:support@poketschool.ai' },
  { label: 'Teach with us', href: 'mailto:educators@poketschool.ai' },
  { label: 'Institutions', href: 'mailto:institutions@poketschool.ai' },
  { label: 'Privacy requests', href: 'mailto:privacy@poketschool.ai' },
];

export function SiteFooter() {
  const pathname = usePathname() || '';
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null;

  return (
    <footer className="border-t border-border bg-muted/20 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </span>
              <span className="font-bold text-foreground">Poket School</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              AI-powered adaptive learning for IGCSE, A Level, degrees and professional
              programmes — built around how you think.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {[
                { Icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
                { Icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
                { Icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
                { Icon: Mail, href: 'mailto:hello@poketschool.ai', label: 'Email' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label} href={href} aria-label={label}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer' : undefined}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {[
            { title: 'Platform', links: PLATFORM_LINKS },
            { title: 'Legal', links: LEGAL_LINKS },
            { title: 'Contact', links: CONTACT_LINKS },
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-foreground mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(l => (
                  <li key={l.label}>
                    {l.href.startsWith('mailto:') ? (
                      <a href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
                    ) : (
                      <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Mandatory disclaimer — must be visible, not buried */}
        <div className="rounded-2xl border border-border bg-card px-5 py-4 mb-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Independent platform.</strong> Poket School is an
            independent learning and preparation platform. We are not affiliated with, endorsed by,
            or accredited by Cambridge Assessment International Education, Pearson Edexcel, AQA, the
            Malaysian Ministry of Education, or any other examination board or government body. All
            curriculum references are for alignment and preparation purposes only. Certificates
            issued by Poket School are platform-specific and do not constitute official academic
            qualifications.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            © {new Date().getFullYear()} {LEGAL_ENTITY} ({LEGAL_COMPANY_NO}) trading as Poket School. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made in Malaysia · <a href="mailto:hello@poketschool.ai" className="hover:text-foreground transition-colors">hello@poketschool.ai</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
