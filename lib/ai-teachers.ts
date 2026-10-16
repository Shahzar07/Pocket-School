export type TeacherStatus = 'live' | 'coming-soon';

export type TeacherCategory =
  | 'Sciences'
  | 'Medicine'
  | 'Mathematics'
  | 'English'
  | 'Languages'
  | 'Humanities'
  | 'Business'
  | 'Computer Science'
  | 'Law'
  | 'Arts'
  | 'Study Support';

export type TeacherIconKey =
  | 'atom'
  | 'calculator'
  | 'pen'
  | 'globe'
  | 'languages'
  | 'code'
  | 'briefcase'
  | 'palette'
  | 'history'
  | 'heart'
  | 'scale'
  | 'brain';

/** Gemini TTS prebuilt voices — each teacher gets a distinct one so students
 * can tell who is speaking without looking at the screen. */
export type TeacherVoice =
  | 'Kore' | 'Charon' | 'Aoede' | 'Puck' | 'Leda' | 'Zephyr'
  | 'Fenrir' | 'Orus' | 'Iapetus';

export interface AiTeacher {
  id: string;
  name: string;
  title: string;
  subjects: string[];
  category: TeacherCategory;
  status: TeacherStatus;
  iframeUrl?: string;
  avatarUrl: string;
  accentColor: string;
  iconKey: TeacherIconKey;
  /** Which synthetic voice speaks for this teacher in live voice sessions. */
  voice: TeacherVoice;
  /** Delivery direction passed to the TTS engine — sets pace and warmth. */
  voiceStyle: string;
  tagline: string;
  bio: string[];
  yearsExperience?: number;
  education?: string[];
  teachingStyle?: string;
  languages?: string[];
  specialties?: string[];
  sampleQuestions?: string[];
  trainedOn?: string[];
}

const dicebear = (seed: string) =>
  `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=eef3ff,f5f1ff,fff7e6&radius=20`;

const VOICES: TeacherVoice[] = [
  'Kore', 'Charon', 'Aoede', 'Puck', 'Leda', 'Zephyr', 'Fenrir', 'Orus', 'Iapetus',
];

const PALETTE = ['#1A73E8', '#1E3A8A', '#0B1B3F', '#10B981', '#2786A4', '#8B5CF6', '#EC4899', '#E2AF4D'];

let voiceCursor = 0;

function et(input: {
  id: string;
  name: string;
  title: string;
  subjects: string[];
  category: TeacherCategory;
  iconKey: TeacherIconKey;
  tagline: string;
  sampleQuestions?: string[];
}): AiTeacher {
  const voice = VOICES[voiceCursor % VOICES.length] ?? 'Kore';
  const accentColor = PALETTE[voiceCursor % PALETTE.length] ?? '#1A73E8';
  voiceCursor += 1;
  return {
    ...input,
    status: 'live',
    avatarUrl: dicebear(input.id),
    accentColor,
    voice,
    voiceStyle: 'Warm, clear, and patient. Short steps, then a check that the idea has landed.',
    bio: [
      input.tagline,
      `ET ${input.name.replace(/^ET /, '')} teaches at ${input.title}. Explanations stay on the subject. Important answers should always be double-checked.`,
    ],
    languages: input.category === 'Languages' ? ['English', ...input.subjects] : ['English'],
    specialties: input.subjects,
    sampleQuestions: input.sampleQuestions,
  };
}

/**
 * Every teacher is "ET AI" plus a subject. No personal names. No exam-board names
 * in the description. Levels use programme names only.
 * Source: landing brief v4, kept where the master brief does not override it.
 */
