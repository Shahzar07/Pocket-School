// ─── Y7 Science Unit 1 seed — "Living Organisms" ────────────────
// Source: Rochford's Education internal content brief
// "iLowerSecondary Science · Year 7 · Unit 1: Living Organisms —
//  Curriculum Content Architecture" (aligned to the Pearson
// iLowerSecondary Science Scheme of Work).
//
// Lessons are seeded as drafts with the curated quiz questions from the
// brief; the remaining formats are produced through the Curriculum CMS
// ("Generate with AI" → specialist review → publish), exercising the real
// production pipeline. Open-ended source questions are converted to
// 4-option MCQ for the deterministic unit-quiz grader, with the original
// marking guidance kept in `explanation`.

import {
  addDoc, collection, getDocs, query, serverTimestamp, setDoc, where, doc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface SeedQuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  objectiveCode: string;
  /** For the unit quiz only: which seeded lesson (1–7) the question maps to. */
  sourceLesson?: number;
}

export interface SeedCurriculumLesson {
  lessonNumber: number;
  title: string;
  objectiveCodes: string[];
  briefPrompt: string;
  teacherNotes: string;
  contentSources: { type: 'text'; value: string }[];
  quiz: SeedQuizQuestion[];
  isUnitQuiz?: boolean;
}

const L1: SeedCurriculumLesson = {
  lessonNumber: 1,
  title: 'The Seven Characteristics of Life',
  objectiveCodes: ['B7.1.1A'],
  briefPrompt:
    'Generate a full lesson on the seven characteristics of living things (MRS NERG: Movement, Respiration, Sensitivity, Nutrition, Excretion, Reproduction, Growth) for Year 7 iLowerSecondary Science students. Include clear definitions, at least one example per characteristic from Malaysian or Southeast Asian organisms, a worked comparison between a plant and an animal, and common exam misconceptions. Write at IGCSE foundation level. Do not reproduce any Pearson textbook text.',
  teacherNotes:
    'This is Lesson 1 — students may be unfamiliar with the term "excretion" vs "egestion/defaecation" — clarify early. The virus discussion in Q8 previews Year 9 Biology. Use it as a stretch question only. Malaysian context examples: rambutan (growth/reproduction), Rafflesia (sensitivity — blooms at specific time), Komodo dragon (all seven).',
  contentSources: [{
    type: 'text',
    value: 'The seven shared characteristics of living things (MRS NERG): Movement, Respiration, Sensitivity, Nutrition, Excretion, Reproduction, Growth. Each characteristic applies to a wide range of organisms in the local and wider environment, including Malaysian examples such as the merbok bird, rambutan tree and Rafflesia.',
  }],
  quiz: [
    {
      question: 'Which characteristic of living things describes the removal of toxic waste products from the body?',
      options: ['Reproduction', 'Excretion', 'Sensitivity', 'Nutrition'],
      answer: 'Excretion',
      objectiveCode: 'B7.1.1A',
    },
    {
      question: 'A Venus flytrap closes its leaves when an insect lands on it. Which characteristic does this demonstrate?',
      options: ['Sensitivity', 'Growth', 'Excretion', 'Reproduction'],
      answer: 'Sensitivity',
      explanation: 'The plant detects and responds to a stimulus (the touch of the insect) — this is sensitivity.',
      objectiveCode: 'B7.1.1A',
    },
    {
      question: 'Which pair of characteristics is shared by a mushroom and a cat?',
      options: [
        'Respiration and growth',
        'Photosynthesis and movement',
        'Photosynthesis and respiration',
        'Hunting and sensitivity',
      ],
      answer: 'Respiration and growth',
      explanation: 'All living things share all seven characteristics — accept any two that apply to both (e.g. respiration, growth, nutrition). Neither a mushroom nor a cat photosynthesises.',
      objectiveCode: 'B7.1.1A',
    },
    {
      question: 'Why is a car engine NOT a living thing, even though it can move and release energy?',
      options: [
        'It cannot carry out all seven life processes, such as growth and reproduction',
        'It does not move on its own',
        'It does not release any energy',
        'It is too large to be an organism',
      ],
      answer: 'It cannot carry out all seven life processes, such as growth and reproduction',
      explanation: 'Mark-scheme guidance: a living thing must show ALL seven characteristics. An engine releases energy but cannot grow, reproduce, excrete or respond to stimuli biologically.',
      objectiveCode: 'B7.1.1A',
    },
    {
      question: 'A student says that fire shows movement, growth, and respiration. Which statement best evaluates this claim?',
      options: [
        'Fire is not alive because it does not carry out nutrition, excretion, sensitivity or reproduction as biological processes',
        'Fire is alive because it grows and spreads',
        'Fire is alive because it uses oxygen like respiration',
        'Fire is not alive because it is too hot',
      ],
      answer: 'Fire is not alive because it does not carry out nutrition, excretion, sensitivity or reproduction as biological processes',
      explanation: 'Fire mimics some characteristics (movement, "growth", using oxygen) but these are not biological processes, and it lacks the remaining characteristics entirely.',
      objectiveCode: 'B7.1.1A',
    },
    {
      question: 'What do the letters in the MRS NERG acronym stand for?',
      options: [
        'Movement, Respiration, Sensitivity, Nutrition, Excretion, Reproduction, Growth',
        'Movement, Reproduction, Strength, Nutrition, Energy, Respiration, Growth',
        'Mass, Respiration, Sensitivity, Nutrition, Excretion, Reproduction, Genes',
        'Movement, Respiration, Sight, Nutrition, Egestion, Reproduction, Growth',
      ],
      answer: 'Movement, Respiration, Sensitivity, Nutrition, Excretion, Reproduction, Growth',
      objectiveCode: 'B7.1.1A',
    },
    {
      question: 'Which of the following is an example of excretion in plants?',
      options: [
        'Releasing oxygen as a waste product of photosynthesis',
        'Absorbing water through the roots',
        'Producing seeds',
        'Growing towards the light',
      ],
      answer: 'Releasing oxygen as a waste product of photosynthesis',
      explanation: 'Excretion is the removal of waste products made by the organism — for plants, oxygen from photosynthesis is a key example.',
      objectiveCode: 'B7.1.1A',
    },
    {
      question: 'A virus can reproduce inside a host cell but cannot carry out most other life processes independently. Why do scientists debate whether viruses are living organisms?',
      options: [
        'They show one characteristic (reproduction) but cannot carry out the others on their own',
        'They are too small to be seen, so they cannot be studied',
        'They show all seven characteristics but only inside a laboratory',
        'They are made of metal and plastic, not cells',
      ],
      answer: 'They show one characteristic (reproduction) but cannot carry out the others on their own',
      explanation: 'Stretch question (previews Year 9 Biology): viruses only reproduce by hijacking a host cell and lack independent respiration, nutrition, excretion and growth.',
      objectiveCode: 'B7.1.1A',
    },
  ],
};

