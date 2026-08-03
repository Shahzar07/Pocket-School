'use client';

/**
 * The site footer — one footer, rendered once from the root layout.
 *
 * This is the original liquid-glass footer design, with the legal content it
 * was missing folded in: working links to the legal documents (they used to
 * be href="#"), the registered entity and company number, and the mandatory
 * examination-board non-affiliation disclaimer.
 *
 * Placement rules live here rather than in each page, so there is exactly one
 * place that decides whether a footer appears. Pages must not render their own.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { Brain, Sparkles, Instagram, Twitter, Youtube, Facebook, Music2 } from 'lucide-react';
import { LEGAL_ENTITY, LEGAL_COMPANY_NO } from '@/lib/legal-content';

/**
 * Routes with no footer: authenticated app chrome, immersive AI surfaces, and
 * the auth flows — a marketing footer under a login form is noise.
 */
const HIDDEN_PREFIXES = [
  '/dashboard',
  '/ai-studio',
  '/ai-teachers/',
  '/onboarding',
  '/verify',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

const FOOTER_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260429_114316_1c7889ad-2885-410e-b493-98119fee0ddb.mp4';

const PLATFORM_LINKS = [
  { label: 'AI Teachers', href: '/ai-teachers' },
  { label: 'AI Studio', href: '/ai-studio' },
  { label: 'Marketplace', href: '/courses' },
  { label: 'Pricing', href: '/pricing' },
];

const LEARNER_LINKS = [
  { label: 'Students', href: '/signup?role=student' },
  { label: 'Teachers', href: '/signup?role=teacher' },
  { label: 'Parents', href: '/signup?role=parent' },
  { label: 'Institutions', href: 'mailto:institutions@poketschool.ai' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/legal?doc=privacy' },
  { label: 'Terms of Service', href: '/legal?doc=terms' },
  { label: 'Cookie Policy', href: '/legal?doc=cookies' },
  { label: 'Acceptable Use', href: '/legal?doc=aup' },
  { label: 'Contact', href: 'mailto:hello@poketschool.ai' },
];

const SOCIALS = [
  { Icon: Instagram, label: 'Instagram', href: 'https://instagram.com' },
  { Icon: Twitter, label: 'Twitter', href: 'https://twitter.com' },
  { Icon: Youtube, label: 'YouTube', href: 'https://youtube.com' },
  { Icon: Facebook, label: 'Facebook', href: 'https://facebook.com' },
  { Icon: Music2, label: 'TikTok', href: 'https://tiktok.com' },
];

function FooterLink({ href, label }: { href: string; label: string }) {
  const external = href.startsWith('http') || href.startsWith('mailto:');
  if (external) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noreferrer' : undefined}
        className="hover:text-white transition-colors"
      >
        {label}
      </a>
    );
  }
  return <Link href={href} className="hover:text-white transition-colors">{label}</Link>;
}

export function SiteFooter() {
  const pathname = usePathname() || '';
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null;

  // The video treatment belongs to the landing page; elsewhere it would drag a
  // large autoplaying asset onto pages that never asked for one.
  const withVideo = pathname === '/';

  return (
    <section className="relative w-full overflow-hidden bg-black print:hidden">
      {withVideo && (
        <>
          <video
            src={FOOTER_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
          <div className="absolute inset-0 bg-black/40 z-[1]" />
        </>
      )}

      <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-8 ${withVideo ? 'pt-32 sm:pt-48' : 'pt-12'}`}>
        <motion.footer
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
          className="liquid-glass w-full rounded-3xl p-6 md:p-10 text-white/70"
        >
          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 mb-10">
            {/* Brand block */}
            <div className="md:col-span-5">
              <Link href="/" className="flex items-center gap-2 text-white mb-4 w-fit">
                <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-white/20">
                  <Brain className="w-5 h-5" />
                </div>
                <span className="text-xl font-semibold">Poket School</span>
              </Link>
              <p className="text-sm leading-relaxed max-w-sm text-white/60">
                AI-powered adaptive learning for IGCSE, A-Levels, degrees and beyond — built around how you think.
              </p>
              <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-white/70">
                <Sparkles className="w-3 h-3 text-[#F5B400]" />
                AI-Powered Platform
              </div>
            </div>

            {/* Link columns */}
            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { title: 'Platform', links: PLATFORM_LINKS },
                { title: 'For Learners', links: LEARNER_LINKS },
                { title: 'Legal', links: LEGAL_LINKS },
              ].map(col => (
                <div key={col.title}>
                  <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">{col.title}</h4>
                  <ul className="text-xs space-y-2.5">
                    {col.links.map(l => (
                      <li key={l.label}><FooterLink href={l.href} label={l.label} /></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Mandatory non-affiliation disclaimer — must be visible, not buried */}
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 mb-8">
            <p className="text-[11px] leading-relaxed text-white/55">
              <strong className="text-white/80 font-semibold">Independent platform.</strong> Poket School is an
              independent learning and preparation platform. We are not affiliated with, endorsed by, or
              accredited by Cambridge Assessment International Education, Pearson Edexcel, AQA, the Malaysian
              Ministry of Education, or any other examination board or government body. All curriculum
              references are for alignment and preparation purposes only. Certificates issued by Poket School
              are platform-specific and do not constitute official academic qualifications.
            </p>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
            <p className="text-[10px] uppercase tracking-widest opacity-50 text-center md:text-left">
              &copy; {new Date().getFullYear()} {LEGAL_ENTITY} ({LEGAL_COMPANY_NO}) trading as Poket School · Made in Malaysia
            </p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase tracking-widest opacity-50">Follow Us:</span>
              <div className="flex items-center gap-3">
                {SOCIALS.map(({ Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="opacity-70 hover:opacity-100 transition-opacity hover:text-white"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </motion.footer>
      </div>
    </section>
  );
}
