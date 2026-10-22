/**
 * Pathway pages for the homepage cards.
 *
 * Subject names start from PROGRAMMES in lib/programmes.ts.
 * Teacher ids start from AI_TEACHERS in lib/ai-teachers.ts.
 * Prices match the homepage cards in lib/marketing/home.ts.
 * Stage bands that the catalogue does not define are marked source: 'standard'.
 * Admins can replace a page from /dashboard/admin/pathways. That save wins on the public page.
 */

import { AI_TEACHERS } from '@/lib/ai-teachers';

export const PATHWAY_SLUGS = ['primary', 'igcse', 'alevel', 'llb', 'mbbs', 'independent'] as const;
export type PathwaySlug = (typeof PATHWAY_SLUGS)[number];
export type SubjectKind = 'core' | 'optional';
export type ContentSource = 'repo' | 'standard';

export interface PathwaySubject {
  name: string;
  kind: SubjectKind;
  teacherId: string;
  source: ContentSource;
}

export interface PathwayStage {
  id: string;
  title: string;
  note: string;
  source: ContentSource;
  subjects: PathwaySubject[];
}

export interface PathwayFaq {
  question: string;
  answer: string;
}

export interface PathwayLink {
  href: string;
  label: string;
}

export interface PathwayRecord {
  slug: PathwaySlug;
  title: string;
  metaTitle: string;
  overview: string;
  audience: string;
  entry: string;
  duration: string;
  priceLabel: string;
  priceDetail: string;
  included: string[];
  progression: PathwayLink[];
  boards: string[];
  boardNote: string;
  disclaimer: string;
  stages: PathwayStage[];
  faqs: PathwayFaq[];
  ctas: PathwayLink[];
  updatedAt?: number;
}

export const PATHWAY_SOURCES = {
  repo: [
    'Subject names for Primary, IGCSE, A-Level, LLB, MBBS, and Independent come from PROGRAMMES in lib/programmes.ts.',
    'Optional Primary subjects ICT and Global Citizenship come from the ET teacher list, not from the Primary programme subject array.',
    'Each subject is attached to an ET teacher id from AI_TEACHERS in lib/ai-teachers.ts. English Literature, English Language, and English First Language use ET English. English Second Language uses ET English SL. Law modules use ET Law. Medicine topics use ET Medicine.',
    'Monthly prices match the homepage cards in lib/marketing/home.ts: Primary $49, IGCSE $79, A-Level included in IGCSE, LLB $99, MBBS included in LLB, Independent $19.',
    'IGCSE and A-Level board names are the existing alignment list: Cambridge International, Pearson Edexcel, and OxfordAQA. Poket School does not award those grades.',
    'The annual 25 percent line is the price already published on the homepage.',
  ],
  standard: [
    'Primary 1–6 are stage labels. The catalogue has one Primary level, so the same subjects are listed in each stage.',
    'IGCSE is treated as one level lasting about two years. Mathematics and English First Language are marked as the usual core. English Second Language is the alternative English route. Every other catalogue subject stays optional.',
    'A-Level is split into AS and A2. The catalogue does not split subjects between those halves and does not set a compulsory core, so the same optional list appears on both stages.',
    'LLB Year 1, Year 2, and Year 3 group the catalogue modules in the usual qualifying-law order. Legal System and Method is not in PROGRAMMES. International Law is the catalogue subject. A separate EU Law module is not added.',
    'MBBS Year 1 and Year 2 are a pre-clinical foundation outline. Later catalogue names such as Internal Medicine and Surgery stay study topics. They are not placements.',
    'Independent study uses CEFR bands A1–A2, B1–B2, and C1–C2 as lesson levels already named on the language teachers. Poket School does not issue a CEFR certificate.',
  ],
} as const;

const ANNUAL = 'Annual billing is 25 percent less, as already shown on the homepage.';

function subject(name: string, kind: SubjectKind, teacherId: string, source: ContentSource = 'repo'): PathwaySubject {
  return { name, kind, teacherId, source };
}