const L2: SeedCurriculumLesson = {
  lessonNumber: 2,
  title: 'Animal Cell Structure',
  objectiveCodes: ['B7.1.2A', 'B7.1.2C', 'B7.1.2D'],
  briefPrompt:
    'Generate a full Year 7 lesson on animal cell structure for iLowerSecondary Science. Cover: cell membrane (controls entry/exit), cytoplasm (jelly-like substance where reactions occur), nucleus (controls cell activities, contains DNA), mitochondria (site of aerobic respiration / energy release). Include a section on the light microscope — eyepiece lens, objective lens, fine/coarse focus, stage, mirror — and what can be seen at school microscope magnifications (×40 to ×400). Include one worked magnification calculation. Write at Pearson Edexcel foundation level. Do not reproduce any Pearson textbook text.',
  teacherNotes:
    'Magnification formula (M = I/A) appears in Physics and Biology. Introduce it here and reinforce. For the microscope section, if students have lab access, this lesson pairs with a practical cheek cell slide activity (enquiry objective B7.1.2D). Remind students that ribosomes are too small to see with a light microscope — this distinguishes animal cells from what they might see at home.',
  contentSources: [{
    type: 'text',
    value: 'The structure of a typical animal cell: cell membrane (controls entry/exit), cytoplasm (jelly-like substance where reactions occur), nucleus (controls cell activities, contains DNA), mitochondria (site of aerobic respiration). The light microscope: eyepiece lens, objective lens, fine/coarse focus, stage, mirror — and the level of cellular detail visible at school magnifications (×40 to ×400). Magnification = image size ÷ actual size.',
  }],
  quiz: [
    {
      question: 'Name the organelle that controls what enters and leaves the cell.',
      options: ['Cell membrane', 'Nucleus', 'Cytoplasm', 'Mitochondria'],
      answer: 'Cell membrane',
      objectiveCode: 'B7.1.2A',
    },
    {
      question: 'What is the function of the mitochondria?',
      options: [
        'Site of aerobic respiration, releasing energy for the cell',
        'Controls what enters and leaves the cell',
        'Contains the cell’s genetic material',
        'Makes food using sunlight',
      ],
      answer: 'Site of aerobic respiration, releasing energy for the cell',
      objectiveCode: 'B7.1.2A',
    },
    {
      question: 'Which part of a light microscope is used to focus the image at high magnification?',
      options: ['Eyepiece lens', 'Fine focus', 'Stage', 'Mirror'],
      answer: 'Fine focus',
      objectiveCode: 'B7.1.2C',
    },
    {
      question: 'A student views a cheek cell under a microscope at ×40 magnification. The cell appears 2 mm wide in the image. What is the actual width of the cell?',
      options: ['0.05 mm', '0.5 mm', '80 mm', '20 mm'],
      answer: '0.05 mm',
      explanation: 'Mark-scheme guidance: actual size = image size ÷ magnification = 2 ÷ 40 = 0.05 mm. Award the working mark for the rearranged formula.',
      objectiveCode: 'B7.1.2D',
    },
    {
      question: 'Which TWO structures can you see in an animal cell using a school light microscope?',
      options: [
        'Nucleus and cytoplasm',
        'Ribosomes and mitochondria in detail',
        'DNA strands and proteins',
        'Cell wall and chloroplasts',
      ],
      answer: 'Nucleus and cytoplasm',
      explanation: 'Ribosomes are too small to see with a light microscope; animal cells have no cell wall or chloroplasts.',
      objectiveCode: 'B7.1.2D',
    },
    {
      question: 'Why is the nucleus often described as the "control centre" of the cell?',
      options: [
        'It contains DNA and controls the cell’s activities',
        'It is in the exact centre of every cell',
        'It controls what enters and leaves the cell',
        'It releases all the cell’s energy',
      ],
      answer: 'It contains DNA and controls the cell’s activities',
      objectiveCode: 'B7.1.2A',
    },
    {
      question: 'A student says the cell membrane and the cell wall are the same thing. Which statement corrects this?',
      options: [
        'The cell membrane controls what enters and leaves the cell; the cell wall is a rigid outer layer found only in plant cells',
        'They are the same structure with two different names',
        'The cell wall controls what enters the cell; the membrane gives the cell its shape',
        'Animal cells have a cell wall but no membrane',
      ],
      answer: 'The cell membrane controls what enters and leaves the cell; the cell wall is a rigid outer layer found only in plant cells',
      objectiveCode: 'B7.1.2A',
    },
    {
      question: 'Which is the correct order of steps to prepare a cheek cell slide for viewing under a light microscope?',
      options: [
        'Collect cheek cells with a swab → smear onto the slide → add a drop of stain → lower the coverslip gently',
        'Add stain to the slide → look through the eyepiece → swab the cheek → add the coverslip',
        'Lower the coverslip → smear cells on top of it → stain → view at highest magnification first',
        'Place the swab directly under the objective lens and focus',
      ],
      answer: 'Collect cheek cells with a swab → smear onto the slide → add a drop of stain → lower the coverslip gently',
      explanation: 'Lower the coverslip at an angle to avoid trapping air bubbles; start at low magnification.',
      objectiveCode: 'B7.1.2C',
    },
  ],
};

