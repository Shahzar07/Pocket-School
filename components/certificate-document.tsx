'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Award, Download, Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CERTIFICATE_DISCLAIMER,
  CERTIFICATE_ISSUER_NAME,
  type CertificateFace,
  buildCertificatePdf,
  certificateCopyright,
  certificateDocumentHtml,
  certificateStatus,
  certificateVerifyPath,
  certificateVerifyUrl,
  formatCertificateDate,
} from '@/lib/certificates';
import { linkedInCertificationUrl } from '@/lib/credentials/badge-model';

function origin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.origin;
}

function issuedIso(value: CertificateFace['issuedAt']): string {
  try {
    const date = value instanceof Date
      ? value
      : value && typeof value === 'object' && typeof value.toDate === 'function'
        ? value.toDate()
        : typeof value === 'string' || typeof value === 'number'
          ? new Date(value)
          : null;
    if (!date || Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function downloadCertificate(face: CertificateFace) {
  const bytes = buildCertificatePdf(face, origin());
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `poket-school-${face.id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export function printCertificate(face: CertificateFace) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    toast.error(i18n.t('certificate.popup'));
    return;
  }
  win.document.write(certificateDocumentHtml(face, origin()));
  win.document.close();
}

export async function shareCertificate(face: CertificateFace) {
  const url = certificateVerifyUrl(face.id, origin());
  const title = 'Poket School certificate';
  const text = `${face.studentName} completed ${face.moduleTitle || face.courseTitle}`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
    }
  }
  await navigator.clipboard.writeText(url);
  toast.success(i18n.t('certificate.copied'));
}

export function CertificateDocument({
  certificate,
  actions = true,
  compact = false,
}: {
  certificate: CertificateFace;
  actions?: boolean;
  compact?: boolean;
}) {
  const moduleTitle = certificate.moduleTitle?.trim();
  const path = certificateVerifyPath(certificate.id);
  const status = certificateStatus(certificate.status);
  const [verify, setVerify] = useState(() => certificateVerifyUrl(certificate.id));
  useEffect(() => {
    setVerify(`${window.location.origin}${path}`);
  }, [path]);
  return (
    <div className={compact ? '' : 'bg-card border border-border rounded-3xl overflow-hidden card-glow'}>
      <div className="bg-white text-[#1c2b30] border-[10px] border-[#1E6A83] m-3 sm:m-4 rounded-sm">
        <div className="border-2 border-primary px-6 py-8 sm:px-10 sm:py-10 text-center">
          <div className="flex items-center justify-center gap-2 text-[#1E6A83]">
            <Award className="w-4 h-4" />
            <p className="text-[11px] font-bold tracking-[0.28em]">POKET SCHOOL</p>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl mt-3 text-[#1c2b30]">Certificate of Achievement</h2>
          <p className={`inline-block mt-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] ${status === 'revoked' ? 'bg-[#FDE8E8] text-[#9B1C1C]' : 'bg-[#E7F6F1] text-[#0F6E56]'}`}>
            {status === 'revoked' ? 'Revoked' : 'Valid'}
          </p>
          <p className="text-sm text-[#526066] mt-4">This is to certify that</p>
          <p className="font-heading text-3xl italic text-[#1E6A83] mt-2">{certificate.studentName}</p>
          <p className="text-sm text-[#526066] mt-4">has completed the module</p>
          <p className="font-heading text-2xl mt-1">{moduleTitle || certificate.courseTitle}</p>
          {moduleTitle ? <p className="text-sm text-[#526066] mt-1">{certificate.courseTitle}</p> : null}
          <p className="text-sm text-[#526066] mt-4">
            {formatCertificateDate(certificate.issuedAt)} · {certificate.issuedByName || CERTIFICATE_ISSUER_NAME}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-5">
            <div className="bg-white p-2 border border-[#DADCE0]">
              <QRCodeSVG
                value={verify}
                size={168}
                level="M"
                marginSize={4}
                bgColor="#ffffff"
                fgColor="#111111"
                title="Scan to open the public verification page for this certificate"
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#526066] mt-1">Scan to verify</p>
            </div>
            <div className="text-left min-w-0 max-w-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#526066]">Certificate ID</p>
              <p className="font-mono text-sm break-all text-[#1c2b30]">{certificate.id}</p>
              <p className="text-[11px] text-[#526066] mt-2">Scanning the QR code opens</p>
              <p className="font-mono text-[11px] break-all text-[#1E6A83] mt-1">{verify}</p>
            </div>
          </div>
          <p className="text-[11px] text-[#6b7c82] mt-6 max-w-md mx-auto leading-relaxed">{CERTIFICATE_DISCLAIMER}</p>
          <p className="text-[11px] text-[#6b7c82] mt-3">{certificateCopyright(certificate.issuedAt)}</p>
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <Button type="button" size="sm" variant="outline" className="rounded-full font-bold gap-2" onClick={() => downloadCertificate(certificate)}>
            <Download className="w-3.5 h-3.5" /> Download PDF
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full font-bold gap-2" onClick={() => printCertificate(certificate)}>
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full font-bold gap-2" onClick={() => shareCertificate(certificate).catch(() => toast.error(i18n.t('certificate.shareFailed')))}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
          <a
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-full font-bold')}
            href={linkedInCertificationUrl({
              name: moduleTitle || certificate.courseTitle,
              issuedAt: issuedIso(certificate.issuedAt),
              certUrl: verify,
              certId: certificate.id,
            })}
            target="_blank"
            rel="noreferrer"
          >
            Add to LinkedIn
          </a>
          <a className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-full font-bold')} href={`/api/credentials/${encodeURIComponent(certificate.id)}/image`}>
            Download badge
          </a>
        </div>
      ) : null}
    </div>
  );
}
