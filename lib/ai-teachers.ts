export type TeacherStatus = 'live' | 'coming-soon';

export type TeacherCategory =
  | 'Sciences'
  | 'Mathematics'
  | 'English'
  | 'Humanities'
  | 'Languages'
  | 'Computer Science'
  | 'Business'
  | 'Arts';

export type TeacherIconKey =
  | 'atom'
  | 'calculator'
  | 'pen'
  | 'globe'
  | 'languages'
  | 'code'
  | 'briefcase'
  | 'palette'
  | 'history';

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

export const AI_TEACHERS: AiTeacher[] = [
  {
    id: 'sarah-bennett',
    name: 'Sarah Bennett',
    title: 'Senior Science Tutor — Physics, Chemistry & Biology',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    category: 'Sciences',
    status: 'live',
    iframeUrl: 'https://embed.liveavatar.com/v1/c1fc27b4-ba0a-4417-b649-b218cc667809?orientation=horizontal',
    avatarUrl: dicebear('sarah-bennett-science'),
    accentColor: '#1A73E8',
    iconKey: 'atom',
    tagline: 'Ask anything from quantum mechanics to cell biology — face-to-face, in real time.',
    bio: [
      'Sarah is Pocket School’s flagship AI educator for the natural sciences, modelled on the methods of senior IGCSE and A-Level science teachers across the UK and Commonwealth. She speaks at a measured pace, asks the right clarifying questions, and never makes you feel small for not knowing.',
      'She specialises in turning abstract science into intuition. Whether you’re grappling with electric fields, organic reaction mechanisms, or the inner workings of a mitochondrion, Sarah will walk you through it visually and verbally until it clicks.',
      'Sarah is calibrated against Cambridge, AQA, Pearson Edexcel and OCR specifications and adapts her explanations to your stated level — from Year 9 right through to first-year undergraduate.',
    ],
    yearsExperience: 22,
    education: [
      'Modelled on 22+ years of senior teaching practice',
      'Aligned to Cambridge IGCSE / A-Level science specifications',
      'Cross-checked with AQA & Pearson Edexcel mark schemes',
    ],
    teachingStyle:
      'Socratic and visual. Sarah opens with a question, lets you try, then corrects with diagrams, real-world analogies, and exam-style follow-ups. She never just hands you the answer.',
    languages: ['English (UK)', 'English (US)'],
    specialties: [
      'IGCSE & A-Level exam prep',
      'Mechanics & electromagnetism',
      'Organic chemistry',
      'Genetics & cell biology',
      'Lab report writing',
      'Required practicals',
    ],
    sampleQuestions: [
      'Why does ice float?',
      'Explain photosynthesis like I’m 10.',
      'Walk me through Newton’s second law with an example.',
      'What’s the difference between mitosis and meiosis?',
      'How do I balance a redox equation?',
    ],
    trainedOn: ['Cambridge', 'AQA', 'Pearson Edexcel', 'OCR'],
  },
  {
    id: 'mathematics',
    name: 'Mathematics Teacher',
    title: 'Algebra · Calculus · Geometry · Statistics',
    subjects: ['Algebra', 'Calculus', 'Geometry', 'Statistics'],
    category: 'Mathematics',
    status: 'coming-soon',
    avatarUrl: dicebear('pocket-school-mathematics'),
    accentColor: '#1E3A8A',
    iconKey: 'calculator',
    tagline: 'Step-by-step problem solving, from primary times tables to multivariable calculus.',
    bio: [
      'Our Mathematics AI is in final calibration against IGCSE, GCSE and A-Level mark schemes.',
      'It will tackle word problems, proof, statistics and applied mechanics with patient, fully-worked solutions — and refuses to skip the steps that students actually get stuck on.',
    ],
    specialties: ['Word problems', 'Proof', 'Past-paper coaching', 'Calculus intuition', 'Statistics & probability'],
    languages: ['English (UK)'],
    sampleQuestions: [
      'How do I integrate x·sin(x)?',
      'Walk me through completing the square.',
      'Explain Bayes’ theorem with a real example.',
    ],
  },
  {
    id: 'english-literature',
    name: 'English Literature & Writing',
    title: 'Close reading · Essay craft · Creative writing',
    subjects: ['Literature', 'Composition', 'Rhetoric'],
    category: 'English',
    status: 'coming-soon',
    avatarUrl: dicebear('pocket-school-english'),
    accentColor: '#EC4899',
    iconKey: 'pen',
    tagline: 'Read closely, argue precisely, write beautifully — coached line by line.',
    bio: [
      'Trained on a broad canon from Shakespeare and the Romantics through to contemporary post-colonial voices, our English teacher will help you read deeper and write sharper.',
      'Expect Socratic prompts on theme and form, line-by-line essay feedback, and creative-writing exercises that respect your voice.',
    ],
    specialties: ['Unseen poetry', 'Essay structure', 'Comparative analysis', 'Personal statements'],
    languages: ['English (UK)', 'English (US)'],
    sampleQuestions: [
      'What’s the central image in this Plath poem?',
      'Critique this paragraph of my essay.',
      'How do I open a comparative essay?',
    ],
  },
  {
    id: 'history-civics',
    name: 'History & Civics',
    title: 'Sources · Causation · Constitutional thinking',
    subjects: ['Modern History', 'Ancient History', 'Civics'],
    category: 'Humanities',
    status: 'coming-soon',
    avatarUrl: dicebear('pocket-school-history'),
    accentColor: '#0B1B3F',
    iconKey: 'history',
    tagline: 'Source analysis, cause-and-consequence reasoning, and clear narrative writing.',
    bio: [
      'Our History tutor will be calibrated against IGCSE, A-Level and IB History specifications, with emphasis on source evaluation and structured argument.',
      'Strong on the 20th century, the Cold War, decolonisation and democratic institutions.',
    ],
    specialties: ['Source analysis', 'Essay planning', 'Timeline mastery', 'Past-paper drills'],
    languages: ['English (UK)'],
    sampleQuestions: [
      'Why did Weimar Germany collapse?',
      'How reliable is this primary source?',
      'Plan a 12-mark essay on the Cuban Missile Crisis.',
    ],
  },
  {
    id: 'geography',
    name: 'Geography',
    title: 'Physical · Human · Environmental',
    subjects: ['Physical Geography', 'Human Geography', 'Environmental Science'],
    category: 'Humanities',
    status: 'coming-soon',
    avatarUrl: dicebear('pocket-school-geography'),
    accentColor: '#10B981',
    iconKey: 'globe',
    tagline: 'Maps, case studies, climate systems and urban patterns — explained clearly.',
    bio: [
      'A geography tutor for the modern syllabus: tectonics and rivers on one side, urbanisation and climate change on the other.',
      'Strong on case-study recall, GIS basics, and fieldwork write-ups.',
    ],
    specialties: ['Case studies', 'Fieldwork', 'Climate & sustainability', 'Map skills'],
    languages: ['English (UK)'],
    sampleQuestions: [
      'Why are coastal cities at higher risk?',
      'Explain the demographic transition model.',
      'What causes a tropical cyclone?',
    ],
  },
  {
    id: 'modern-languages',
    name: 'Modern Languages',
    title: 'Spanish · French · Mandarin',
    subjects: ['Spanish', 'French', 'Mandarin'],
    category: 'Languages',
    status: 'coming-soon',
    avatarUrl: dicebear('pocket-school-languages'),
    accentColor: '#F5B400',
    iconKey: 'languages',
    tagline: 'Conversation, grammar and exam writing — corrected gently, in real time.',
    bio: [
      'Multilingual conversation partner with native-quality pronunciation across Spanish, French and Mandarin.',
      'Tuned to GCSE, IGCSE, A-Level and DELE/DELF/HSK frameworks.',
    ],
    specialties: ['Speaking practice', 'Translation', 'Listening comprehension', 'Exam writing'],
    languages: ['Spanish', 'French', 'Mandarin', 'English (UK)'],
    sampleQuestions: [
      'Help me prepare for my Spanish oral.',
      'Correct this paragraph in French.',
      'Teach me 10 essential Mandarin verbs.',
    ],
  },
  {
    id: 'computer-science',
    name: 'Computer Science & Coding',
    title: 'Algorithms · Web · Python · Theory',
    subjects: ['Computer Science', 'Python', 'JavaScript', 'Algorithms'],
    category: 'Computer Science',
    status: 'coming-soon',
    avatarUrl: dicebear('pocket-school-computer-science'),
    accentColor: '#8B5CF6',
    iconKey: 'code',
    tagline: 'Pair-programme through projects, debug live, and master the theory behind the code.',
    bio: [
      'A patient pair-programmer for absolute beginners through A-Level Computer Science.',
      'Strong on data structures, algorithm analysis, Python, web fundamentals, and exam-style theory questions.',
    ],
    specialties: ['Python', 'Web fundamentals', 'Algorithms & complexity', 'A-Level CS exam prep'],
    languages: ['English (UK)'],
    sampleQuestions: [
      'Why is my recursion stack-overflowing?',
      'Explain Big-O like I’m new to this.',
      'Walk me through bubble sort vs. quicksort.',
    ],
  },
  {
    id: 'business-economics',
    name: 'Business & Economics',
    title: 'Micro · Macro · Strategy · Finance',
    subjects: ['Economics', 'Business Studies', 'Accounting'],
    category: 'Business',
    status: 'coming-soon',
    avatarUrl: dicebear('pocket-school-business'),
    accentColor: '#1A73E8',
    iconKey: 'briefcase',
    tagline: 'From price elasticity to strategic case studies — practical and exam-ready.',
    bio: [
      'A business and economics tutor with both academic rigour and real-world grounding.',
      'Trained on UK A-Level Economics, IB Business, and major case-study frameworks.',
    ],
    specialties: ['Microeconomics', 'Macroeconomics', 'Business strategy', 'Case-study analysis'],
    languages: ['English (UK)'],
    sampleQuestions: [
      'Explain price elasticity with a real example.',
      'What is SWOT, really?',
      'Why does inflation hurt savers?',
    ],
  },
  {
    id: 'arts',
    name: 'Art, Music & Design',
    title: 'Visual analysis · Composition · Theory',
    subjects: ['Art History', 'Music Theory', 'Design'],
    category: 'Arts',
    status: 'coming-soon',
    avatarUrl: dicebear('pocket-school-arts'),
    accentColor: '#EC4899',
    iconKey: 'palette',
    tagline: 'Analyse a painting, decode a chord progression, plan a design portfolio.',
    bio: [
      'A creative-disciplines tutor that takes art and music as seriously as the sciences.',
      'Covers art history, formal analysis, music theory, harmony, and design portfolio prep.',
    ],
    specialties: ['Formal analysis', 'Music theory', 'Portfolio review', 'Composition'],
    languages: ['English (UK)'],
    sampleQuestions: [
      'Analyse the composition of this painting.',
      'Explain a ii-V-I progression.',
      'Help me critique my portfolio.',
    ],
  },
];

export const TEACHER_CATEGORIES: TeacherCategory[] = [
  'Sciences',
  'Mathematics',
  'English',
  'Humanities',
  'Languages',
  'Computer Science',
  'Business',
  'Arts',
];