const L3: SeedCurriculumLesson = {
  lessonNumber: 3,
  title: 'Plant Cells vs Animal Cells',
  objectiveCodes: ['B7.1.2B', 'B7.1.2E', 'B7.1.2F'],
  briefPrompt:
    'Generate a Year 7 iLowerSecondary Science lesson comparing plant and animal cells. Cover all 7 structures listed in B7.1.2E/F: cell wall (cellulose, gives support and shape), cell membrane (controls what enters/exits), cytoplasm (site of chemical reactions), nucleus (controls activities, contains genetic material), permanent vacuole (contains cell sap, maintains turgor), mitochondria (aerobic respiration), chloroplasts (photosynthesis — present in green plant cells only). Include a clear comparison table, exam-style worked examples, and note that not all plant cells have chloroplasts (e.g. root cells). Do not reproduce any Pearson textbook text.',
  teacherNotes:
    'Common exam error: students say "chloroplasts are found in ALL plant cells" — root cells are the counterexample. The permanent vacuole question (Q5) is intentionally open-ended — accept "animal cells need to be more flexible" or "animal cells do not need to maintain turgor pressure". The Venn diagram mind map format is particularly effective for this lesson — consider assigning it as the primary format for weaker students.',
  contentSources: [{
    type: 'text',
    value: 'Similarities and differences between plant and animal cells across 7 structures: cell wall (cellulose, support and shape — plants only), cell membrane (controls entry/exit), cytoplasm (site of chemical reactions), nucleus (controls activities, contains genetic material), permanent vacuole (cell sap, turgor — plants only), mitochondria (aerobic respiration), chloroplasts (photosynthesis — green plant cells only; root cells have none).',
  }],
  quiz: [
    {
      question: 'Which THREE structures are found in plant cells but NOT in animal cells?',
      options: [
        'Cell wall, chloroplasts and permanent vacuole',
        'Cell membrane, nucleus and cytoplasm',
        'Mitochondria, nucleus and cell wall',
        'Chloroplasts, mitochondria and ribosomes',
      ],
      answer: 'Cell wall, chloroplasts and permanent vacuole',
      objectiveCode: 'B7.1.2B',
    },
    {
      question: 'What is the function of the cell wall in a plant cell?',
      options: [
        'It gives the cell support and shape',
        'It controls what enters and leaves the cell',
        'It is the site of photosynthesis',
        'It stores cell sap',
      ],
      answer: 'It gives the cell support and shape',
      explanation: 'The cell wall is made of cellulose and provides support and shape.',
      objectiveCode: 'B7.1.2F',
    },
    {
      question: 'Name the organelle where photosynthesis takes place.',
      options: ['Chloroplast', 'Mitochondria', 'Permanent vacuole', 'Nucleus'],
      answer: 'Chloroplast',
      objectiveCode: 'B7.1.2F',
    },
    {
      question: 'Which structure is found in BOTH plant and animal cells?',
      options: ['Cell membrane', 'Cell wall', 'Chloroplast', 'Permanent vacuole'],
      answer: 'Cell membrane',
      explanation: 'From the comparison table: cell membrane, cytoplasm, nucleus and mitochondria are shared; cell wall, chloroplasts and permanent vacuole are plant-only.',
      objectiveCode: 'B7.1.2E',
    },
    {
      question: 'Which is the best explanation of why animal cells do not have a permanent vacuole?',
      options: [
        'Animal cells do not need to maintain turgor pressure and benefit from being more flexible',
        'Animal cells are too small to fit a vacuole',
        'Animal cells store all their water in the nucleus instead',
        'Animal cells would burst if they contained any liquid',
      ],
      answer: 'Animal cells do not need to maintain turgor pressure and benefit from being more flexible',
      explanation: 'Open-ended in the source — accept "animal cells need to be more flexible" or "do not need to maintain turgor pressure".',
      objectiveCode: 'B7.1.2F',
    },
    {
      question: 'A cell observed under a microscope has a cell wall, chloroplasts, and a large central vacuole. What type of cell is it?',
      options: [
        'A plant cell, because it has structures never found in animal cells',
        'An animal cell, because it has a nucleus',
        'A bacterial cell, because it has a cell wall',
        'It is impossible to tell from these structures',
      ],
      answer: 'A plant cell, because it has structures never found in animal cells',
      objectiveCode: 'B7.1.2B',
    },
    {
      question: 'Which option states TWO functions of the cell membrane?',
      options: [
        'It controls what enters and leaves the cell, and it holds the cell contents together',
        'It makes food for the cell, and it stores cell sap',
        'It releases energy, and it contains DNA',
        'It gives the cell a rigid shape, and it carries out photosynthesis',
      ],
      answer: 'It controls what enters and leaves the cell, and it holds the cell contents together',
      objectiveCode: 'B7.1.2F',
    },
    {
      question: 'A student states that all plant cells contain chloroplasts. Which response best evaluates this claim?',
      options: [
        'Incorrect — root cells are plant cells but have no chloroplasts because they receive no light',
        'Correct — chloroplasts are what make a cell a plant cell',
        'Incorrect — only animal cells contain chloroplasts',
        'Correct — every green organism is made entirely of chloroplasts',
      ],
      answer: 'Incorrect — root cells are plant cells but have no chloroplasts because they receive no light',
      explanation: 'Common exam error: chloroplasts occur in green plant cells only; root cells are the standard counterexample.',
      objectiveCode: 'B7.1.2E',
    },
  ],
};

const L4: SeedCurriculumLesson = {
  lessonNumber: 4,
  title: 'Cell Organisation — Tissues, Organs & Systems',
  objectiveCodes: ['B7.1.2G', 'B7.1.2H', 'B7.1.2I'],
  briefPrompt:
    'Generate a Year 7 iLowerSecondary Science lesson on the hierarchical organisation of multicellular organisms. Cover the five levels: cell → tissue → organ → organ system → organism. Use cardiac muscle cells → heart → circulatory system → human as the main worked example. Include a table of 8 human organ systems: circulatory (heart, blood vessels), respiratory (lungs, trachea), digestive (stomach, intestines, liver), nervous (brain, spinal cord, nerves), musculo-skeletal (bones, muscles), urinary/excretory (kidneys), skin/integumentary, reproductive. Add a brief section on applying this to other vertebrates (cats, fish, birds). Do not reproduce any Pearson textbook text.',
  teacherNotes:
    'Students often confuse "organ" with "organ system" — the heart vs the circulatory system is the clearest example. For B7.1.2I (vertebrates), keep it brief — one or two examples linking a named vertebrate organ to a human equivalent. The infographic format (body silhouette) works well as a visual summary for students who struggle with text-heavy notes. Pairs well with a body-systems labelling activity.',
  contentSources: [{
    type: 'text',
    value: 'The hierarchical organisation of multicellular organisms: cell → tissue → organ → organ system → organism, using cardiac muscle cell → heart → circulatory system → human as the worked example. The 8 major human organ systems (circulatory, respiratory, digestive, nervous, musculo-skeletal, urinary/excretory, skin, reproductive) and their functions, applied to other vertebrates.',
  }],
  quiz: [
    {
      question: 'Which option places the following in order from smallest to largest: organism, tissue, organ, cell, organ system?',
      options: [
        'Cell → tissue → organ → organ system → organism',
        'Cell → organ → tissue → organism → organ system',
        'Tissue → cell → organ → organ system → organism',
        'Organism → organ system → organ → tissue → cell',
      ],
      answer: 'Cell → tissue → organ → organ system → organism',
      objectiveCode: 'B7.1.2G',
    },
    {
      question: 'Name the organ system responsible for transporting blood around the body.',
      options: ['Circulatory system', 'Respiratory system', 'Digestive system', 'Nervous system'],
      answer: 'Circulatory system',
      objectiveCode: 'B7.1.2H',
    },
    {
      question: 'What is the function of the kidneys?',
      options: [
        'They filter the blood and remove waste products as urine',
        'They pump blood around the body',
        'They digest food and absorb nutrients',
        'They send electrical signals around the body',
      ],
      answer: 'They filter the blood and remove waste products as urine',
      objectiveCode: 'B7.1.2H',
    },
    {
      question: 'Which of the following is an organ?',
      options: ['Blood', 'Neurone', 'Liver', 'Digestive system'],
      answer: 'Liver',
      explanation: 'Blood is a tissue, a neurone is a cell, and the digestive system is an organ system.',
      objectiveCode: 'B7.1.2G',
    },
    {
      question: 'A cat has a heart that pumps blood around its body. Which organ system does this belong to, and how do we know it is the same system found in humans?',
      options: [
        'The circulatory system — the heart performs the same function (pumping blood) in both vertebrates',
        'The respiratory system — because the heart needs oxygen',
        'The digestive system — because blood carries nutrients',
        'A cat’s heart belongs to a completely different system to a human heart',
      ],
      answer: 'The circulatory system — the heart performs the same function (pumping blood) in both vertebrates',
      explanation: 'B7.1.2I: vertebrate organs map to human equivalents by matching structure and function.',
      objectiveCode: 'B7.1.2I',
    },
    {
      question: 'What is the difference between a tissue and an organ?',
      options: [
        'A tissue is a group of similar cells working together; an organ is made of several different tissues working together',
        'A tissue is larger than an organ',
        'An organ is a group of identical cells; a tissue is made of organs',
        'There is no difference — the words mean the same thing',
      ],
      answer: 'A tissue is a group of similar cells working together; an organ is made of several different tissues working together',
      objectiveCode: 'B7.1.2G',
    },
    {
      question: 'Which option names an organ in the nervous system and states its function correctly?',
      options: [
        'The brain — it coordinates the body’s activities and processes information',
        'The heart — it sends electrical signals to the muscles',
        'The lungs — they control thinking and memory',
        'The stomach — it sends nerve impulses around the body',
      ],
      answer: 'The brain — it coordinates the body’s activities and processes information',
      objectiveCode: 'B7.1.2H',
    },
    {
      question: 'A student says "the stomach is a tissue". Which statement corrects this?',
      options: [
        'The stomach is an organ, because it is made of several different tissues (muscle, lining, glandular) working together',
        'The stomach is a cell, because it is a single unit',
        'The student is correct — the stomach is a tissue',
        'The stomach is an organ system, because it digests food',
      ],
      answer: 'The stomach is an organ, because it is made of several different tissues (muscle, lining, glandular) working together',
      objectiveCode: 'B7.1.2G',
    },
  ],
};

