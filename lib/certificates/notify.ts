import 'server-only';

import { brandedMailHtml, mailFromHeader } from '../academy-mail';
import { smtpConfigured } from '../documents/delivery';
import { certificateVerifyUrl, publicSiteOrigin } from '../certificates';

/** Emails a PDF link. Missing SMTP, or a send failure, does not block issuance. */
export async function emailCertificatePdfLink(input: {
  to: string;
  studentName: string;
  courseTitle: string;
  certificateId: string;
}): Promise<boolean> {
  const to = input.to.trim();
  if (!to.includes('@')) return false;
  const env = {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
  if (!smtpConfigured(env)) return false;
  const origin = publicSiteOrigin();
  const pdfUrl = `${origin}/api/certificates/${encodeURIComponent(input.certificateId)}/pdf`;
  const verifyUrl = certificateVerifyUrl(input.certificateId, origin);
  try {
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: env.host,
      port,
      secure: port === 465,
      auth: { user: env.user, pass: env.pass },
    });
    const heading = `${input.studentName} passed ${input.courseTitle}`;
    await transport.sendMail({
      from: mailFromHeader('Poket School'),
      to,
      subject: `Your Poket School certificate for ${input.courseTitle}`,
      text: `${heading}\n\nDownload the PDF: ${pdfUrl}\nVerify the certificate: ${verifyUrl}\n`,
      html: brandedMailHtml({
        heading,
        paragraphs: [
          `Download the PDF: ${pdfUrl}`,
          `Verify this certificate: ${verifyUrl}`,
        ],
      }),
    });
    return true;
  } catch (error) {
    console.error('Certificate email skipped', error);
    return false;
  }
}