const PRIMARY_SUBJECTS: PathwaySubject[] = [
  subject('Science', 'core', 'et-science'),
  subject('Mathematics', 'core', 'et-maths'),
  subject('English', 'core', 'et-english'),
  subject('Malay', 'core', 'et-malay'),
  subject('ICT', 'optional', 'et-ict'),
  subject('Global Citizenship', 'optional', 'et-global-citizenship'),
];

const PRIMARY_NOTE = 'Science, Mathematics, English, and Malay are the Primary programme subjects. ICT and Global Citizenship are optional and come from the ET teachers marked for Primary. The catalogue does not give each year its own subject list, so these subjects continue through Primary 1–6.';

function primaryStages(): PathwayStage[] {
  return [1, 2, 3, 4, 5, 6].map((year) => ({
    id: `primary-${year}`,
    title: `Primary ${year}`,
    note: PRIMARY_NOTE,
    source: 'standard',
    subjects: PRIMARY_SUBJECTS.map((item) => ({ ...item })),
  }));
}

const IGCSE_SUBJECTS: PathwaySubject[] = [
  subject('Mathematics', 'core', 'et-maths'),
  subject('English First Language', 'core', 'et-english'),
  subject('English Second Language', 'optional', 'et-english-sl'),
  subject('Biology', 'optional', 'et-biology'),
  subject('Human Biology', 'optional', 'et-human-biology'),
  subject('Chemistry', 'optional', 'et-chemistry'),
  subject('Physics', 'optional', 'et-physics'),
  subject('Additional Mathematics', 'optional', 'et-additional-maths'),
  subject('Malay', 'optional', 'et-malay'),
  subject('Mandarin', 'optional', 'et-mandarin'),
  subject('French', 'optional', 'et-french'),
  subject('German', 'optional', 'et-german'),
  subject('Business Studies', 'optional', 'et-business'),
  subject('Economics', 'optional', 'et-economics'),
  subject('Accounting', 'optional', 'et-accounting'),
  subject('History', 'optional', 'et-history'),
  subject('Geography', 'optional', 'et-geography'),
  subject('Computer Science', 'optional', 'et-computer-science'),
  subject('ICT', 'optional', 'et-ict'),
  subject('Global Citizenship', 'optional', 'et-global-citizenship'),
  subject('Psychology', 'optional', 'et-psychology'),
  subject('Sociology', 'optional', 'et-sociology'),
  subject('Media Studies', 'optional', 'et-media-studies'),
  subject('Art and Design', 'optional', 'et-art'),
  subject('Music', 'optional', 'et-music'),
];

const ALEVEL_SUBJECTS: PathwaySubject[] = [
  subject('Biology', 'optional', 'et-biology'),
  subject('Chemistry', 'optional', 'et-chemistry'),
  subject('Physics', 'optional', 'et-physics'),
  subject('Mathematics', 'optional', 'et-maths'),
  subject('Further Mathematics', 'optional', 'et-further-maths'),
  subject('English Literature', 'optional', 'et-english'),
  subject('English Language', 'optional', 'et-english'),
  subject('Malay', 'optional', 'et-malay'),
  subject('Mandarin', 'optional', 'et-mandarin'),
  subject('French', 'optional', 'et-french'),
  subject('German', 'optional', 'et-german'),
  subject('Business Studies', 'optional', 'et-business'),
  subject('Economics', 'optional', 'et-economics'),
  subject('Accounting', 'optional', 'et-accounting'),
  subject('History', 'optional', 'et-history'),
  subject('Geography', 'optional', 'et-geography'),
  subject('Computer Science', 'optional', 'et-computer-science'),
  subject('Psychology', 'optional', 'et-psychology'),
  subject('Sociology', 'optional', 'et-sociology'),
  subject('Media Studies', 'optional', 'et-media-studies'),
  subject('Law', 'optional', 'et-law'),
  subject('Art and Design', 'optional', 'et-art'),
  subject('Music', 'optional', 'et-music'),
];

const ALEVEL_NOTE = 'The A-Level catalogue does not set a compulsory core and does not split subjects between AS and A2. A learner chooses from this list. AS is the first half. A2 continues the same subject.';

const LAW = 'et-law';