const L5: SeedCurriculumLesson = {
  lessonNumber: 5,
  title: 'The External Structure of Plants',
  objectiveCodes: ['B7.2.1A', 'B7.2.1B', 'B7.2.1C', 'B7.2.1D'],
  briefPrompt:
    'Generate a Year 7 iLowerSecondary Science lesson on the external structure of flowering plants. Cover: roots (absorb water and minerals, anchor the plant, storage in some species), stems (transport water upward via xylem, transport sugars via phloem, support), leaves (photosynthesis, gas exchange, transpiration). Include examples from Malaysian/tropical plants (hibiscus, rambutan, banana, rubber tree). Add a section on habitat adaptations: desert plants (cacti — thick stems for water storage, waxy coating to reduce evaporation, spines instead of leaves), arctic/tundra plants (small, ground-hugging, thick leaves to retain heat), tropical rainforest plants (large thin leaves to capture light, drip tips to shed water). Do not reproduce any Pearson textbook text.',
  teacherNotes:
    'Malaysian context is a major strength here — students can observe hibiscus (national flower), banana, papaya, and rubber trees in their environment. The habitat adaptation section links directly to B7.4.2A (organisms adapted to their habitat) later in this unit. Consider assigning the infographic as a take-home task using a plant the student can find locally.',
  contentSources: [{
    type: 'text',
    value: 'The external structure of flowering plants: roots (absorb water and minerals, anchor, storage), stems (transport water via xylem, sugars via phloem, support), leaves (photosynthesis, gas exchange, transpiration). Habitat adaptations: desert plants (thick stems, waxy coating, spines), arctic plants (small, ground-hugging, thick leaves), rainforest plants (large thin leaves, drip tips). Malaysian examples: hibiscus, rambutan, banana, rubber tree.',
  }],
  quiz: [
    {
      question: 'Which option states TWO functions of roots in a flowering plant?',
      options: [
        'Absorbing water and minerals, and anchoring the plant in the soil',
        'Photosynthesis and gas exchange',
        'Transporting sugars and producing flowers',
        'Capturing sunlight and shedding rainwater',
      ],
      answer: 'Absorbing water and minerals, and anchoring the plant in the soil',
      explanation: 'Also accept storage (in some species).',
      objectiveCode: 'B7.2.1B',
    },
    {
      question: 'How do stems transport water from the roots to the leaves?',
      options: [
        'Through xylem vessels running up the stem',
        'Through the phloem, which carries water downward',
        'Water soaks slowly through the bark',
        'The leaves pull water in directly from the air',
      ],
      answer: 'Through xylem vessels running up the stem',
      objectiveCode: 'B7.2.1B',
    },
    {
      question: 'A cactus has a thick, waxy stem and no visible leaves. How do these features help it survive in a desert?',
      options: [
        'The thick stem stores water and the waxy coating reduces evaporation',
        'The thick stem makes it too heavy for animals to move',
        'The waxy coating attracts insects for pollination',
        'Having no leaves means it does not need any water',
      ],
      answer: 'The thick stem stores water and the waxy coating reduces evaporation',
      objectiveCode: 'B7.2.1D',
    },
    {
      question: 'Name the process that occurs mainly in the leaves of a plant.',
      options: ['Photosynthesis', 'Respiration only', 'Absorption of minerals', 'Anchoring'],
      answer: 'Photosynthesis',
      objectiveCode: 'B7.2.1B',
    },
    {
      question: 'Which option gives TWO correct differences between the leaves of a tropical rainforest plant and an arctic plant?',
      options: [
        'Rainforest leaves are large and thin to capture light; arctic leaves are small and thick to retain heat',
        'Rainforest leaves are small and waxy; arctic leaves are large and thin',
        'Rainforest leaves are spines; arctic leaves are drip tips',
        'There is no difference — leaves are the same in every habitat',
      ],
      answer: 'Rainforest leaves are large and thin to capture light; arctic leaves are small and thick to retain heat',
      explanation: 'Rainforest leaves may also have drip tips to shed water; arctic plants grow low to the ground.',
      objectiveCode: 'B7.2.1D',
    },
    {
      question: 'A student digs up a plant and notices the roots spread out widely near the surface. Why might this be an advantage?',
      options: [
        'It lets the plant quickly absorb rainwater over a large area before it drains away',
        'It makes the plant easier to dig up',
        'Shallow roots are stronger than deep roots in every soil',
        'It stops the plant from photosynthesising too fast',
      ],
      answer: 'It lets the plant quickly absorb rainwater over a large area before it drains away',
      objectiveCode: 'B7.2.1C',
    },
    {
      question: 'Which structure is responsible for each of the following: (a) anchoring the plant; (b) making food using sunlight; (c) carrying water upward?',
      options: [
        '(a) root, (b) leaf, (c) stem',
        '(a) stem, (b) root, (c) leaf',
        '(a) leaf, (b) stem, (c) root',
        '(a) root, (b) stem, (c) leaf',
      ],
      answer: '(a) root, (b) leaf, (c) stem',
      objectiveCode: 'B7.2.1A',
    },
    {
      question: 'How might the leaves of a plant growing in a dark rainforest understory differ from those growing in direct sunlight?',
      options: [
        'They are likely to be larger, to capture as much of the limited light as possible',
        'They are likely to be smaller, because light is not needed',
        'They will have spines instead of leaf blades',
        'They will be thicker and waxy to store water',
      ],
      answer: 'They are likely to be larger, to capture as much of the limited light as possible',
      objectiveCode: 'B7.2.1C',
    },
  ],
};

