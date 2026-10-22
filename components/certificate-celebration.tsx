'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CloseControl, useLayerDismiss } from '@/components/ui/close-control';
import { CertificateDocument } from '@/components/certificate-document';
import type { CertificateAward } from '@/lib/certificates';

const CONFETTI = [
  'bg-primary', 'bg-[#1E6A83]', 'bg-[#1E6A83]', 'bg-[#81B29A]', 'bg-[#1E6A83]', 'bg-white',
];

export function CertificateCelebration({
  award,
  onClose,
}: {
  award: CertificateAward | null;
  onClose: () => void;
}) {
  useLayerDismiss(award !== null, onClose);
  if (!award) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Close celebration" className="absolute inset-0 bg-[#122026]/70" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-labelledby="certificate-celebration-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#f7fbfc] shadow-2xl"
      >
        <CloseControl onClose={onClose} className="absolute top-2 right-2 z-10 text-[#203337]" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          {CONFETTI.concat(CONFETTI, CONFETTI).map((color, index) => (
            <motion.span
              key={`${color}-${index}`}
              className={`absolute top-0 h-2 w-2 rounded-sm ${color}`}
              style={{ left: `${(index * 17) % 100}%` }}
              initial={{ y: -12, rotate: 0, opacity: 0 }}
              animate={{ y: 280 + (index % 5) * 40, rotate: 180, opacity: [0, 1, 0] }}
              transition={{ duration: 1.8 + (index % 4) * 0.25, delay: (index % 8) * 0.05, ease: 'easeOut' }}
            />
          ))}
        </div>
        <div className="relative px-5 pt-6 pb-5 sm:px-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center">
              <Award className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p id="certificate-celebration-title" className="font-heading text-2xl text-[#1c2b30]">Module complete</p>
              <p className="text-sm text-[#526066]">{award.moduleTitle} · {award.courseTitle}</p>
            </div>
          </div>
          <CertificateDocument certificate={award} />
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/dashboard/student/certificates" onClick={onClose}>
              <Button className="rounded-full h-11 px-5 font-bold bg-primary text-primary-foreground border-0">
                View my certificates
              </Button>
            </Link>
            <Button type="button" variant="outline" className="rounded-full h-11 px-5 font-bold" onClick={onClose}>
              Keep learning
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