const LLB_YEAR_1: PathwaySubject[] = [
  subject('Legal System and Method', 'core', LAW, 'standard'),
  subject('Contract Law', 'core', LAW),
  subject('Criminal Law', 'core', LAW),
  subject('Public Law', 'core', LAW),
];

const LLB_YEAR_2: PathwaySubject[] = [
  subject('Tort Law', 'core', LAW),
  subject('Land Law', 'core', LAW),
  subject('Equity and Trusts', 'core', LAW),
  subject('International Law', 'core', LAW),
];

const LLB_YEAR_3: PathwaySubject[] = [
  subject('Jurisprudence', 'core', LAW),
  subject('Company Law', 'optional', LAW),
  subject('Evidence', 'optional', LAW),
  subject('Family Law', 'optional', LAW),
  subject('Commercial Law', 'optional', LAW),
];

const MEDICINE = 'et-medicine';

export const SCHOOL_BOARDS = ['Cambridge International', 'Pearson Edexcel', 'OxfordAQA'] as const;
const SCHOOL_BOARD_NOTE = 'These names describe syllabus alignment already used on the IGCSE page. Poket School does not award those grades.';

export const PATHWAYS: readonly PathwayRecord[] = [
  {
    slug: 'primary',
    title: 'Primary',
    metaTitle: 'Primary pathway',
    overview: 'Primary is the pathway for younger learners. ET AI teachers explain a topic in short steps, and a linked parent can see goals, attendance, and report cards.',
    audience: 'Younger learners, and a parent who wants the week, the goals, and the report cards on the same login.',
    entry: 'No exam grade is required. A family can open the free preview, then start Primary when they are ready. A school can also place the learner in a class.',
    duration: 'Six stages, Primary 1 to Primary 6. The catalogue keeps one Primary level, so the subjects stay the same while the lessons go further.',
    priceLabel: '$49 / month',
    priceDetail: `Primary is 49 US dollars a month. ${ANNUAL} The IGCSE and A-Level plan includes Primary.`,
    included: [
      'ET AI teachers for the subjects on this page.',
      'Parent view of goals, attendance, and report cards when the accounts are linked.',
      'ET AI Studio for a lesson or a quiz.',
      'A planner for class, homework, and goals.',
    ],
    progression: [
      { href: '/igcse', label: 'IGCSE' },
      { href: '/alevel', label: 'A-Level' },
      { href: '/llb', label: 'LLB Law' },
      { href: '/mbbs', label: 'MBBS foundation' },
    ],
    boards: [],
    boardNote: 'Poket School does not award an external primary certificate.',
    disclaimer: '',
    stages: primaryStages(),
    faqs: [
      {
        question: 'Which subjects are core in Primary?',
        answer: 'Science, Mathematics, English, and Malay are the core subjects in the Primary programme. ICT and Global Citizenship are optional.',
      },
      {
        question: 'Do Primary 1 to Primary 6 have different subject lists?',
        answer: 'No. The catalogue has one Primary subject list. The same subjects are shown in each stage so a family can see the path from Primary 1 to Primary 6.',
      },
      {
        question: 'What does Primary cost?',
        answer: 'The homepage card is 49 US dollars a month. Annual billing is 25 percent less. IGCSE and A-Level plans include Primary.',
      },
    ],
    ctas: [
      { href: '/signup?plan=primary', label: 'Start Primary' },
      { href: '/demo', label: 'Talk to us' },
    ],
  },
  {
    slug: 'igcse',
    title: 'IGCSE',
    metaTitle: 'IGCSE pathway',
    overview: 'IGCSE on Poket School is independent study aligned with Cambridge International, Pearson Edexcel, and OxfordAQA syllabuses. Poket School does not award those grades.',
    audience: 'Learners working towards IGCSE-style subjects, including someone moving on from Primary, and a parent who wants published grades and goals.',
    entry: 'Poket School does not set an exam grade you must already hold. Learners often come from Primary or lower secondary. The free preview still opens the first lesson of a course.',
    duration: 'Usually two years of study. The catalogue lists IGCSE as one level, so the subjects sit in a single stage rather than a made-up split.',
    priceLabel: '$79 / month',
    priceDetail: `IGCSE and A-Level together are 79 US dollars a month. ${ANNUAL} Primary is included. Degree pathways are a separate plan.`,
    included: [
      'ET AI teachers for the catalogue subjects.',
      'Exam Prep for practice on the topic the learner is on.',
      'A gradebook when a teacher is involved, using the scales that teacher already has.',
      'The planner, and a parent view of published grades and goals.',
    ],
    progression: [
      { href: '/primary', label: 'Primary' },
      { href: '/alevel', label: 'A-Level' },
      { href: '/llb', label: 'LLB Law' },
      { href: '/mbbs', label: 'MBBS foundation' },
    ],
    boards: SCHOOL_BOARDS,
    boardNote: SCHOOL_BOARD_NOTE,
    disclaimer: '',
    stages: [
      {
        id: 'igcse',
        title: 'IGCSE',
        note: 'Mathematics and English First Language are marked core because that is the usual IGCSE pair. English Second Language is the alternative English route in the catalogue. Every other subject is optional. Poket School does not award the grade.',
        source: 'standard',
        subjects: IGCSE_SUBJECTS.map((item) => ({ ...item })),
      },
    ],
    faqs: [
      {
        question: 'Does Poket School award IGCSE grades?',
        answer: 'No. Study can follow Cambridge International, Pearson Edexcel, or OxfordAQA syllabuses. Poket School does not award those grades.',
      },
      {
        question: 'Which IGCSE subjects are core?',
        answer: 'Mathematics and English First Language are the usual core. English Second Language is the other English route in the catalogue. Biology, Chemistry, Physics, and the other catalogue subjects are optional.',
      },
      {
        question: 'What does the IGCSE plan cost?',
        answer: 'The homepage card is 79 US dollars a month for IGCSE and A-Level together. Annual billing is 25 percent less. Primary is included.',
      },
    ],
    ctas: [
      { href: '/signup?plan=igcse', label: 'Start IGCSE' },
      { href: '/demo', label: 'Talk to us' },
    ],
  },
  {
    slug: 'alevel',
    title: 'A-Level',
    metaTitle: 'A-Level pathway',
    overview: 'A-Level study uses the same login as IGCSE. The teachers, the exam practice, and the planner stay, with room for a heavier subject load.',
    audience: 'Learners who want deeper subjects after IGCSE, including Further Mathematics, Law, and the essay subjects in the catalogue.',
    entry: 'Poket School does not require a published IGCSE grade. Learners usually come from IGCSE or equivalent study. A-Level is on the same plan as IGCSE.',
    duration: 'Usually two years: AS, then A2. The catalogue does not split the subject list between those halves.',
    priceLabel: 'Included in IGCSE',
    priceDetail: `A-Level is on the IGCSE and A-Level plan at 79 US dollars a month. ${ANNUAL} LLB and MBBS are the next plan up.`,
    included: [
      'The IGCSE and A-Level plan, including Primary.',
      'ET AI teachers for every A-Level subject in the catalogue.',
      'Exam Prep, ET AI Studio, and the planner.',
      'A parent view of goals and published reports when the accounts are linked.',
    ],
    progression: [
      { href: '/igcse', label: 'IGCSE' },
      { href: '/llb', label: 'LLB Law' },
      { href: '/mbbs', label: 'MBBS foundation' },
    ],
    boards: SCHOOL_BOARDS,
    boardNote: SCHOOL_BOARD_NOTE,
    disclaimer: '',
    stages: [
      {
        id: 'as',
        title: 'AS',
        note: ALEVEL_NOTE,
        source: 'standard',
        subjects: ALEVEL_SUBJECTS.map((item) => ({ ...item })),
      },
      {
        id: 'a2',
        title: 'A2',
        note: ALEVEL_NOTE,
        source: 'standard',
        subjects: ALEVEL_SUBJECTS.map((item) => ({ ...item })),
      },
    ],
    faqs: [
      {
        question: 'Is there a compulsory A-Level core?',
        answer: 'No. The catalogue does not set a compulsory subject. Biology, Chemistry, Mathematics, Law, and the other names on this page are options.',
      },
      {
        question: 'What is the difference between AS and A2 here?',
        answer: 'AS is the first half and A2 continues it. The catalogue uses one subject list, so both stages show the same options.',
      },
      {
        question: 'How is A-Level priced?',
        answer: 'The homepage card says A-Level is included in IGCSE. That plan is 79 US dollars a month.',
      },
    ],
    ctas: [
      { href: '/signup?plan=igcse', label: 'Start A-Level' },
      { href: '/demo', label: 'Talk to us' },
    ],
  },
  {
    slug: 'llb',
    title: 'LLB Law',
    metaTitle: 'LLB Law pathway',
    overview: 'LLB Law is degree-level study with ET Law. The modules follow the usual foundations of a qualifying law degree. Poket School does not enrol you at a university.',
    audience: 'Learners who want Contract, Tort, Criminal, Public Law, Land, Equity and Trusts, and the other law modules in the catalogue, after IGCSE and A-Level or alongside them.',
    entry: 'This is not a university offer and not an admissions decision. You can start from the degree plan. Comfort with long written answers helps. No A-Level grade is required by Poket School.',
    duration: 'The study plan is set out as Year 1, Year 2, and Year 3. That is the usual shape of an LLB. It is not a university timetable.',
    priceLabel: '$99 / month',
    priceDetail: `LLB and MBBS are 99 US dollars a month. ${ANNUAL} The IGCSE and A-Level plan is included. This is not a university fee.`,
    included: [
      'ET Law for every module on this page.',
      'Essay tools in ET AI Studio, with a teacher review path when a class exists.',
      'The IGCSE and A-Level plan, so school subjects are not a second subscription.',
      'Goals and due dates on the planner.',
    ],
    progression: [
      { href: '/igcse', label: 'IGCSE' },
      { href: '/alevel', label: 'A-Level' },
      { href: '/mbbs', label: 'MBBS foundation' },
    ],
    boards: [],
    boardNote: 'Public Law on this page is constitutional and administrative law. International Law is the catalogue subject for the international part of the foundations. There is no separate EU Law module in the catalogue. Poket School does not run a qualifying-law exam and does not confer a degree.',
    disclaimer: 'Degree pathway. Not a university enrolment.',
    stages: [
      {
        id: 'year-1',
        title: 'Year 1',
        note: 'Legal System and Method is the usual introductory module. It is not in the programme catalogue, so it is marked as a standard addition. Contract Law, Criminal Law, and Public Law are catalogue subjects.',
        source: 'standard',
        subjects: LLB_YEAR_1.map((item) => ({ ...item })),
      },
      {
        id: 'year-2',
        title: 'Year 2',
        note: 'Tort Law, Land Law, Equity and Trusts, and International Law are catalogue subjects. They are grouped here in the usual second-year order.',
        source: 'standard',
        subjects: LLB_YEAR_2.map((item) => ({ ...item })),
      },
      {
        id: 'year-3',
        title: 'Year 3',
        note: 'Jurisprudence is the core theory module from the catalogue. Company Law, Evidence, Family Law, and Commercial Law are the catalogue electives.',
        source: 'standard',
        subjects: LLB_YEAR_3.map((item) => ({ ...item })),
      },
    ],
    faqs: [
      {
        question: 'Is the LLB pathway a university enrolment?',
        answer: 'No. Degree pathway. Not a university enrolment. It does not confer a degree.',
      },
      {
        question: 'What is in Year 1, Year 2, and Year 3?',
        answer: 'Year 1 is Legal System and Method, Contract Law, Criminal Law, and Public Law. Year 2 is Tort Law, Land Law, Equity and Trusts, and International Law. Year 3 is Jurisprudence, plus Company Law, Evidence, Family Law, and Commercial Law as options.',
      },
      {
        question: 'Is there an EU Law module?',
        answer: 'The catalogue lists International Law, not a separate EU Law module. Public Law covers constitutional and administrative law.',
      },
    ],
    ctas: [
      { href: '/signup?plan=degree', label: 'Start LLB' },
      { href: '/demo', label: 'Talk to us' },
    ],
  },
  {
    slug: 'mbbs',
    title: 'MBBS Medicine',
    metaTitle: 'MBBS Medicine pathway',
    overview: 'MBBS Medicine on Poket School is foundation and degree-level study with ET Medicine and the science teachers. It does not place a learner in a medical school.',
    audience: 'Learners who want a pre-clinical foundation in anatomy, physiology, and the other medicine subjects in the catalogue, often after IGCSE and A-Level science.',
    entry: 'Poket School does not ask for a medical-school offer. Science subjects from IGCSE or A-Level are useful preparation. No grade threshold is set here.',
    duration: 'Year 1 and Year 2 are the pre-clinical foundation on this page. Later catalogue topics sit after that. Poket School does not state a medical-school length.',
    priceLabel: 'Included in LLB',
    priceDetail: `MBBS is on the same plan as LLB: 99 US dollars a month. ${ANNUAL} The homepage card says MBBS is included in LLB.`,
    included: [
      'ET Medicine for the subjects on this page.',
      'The science teachers for Biology, Human Biology, Chemistry, and Physics on the included IGCSE plan.',
      'Practice questions and goals. Not a clinical placement.',
      'Reports a linked parent can read.',
    ],
    progression: [
      { href: '/igcse', label: 'IGCSE' },
      { href: '/alevel', label: 'A-Level' },
      { href: '/llb', label: 'LLB Law' },
    ],
    boards: [],
    boardNote: 'Poket School does not award a medical degree and does not claim a medical council, a teaching hospital, or a clinical placement.',
    disclaimer: 'Not a clinical licence.',
    stages: [
      {
        id: 'year-1',
        title: 'Year 1',
        note: 'A pre-clinical foundation year. Anatomy, Physiology, and Biochemistry are catalogue subjects. They are grouped here. They are not a medical-school timetable.',
        source: 'standard',
        subjects: [
          subject('Anatomy', 'core', MEDICINE),
          subject('Physiology', 'core', MEDICINE),
          subject('Biochemistry', 'core', MEDICINE),
        ],
      },
      {
        id: 'year-2',
        title: 'Year 2',
        note: 'The second pre-clinical year uses Pharmacology, Pathology, and Clinical Reasoning from the catalogue. Clinical Reasoning is study on Poket School, not a ward placement.',
        source: 'standard',
        subjects: [
          subject('Pharmacology', 'core', MEDICINE),
          subject('Pathology', 'core', MEDICINE),
          subject('Clinical Reasoning', 'core', MEDICINE),
        ],
      },
      {
        id: 'later-study',
        title: 'Later study topics',
        note: 'These names are in the MBBS catalogue. On Poket School they are study topics only. They are not clinical placements and not a licence to practise.',
        source: 'repo',
        subjects: [
          subject('Internal Medicine', 'optional', MEDICINE),
          subject('Surgery', 'optional', MEDICINE),
          subject('Obstetrics and Gynaecology', 'optional', MEDICINE),
          subject('Paediatrics', 'optional', MEDICINE),
          subject('Psychiatry', 'optional', MEDICINE),
          subject('Community Medicine', 'optional', MEDICINE),
        ],
      },
    ],
    faqs: [
      {
        question: 'Is this a medical licence?',
        answer: 'No. Not a clinical licence. It is not a medical-school place and it does not confer an MBBS.',
      },
      {
        question: 'What is in the pre-clinical foundation?',
        answer: 'Year 1 is Anatomy, Physiology, and Biochemistry. Year 2 is Pharmacology, Pathology, and Clinical Reasoning. Later catalogue topics are listed separately and are not placements.',
      },
      {
        question: 'What does MBBS cost?',
        answer: 'The homepage card says MBBS is included in LLB. That plan is 99 US dollars a month.',
      },
    ],
    ctas: [
      { href: '/signup?plan=degree', label: 'Start MBBS foundation' },
      { href: '/demo', label: 'Talk to us' },
    ],
  },
  {
    slug: 'independent',
    title: 'Independent',
    metaTitle: 'Independent pathway',
    overview: 'Independent learning is for someone who is not enrolled at a school on Poket School. They still get ET AI teachers, the studio, and a planner.',
    audience: 'A learner studying a language or another subject without a school roll, and a teacher who invites them into a private classroom.',
    entry: 'Choose independent study at sign-up. There is no school approval step. A parent can still link if the learner adds them. Under-18s who are not members of a school are not auto-approved into that school’s classes.',
    duration: 'Self-paced. Language lessons use the CEFR bands below as levels of study. There is no fixed end date.',
    priceLabel: '$19 / month',
    priceDetail: `Micro and professional study is 19 US dollars a month. ${ANNUAL} School-age pathways use the Primary, IGCSE, or degree plans.`,
    included: [
      'ET language teachers for Mandarin, French, German, Russian, and Languages.',
      'ET AI Studio and the planner.',
      'A private classroom by code or link, without a second subscription for that seat.',
      'A student ID card on the account.',
    ],
    progression: [
      { href: '/primary', label: 'Primary' },
      { href: '/igcse', label: 'IGCSE' },
      { href: '/alevel', label: 'A-Level' },
    ],
    boards: [],
    boardNote: 'CEFR labels are lesson levels already named on the language teachers. Poket School does not issue a CEFR certificate.',
    disclaimer: '',
    stages: [
      {
        id: 'cefr-a',
        title: 'A1–A2',
        note: 'Beginner and elementary lesson levels. The same catalogue languages are available. The band is a level of study, not a certificate.',
        source: 'standard',
        subjects: [
          subject('Mandarin', 'optional', 'et-mandarin'),
          subject('French', 'optional', 'et-french'),
          subject('German', 'optional', 'et-german'),
          subject('Russian', 'optional', 'et-russian'),
          subject('Languages', 'optional', 'et-languages'),
        ],
      },
      {
        id: 'cefr-b',
        title: 'B1–B2',
        note: 'Intermediate and upper-intermediate lesson levels. The catalogue does not split a language into different subject names by band.',
        source: 'standard',
        subjects: [
          subject('Mandarin', 'optional', 'et-mandarin'),
          subject('French', 'optional', 'et-french'),
          subject('German', 'optional', 'et-german'),
          subject('Russian', 'optional', 'et-russian'),
          subject('Languages', 'optional', 'et-languages'),
        ],
      },
      {
        id: 'cefr-c',
        title: 'C1–C2',
        note: 'Advanced and mastery lesson levels. Poket School does not issue a CEFR certificate for reaching a band.',
        source: 'standard',
        subjects: [
          subject('Mandarin', 'optional', 'et-mandarin'),
          subject('French', 'optional', 'et-french'),
          subject('German', 'optional', 'et-german'),
          subject('Russian', 'optional', 'et-russian'),
          subject('Languages', 'optional', 'et-languages'),
        ],
      },
    ],
    faqs: [
      {
        question: 'Do I need a school enrolment?',
        answer: 'No. Independent study is the plan without a school roll. A teacher can still invite you to a private classroom.',
      },
      {
        question: 'What languages are on this pathway?',
        answer: 'Mandarin, French, German, Russian, and Languages, with ET Mandarin, ET French, ET German, ET Russian, and ET Languages.',
      },
      {
        question: 'Does a CEFR band come with a certificate?',
        answer: 'No. The bands are lesson levels. Poket School does not issue a CEFR certificate.',
      },
    ],
    ctas: [
      { href: '/signup?plan=micro', label: 'Start independent study' },
      { href: '/demo', label: 'Talk to us' },
    ],
  },
];