const L6: SeedCurriculumLesson = {
  lessonNumber: 6,
  title: 'The Musculo-Skeletal System',
  objectiveCodes: ['B7.3.1A', 'B7.3.1B', 'B7.3.1C', 'B7.3.1D'],
  briefPrompt:
    'Generate a Year 7 iLowerSecondary Science lesson on the musculo-skeletal system. Cover: (1) Skeleton functions — support (maintains body shape), protection (skull/ribcage/vertebral column), movement (with muscles), production of blood cells (red bone marrow). (2) Antagonistic muscles — bicep contracts/tricep relaxes to bend the arm; tricep contracts/bicep relaxes to straighten. Muscles can only pull, not push. (3) Joints — ball-and-socket (shoulder, hip — full rotation), hinge (elbow, knee — one plane), pivot (neck), fixed/fused (skull). (4) Worked example: movement at the elbow during a bicep curl. Do not reproduce any Pearson textbook text.',
  teacherNotes:
    'Students frequently confuse which muscle contracts for which action — the mnemonic "Bend = Bicep, Straight = Tricep" helps. For B7.3.1D (joint comparison), use students’ own bodies — ask them to rotate their shoulder vs bend their elbow and describe the difference. This lesson pairs excellently with a joints practical where students compare movement using a model arm or their own.',
  contentSources: [{
    type: 'text',
    value: 'The musculo-skeletal system: four skeleton functions (support, protection, movement, making blood cells in red bone marrow); antagonistic muscle pairs (bicep/tricep at the elbow — muscles can only pull, not push); joint types and range of movement (ball-and-socket: shoulder/hip; hinge: elbow/knee; pivot: neck; fixed/fused: skull).',
  }],
  quiz: [
    {
      question: 'Which option states FOUR functions of the human skeleton?',
      options: [
        'Support, protection, movement and making blood cells',
        'Support, digestion, movement and breathing',
        'Protection, excretion, sensitivity and growth',
        'Movement, photosynthesis, support and protection',
      ],
      answer: 'Support, protection, movement and making blood cells',
      explanation: 'Blood cells are made in the red bone marrow.',
      objectiveCode: 'B7.3.1A',
    },
    {
      question: 'When you bend your arm at the elbow, which muscle contracts?',
      options: ['Tricep', 'Bicep', 'Both', 'Neither'],
      answer: 'Bicep',
      explanation: 'Mnemonic: "Bend = Bicep, Straight = Tricep".',
      objectiveCode: 'B7.3.1C',
    },
    {
      question: 'Why must muscles work in antagonistic pairs?',
      options: [
        'Muscles can only pull, not push — so a second muscle is needed to pull the bone back the other way',
        'One muscle is always stronger than the other',
        'Muscles get tired and need a partner to rest',
        'Pairs of muscles make the arm look symmetrical',
      ],
      answer: 'Muscles can only pull, not push — so a second muscle is needed to pull the bone back the other way',
      objectiveCode: 'B7.3.1B',
    },
    {
      question: 'Name the type of joint found at the shoulder and the range of movement it allows.',
      options: [
        'Ball-and-socket joint — allows movement in a full circle (rotation in many directions)',
        'Hinge joint — allows movement in one plane only',
        'Pivot joint — allows side-to-side turning only',
        'Fixed joint — allows no movement',
      ],
      answer: 'Ball-and-socket joint — allows movement in a full circle (rotation in many directions)',
      objectiveCode: 'B7.3.1D',
    },
    {
      question: 'A student says "the skeleton is just for support and movement". Which TWO additional functions have they missed?',
      options: [
        'Protection of organs and production of blood cells',
        'Digestion and respiration',
        'Photosynthesis and excretion',
        'Sensitivity and reproduction',
      ],
      answer: 'Protection of organs and production of blood cells',
      objectiveCode: 'B7.3.1A',
    },
    {
      question: 'What happens to the bicep and tricep when you straighten your arm at the elbow?',
      options: [
        'The tricep contracts and the bicep relaxes',
        'The bicep contracts and the tricep relaxes',
        'Both muscles contract together',
        'Both muscles relax together',
      ],
      answer: 'The tricep contracts and the bicep relaxes',
      objectiveCode: 'B7.3.1C',
    },
    {
      question: 'Which option correctly compares a hinge joint with a ball-and-socket joint?',
      options: [
        'A hinge joint (e.g. elbow) moves in one plane; a ball-and-socket joint (e.g. shoulder) allows rotation in many directions',
        'A hinge joint (e.g. shoulder) rotates fully; a ball-and-socket joint (e.g. knee) moves in one plane',
        'Both joints allow exactly the same range of movement',
        'A hinge joint allows no movement; a ball-and-socket joint moves in one plane',
      ],
      answer: 'A hinge joint (e.g. elbow) moves in one plane; a ball-and-socket joint (e.g. shoulder) allows rotation in many directions',
      objectiveCode: 'B7.3.1D',
    },
    {
      question: 'How does the ribcage protect the heart and lungs?',
      options: [
        'The ribs and breastbone form a bony cage around the heart and lungs, shielding them from knocks and impacts',
        'The ribs squeeze the heart to keep it pumping',
        'The breastbone produces blood cells that heal the lungs',
        'The ribcage keeps the heart and lungs warm',
      ],
      answer: 'The ribs and breastbone form a bony cage around the heart and lungs, shielding them from knocks and impacts',
      explanation: 'Mark-scheme guidance: answer must include the role of the ribs and the breastbone (sternum).',
      objectiveCode: 'B7.3.1A',
    },
  ],
};

