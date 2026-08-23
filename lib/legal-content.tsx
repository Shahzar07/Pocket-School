import type { ReactNode } from 'react';

/**
 * Legal document content for Poket School.
 * Operator: Poket Media Sdn Bhd (1332289-X) trading as Poket School.
 * Kept as data so the /legal page, the signup consent links and any future
 * PDF export all render from one source of truth.
 */

export const LEGAL_ENTITY = 'Poket Media Sdn Bhd';
export const LEGAL_COMPANY_NO = '1332289-X';
export const LEGAL_UPDATED = '21 July 2026';

export interface LegalDoc {
  id: string;
  title: string;
  meta: string;
  intro?: { tone: 'info' | 'warn' | 'danger'; text: string };
  sections: LegalSection[];
}

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export type LegalBlock =
  | { type: 'p'; text: ReactNode }
  | { type: 'sub'; text: string }
  | { type: 'ul'; items: ReactNode[] }
  | { type: 'ol'; items: ReactNode[] }
  | { type: 'callout'; tone: 'info' | 'warn' | 'danger'; text: ReactNode }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'contact'; title: string; rows: { label: string; value: string; href?: string }[] };

export const LEGAL_DOCS: LegalDoc[] = [
  /* ── 1. TERMS OF SERVICE ─────────────────────────────────── */
  {
    id: 'terms',
    title: 'Terms of Service',
    meta: `Last updated: ${LEGAL_UPDATED} · Effective: ${LEGAL_UPDATED} · Governed by: Malaysian Law`,
    intro: {
      tone: 'info',
      text: 'Please read these Terms of Service carefully before using the Poket School platform. By accessing or using any part of the platform, you agree to be bound by these Terms. If you do not agree, you must not use the platform.',
    },
    sections: [
      {
        heading: '1. Who We Are',
        blocks: [
          { type: 'p', text: <>Poket School is an online learning platform operated by <strong>Poket Media Sdn Bhd</strong> (Company No. 1332289-X), a company incorporated in Malaysia.</> },
          { type: 'p', text: 'References to "Poket School," "we," "us," or "our" in these Terms refer to Poket Media Sdn Bhd. References to "you" or "the user" refer to any individual or entity accessing or using the platform, including students, parents, teachers, institutions, and community members.' },
          { type: 'p', text: 'The platform is accessible at poketschool.ai and through any associated mobile applications.' },
        ],
      },
      {
        heading: '2. The Platform and Its Services',
        blocks: [
          { type: 'p', text: 'Poket School provides an AI-powered educational platform offering the following services:' },
          {
            type: 'ul',
            items: [
              <><strong>Student Learning Platform:</strong> AI-assisted lessons, quizzes, flashcards, study plans, and tutoring across multiple academic programmes including IGCSE, A Level, SPM, and professional certification tracks.</>,
              <><strong>AI Tutor (Ayla):</strong> A conversational AI tutoring assistant powered by third-party large language model technology, providing Socratic-style academic support.</>,
              <><strong>Content Generator (ET):</strong> An AI-powered tool for generating study materials including flashcards, quizzes, audio summaries, mind maps, and video lessons.</>,
              <><strong>Teacher Marketplace:</strong> A platform for independent teachers and institutions to publish, sell, and manage educational courses.</>,
              <><strong>Institution Management:</strong> Administrative tools for schools and educational organisations to manage students, teachers, content, and reporting.</>,
              <><strong>Sparks Economy:</strong> A credit-based system enabling access to AI features above the base subscription allowance.</>,
            ],
          },
        ],
      },
      {
        heading: '3. Academic Affiliation Disclaimer',
        blocks: [
          {
            type: 'callout',
            tone: 'danger',
            text: <><strong>Important:</strong> Poket School is an independent learning and preparation platform. We are not affiliated with, endorsed by, or accredited by Cambridge Assessment International Education, Pearson Edexcel, AQA, the Malaysian Ministry of Education (KPM), or any other examination board or government body. All curriculum references are for alignment and preparation purposes only. Poket School certificates are platform-specific and do not constitute official academic qualifications.</>,
          },
        ],
      },
      {
        heading: '4. Account Registration and Eligibility',
        blocks: [
          { type: 'sub', text: '4.1 Age Requirements' },
          { type: 'p', text: 'You must be at least 13 years of age to create an account on Poket School. Users under the age of 18 must have verifiable parental or guardian consent to register and use the platform. By registering on behalf of a minor, you confirm that you are the parent or legal guardian of that minor and that you consent to these Terms on their behalf.' },
          { type: 'sub', text: '4.2 Accurate Information' },
          { type: 'p', text: 'You agree to provide accurate, current, and complete information during registration and to keep your account information updated. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.' },
          { type: 'sub', text: '4.3 Account Types' },
          { type: 'p', text: 'Poket School offers distinct account types including Student, Parent, Teacher, and Institution Administrator accounts. Each account type carries specific permissions, responsibilities, and features as described in the platform documentation.' },
        ],
      },
      {
        heading: '5. Subscriptions, Payments, and Sparks',
        blocks: [
          { type: 'sub', text: '5.1 Subscription Plans' },
          { type: 'p', text: 'Access to the full platform requires an active paid subscription. Subscription fees are determined by the geographic pricing tier applicable to your location and the programme track selected. Current pricing is published on our pricing page. We reserve the right to modify pricing with at least 30 days’ notice to existing subscribers.' },
          { type: 'sub', text: '5.2 Billing and Renewal' },
          { type: 'p', text: 'Subscriptions are billed monthly or annually as selected at the time of purchase. Annual subscriptions are offered at a discounted rate. Subscriptions automatically renew at the end of each billing period unless cancelled before the renewal date. You may cancel at any time through your account settings.' },
          { type: 'sub', text: '5.3 Refund Policy' },
          { type: 'p', text: 'Monthly subscriptions are non-refundable once a billing period has commenced. For annual subscriptions, a pro-rated refund may be requested within 14 days of the billing date by contacting billing@poketschool.ai. Sparks credit pack purchases are non-refundable once purchased. Sparks do not expire and roll over indefinitely.' },
          { type: 'sub', text: '5.4 Sparks Credits' },
          { type: 'p', text: 'Sparks are platform credits used to access AI-powered features above the base subscription allowance. Sparks are purchased in packs and deducted upon use of eligible features. Sparks have no monetary value and cannot be transferred, sold, or redeemed for cash. Upon account termination, any unused Sparks are forfeited.' },
        ],
      },
      {
        heading: '6. AI Features — Limitations and Accuracy',
        blocks: [
          {
            type: 'callout',
            tone: 'warn',
            text: <><strong>AI-generated content is not infallible.</strong> Ayla, ET, and all AI features on the platform are powered by large language model technology and may produce responses that are inaccurate, incomplete, or misleading. AI-generated content should always be verified against authoritative academic sources before reliance, particularly for examination preparation.</>,
          },
          { type: 'p', text: 'You acknowledge and agree that:' },
          {
            type: 'ul',
            items: [
              'AI tutoring responses are for educational support purposes only and do not constitute professional academic advice.',
              'AI-generated flashcards, quizzes, and study materials should be reviewed for accuracy before use.',
              'Poket School is not liable for any examination results, academic outcomes, or decisions made in reliance on AI-generated content.',
              'AI conversations may be reviewed by Poket School for quality, safety, and improvement purposes in accordance with our Privacy Policy.',
            ],
          },
        ],
      },
      {
        heading: '7. Teacher and Institution Content',
        blocks: [
          { type: 'p', text: 'Teachers and institutions publishing content on the Poket School Marketplace ("Content Providers") agree to the additional terms set out in the Content Creator Agreement. In summary:' },
          {
            type: 'ul',
            items: [
              'Content Providers are solely responsible for the accuracy, legality, quality, and appropriateness of all content they publish.',
              'Poket School does not pre-approve, verify, or endorse Content Provider content before publication.',
              'Content Providers warrant that their content does not infringe third-party intellectual property rights and complies with all applicable laws.',
              'Revenue sharing is governed by the Content Creator Agreement: 70% to the Content Provider for Marketplace sales and 60% for institution-allocated content.',
              'Poket School reserves the right to remove any content that violates these Terms or the Content Creator Agreement without prior notice.',
            ],
          },
        ],
      },
      {
        heading: '8. Intellectual Property',
        blocks: [
          { type: 'sub', text: '8.1 Platform Content' },
          { type: 'p', text: 'All content created by Poket School — including original course materials, platform design, software, AI systems, branding, and documentation — is the intellectual property of Poket Media Sdn Bhd and is protected by Malaysian and international copyright law.' },
          { type: 'sub', text: '8.2 User-Generated Content' },
          { type: 'p', text: 'By submitting content to the platform you grant Poket School a non-exclusive, royalty-free, worldwide licence to use, store, display, and reproduce that content solely for the purposes of operating and improving the platform. You retain ownership of your original content.' },
          { type: 'sub', text: '8.3 AI-Generated Content' },
          { type: 'p', text: 'Content generated by AI features (Ayla, ET) in response to your inputs may be used by you for personal educational purposes. You may not resell, commercially reproduce, or publish AI-generated content as your own original work without appropriate attribution and verification.' },
        ],
      },
      {
        heading: '9. Limitation of Liability',
        blocks: [
          { type: 'p', text: 'To the maximum extent permitted by Malaysian law, Poket Media Sdn Bhd and its directors, employees, agents, and affiliates shall not be liable for:' },
          {
            type: 'ul',
            items: [
              'Any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the platform.',
              'Loss of data, revenue, profits, or business opportunity.',
              'Examination results, academic outcomes, or institutional decisions made in reliance on platform content or AI outputs.',
              'Errors, interruptions, or unavailability of the platform or its AI features.',
              'Content published by independent Content Providers (teachers and institutions).',
            ],
          },
          { type: 'p', text: 'Our total liability to you for any claim arising from or related to these Terms or the platform shall not exceed the total subscription fees paid by you to Poket School in the 12 months immediately preceding the claim.' },
        ],
      },
      {
        heading: '10. Termination',
        blocks: [
          { type: 'p', text: 'You may terminate your account at any time by contacting support@poketschool.ai or through your account settings. We may suspend or terminate your account immediately if we determine that you have breached these Terms, engaged in fraudulent activity, or if required by law. Upon termination, your access to the platform will cease and any unused Sparks balance will be forfeited.' },
        ],
      },
      {
        heading: '11. Governing Law and Dispute Resolution',
        blocks: [
          { type: 'p', text: 'These Terms are governed by and construed in accordance with the laws of Malaysia. Any dispute arising from or in connection with these Terms shall first be subject to good-faith negotiation between the parties. If the dispute is not resolved within 30 days, it shall be submitted to the jurisdiction of the Courts of Malaysia, with the courts of Kuala Lumpur having non-exclusive jurisdiction.' },
        ],
      },
      {
        heading: '12. Changes to These Terms',
        blocks: [
          { type: 'p', text: 'We reserve the right to modify these Terms at any time. We will notify registered users of material changes by email or prominent notice on the platform at least 14 days before the changes take effect. Your continued use of the platform after the effective date constitutes acceptance of the revised Terms.' },
        ],
      },
      {
        heading: '13. Contact',
        blocks: [
          {
            type: 'contact',
            title: 'Poket Media Sdn Bhd — Legal',
            rows: [
              { label: 'Email', value: 'legal@poketschool.ai', href: 'mailto:legal@poketschool.ai' },
              { label: 'Address', value: 'Malaysia' },
              { label: 'Company No.', value: '1332289-X' },
            ],
          },
        ],
      },
    ],
  },

  /* ── 2. PRIVACY POLICY ───────────────────────────────────── */
  {
    id: 'privacy',
    title: 'Privacy Policy',
    meta: `Last updated: ${LEGAL_UPDATED} · Governed by: Malaysia PDPA 2010 (as amended 2024)`,
    intro: {
      tone: 'info',
      text: 'This Privacy Policy explains how Poket Media Sdn Bhd ("Poket School," "we," "us") collects, uses, stores, and protects personal data in compliance with the Malaysian Personal Data Protection Act 2010 (Act 709), as amended by the Personal Data Protection (Amendment) Act 2024, which came into full force in June 2025.',
    },
    sections: [
      {
        heading: '1. Data Controller and Data Protection Officer',
        blocks: [
          { type: 'p', text: 'Poket Media Sdn Bhd is the Data Controller responsible for your personal data processed in connection with the Poket School platform.' },
          { type: 'p', text: 'In compliance with the PDPA (Amendment) Act 2024, we have appointed a Data Protection Officer (DPO) responsible for ensuring our compliance with the PDPA, handling data subject requests, and serving as the point of contact with the Personal Data Protection Department.' },
          {
            type: 'contact',
            title: 'Data Protection Officer',
            rows: [
              { label: 'Email', value: 'dpo@poketschool.ai', href: 'mailto:dpo@poketschool.ai' },
              { label: 'Postal', value: 'Poket Media Sdn Bhd (1332289-X), Malaysia' },
            ],
          },
        ],
      },
      {
        heading: '2. Personal Data We Collect',
        blocks: [
          {
            type: 'table',
            head: ['Category', 'Data Collected', 'Applies To'],
            rows: [
              ['Account Data', 'Full name, email address, password (hashed), account type, country, preferred language, date of birth', 'All users'],
              ['Student Data', "Age, year group, enrolled programmes, learning style profile, Bloom's profile, quiz scores, lesson progress, daily goals, streaks, Sparks balance", 'Students'],
              ['Parent Data', 'Name, email, relationship to student, notification preferences, payment details', 'Parents/Guardians'],
              ['Teacher Data', 'Name, email, professional credentials, bank details for revenue payments, published courses, student analytics', 'Teachers/Creators'],
              ['Institution Data', 'Organisation name, registered address, contact person, registration number, teacher and student lists', 'Institutions'],
              ['AI Interaction Data', 'Conversation transcripts with Ayla and ET, AI-generated content requests, feedback and ratings', 'All users'],
              ['Payment Data', 'Transaction records, subscription tier, payment method type (full card numbers are never stored — processed by our payment provider)', 'Paying users'],
              ['Technical Data', 'IP address, device type, browser, operating system, session timestamps, cookies', 'All users'],
            ],
          },
        ],
      },
      {
        heading: "3. Children's Data and Parental Consent",
        blocks: [
          {
            type: 'callout',
            tone: 'warn',
            text: "We take children's privacy extremely seriously. In accordance with the Malaysian PDPA and general best practice, parental or guardian consent is required for processing the personal data of users under the age of 18. During signup we collect a date of birth; where the user is under 18 we require a parent or guardian email and verified consent before the account is activated.",
          },
          { type: 'p', text: 'We do not knowingly collect personal data from children under 13 years of age. If you believe we have inadvertently collected data from a child under 13, please contact our DPO immediately at dpo@poketschool.ai.' },
          { type: 'p', text: "Parents and guardians may at any time request access to, correction of, or deletion of their child's personal data by contacting privacy@poketschool.ai." },
        ],
      },
      {
        heading: '4. How We Use Your Personal Data',
        blocks: [
          {
            type: 'ul',
            items: [
              'To create and manage your account and provide platform access.',
              "To personalise the learning experience based on your Bloom's profile, learning style, and progress data.",
              'To power AI tutoring and generation features (Ayla and ET).',
              "To send parents and guardians notifications about their child's goal completion, progress, and platform activity.",
              'To process subscription payments and Sparks credit purchases.',
              'To pay teachers and Content Providers their revenue share.',
              'To generate report cards and academic progress reports for institutions.',
              'To send transactional emails (account verification, password reset, receipts).',
              'To improve the platform using anonymised interaction data.',
              'To comply with our legal obligations under Malaysian law.',
            ],
          },
        ],
      },
      {
        heading: '5. Legal Basis for Processing',
        blocks: [
          {
            type: 'ul',
            items: [
              <><strong>Consent:</strong> Where you or your parent/guardian have given explicit consent, including for AI interaction data and marketing communications.</>,
              <><strong>Contract:</strong> Processing necessary to perform our contract with you (your subscription agreement).</>,
              <><strong>Legal Obligation:</strong> Processing required to comply with Malaysian law, including the PDPA, tax law, and company law.</>,
              <><strong>Legitimate Interests:</strong> Processing for platform security, fraud prevention, and improving our services.</>,
            ],
          },
        ],
      },
      {
        heading: '6. Data Sharing and Third Parties',
        blocks: [
          { type: 'p', text: 'We do not sell your personal data. We share data with third parties only in the following circumstances:' },
          {
            type: 'ul',
            items: [
              <><strong>AI Model Providers:</strong> We use third-party AI infrastructure to power Ayla and ET. Conversation data is transmitted subject to their data processing agreements. We do not permit AI providers to use student data for model training beyond what is necessary to provide the service.</>,
              <><strong>Payment Processors:</strong> Subscription payments and Sparks purchases are processed by our payment provider. We share only the information necessary to complete transactions.</>,
              <><strong>Analytics Providers:</strong> Anonymised and aggregated usage data may be shared to help us understand platform usage patterns.</>,
              <><strong>Legal Authorities:</strong> We may disclose personal data where required by Malaysian law or a valid legal order.</>,
              <><strong>Institution Administrators:</strong> If you are enrolled through a school, your progress data, report cards, and attendance are visible to authorised administrators at that institution.</>,
            ],
          },
        ],
      },
      {
        heading: '7. Cross-Border Data Transfers',
        blocks: [
          { type: 'p', text: 'Poket School operates primarily in Malaysia. Some third-party service providers (including AI infrastructure and cloud hosting) may process data outside Malaysia. In accordance with the PDPA (Amendment) Act 2024, we conduct Transfer Impact Assessments for all cross-border transfers and ensure an adequate level of protection.' },
        ],
      },
      {
        heading: '8. Data Retention',
        blocks: [
          {
            type: 'table',
            head: ['Data Type', 'Retention Period'],
            rows: [
              ['Account data', 'Duration of account plus 7 years after closure (legal and tax compliance)'],
              ['Student learning data', 'Duration of active enrolment plus 3 years'],
              ['Payment records', '7 years from transaction date (tax law requirement)'],
              ['AI conversation logs', '12 months, then anonymised for quality purposes'],
              ['Teacher revenue records', '7 years from payment date'],
              ['Support communications', '3 years from last communication'],
            ],
          },
        ],
      },
      {
        heading: '9. Your Rights Under the PDPA',
        blocks: [
          {
            type: 'ul',
            items: [
              <><strong>Right of Access:</strong> Request a copy of the personal data we hold about you.</>,
              <><strong>Right of Correction:</strong> Request correction of inaccurate or incomplete data.</>,
              <><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time, without affecting prior lawful processing.</>,
              <><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format.</>,
              <><strong>Right to Restrict Processing:</strong> Limit processing of your data in certain circumstances.</>,
              <><strong>Right to Object:</strong> Object to processing based on legitimate interests.</>,
            ],
          },
          { type: 'p', text: 'To exercise any of these rights, contact privacy@poketschool.ai. We will respond within 21 days as required by the PDPA.' },
        ],
      },
      {
        heading: '10. Data Security and Breach Notification',
        blocks: [
          { type: 'p', text: 'We implement appropriate technical and organisational measures including encryption at rest and in transit, access controls, regular security audits, and staff training.' },
          { type: 'p', text: 'In the event of a personal data breach, we will:' },
          {
            type: 'ul',
            items: [
              <>Notify the Personal Data Protection Commissioner within <strong>72 hours</strong> of becoming aware of the breach.</>,
              <>Notify affected data subjects within <strong>7 days</strong> where the breach is likely to result in high risk to their rights and freedoms.</>,
              'Take immediate steps to contain and remediate the breach.',
            ],
          },
        ],
      },
      {
        heading: '11. Contact and Complaints',
        blocks: [
          { type: 'p', text: 'If you have concerns about how we handle your personal data, please contact our DPO first. If you are not satisfied with our response, you may lodge a complaint with the Personal Data Protection Department (JPDP) Malaysia at pdp.gov.my.' },
          {
            type: 'contact',
            title: 'Privacy Enquiries',
            rows: [
              { label: 'DPO Email', value: 'dpo@poketschool.ai', href: 'mailto:dpo@poketschool.ai' },
              { label: 'General Privacy', value: 'privacy@poketschool.ai', href: 'mailto:privacy@poketschool.ai' },
              { label: 'Response Time', value: 'Within 21 days of receipt' },
            ],
          },
        ],
      },
    ],
  },

  /* ── 3. COOKIE POLICY ────────────────────────────────────── */
  {
    id: 'cookies',
    title: 'Cookie Policy',
    meta: `Last updated: ${LEGAL_UPDATED}`,
    intro: {
      tone: 'info',
      text: 'This Cookie Policy explains how Poket School uses cookies and similar tracking technologies. You have the right to control which non-essential cookies we use.',
    },
    sections: [
      {
        heading: '1. What Are Cookies',
        blocks: [
          { type: 'p', text: 'Cookies are small text files placed on your device when you visit a website. They allow the platform to recognise your device, remember your preferences, maintain your session, and understand how you use the service. We also use similar technologies such as local storage for platform functionality.' },
        ],
      },
      {
        heading: '2. Cookies We Use',
        blocks: [
          {
            type: 'table',
            head: ['Type', 'Purpose', 'Can Be Disabled'],
            rows: [
              ['Essential', 'Required for the platform to function — session management, authentication tokens, security. Without these you cannot log in.', 'No'],
              ['Functional', 'Remember your preferences such as language, theme, and notification settings.', 'Yes'],
              ['Analytics', 'Help us understand how users interact with the platform. Data is aggregated and anonymised.', 'Yes'],
              ['AI Performance', 'Track interactions with Ayla and ET to improve response quality and personalisation.', 'Yes'],
              ['Marketing', 'We do not use marketing or advertising cookies. The platform is ad-free.', 'N/A'],
            ],
          },
        ],
      },
      {
        heading: '3. Managing Cookies',
        blocks: [
          { type: 'p', text: 'You can manage your preferences at any time using the cookie banner shown on your first visit, or by clearing site data in your browser. Disabling essential cookies will prevent you from using the platform.' },
        ],
      },
      {
        heading: '4. Contact',
        blocks: [{ type: 'p', text: 'If you have questions about our use of cookies, contact privacy@poketschool.ai.' }],
      },
    ],
  },

  /* ── 4. CONTENT CREATOR AGREEMENT ────────────────────────── */
  {
    id: 'creator',
    title: 'Content Creator Agreement',
    meta: `Applies to: Teachers, Independent Educators & Institutions publishing on the Marketplace · Last updated: ${LEGAL_UPDATED}`,
    intro: {
      tone: 'danger',
      text: 'Content Responsibility Notice: By publishing a course or educational content on the Poket School platform, you acknowledge and agree that you are solely and entirely responsible for the accuracy, legality, quality, and appropriateness of all content you create, upload, publish, or make available. Poket School does not review, verify, endorse, or guarantee the accuracy or completeness of any content created by Content Providers.',
    },
    sections: [
      {
        heading: '1. Who This Agreement Applies To',
        blocks: [
          { type: 'p', text: 'This Agreement applies to any individual or entity ("Content Provider") who creates, uploads, publishes, or makes available educational content on the Poket School platform through the Teacher or Institution account types. It forms part of the Poket School Terms of Service.' },
          { type: 'p', text: 'By clicking "Publish" or submitting content for review on the platform, you confirm that you have read, understood, and agree to be bound by this Agreement.' },
        ],
      },
      {
        heading: '2. Content Standards — What You Must Ensure',
        blocks: [
          { type: 'p', text: 'As a Content Provider, you warrant and represent that all content you publish:' },
          {
            type: 'ul',
            items: [
              'Is accurate, current, and based on credible sources — you have verified the factual content before publishing.',
              'Is your own original work, or you hold all necessary licences, permissions, and rights to use any third-party material included.',
              'Does not infringe any third-party intellectual property rights, including copyright, trademark, or patent.',
              'Does not reproduce substantial portions of copyrighted examination board materials (past papers, mark schemes, official textbooks) without appropriate licence.',
              'Is age-appropriate for the student audience specified in the course settings.',
              'Does not contain unlawful, defamatory, discriminatory, hateful, violent, sexually explicit, or otherwise inappropriate material.',
              'Does not contain misleading, false, or unverified claims, including claims of affiliation with examination boards or government bodies.',
              'Complies with all applicable Malaysian laws and the laws of jurisdictions where your content is made available.',
              'Does not include personal data of third parties (including students) without their consent.',
            ],
          },
        ],
      },
      {
        heading: '3. Examination Board and Curriculum References',
        blocks: [
          {
            type: 'callout',
            tone: 'warn',
            text: 'You must not claim or imply that your content is officially approved, endorsed, or affiliated with Cambridge Assessment International Education, Pearson Edexcel, AQA, the Malaysian Ministry of Education, or any other examination board — unless you hold a valid, current written authorisation from that body. Any curriculum alignment claims must be clearly framed as preparation or alignment, not official partnership.',
          },
        ],
      },
      {
        heading: '4. Content Review Process',
        blocks: [
          { type: 'p', text: 'All content submitted for publication is subject to a nine-point compliance review before going live. This review checks for:' },
          {
            type: 'ol',
            items: [
              "Complete course information (title, description, programme tag, Bloom's level)",
              'Absence of prohibited content types',
              'Appropriate age and programme classification',
              'No unlicensed examination board material',
              'Accurate curriculum alignment tags',
              'Video and audio quality standards',
              'Correct disclaimer placement',
              'Accurate Recommended For tags',
              'No false affiliation claims',
            ],
          },
          { type: 'p', text: "Passing this review does not constitute endorsement of the content's accuracy by Poket School. You remain solely responsible for the academic accuracy and legal compliance of your content at all times." },
        ],
      },
      {
        heading: '5. Revenue and Payment',
        blocks: [
          { type: 'sub', text: '5.1 Revenue Share' },
          {
            type: 'table',
            head: ['Sale Type', 'Content Provider Share', 'Platform Share'],
            rows: [
              ['Direct Marketplace sale (student purchases)', '70%', '30%'],
              ['Institution-allocated content', '60%', '40%'],
              ['Poket School original content', '0%', '100%'],
            ],
          },
          { type: 'sub', text: '5.2 Payment Terms' },
          { type: 'p', text: 'Revenue earned is calculated monthly based on completed sales and paid within 30 days of the end of each calendar month, provided the balance exceeds RM 50 (or equivalent). You are responsible for the accuracy of your payment details and for your own tax obligations.' },
          { type: 'sub', text: '5.3 Chargebacks and Refunds' },
          { type: 'p', text: 'In the event of a student refund or chargeback attributable to a defect in your content, the refunded amount will be deducted from your next revenue payment. Repeated refund complaints may result in content removal.' },
        ],
      },
      {
        heading: '6. Licence to Poket School',
        blocks: [
          { type: 'p', text: "By publishing content on the platform, you grant Poket School a non-exclusive, royalty-free licence to host, display, reproduce, and deliver your content to students and institutions for the duration of your content's availability. This does not transfer ownership. You may remove your content at any time, subject to active institutional allocations which may require 30 days' notice." },
        ],
      },
      {
        heading: '7. AI Enhancement of Your Content',
        blocks: [
          { type: 'p', text: 'The platform may automatically generate supplementary materials from your published content — including AI-generated flashcards, quizzes, and summaries — for student use via Ayla and ET. You consent to this enhancement as part of publishing. All AI-generated supplements are clearly labelled and do not replace your original content.' },
        ],
      },
      {
        heading: '8. Content Removal and Termination',
        blocks: [
          { type: 'p', text: 'Poket School reserves the right to remove, suspend, or delist any content at any time without prior notice if we determine that it violates this Agreement, the Terms of Service, or applicable law. In cases of serious breach we may terminate your Content Provider account immediately and withhold outstanding revenue pending investigation.' },
        ],
      },
      {
        heading: '9. Indemnification',
        blocks: [
          { type: 'p', text: 'You agree to indemnify, defend, and hold harmless Poket Media Sdn Bhd and its directors, employees, and agents from and against any claims, damages, losses, liabilities, costs, and expenses arising from or related to: (a) your content; (b) your breach of this Agreement; (c) your breach of any third-party intellectual property rights; or (d) any claim arising from reliance on inaccurate or misleading content you published.' },
        ],
      },
      {
        heading: '10. Contact',
        blocks: [
          {
            type: 'contact',
            title: 'Content and Creator Support',
            rows: [
              { label: 'Creators', value: 'creators@poketschool.ai', href: 'mailto:creators@poketschool.ai' },
              { label: 'Revenue enquiries', value: 'payments@poketschool.ai', href: 'mailto:payments@poketschool.ai' },
              { label: 'Content disputes', value: 'legal@poketschool.ai', href: 'mailto:legal@poketschool.ai' },
            ],
          },
        ],
      },
    ],
  },

  /* ── 5. ACCEPTABLE USE POLICY ────────────────────────────── */
  {
    id: 'aup',
    title: 'Acceptable Use Policy',
    meta: `Applies to: All users — students, parents, teachers, institutions · Last updated: ${LEGAL_UPDATED}`,
    intro: {
      tone: 'info',
      text: 'This Acceptable Use Policy sets out the standards of behaviour expected of all Poket School platform users. Violations may result in account suspension or permanent termination without refund.',
    },
    sections: [
      {
        heading: '1. Platform Use — What You Must Not Do',
        blocks: [
          { type: 'p', text: 'You must not use the Poket School platform to:' },
          {
            type: 'ul',
            items: [
              'Attempt to circumvent, disable, or interfere with any security feature or access control.',
              'Share your account credentials with any other person or allow multiple users to access one account simultaneously.',
              'Use automated scripts, bots, or tools to scrape, crawl, or extract content from the platform.',
              'Reproduce, resell, or commercially distribute any platform content (including AI-generated content) without written authorisation.',
              'Upload viruses, malware, or any code designed to damage or disrupt the platform.',
              "Attempt to gain unauthorised access to other users' accounts, data, or private communications.",
              'Submit false, misleading, or fraudulent information during registration or any platform process.',
              'Use Ayla, ET, or any AI feature to generate content that is harmful, defamatory, illegal, sexually explicit, or designed to deceive.',
              'Use the platform for any purpose that violates Malaysian law or the law of your jurisdiction.',
            ],
          },
        ],
      },
      {
        heading: '2. AI Feature Use',
        blocks: [
          { type: 'p', text: 'When using Ayla, ET, and any other AI-powered features, you must not:' },
          {
            type: 'ul',
            items: [
              'Attempt to manipulate or "jailbreak" the AI to produce harmful, illegal, or policy-violating content.',
              'Input personal data of third parties into AI prompts.',
              'Use AI-generated content to commit academic fraud, including submitting AI-generated work as your own where this is prohibited.',
              'Attempt to extract training data, system prompts, or proprietary information from AI systems.',
              'Use AI tutoring to seek advice outside its educational scope, including legal, medical, or financial advice.',
            ],
          },
        ],
      },
      {
        heading: '3. Student-Specific Standards',
        blocks: [
          {
            type: 'ul',
            items: [
              'Students must not share login credentials or allow others to complete their coursework or assessments.',
              'Students must engage with daily goals honestly — marking goals complete without doing the work undermines their own learning and misrepresents progress to parents.',
              'Students must treat AI tutoring as a learning aid, not a shortcut.',
            ],
          },
        ],
      },
      {
        heading: '4. Reporting Violations',
        blocks: [
          { type: 'p', text: 'If you witness or experience a violation of this Policy, please report it:' },
          {
            type: 'contact',
            title: 'Report a Violation',
            rows: [
              { label: 'Platform issues', value: 'trust@poketschool.ai', href: 'mailto:trust@poketschool.ai' },
              { label: 'Child safety concerns', value: 'safeguarding@poketschool.ai', href: 'mailto:safeguarding@poketschool.ai' },
            ],
          },
          { type: 'p', text: 'All reports are treated confidentially. We will not disclose your identity to the reported party without your consent except where required by law.' },
        ],
      },
      {
        heading: '5. Consequences of Violation',
        blocks: [
          { type: 'p', text: 'Violations of this Policy may result in, depending on severity:' },
          {
            type: 'ul',
            items: [
              'A formal warning issued to your account.',
              'Temporary suspension of platform access or specific features.',
              'Permanent termination of your account without refund of any subscription fees or Sparks balance.',
              'Referral to law enforcement or regulatory authorities where the violation constitutes a criminal offence.',
            ],
          },
        ],
      },
    ],
  },
];

export const LEGAL_NAV = LEGAL_DOCS.map(d => ({ id: d.id, title: d.title }));