export function isPathwaySlug(value: string): value is PathwaySlug {
  return (PATHWAY_SLUGS as readonly string[]).includes(value);
}

export function pathwayBySlug(slug: string): PathwayRecord | null {
  const found = PATHWAYS.find((item) => item.slug === slug);
  return found ? copyPathway(found) : null;
}

export function copyPathway(pathway: PathwayRecord): PathwayRecord {
  return JSON.parse(JSON.stringify(pathway)) as PathwayRecord;
}

export function pathwayTeacher(teacherId: string): { id: string; name: string } | null {
  const teacher = AI_TEACHERS.find((item) => item.id === teacherId);
  if (!teacher) return null;
  return { id: teacher.id, name: teacher.name };
}

export function pathwayFaqJsonLd(pathway: PathwayRecord): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pathway.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number, allowEmpty = false): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > max) return null;
  if (!allowEmpty && trimmed.length === 0) return null;
  return trimmed;
}

function textList(value: unknown, maxItems: number, maxLen: number, allowEmpty: boolean): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  if (!allowEmpty && value.length === 0) return null;
  const out: string[] = [];
  for (const item of value) {
    const line = text(item, maxLen);
    if (!line) return null;
    out.push(line);
  }
  return out;
}

function linkList(value: unknown, maxItems: number): PathwayLink[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) return null;
  const out: PathwayLink[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const label = text(item.label, 80);
    const href = text(item.href, 200);
    if (!label || !href) return null;
    if (!href.startsWith('/') && !href.startsWith('mailto:')) return null;
    out.push({ label, href });
  }
  return out;
}