const L7: SeedCurriculumLesson = {
  lessonNumber: 7,
  title: 'Organisms & Their Environment — Food Chains, Food Webs & Adaptation',
  objectiveCodes: ['B7.4.1A', 'B7.4.1B', 'B7.4.2A', 'B7.4.2B', 'B7.4.2C'],
  briefPrompt:
    'Generate a Year 7 iLowerSecondary Science lesson on organisms and their environment. Cover: (1) Feeding levels — producer (makes own food via photosynthesis), primary consumer (eats producer), secondary consumer, tertiary consumer, decomposer (breaks down dead material, returns nutrients to soil). (2) Food chains and food webs — energy flows from producer upward — interdependence means change in one population affects others. Use a Malaysian/Southeast Asian context: e.g. grass → grasshopper → lizard → monitor lizard → tiger, or a mangrove food web. (3) Adaptation — give 3 examples with structural and behavioural adaptations (e.g. polar bear: white fur for camouflage, blubber for insulation; cactus: spines, thick stem; fish: streamlined body, gills). (4) Abiotic factors (temperature, light intensity, water availability, pH, salinity) vs biotic factors (predation, competition, disease, food availability). (5) Effect of environmental change — if one species declines, predict knock-on effects. Do not reproduce any Pearson textbook text.',
  teacherNotes:
    'Use Malaysian examples throughout — the Malayan tiger (endangered), the hornbill (national symbol of Sarawak), the Malayan tapir, and mangrove ecosystems are all highly relatable. The food web prediction question (Q6) is the most important exam skill in this lesson — students must practise chain-of-reasoning answers: "deer decrease → tiger has less food → tiger population decreases; grass increases because fewer deer eating it". The abiotic/biotic distinction trips up students who confuse "disease" (biotic) with "drought" (abiotic).',
  contentSources: [{
    type: 'text',
    value: 'Feeding levels: producer, primary/secondary/tertiary consumer, decomposer. Food chains and food webs — energy flows from the producer upward; interdependence means a change in one population affects others. Adaptation: structural and behavioural examples (polar bear, cactus, fish). Abiotic factors (temperature, light, water, pH, salinity) vs biotic factors (predation, competition, disease, food availability). Effects of changing environmental conditions on the number and distribution of organisms, using Malaysian rainforest and mangrove contexts.',
  }],
  quiz: [
    {
      question: 'What is the source of energy for all food chains?',
      options: ['The Sun', 'The soil', 'Decomposers', 'Water'],
      answer: 'The Sun',
      objectiveCode: 'B7.4.1A',
    },
    {
      question: 'In the food chain: Grass → Grasshopper → Frog → Snake → Eagle, identify the secondary consumer.',
      options: ['Frog', 'Grasshopper', 'Snake', 'Eagle'],
      answer: 'Frog',
      explanation: 'Producer: grass; primary consumer: grasshopper; secondary: frog; tertiary: snake.',
      objectiveCode: 'B7.4.1A',
    },
    {
      question: 'What does a decomposer do, and why are decomposers important in a food web?',
      options: [
        'It breaks down dead material and returns nutrients to the soil for producers to reuse',
        'It eats only producers, keeping plant populations under control',
        'It hunts the top predator, limiting its population',
        'It converts sunlight into food for the whole web',
      ],
      answer: 'It breaks down dead material and returns nutrients to the soil for producers to reuse',
      objectiveCode: 'B7.4.1A',
    },
    {
      question: 'Which option gives TWO abiotic factors that might affect the distribution of organisms in a pond?',
      options: [
        'Water temperature and light intensity',
        'Predation and competition',
        'Disease and food availability',
        'Fish and pondweed',
      ],
      answer: 'Water temperature and light intensity',
      explanation: 'Abiotic = non-living. Also accept pH, salinity, water availability.',
      objectiveCode: 'B7.4.2B',
    },
    {
      question: 'A polar bear has thick white fur and a layer of blubber. How is each feature an adaptation to its habitat?',
      options: [
        'White fur camouflages it against the snow; blubber insulates it against the cold',
        'White fur keeps it cool; blubber helps it swim faster',
        'White fur attracts prey; blubber stores oxygen',
        'Both features are for attracting a mate',
      ],
      answer: 'White fur camouflages it against the snow; blubber insulates it against the cold',
      explanation: 'Mark-scheme guidance: one mark per feature linked to its survival advantage.',
      objectiveCode: 'B7.4.2A',
    },
    {
      question: 'In a Malaysian rainforest food web, a disease kills most of the deer population. What is the most likely effect on the tiger population and the grass?',
      options: [
        'Tigers decrease because they have less food; grass increases because fewer deer are eating it',
        'Tigers increase because they catch the sick deer easily; grass decreases',
        'Both tigers and grass decrease',
        'Nothing changes, because food webs are independent of each species',
      ],
      answer: 'Tigers decrease because they have less food; grass increases because fewer deer are eating it',
      explanation: 'The key exam skill: chain-of-reasoning — "deer decrease → tiger has less food → tiger population decreases; grass increases because fewer deer eating it".',
      objectiveCode: 'B7.4.2C',
    },
    {
      question: 'Which option correctly distinguishes an abiotic factor from a biotic factor, with one example of each?',
      options: [
        'Abiotic factors are non-living (e.g. temperature); biotic factors come from living organisms (e.g. predation)',
        'Abiotic factors are living (e.g. disease); biotic factors are non-living (e.g. drought)',
        'Abiotic factors only affect plants; biotic factors only affect animals',
        'Abiotic and biotic both mean non-living factors',
      ],
      answer: 'Abiotic factors are non-living (e.g. temperature); biotic factors come from living organisms (e.g. predation)',
      explanation: 'Watch the classic trap: disease is biotic; drought is abiotic.',
      objectiveCode: 'B7.4.2B',
    },
    {
      question: 'Why can removing a species from the middle of a food web affect all other organisms in the web?',
      options: [
        'Organisms are interdependent — predators of that species lose food while its prey increase, and those changes ripple through the web',
        'The web physically collapses without a middle species',
        'Only the top predator is ever affected by a removal',
        'Energy starts flowing backwards through the web',
      ],
      answer: 'Organisms are interdependent — predators of that species lose food while its prey increase, and those changes ripple through the web',
      objectiveCode: 'B7.4.1B',
    },
  ],
};

