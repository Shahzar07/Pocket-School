/** Balanced footer columns. Labels are i18n keys. One schools link, legal links stay out. */

export interface FooterLink {
  href: string;
  labelKey: string;
}

export interface FooterColumn {
  id: string;
  titleKey: string;
  links: FooterLink[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    id: 'product',
    titleKey: 'footer.product',
    links: [
      { href: '/ai-teachers', labelKey: 'footer.aiTeachers' },
      { href: '/ai-studio', labelKey: 'footer.aiStudio' },
      { href: '/courses', labelKey: 'footer.marketplace' },
      { href: '/reads', labelKey: 'nav.books' },
      { href: '/pricing', labelKey: 'footer.pricing' },
      { href: '/blog', labelKey: 'footer.blog' },
    ],
  },
  {
    id: 'learners',
    titleKey: 'footer.forLearners',
    links: [
      { href: '/signup?role=student', labelKey: 'footer.students' },
      { href: '/signup?role=teacher', labelKey: 'footer.teachers' },
      { href: '/signup?role=parent', labelKey: 'footer.parents' },
      { href: 'mailto:institutions@poketschool.ai', labelKey: 'footer.institutions' },
      { href: '/independent', labelKey: 'footer.independentLearning' },
    ],
  },
  {
    id: 'levels',
    titleKey: 'footer.levels',
    links: [
      { href: '/primary', labelKey: 'footer.primary' },
      { href: '/igcse', labelKey: 'footer.igcse' },
      { href: '/alevel', labelKey: 'footer.alevel' },
      { href: '/llb', labelKey: 'footer.llb' },
      { href: '/mbbs', labelKey: 'footer.mbbs' },
    ],
  },
  {
    id: 'platform',
    titleKey: 'footer.platform',
    links: [
      { href: '/ai-teachers', labelKey: 'footer.etTeachers' },
      { href: '/studio', labelKey: 'footer.etStudio' },
      { href: '/dashboard/studio/maths', labelKey: 'header.etMaths' },
      { href: '/dashboard/studio/exam-prep', labelKey: 'header.examPrep' },
      { href: '/reads', labelKey: 'footer.reads' },
      { href: '/safeline', labelKey: 'footer.safeline' },
      { href: '/id', labelKey: 'footer.studentId' },
    ],
  },
  {
    id: 'company',
    titleKey: 'footer.company',
    links: [
      { href: '/about', labelKey: 'footer.about' },
      { href: '/rochfords', labelKey: 'footer.rochfords' },
      { href: '/institutions/register', labelKey: 'footer.schools' },
      { href: '/demo', labelKey: 'footer.demo' },
      { href: '/help', labelKey: 'footer.help' },
      { href: '/login', labelKey: 'header.signIn' },
    ],
  },
];

export const FOOTER_LEGAL: FooterLink[] = [
  { href: '/privacy', labelKey: 'footer.privacy' },
  { href: '/terms', labelKey: 'footer.terms' },
  { href: '/legal?doc=cookies', labelKey: 'footer.cookies' },
  { href: '/legal?doc=aup', labelKey: 'footer.aup' },
];

/** Pages that left the landing header and must stay in the footer. */
export const HEADER_DESTINATIONS = [
  '/',
  '/courses',
  '/ai-studio',
  '/dashboard/studio/maths',
  '/dashboard/studio/exam-prep',
  '/ai-teachers',
  '/reads',
  '/pricing',
  '/blog',
  '/institutions/register',
  '/login',
];
