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
  certificateAccent,
  certificateDocumentHtml,
  certificateHeader,
  certificateStatus,
  certificateStudentNumber,
  certificateVerifyPath,
  certificateVerifyUrl,
  displayLogoUrl,
  formatCertificateDate,
} from '@/lib/certificates';
import { linkedInCertificationUrl, shareLinks } from '@/lib/credentials/badge-model';

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
  const studentNumber = certificateStudentNumber(certificate.studentNumber);
  const path = certificateVerifyPath(certificate.id);
  const status = certificateStatus(certificate.status);
  const header = certificateHeader(certificate);
  const accent = certificateAccent(certificate.accent) ?? '#1E6A83';
  const logo = displayLogoUrl(certificate.logoUrl);
  const [verify, setVerify] = useState(() => certificateVerifyUrl(certificate.id));
  const [organizationId, setOrganizationId] = useState('');
  useEffect(() => {
    setVerify(`${window.location.origin}${path}`);
  }, [path]);
  useEffect(() => {
    fetch('/api/auth/linkedin')
      .then((response) => response.json())
      .then((data: { organizationId?: string }) => {
        if (typeof data.organizationId === 'string') setOrganizationId(data.organizationId);
      })
      .catch(() => undefined);
  }, []);
  return (
    <div className={compact ? '' : 'bg-card border border-border rounded-3xl overflow-hidden card-glow'}>
      <div className="bg-white text-[#1c2b30] border-[10px] m-3 sm:m-4 rounded-sm" style={{ borderColor: accent }}>
        <div className="border-2 px-6 py-8 sm:px-10 sm:py-10 text-center" style={{ borderColor: accent }}>
          <div className="flex flex-col items-center justify-center gap-2" style={{ color: accent }}>
            {logo ? <img src={logo} alt="" className="h-14 w-14 object-contain" /> : <Award className="w-4 h-4" />}
            <p className="text-[11px] font-bold tracking-[0.28em]">{header.brand}</p>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl mt-3 text-[#1c2b30]">Certificate of Achievement</h2>
          <p className={`inline-block mt-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] ${status === 'revoked' ? 'bg-[#E9F7FA] text-[#1E6A83]' : 'bg-[#E7F6F1] text-[#0F6E56]'}`}>
            {status === 'revoked' ? 'Revoked' : 'Valid'}
          </p>
          <p className="text-sm text-[#526066] mt-4">This is to certify that</p>
          <p className="font-heading text-3xl italic mt-2" style={{ color: accent }}>{certificate.studentName}</p>
          {studentNumber ? (
            <p className="mt-3 text-sm text-[#1c2b30]">
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#526066]">Student number</span>
              <span className="font-mono text-lg tracking-wide">{studentNumber}</span>
            </p>
          ) : null}
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
              {studentNumber ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#526066]">Student number</p>
                  <p className="font-mono text-sm text-[#1c2b30]">{studentNumber}</p>
                </>
              ) : null}
              <p className={`text-[10px] font-bold uppercase tracking-[0.16em] text-[#526066] ${studentNumber ? 'mt-3' : ''}`}>Certificate ID</p>
              <p className="font-mono text-sm break-all text-[#1c2b30]">{certificate.id}</p>
              <p className="text-[11px] text-[#526066] mt-2">Scanning the QR code opens</p>
              <p className="font-mono text-[11px] break-all text-[#1E6A83] mt-1">{verify}</p>
            </div>
          </div>
          <p className="text-[11px] text-[#6b7c82] mt-6 max-w-md mx-auto leading-relaxed">{CERTIFICATE_DISCLAIMER}</p>
          {certificate.certificateFooter?.trim() ? <p className="text-[11px] text-[#6b7c82] mt-3 max-w-md mx-auto">{certificate.certificateFooter.trim()}</p> : null}
          <p className="text-[11px] text-[#6b7c82] mt-3">{certificateCopyright(certificate.issuedAt)}</p>
          {header.poweredBy ? <p className="text-[11px] text-[#6b7c82] mt-2">Powered by Poket School</p> : null}
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
              organizationId,
              issuedAt: issuedIso(certificate.issuedAt),
              certUrl: verify,
              certId: certificate.id,
            })}
            target="_blank"
            rel="noreferrer"
          >
            Add to LinkedIn
          </a>
          <a
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-full font-bold')}
            href={shareLinks(verify, moduleTitle || certificate.courseTitle).linkedin}
            target="_blank"
            rel="noreferrer"
          >
            Share to LinkedIn
          </a>
          <a className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-full font-bold')} href={`/api/credentials/${encodeURIComponent(certificate.id)}/image`}>
            Download badge
          </a>
        </div>
      ) : null}
    </div>
  );
}