const L8: SeedCurriculumLesson = {
  lessonNumber: 8,
  title: 'Unit 1 Mastery Quiz — Living Organisms',
  isUnitQuiz: true,
  objectiveCodes: [
    'B7.1.1A', 'B7.1.2A', 'B7.1.2B', 'B7.1.2C', 'B7.1.2D', 'B7.1.2E', 'B7.1.2F',
    'B7.1.2G', 'B7.1.2H', 'B7.1.2I', 'B7.2.1A', 'B7.2.1B', 'B7.2.1C', 'B7.2.1D',
    'B7.3.1A', 'B7.3.1B', 'B7.3.1C', 'B7.3.1D', 'B7.4.1A', 'B7.4.1B', 'B7.4.2A',
    'B7.4.2B', 'B7.4.2C',
  ],
  briefPrompt:
    'Generate a 20-question Unit 1 mastery quiz for Year 7 iLowerSecondary Science covering: characteristics of living things (MRS NERG), animal and plant cell structure, cell organisation hierarchy, external plant structure, musculo-skeletal system, food chains/webs, adaptation, and abiotic/biotic factors. Format: 10 multiple-choice (4 options each), 5 short-answer (1–2 marks each), 3 structured questions (4–6 marks each), 2 extended response (4 marks each). Questions must be at Pearson Edexcel iLowerSecondary standard. Include a full mark scheme. Do not reproduce any Pearson textbook text.',
  teacherNotes:
    'MASTERY GATE: Students must score 70% or above (14/20) to unlock Unit 2. Students who fail are directed back to the specific lessons where they lost marks — the adaptive review system maps each quiz question to its source lesson. This is the Rochford’s mastery model applied digitally. The parent dashboard auto-generates a report showing the score, time taken, weakest objective, and recommended next steps. Teacher accounts see all student scores in the class dashboard.',
  contentSources: [{
    type: 'text',
    value: 'Unit 1 mastery assessment covering all objectives from B7.1.1A through B7.4.2C: characteristics of living things, animal and plant cell structure, microscopy, cell organisation hierarchy, external plant structure and adaptation, the musculo-skeletal system, food chains and webs, adaptation, and abiotic/biotic factors.',
  }],
  quiz: [
    // ── 10 MCQ — one or more per lesson, covering B7.1.1A → B7.4.2C ──
    {
      question: 'Which of the following is NOT one of the seven characteristics of living things?',
      options: ['Movement', 'Respiration', 'Combustion', 'Excretion'],
      answer: 'Combustion',
      objectiveCode: 'B7.1.1A',
      sourceLesson: 1,
    },
    {
      question: 'Which organelle is the site of aerobic respiration in a cell?',
      options: ['Mitochondria', 'Nucleus', 'Cell membrane', 'Chloroplast'],
      answer: 'Mitochondria',
      objectiveCode: 'B7.1.2A',
      sourceLesson: 2,
    },
    {
      question: 'Which part of a light microscope do you look through to see the image?',
      options: ['Eyepiece lens', 'Stage', 'Mirror', 'Coarse focus'],
      answer: 'Eyepiece lens',
      objectiveCode: 'B7.1.2C',
      sourceLesson: 2,
    },
    {
      question: 'Which structure is found in a plant cell but NOT in an animal cell?',
      options: ['Cell wall', 'Cell membrane', 'Nucleus', 'Mitochondria'],
      answer: 'Cell wall',
      objectiveCode: 'B7.1.2B',
      sourceLesson: 3,
    },
    {
      question: 'Which is the correct order of organisation in a multicellular organism, from smallest to largest?',
      options: [
        'Cell → tissue → organ → organ system → organism',
        'Tissue → cell → organ system → organ → organism',
        'Organ → tissue → cell → organism → organ system',
        'Cell → organ → tissue → organ system → organism',
      ],
      answer: 'Cell → tissue → organ → organ system → organism',
      objectiveCode: 'B7.1.2G',
      sourceLesson: 4,
    },
    {
      question: 'Which organ belongs to the digestive system?',
      options: ['Stomach', 'Heart', 'Lungs', 'Brain'],
      answer: 'Stomach',
      objectiveCode: 'B7.1.2H',
      sourceLesson: 4,
    },
    {
      question: 'What is the main function of a plant’s leaves?',
      options: [
        'Photosynthesis — making food using sunlight',
        'Anchoring the plant in the soil',
        'Absorbing minerals from the soil',
        'Transporting water up from the roots',
      ],
      answer: 'Photosynthesis — making food using sunlight',
      objectiveCode: 'B7.2.1B',
      sourceLesson: 5,
    },
    {
      question: 'During a bicep curl, what happens at the elbow as the arm bends?',
      options: [
        'The bicep contracts while the tricep relaxes',
        'The tricep contracts while the bicep relaxes',
        'Both muscles contract at the same time',
        'Both muscles relax at the same time',
      ],
      answer: 'The bicep contracts while the tricep relaxes',
      objectiveCode: 'B7.3.1C',
      sourceLesson: 6,
    },
    {
      question: 'In the food chain Grass → Deer → Tiger, which organism is the producer?',
      options: ['Grass', 'Deer', 'Tiger', 'None of them'],
      answer: 'Grass',
      objectiveCode: 'B7.4.1A',
      sourceLesson: 7,
    },
    {
      question: 'Which of the following is an abiotic factor?',
      options: ['Temperature', 'Predation', 'Disease', 'Competition for food'],
      answer: 'Temperature',
      objectiveCode: 'B7.4.2B',
      sourceLesson: 7,
    },
    // ── 5 short answer (converted to MCQ) ──
    {
      question: 'Which option states THREE functions of roots?',
      options: [
        'Absorbing water and minerals, anchoring the plant, and storing food',
        'Photosynthesis, transpiration, and gas exchange',
        'Transporting sugars, supporting the flower, and attracting pollinators',
        'Making seeds, shedding water, and capturing light',
      ],
      answer: 'Absorbing water and minerals, anchoring the plant, and storing food',
      explanation: 'Short-answer mark scheme: one mark per correct function (any three).',
      objectiveCode: 'B7.2.1B',
      sourceLesson: 5,
    },
    {
      question: 'Which option best describes antagonistic muscle action?',
      options: [
        'Two muscles work as a pair — one contracts while the other relaxes — because muscles can only pull',
        'Two muscles always contract together to double the force',
        'One muscle pushes the bone while the other pulls it',
        'Muscles take turns resting on alternate days',
      ],
      answer: 'Two muscles work as a pair — one contracts while the other relaxes — because muscles can only pull',
      explanation: 'Short-answer mark scheme: must state the pair acts in opposition and that muscles can only pull, not push.',
      objectiveCode: 'B7.3.1B',
      sourceLesson: 6,
    },
    {
      question: 'Which option gives TWO examples of abiotic factors?',
      options: [
        'Light intensity and water availability',
        'Predation and disease',
        'Competition and food availability',
        'Producers and decomposers',
      ],
      answer: 'Light intensity and water availability',
      explanation: 'Also accept temperature, pH, salinity.',
      objectiveCode: 'B7.4.2B',
      sourceLesson: 7,
    },
    {
      question: 'Which option names THREE structures found only in plant cells?',
      options: [
        'Cell wall, chloroplasts and permanent vacuole',
        'Nucleus, cytoplasm and cell membrane',
        'Mitochondria, ribosomes and nucleus',
        'Cell wall, mitochondria and cytoplasm',
      ],
      answer: 'Cell wall, chloroplasts and permanent vacuole',
      objectiveCode: 'B7.1.2E',
      sourceLesson: 3,
    },
    {
      question: 'Which option states TWO roles of the skeleton?',
      options: [
        'Protecting organs and making blood cells',
        'Digesting food and absorbing nutrients',
        'Pumping blood and exchanging gases',
        'Sending nerve impulses and storing fat',
      ],
      answer: 'Protecting organs and making blood cells',
      explanation: 'Also accept support and movement.',
      objectiveCode: 'B7.3.1A',
      sourceLesson: 6,
    },
    // ── 3 structured questions (converted to MCQ) ──
    {
      question: 'A Malaysian food web contains: grass, deer, tapir, tiger, hornbill and fig tree. Disease kills most of the deer. Which prediction is correct, with sound reasoning?',
      options: [
        'Tigers decline because a food source is lost, and grass increases because fewer deer graze on it',
        'Tigers increase because deer become easier to catch',
        'The fig tree dies because deer no longer spread its seeds — so the whole web collapses immediately',
        'Nothing changes because tigers can photosynthesise',
      ],
      answer: 'Tigers decline because a food source is lost, and grass increases because fewer deer graze on it',
      explanation: 'Structured question (5 marks): identify the producer, name a consumer, predict the effect of disease in one species, and explain the chain of reasoning.',
      objectiveCode: 'B7.4.1B',
      sourceLesson: 7,
    },
    {
      question: 'A diagram shows a cell with a cell wall, chloroplasts, a large central vacuole and a nucleus. Which row identifies the cell and the function of TWO labelled structures correctly?',
      options: [
        'Plant cell — chloroplasts carry out photosynthesis; the cell wall gives support and shape',
        'Animal cell — chloroplasts release energy; the cell wall controls what enters',
        'Plant cell — the vacuole controls cell activities; the nucleus stores cell sap',
        'Animal cell — the nucleus carries out photosynthesis; the vacuole gives support',
      ],
      answer: 'Plant cell — chloroplasts carry out photosynthesis; the cell wall gives support and shape',
      explanation: 'Structured question (6 marks): identify plant/animal, name four labelled structures, state the function of two.',
      objectiveCode: 'B7.1.2B',
      sourceLesson: 3,
    },
    {
      question: 'Using a school light microscope (×40 to ×400) to view the cell in the diagram, which structures could you actually see?',
      options: [
        'The cell wall, nucleus, vacuole and chloroplasts — but not ribosomes, which are too small',
        'Every structure including ribosomes and individual DNA strands',
        'Only the colour of the cell — no internal structures at all',
        'Only structures in animal cells can be seen with a light microscope',
      ],
      answer: 'The cell wall, nucleus, vacuole and chloroplasts — but not ribosomes, which are too small',
      explanation: 'Tests B7.1.2D: the level of cellular detail visible with a simple light microscope.',
      objectiveCode: 'B7.1.2D',
      sourceLesson: 2,
    },
    // ── 2 extended response (converted to MCQ) ──
    {
      question: 'Which option best compares the structure and function of a desert cactus with a tropical rainforest plant, referring to stems, leaves and roots?',
      options: [
        'Cactus: thick water-storing stem, spines instead of leaves, wide shallow roots. Rainforest plant: tall stem to reach light, large thin leaves with drip tips, roots adapted to wet soil',
        'Cactus: large thin leaves to lose water quickly. Rainforest plant: spines and a waxy thick stem to store water',
        'Both plants have identical structures because all plants share the same three organs',
        'Cactus: no roots at all. Rainforest plant: no leaves at all',
      ],
      answer: 'Cactus: thick water-storing stem, spines instead of leaves, wide shallow roots. Rainforest plant: tall stem to reach light, large thin leaves with drip tips, roots adapted to wet soil',
      explanation: 'Extended response (4 marks): one mark per correct structural comparison linked to habitat, across stems, leaves and roots.',
      objectiveCode: 'B7.2.1D',
      sourceLesson: 5,
    },
    {
      question: 'Which option fully explains how antagonistic muscles bring about movement at the elbow during a bicep curl?',
      options: [
        'The bicep contracts and pulls the forearm up while the tricep relaxes; to lower the arm, the tricep contracts and pulls it straight while the bicep relaxes',
        'The bicep pushes the forearm up while the tricep pushes it down',
        'Both the bicep and tricep contract together to lift, then both relax to lower',
        'The elbow joint moves on its own; the muscles only keep the bones warm',
      ],
      answer: 'The bicep contracts and pulls the forearm up while the tricep relaxes; to lower the arm, the tricep contracts and pulls it straight while the bicep relaxes',
      explanation: 'Extended response (4 marks): name both muscles and describe what each does in both phases. Muscles can only pull, not push.',
      objectiveCode: 'B7.3.1C',
      sourceLesson: 6,
    },
  ],
};