function parseSubject(value: unknown): PathwaySubject | null {
  if (!isRecord(value)) return null;
  const name = text(value.name, 80);
  const teacherId = text(value.teacherId, 40);
  if (!name || !teacherId || !pathwayTeacher(teacherId)) return null;
  if (value.kind !== 'core' && value.kind !== 'optional') return null;
  if (value.source !== 'repo' && value.source !== 'standard') return null;
  return { name, kind: value.kind, teacherId, source: value.source };
}

function parseStage(value: unknown): PathwayStage | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 40);
  const title = text(value.title, 80);
  const note = text(value.note, 800);
  if (!id || !/^[a-z0-9-]+$/.test(id) || !title || !note) return null;
  if (value.source !== 'repo' && value.source !== 'standard') return null;
  if (!Array.isArray(value.subjects) || value.subjects.length < 1 || value.subjects.length > 40) return null;
  const subjects: PathwaySubject[] = [];
  for (const item of value.subjects) {
    const parsed = parseSubject(item);
    if (!parsed) return null;
    subjects.push(parsed);
  }
  return { id, title, note, source: value.source, subjects };
}

/** Accepts a catalogue row or an admin save. Returns null when the shape is not safe to publish. */
export function parsePathway(value: unknown, expectedSlug?: string): PathwayRecord | null {
  if (!isRecord(value)) return null;
  const slug = text(value.slug, 40);
  if (!slug || !isPathwaySlug(slug)) return null;
  if (expectedSlug && slug !== expectedSlug) return null;
  const title = text(value.title, 80);
  const metaTitle = text(value.metaTitle, 120);
  const overview = text(value.overview, 2000);
  const audience = text(value.audience, 2000);
  const entry = text(value.entry, 2000);
  const duration = text(value.duration, 400);
  const priceLabel = text(value.priceLabel, 80);
  const priceDetail = text(value.priceDetail, 800);
  const boardNote = text(value.boardNote, 800);
  const disclaimer = text(value.disclaimer, 600, true);
  if (!title || !metaTitle || !overview || !audience || !entry || !duration || !priceLabel || !priceDetail || !boardNote || disclaimer === null) {
    return null;
  }
  const included = textList(value.included, 12, 240, false);
  const boards = textList(value.boards, 6, 80, true);
  const progression = linkList(value.progression, 8);
  const ctas = linkList(value.ctas, 4);
  if (!included || !boards || !progression || !ctas) return null;
  if (!Array.isArray(value.stages) || value.stages.length < 1 || value.stages.length > 8) return null;
  if (!Array.isArray(value.faqs) || value.faqs.length < 1 || value.faqs.length > 8) return null;
  const stages: PathwayStage[] = [];
  const seen = new Set<string>();
  for (const item of value.stages) {
    const stage = parseStage(item);
    if (!stage || seen.has(stage.id)) return null;
    seen.add(stage.id);
    stages.push(stage);
  }
  const faqs: PathwayFaq[] = [];
  for (const item of value.faqs) {
    if (!isRecord(item)) return null;
    const question = text(item.question, 200);
    const answer = text(item.answer, 800);
    if (!question || !answer) return null;
    faqs.push({ question, answer });
  }
  const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : undefined;
  return {
    slug,
    title,
    metaTitle,
    overview,
    audience,
    entry,
    duration,
    priceLabel,
    priceDetail,
    included,
    progression,
    boards,
    boardNote,
    disclaimer,
    stages,
    faqs,
    ctas,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
}