export const AI_TEACHERS: AiTeacher[] = [
  et({
    id: 'et-science', name: 'ET Science', title: 'Primary · Secondary',
    subjects: ['Science'], category: 'Sciences', iconKey: 'atom',
    tagline: 'General combined science — Biology, Chemistry and Physics concepts explained clearly from the earliest years through secondary level.',
    sampleQuestions: ['Why does ice float?', 'What is a food chain?', 'How does a simple circuit work?'],
  }),
  et({
    id: 'et-biology', name: 'ET Biology', title: 'Secondary · IGCSE · A-Level · MBBS foundation',
    subjects: ['Biology'], category: 'Sciences', iconKey: 'atom',
    tagline: 'Cell biology, genetics, ecosystems, human physiology — from secondary through degree level, including pre-med foundations.',
    sampleQuestions: ['What is the difference between mitosis and meiosis?', 'Explain photosynthesis.', 'How does a vaccine work?'],
  }),
  et({
    id: 'et-chemistry', name: 'ET Chemistry', title: 'Primary · Secondary · IGCSE · A-Level · MBBS foundation',
    subjects: ['Chemistry'], category: 'Sciences', iconKey: 'atom',
    tagline: 'From basic elements through organic chemistry and biochemistry — the why behind every reaction, not just the formula.',
    sampleQuestions: ['How do I balance a chemical equation?', 'What is a mole?', 'Why do acids and bases react?'],
  }),
  et({
    id: 'et-physics', name: 'ET Physics', title: 'Primary · Secondary · IGCSE · A-Level',
    subjects: ['Physics'], category: 'Sciences', iconKey: 'atom',
    tagline: 'Forces, energy, waves, electricity and mechanics — step-by-step coaching from primary concepts through advanced level.',
    sampleQuestions: ['Walk me through Newton’s second law.', 'What is the difference between speed and velocity?', 'How does a transformer work?'],
  }),
  et({
    id: 'et-human-biology', name: 'ET Human Biology', title: 'Secondary · IGCSE · MBBS foundation',
    subjects: ['Human Biology'], category: 'Sciences', iconKey: 'heart',
    tagline: 'Body systems, health, disease, reproduction and genetics — specialist support including pre-med foundation.',
    sampleQuestions: ['How does the heart pump blood?', 'What do kidneys do?', 'Explain a reflex arc.'],
  }),
  et({
    id: 'et-medicine', name: 'ET Medicine', title: 'MBBS · Pre-Med · Medical Sciences · Degree level',
    subjects: ['Anatomy', 'Physiology', 'Pharmacology', 'Pathology'], category: 'Medicine', iconKey: 'heart',
    tagline: 'Anatomy, physiology, pharmacology, biochemistry, pathology and clinical reasoning — built to medical degree standards. For MBBS students and pre-med independent learners.',
    sampleQuestions: ['Outline the cardiac cycle.', 'What does the liver do with drugs?', 'How do I structure a clinical reasoning answer?'],
  }),
  et({
    id: 'et-maths', name: 'ET Maths', title: 'Primary · Secondary · IGCSE · A-Level · Independent',
    subjects: ['Mathematics'], category: 'Mathematics', iconKey: 'calculator',
    tagline: 'Snap a problem. ET AI walks you through it step by step — or shows a full worked solution. 1 Spark per problem.',
    sampleQuestions: ['Walk me through completing the square.', 'How do I solve a quadratic equation?', 'Explain percentages with an example.'],
  }),
  et({
    id: 'et-further-maths', name: 'ET Further Maths', title: 'A-Level · Independent',
    subjects: ['Further Mathematics'], category: 'Mathematics', iconKey: 'calculator',
    tagline: 'Complex numbers, matrices, further calculus, differential equations and advanced mechanics.',
    sampleQuestions: ['What is a complex conjugate?', 'Multiply these two matrices.', 'Solve a simple differential equation.'],
  }),
  et({
    id: 'et-additional-maths', name: 'ET Additional Maths', title: 'Secondary · IGCSE',
    subjects: ['Additional Mathematics'], category: 'Mathematics', iconKey: 'calculator',
    tagline: 'Functions, calculus, trigonometry and advanced algebra for extension students.',
    sampleQuestions: ['Differentiate x squared.', 'Solve a trigonometric equation.', 'What is a function?'],
  }),
  et({
    id: 'et-computer-science', name: 'ET Computer Science', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Computer Science'], category: 'Computer Science', iconKey: 'code',
    tagline: 'Programming, algorithms, data structures, systems and theory — coding walkthroughs and concept coaching.',
    sampleQuestions: ['Explain Big-O with a small example.', 'Why is this loop infinite?', 'What is a binary search?'],
  }),
  et({
    id: 'et-ict', name: 'ET ICT', title: 'Primary · Secondary · IGCSE',
    subjects: ['ICT'], category: 'Computer Science', iconKey: 'code',
    tagline: 'Digital literacy, spreadsheets, databases and networks — from primary computing through IGCSE.',
    sampleQuestions: ['What is a spreadsheet formula?', 'How does a network switch differ from a router?', 'What makes a strong password?'],
  }),
  et({
    id: 'et-english', name: 'ET English', title: 'Primary · Secondary · IGCSE · A-Level · Independent',
    subjects: ['English'], category: 'English', iconKey: 'pen',
    tagline: 'First and second language — directed writing, reading, summary and essay technique. All levels from primary through advanced independent learning.',
    sampleQuestions: ['How do I open a comparative essay?', 'Summarise this paragraph.', 'What is a topic sentence?'],
  }),
  et({
    id: 'et-english-sl', name: 'ET English SL', title: 'Secondary · IGCSE · Independent',
    subjects: ['English Second Language'], category: 'English', iconKey: 'pen',
    tagline: 'Second language support — reading, writing, grammar and listening for non-native speakers.',
    sampleQuestions: ['Correct this paragraph.', 'What is the difference between a and the?', 'Help me plan a short email.'],
  }),
  et({
    id: 'et-malay', name: 'ET Malay', title: 'Primary · Secondary · IGCSE · Independent',
    subjects: ['Malay'], category: 'Languages', iconKey: 'languages',
    tagline: 'Bahasa Melayu first and second language — comprehension, essay and oral coaching at all levels.',
    sampleQuestions: ['Help me plan a karangan.', 'Correct this sentence.', 'How do I start an oral answer?'],
  }),
  et({
    id: 'et-mandarin', name: 'ET Mandarin', title: 'Secondary · IGCSE · A-Level · Independent · CEFR A1–C2',
    subjects: ['Mandarin'], category: 'Languages', iconKey: 'languages',
    tagline: 'Mandarin Chinese for all levels — from beginner conversational to advanced. Not limited to school examinations. Aligned to CEFR A1–C2.',
    sampleQuestions: ['Teach me a greeting.', 'How do tones change the meaning?', 'Help me read this short sentence.'],
  }),
  et({
    id: 'et-french', name: 'ET French', title: 'Secondary · IGCSE · A-Level · Independent · CEFR A1–C2',
    subjects: ['French'], category: 'Languages', iconKey: 'languages',
    tagline: 'French for school syllabuses and independent learners — grammar, conversation, writing and reading from beginner through advanced. Aligned to CEFR A1–C2.',
    sampleQuestions: ['Correct this paragraph.', 'How do I introduce myself?', 'Explain the passé composé.'],
  }),
  et({
    id: 'et-german', name: 'ET German', title: 'Secondary · IGCSE · A-Level · Independent · CEFR A1–C2',
    subjects: ['German'], category: 'Languages', iconKey: 'languages',
    tagline: 'German for all levels — vocabulary, grammar, reading and writing for school programmes and independent learners. Aligned to CEFR A1–C2.',
    sampleQuestions: ['How do cases work?', 'Teach me ten useful verbs.', 'Correct this sentence.'],
  }),
  et({
    id: 'et-russian', name: 'ET Russian', title: 'Independent · CEFR A1–C2',
    subjects: ['Russian'], category: 'Languages', iconKey: 'languages',
    tagline: 'Russian language for independent learners — Cyrillic script, grammar, conversation and reading from beginner through advanced. Aligned to CEFR A1–C2.',
    sampleQuestions: ['Teach me the Cyrillic alphabet.', 'How do I say hello?', 'What is a case in Russian?'],
  }),
  et({
    id: 'et-languages', name: 'ET Languages', title: 'Any language · Independent · CEFR A1–C2',
    subjects: ['Languages'], category: 'Languages', iconKey: 'languages',
    tagline: 'Any other language for independent learning — conversational coaching, grammar and reading in any language. Aligned to CEFR A1–C2.',
    sampleQuestions: ['I want to start a new language. Where do I begin?', 'Help me practise a short conversation.', 'Explain this grammar point.'],
  }),
  et({
    id: 'et-law', name: 'ET Law', title: 'Secondary · IGCSE · A-Level · LLB Degree',
    subjects: ['Law', 'Contract Law', 'Tort Law', 'Criminal Law'], category: 'Law', iconKey: 'scale',
    tagline: 'IRAC coaching, case citations, ratio decidendi, problem-question marking and essay structure — from secondary law through degree level.',
    sampleQuestions: ['What is the IRAC structure?', 'How do I spot a contract issue?', 'Explain ratio decidendi.'],
  }),
  et({
    id: 'et-global-citizenship', name: 'ET Global Citizenship', title: 'Primary · Secondary · IGCSE',
    subjects: ['Global Citizenship'], category: 'Humanities', iconKey: 'globe',
    tagline: 'Environment, rights, sustainability, community and global issues — specialist for global citizenship and perspectives programmes.',
    sampleQuestions: ['What is a human right?', 'Why does recycling matter?', 'How do communities make decisions?'],
  }),
  et({
    id: 'et-psychology', name: 'ET Psychology', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Psychology'], category: 'Humanities', iconKey: 'brain',
    tagline: 'Research methods, studies, evaluation and essay structure — teaches how to evaluate, not just describe.',
    sampleQuestions: ['What makes a study reliable?', 'How do I evaluate a theory?', 'Plan a 12-mark essay.'],
  }),
  et({
    id: 'et-sociology', name: 'ET Sociology', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Sociology'], category: 'Humanities', iconKey: 'history',
    tagline: 'Social structures, research methods, identity and inequality — essay coaching with theory application.',
    sampleQuestions: ['What is socialisation?', 'How do I apply a theory in an essay?', 'What is a representative sample?'],
  }),
  et({
    id: 'et-media-studies', name: 'ET Media Studies', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Media Studies'], category: 'Humanities', iconKey: 'pen',
    tagline: 'Media language, representation, audience and institutions — set-text analysis and essay technique.',
    sampleQuestions: ['How do I analyse a poster?', 'What is representation?', 'Who is the audience for this text?'],
  }),
  et({
    id: 'et-business', name: 'ET Business Studies', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Business Studies'], category: 'Business', iconKey: 'briefcase',
    tagline: 'Strategy, marketing, finance, HR — case study analysis and evaluation answers.',
    sampleQuestions: ['What is a SWOT analysis?', 'How do I evaluate a business decision?', 'Explain cash flow.'],
  }),
  et({
    id: 'et-economics', name: 'ET Economics', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Economics'], category: 'Business', iconKey: 'briefcase',
    tagline: 'Micro and macro economics, diagrams and evaluation — teaches the diagram logic before the theory.',
    sampleQuestions: ['Draw demand and supply.', 'Why does inflation matter?', 'What is opportunity cost?'],
  }),
  et({
    id: 'et-accounting', name: 'ET Accounting', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Accounting'], category: 'Business', iconKey: 'calculator',
    tagline: 'Accounts, financial statements, ratios and costing — step-by-step with worked examples.',
    sampleQuestions: ['What is double entry?', 'How do I read a balance sheet?', 'Explain gross profit.'],
  }),
  et({
    id: 'et-history', name: 'ET History', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['History'], category: 'Humanities', iconKey: 'history',
    tagline: 'Source evaluation, essay structure and extended writing — marks for analysis, not just recall.',
    sampleQuestions: ['How reliable is this source?', 'Plan an essay on cause and consequence.', 'What is provenance?'],
  }),
  et({
    id: 'et-geography', name: 'ET Geography', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Geography'], category: 'Humanities', iconKey: 'globe',
    tagline: 'Physical and human geography, fieldwork and data response — maps, case studies and climate systems.',
    sampleQuestions: ['What causes a tropical cyclone?', 'How do I describe a map?', 'Explain urbanisation.'],
  }),
  et({
    id: 'et-art', name: 'ET Art & Design', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Art and Design'], category: 'Arts', iconKey: 'palette',
    tagline: 'Visual analysis, composition, design theory and portfolio planning — from secondary through advanced level.',
    sampleQuestions: ['How do I analyse a painting?', 'What belongs in a portfolio?', 'Explain composition.'],
  }),
  et({
    id: 'et-music', name: 'ET Music', title: 'Secondary · IGCSE · A-Level · Independent',
    subjects: ['Music'], category: 'Arts', iconKey: 'palette',
    tagline: 'Composition, theory, listening analysis and performance coaching — all levels.',
    sampleQuestions: ['What is a ii–V–I progression?', 'How do I describe a melody?', 'Help me plan a composition.'],
  }),
  et({
    id: 'et-exam-coach', name: 'ET Exam Coach', title: 'All levels · All subjects',
    subjects: ['Exam technique'], category: 'Study Support', iconKey: 'brain',
    tagline: 'Exam technique, time management, question decoding and revision planning — cross-subject exam strategy.',
    sampleQuestions: ['How should I use the last ten minutes?', 'How do I decode a command word?', 'Build me a one-week revision plan.'],
  }),
  et({
    id: 'et-study-coach', name: 'ET Study Coach', title: 'All levels · All subjects',
    subjects: ['Study skills'], category: 'Study Support', iconKey: 'brain',
    tagline: 'Goal setting, daily plans, learning habits and motivation — your personal study companion and accountability partner.',
    sampleQuestions: ['Help me plan today.', 'I keep putting revision off. What should I do?', 'How long should a study block be?'],
  }),
];

export const TEACHER_CATEGORIES: TeacherCategory[] = [
  'Sciences',
  'Medicine',
  'Mathematics',
  'English',
  'Languages',
  'Humanities',
  'Business',
  'Computer Science',
  'Law',
  'Arts',
  'Study Support',
];

export const CEFR_LEVELS: readonly { code: string; label: string }[] = [
  { code: 'A1', label: 'Beginner' },
  { code: 'A2', label: 'Elementary' },
  { code: 'B1', label: 'Intermediate' },
  { code: 'B2', label: 'Upper Intermediate' },
  { code: 'C1', label: 'Advanced' },
  { code: 'C2', label: 'Mastery' },
];

export const CEFR_BANNER =
  'All ET AI language teachers are aligned to the Common European Framework of Reference for Languages (CEFR). A1 Beginner / A2 Elementary / B1 Intermediate / B2 Upper Intermediate / C1 Advanced / C2 Mastery — whether learning for school, an exam, travel, work, or pure curiosity.';