export const Y7_SCIENCE_UNIT_1 = {
  programme: {
    id: 'ilowersecondary',
    name: 'iLowerSecondary',
    description:
      'Pearson iLowerSecondary programme for Years 7–9 — Science, Maths, English and Computing. Aligned to the Pearson iLowerSecondary Schemes of Work.',
    yearGroups: ['Year 7', 'Year 8', 'Year 9'],
    subjects: ['Science', 'Maths', 'English', 'Computing'],
    requiredTier: 'academic' as const,
    status: 'active' as const,
  },
  module: {
    title: 'Science — Year 7',
    description:
      'iLowerSecondary Science for Year 7. Six units across the academic year, each ending in a mastery quiz. Unit 1 covers Living Organisms: characteristics of life, cells, organisation, plants, the musculo-skeletal system, and organisms & their environment.',
    subject: 'Science',
    yearGroup: 'Year 7',
  },
  unit: {
    title: 'Unit 1: Living Organisms',
    description:
      'Autumn Term 1 · Biology strands: Life Processes, Cells & Organisation, Plants, Humans & Animals (Skeleton), Organisms & Environment. Objective codes B7.1.1A–B7.4.2C. Score ≥70% on the mastery quiz to unlock Unit 2.',
    unitNumber: 1,
    term: 'Autumn 1',
    masteryThreshold: 70,
    estimatedHours: 10,
    sparkBudget: 100,
  },
  lessons: [L1, L2, L3, L4, L5, L6, L7, L8] as SeedCurriculumLesson[],
};

/**
 * Seed the iLowerSecondary programme + "Science — Year 7" curriculum module
 * with Unit 1 and its 8 lessons. Idempotent: skips if a curriculum course
 * titled "Science — Year 7" already exists.
 */
export async function seedY7ScienceUnit1(
  adminId: string
): Promise<{ created: boolean; courseId: string; lessonsCreated: number }> {
  const existing = await getDocs(query(
    collection(db, 'courses'),
    where('kind', '==', 'curriculum'),
    where('title', '==', Y7_SCIENCE_UNIT_1.module.title),
  ));
  if (!existing.empty) {
    return { created: false, courseId: existing.docs[0].id, lessonsCreated: 0 };
  }

  const { programme, module: mod, unit, lessons } = Y7_SCIENCE_UNIT_1;

  await setDoc(doc(db, 'programmes', programme.id), {
    name: programme.name,
    description: programme.description,
    yearGroups: programme.yearGroups,
    subjects: programme.subjects,
    requiredTier: programme.requiredTier,
    status: programme.status,
    createdAt: serverTimestamp(),
  }, { merge: true });

  const courseRef = await addDoc(collection(db, 'courses'), {
    title: mod.title,
    description: mod.description,
    subject: mod.subject,
    ownerId: adminId,
    status: 'published',
    isPublic: false,
    kind: 'curriculum',
    programmeId: programme.id,
    yearGroup: mod.yearGroup,
    type: 'course',
    level: 'Foundation',
    category: 'Science',
    durationHours: unit.estimatedHours,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const unitRef = await addDoc(collection(db, 'courses', courseRef.id, 'modules'), {
    title: unit.title,
    description: unit.description,
    courseId: courseRef.id,
    order: 1,
    unitNumber: unit.unitNumber,
    term: unit.term,
    masteryThreshold: unit.masteryThreshold,
    estimatedHours: unit.estimatedHours,
    sparkBudget: unit.sparkBudget,
  });

  // Create L1–L7 first so the unit quiz can map each question's
  // sourceLesson number to a real lesson id.
  const lessonIdByNumber: Record<number, string> = {};
  let lessonsCreated = 0;

  for (const lesson of lessons.filter(l => !l.isUnitQuiz)) {
    const ref = await addDoc(
      collection(db, 'courses', courseRef.id, 'modules', unitRef.id, 'lessons'),
      {
        title: lesson.title,
        moduleId: unitRef.id,
        courseId: courseRef.id,
        order: lesson.lessonNumber,
        lessonNumber: lesson.lessonNumber,
        status: 'draft',
        objectiveCodes: lesson.objectiveCodes,
        briefPrompt: lesson.briefPrompt,
        teacherNotes: lesson.teacherNotes,
        contentSources: lesson.contentSources,
        aiOutputs: {
          quiz: lesson.quiz.map(q => ({
            question: q.question,
            options: q.options,
            answer: q.answer,
            ...(q.explanation ? { explanation: q.explanation } : {}),
            objectiveCode: q.objectiveCode,
          })),
        },
        createdAt: serverTimestamp(),
      }
    );
    lessonIdByNumber[lesson.lessonNumber] = ref.id;
    lessonsCreated++;
  }

  const quizLesson = lessons.find(l => l.isUnitQuiz)!;
  await addDoc(
    collection(db, 'courses', courseRef.id, 'modules', unitRef.id, 'lessons'),
    {
      title: quizLesson.title,
      moduleId: unitRef.id,
      courseId: courseRef.id,
      order: quizLesson.lessonNumber,
      lessonNumber: quizLesson.lessonNumber,
      isUnitQuiz: true,
      status: 'draft',
      objectiveCodes: quizLesson.objectiveCodes,
      briefPrompt: quizLesson.briefPrompt,
      teacherNotes: quizLesson.teacherNotes,
      contentSources: quizLesson.contentSources,
      aiOutputs: {
        quiz: quizLesson.quiz.map(q => ({
          question: q.question,
          options: q.options,
          answer: q.answer,
          ...(q.explanation ? { explanation: q.explanation } : {}),
          objectiveCode: q.objectiveCode,
          ...(q.sourceLesson && lessonIdByNumber[q.sourceLesson]
            ? { sourceLessonId: lessonIdByNumber[q.sourceLesson] }
            : {}),
        })),
      },
      createdAt: serverTimestamp(),
    }
  );
  lessonsCreated++;

  return { created: true, courseId: courseRef.id, lessonsCreated };
}
