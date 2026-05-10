import { AiOutputs } from './db';

export interface SeedLesson {
  title: string;
  order: number;
  aiOutputs: AiOutputs;
  contentSources: { type: 'text'; value: string }[];
}

export interface SeedModule {
  title: string;
  description: string;
  order: number;
  lessons: SeedLesson[];
}

export interface SeedCourse {
  title: string;
  description: string;
  subject: string;
  thumbnailUrl: string;
  modules: SeedModule[];
}

export const SEED_COURSES: SeedCourse[] = [
  {
    title: 'Biology 101',
    description: 'An introduction to the fundamental concepts of life science, from cellular biology to ecosystems.',
    subject: 'Biology',
    thumbnailUrl: '',
    modules: [
      {
        title: 'Module 1: The Cell',
        description: 'Understanding the basic unit of life',
        order: 1,
        lessons: [
          {
            title: 'Cell Structure & Organelles',
            order: 1,
            contentSources: [{ type: 'text', value: 'All living things are made of cells. Cells contain organelles — specialised structures each with distinct roles. The nucleus stores DNA and controls cell activity. Mitochondria generate ATP energy via cellular respiration. The endoplasmic reticulum synthesises proteins (rough ER) and lipids (smooth ER). The Golgi apparatus packages and ships proteins. The cell membrane controls what enters and exits the cell.' }],
            aiOutputs: {
              text: `# Cell Structure & Organelles\n\nAll living things are composed of **cells** — the fundamental units of life. Every cell contains specialised structures called **organelles**, each performing a distinct role.\n\n## Key Organelles\n\n### The Nucleus\nThe nucleus is the cell's **control centre**. It houses the cell's DNA (genetic material) and directs cellular activities including growth, metabolism, and reproduction.\n\n### Mitochondria\nOften called the **"powerhouse of the cell"**, mitochondria generate **ATP** (adenosine triphosphate) — the cell's energy currency — through cellular respiration.\n\n### Endoplasmic Reticulum (ER)\n- **Rough ER**: Studded with ribosomes; synthesises and processes **proteins**\n- **Smooth ER**: Lacks ribosomes; synthesises **lipids** and detoxifies chemicals\n\n### Golgi Apparatus\nFunctions like a **post office** — it packages, modifies, and ships proteins to their destinations inside or outside the cell.\n\n### Cell Membrane\nA **phospholipid bilayer** that controls what substances enter and exit the cell, maintaining homeostasis.\n\n## Summary\nCells are the building blocks of life. Their organelles work together like a factory, each component contributing to the cell's survival and function.`,
              flashcards: [
                { question: 'What is the function of the nucleus?', answer: 'The nucleus is the control centre of the cell. It contains the cell\'s DNA and directs all cellular activities including growth, metabolism, and reproduction.' },
                { question: 'Why are mitochondria called the powerhouse of the cell?', answer: 'Mitochondria generate ATP (adenosine triphosphate) — the primary energy currency of the cell — through cellular respiration.' },
                { question: 'What is the difference between rough and smooth ER?', answer: 'Rough ER is studded with ribosomes and synthesises proteins. Smooth ER lacks ribosomes and synthesises lipids and detoxifies chemicals.' },
                { question: 'What does the Golgi apparatus do?', answer: 'The Golgi apparatus packages, modifies, and ships proteins to their destinations — either within the cell or for secretion outside.' },
                { question: 'What is the function of the cell membrane?', answer: 'The cell membrane (a phospholipid bilayer) controls what substances enter and exit the cell, maintaining the internal environment.' },
              ],
              quiz: [
                { question: 'Which organelle is known as the "powerhouse of the cell"?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Vacuole'], answer: 'Mitochondria', explanation: 'Mitochondria produce ATP through cellular respiration, providing energy for all cell processes.' },
                { question: 'Where is the cell\'s DNA stored?', options: ['Mitochondria', 'Golgi Apparatus', 'Nucleus', 'Cell Membrane'], answer: 'Nucleus', explanation: 'The nucleus contains the cell\'s genetic material (DNA) and controls all cellular activities.' },
                { question: 'Which type of endoplasmic reticulum is studded with ribosomes?', options: ['Smooth ER', 'Rough ER', 'Golgi ER', 'Nuclear ER'], answer: 'Rough ER', explanation: 'Rough ER has ribosomes attached to its surface, which are used to synthesise proteins.' },
                { question: 'What is the primary function of the Golgi apparatus?', options: ['Energy production', 'DNA storage', 'Packaging and shipping proteins', 'Controlling cell entry/exit'], answer: 'Packaging and shipping proteins', explanation: 'The Golgi apparatus acts as the cell\'s post office — modifying, packaging, and dispatching proteins.' },
              ],
              notes: `## My Notes — Cell Structure & Organelles\n\n**Key points to remember:**\n- Nucleus = control centre (DNA lives here)\n- Mitochondria = energy (ATP) production\n- Rough ER = protein synthesis (ribosomes present)\n- Smooth ER = lipid synthesis, detox\n- Golgi = packages + ships proteins\n- Cell membrane = gatekeeper\n\n**Memory trick:** "Mighty Mitochondria Make My Energy" → MMM = Mitochondria = ATP`,
              summary: 'Cells are the basic units of life. Key organelles include: the nucleus (DNA storage/control), mitochondria (ATP energy), rough ER (protein synthesis), smooth ER (lipid synthesis), Golgi apparatus (protein packaging/shipping), and the cell membrane (gatekeeper). Each organelle has a specific role contributing to the cell\'s overall function.',
              glossary: [
                { term: 'Organelle', definition: 'A specialised structure within a cell that performs a specific function, analogous to an organ in the body.' },
                { term: 'ATP (Adenosine Triphosphate)', definition: 'The primary energy currency of cells, produced by mitochondria during cellular respiration.' },
                { term: 'Phospholipid Bilayer', definition: 'The structure of the cell membrane — two layers of phospholipid molecules arranged with hydrophobic tails inward.' },
                { term: 'Ribosome', definition: 'A small organelle responsible for protein synthesis, found on rough ER or floating in the cytoplasm.' },
              ],
            },
          },
          {
            title: 'Cellular Respiration',
            order: 2,
            contentSources: [{ type: 'text', value: 'Cellular respiration is the process by which cells break down glucose to produce ATP energy. It occurs in three main stages: glycolysis (in the cytoplasm, produces 2 ATP), the Krebs cycle (in the mitochondrial matrix, produces 2 ATP + NADH), and the electron transport chain (in the inner mitochondrial membrane, produces ~32 ATP). The overall equation is: C6H12O6 + 6O2 → 6CO2 + 6H2O + ATP' }],
            aiOutputs: {
              text: `# Cellular Respiration\n\nCellular respiration is the process by which cells **break down glucose** to produce **ATP** — the energy currency that powers all cellular activities.\n\n## The Overall Equation\n\n$$C_6H_{12}O_6 + 6O_2 \\rightarrow 6CO_2 + 6H_2O + ATP$$\n\n## Three Stages\n\n### 1. Glycolysis (Cytoplasm)\n- Glucose (6C) is split into two pyruvate molecules (3C each)\n- Net yield: **2 ATP** + 2 NADH\n- Does **not** require oxygen (anaerobic)\n\n### 2. Krebs Cycle / Citric Acid Cycle (Mitochondrial Matrix)\n- Pyruvate is converted to acetyl-CoA and enters the cycle\n- Yield per glucose: **2 ATP** + 6 NADH + 2 FADH₂\n- Releases CO₂ as a by-product\n\n### 3. Electron Transport Chain (Inner Mitochondrial Membrane)\n- NADH and FADH₂ donate electrons, driving ATP synthesis\n- Yield: **~32 ATP**\n- Requires oxygen as the final electron acceptor\n- Produces water as a by-product\n\n## Total ATP Yield\n~**36–38 ATP** per glucose molecule\n\n## Key Takeaway\nCellular respiration is essential for life — it converts the chemical energy in food into a usable form (ATP) that powers everything from muscle contraction to DNA replication.`,
              flashcards: [
                { question: 'What is the net ATP yield from glycolysis?', answer: '2 ATP molecules are the net yield from glycolysis, along with 2 NADH.' },
                { question: 'Where does the Krebs cycle take place?', answer: 'The Krebs cycle (citric acid cycle) occurs in the mitochondrial matrix.' },
                { question: 'What is the total approximate ATP yield from one glucose molecule?', answer: 'Approximately 36–38 ATP molecules are produced from the complete respiration of one glucose molecule.' },
                { question: 'What is the final electron acceptor in the electron transport chain?', answer: 'Oxygen (O₂) is the final electron acceptor in the ETC, combining with electrons and H⁺ to form water.' },
              ],
              quiz: [
                { question: 'Where does glycolysis take place in the cell?', options: ['Mitochondrial matrix', 'Cytoplasm', 'Nucleus', 'Cell membrane'], answer: 'Cytoplasm', explanation: 'Glycolysis occurs in the cytoplasm and does not require mitochondria — it can occur even in the absence of oxygen.' },
                { question: 'How many ATP molecules are produced by the electron transport chain?', options: ['2', '4', '~32', '6'], answer: '~32', explanation: 'The ETC produces the majority of ATP (~32 out of ~36–38 total) using the energy from NADH and FADH₂.' },
                { question: 'What is the overall equation for cellular respiration?', options: ['6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂', 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP', 'ATP → ADP + energy', 'Glucose + ATP → pyruvate'], answer: 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP', explanation: 'This equation summarises the complete oxidation of glucose in the presence of oxygen to produce CO₂, water, and ATP.' },
              ],
              notes: '## Cellular Respiration Notes\n\n**3 stages:**\n1. Glycolysis → 2 ATP (cytoplasm, no O₂ needed)\n2. Krebs Cycle → 2 ATP (mitochondrial matrix)\n3. ETC → ~32 ATP (inner mitochondrial membrane, needs O₂)\n\n**Total: ~36-38 ATP per glucose**\n\n**Mnemonic:** "Glycolysis Keeps Energy Churning" = G→K→ETC',
              summary: 'Cellular respiration converts glucose into ATP energy through three stages: glycolysis (2 ATP, cytoplasm), Krebs cycle (2 ATP, mitochondrial matrix), and the electron transport chain (~32 ATP, inner mitochondrial membrane). Total yield is approximately 36–38 ATP per glucose. Oxygen is required for the ETC stage.',
              glossary: [
                { term: 'Glycolysis', definition: 'The first stage of cellular respiration occurring in the cytoplasm, converting glucose into pyruvate and producing 2 net ATP.' },
                { term: 'Krebs Cycle', definition: 'The second stage of aerobic respiration, occurring in the mitochondrial matrix, producing ATP, NADH, and FADH₂ while releasing CO₂.' },
                { term: 'ATP Synthase', definition: 'The enzyme in the inner mitochondrial membrane that synthesises ATP using the energy from proton flow during the ETC.' },
              ],
            },
          },
        ],
      },
      {
        title: 'Module 2: Genetics',
        description: 'DNA, inheritance and genetic variation',
        order: 2,
        lessons: [
          {
            title: 'DNA Structure & Replication',
            order: 1,
            contentSources: [{ type: 'text', value: 'DNA (deoxyribonucleic acid) is a double helix molecule made of nucleotides. Each nucleotide contains a sugar (deoxyribose), a phosphate group, and one of four nitrogenous bases: adenine (A), thymine (T), guanine (G), and cytosine (C). Base pairing rules: A pairs with T, G pairs with C. DNA replication is semi-conservative: each strand acts as a template for a new complementary strand, resulting in two identical DNA molecules.' }],
            aiOutputs: {
              text: `# DNA Structure & Replication\n\n## The Double Helix\n\nDNA (**deoxyribonucleic acid**) is the molecule that carries genetic information. It has a **double helix** structure — two strands wound around each other, discovered by Watson and Crick in 1953.\n\n## Nucleotide Structure\n\nEach DNA strand is made of **nucleotides**, each containing:\n1. A **deoxyribose sugar**\n2. A **phosphate group**\n3. One of four **nitrogenous bases**: Adenine (A), Thymine (T), Guanine (G), Cytosine (C)\n\n## Base Pairing Rules\n\n- **A pairs with T** (2 hydrogen bonds)\n- **G pairs with C** (3 hydrogen bonds)\n\nThese complementary base pairs hold the two strands together.\n\n## DNA Replication\n\nReplication is **semi-conservative** — each original strand serves as a template for a new complementary strand:\n\n1. **Helicase** unwinds and separates the double helix\n2. **DNA Polymerase** reads each template strand and adds complementary nucleotides\n3. Two identical DNA molecules result, each containing one original strand\n\n### Why semi-conservative?\nThis mechanism ensures accuracy — each new DNA molecule retains one original strand as a quality-control reference.`,
              flashcards: [
                { question: 'What are the four nitrogenous bases in DNA?', answer: 'Adenine (A), Thymine (T), Guanine (G), and Cytosine (C). A pairs with T, and G pairs with C.' },
                { question: 'What does "semi-conservative replication" mean?', answer: 'Each new DNA molecule retains one original (parental) strand and one newly synthesised strand.' },
                { question: 'What enzyme unwinds the DNA double helix during replication?', answer: 'Helicase unwinds and separates the two DNA strands at the replication fork.' },
              ],
              quiz: [
                { question: 'Which base pairs with Adenine in DNA?', options: ['Cytosine', 'Guanine', 'Thymine', 'Uracil'], answer: 'Thymine', explanation: 'In DNA, Adenine (A) always pairs with Thymine (T) via 2 hydrogen bonds. Note: in RNA, Uracil replaces Thymine.' },
                { question: 'DNA replication is described as semi-conservative because:', options: ['It only copies half the DNA', 'Each new molecule has one old and one new strand', 'It requires two enzymes', 'It only occurs in the nucleus'], answer: 'Each new molecule has one old and one new strand', explanation: 'Semi-conservative means each daughter DNA molecule retains one parental strand, ensuring genetic accuracy.' },
              ],
              notes: '## DNA Notes\n\n**Structure:** Double helix of nucleotides\n**Bases:** A-T (2 bonds), G-C (3 bonds)\n**Replication:** Semi-conservative\n- Helicase = unwinds\n- DNA Polymerase = builds new strand\n\n**Memory:** "AT the GC Concert" → A-T, G-C',
              summary: 'DNA is a double helix made of nucleotides. The four bases are Adenine, Thymine, Guanine, and Cytosine, with base pairing rules A-T and G-C. DNA replication is semi-conservative: helicase unwinds the helix, and DNA polymerase builds new complementary strands, producing two identical DNA molecules.',
              glossary: [
                { term: 'Nucleotide', definition: 'The monomer of DNA, consisting of a deoxyribose sugar, a phosphate group, and a nitrogenous base.' },
                { term: 'Helicase', definition: 'An enzyme that unwinds and separates the DNA double helix during replication.' },
                { term: 'DNA Polymerase', definition: 'The enzyme that synthesises new DNA strands by adding nucleotides complementary to the template strand.' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: 'World History',
    description: 'A survey of major events and civilisations that shaped the modern world.',
    subject: 'History',
    thumbnailUrl: '',
    modules: [
      {
        title: 'Module 1: Ancient Civilisations',
        description: 'From Mesopotamia to Rome',
        order: 1,
        lessons: [
          {
            title: 'Mesopotamia: The Cradle of Civilisation',
            order: 1,
            contentSources: [{ type: 'text', value: 'Mesopotamia, located between the Tigris and Euphrates rivers in modern-day Iraq, is considered the cradle of civilisation. Key developments include the invention of writing (cuneiform, ~3200 BCE), the wheel (~3500 BCE), the first cities (Uruk, Ur), the Code of Hammurabi (one of the earliest legal codes, ~1754 BCE), and irrigation agriculture. Major civilisations include the Sumerians, Akkadians, Babylonians, and Assyrians.' }],
            aiOutputs: {
              text: `# Mesopotamia: The Cradle of Civilisation\n\n## Where Was Mesopotamia?\n\nMesopotamia (Greek for "land between rivers") was located between the **Tigris and Euphrates rivers**, in the region of modern-day **Iraq**. This fertile land — part of the **Fertile Crescent** — allowed early agricultural societies to flourish.\n\n## Why Is It Called the "Cradle of Civilisation"?\n\nMesopotamia is credited with some of humanity's most significant innovations:\n\n| Innovation | Date | Significance |\n|---|---|---|\n| The Wheel | ~3500 BCE | Revolutionised transport and agriculture |\n| Cuneiform Writing | ~3200 BCE | Earliest known writing system |\n| First Cities | ~3500 BCE | Uruk, Ur — organised urban living |\n| Code of Hammurabi | ~1754 BCE | One of history's first legal codes |\n| Irrigation Systems | ~6000 BCE | Enabled farming in arid regions |\n\n## Major Civilisations\n\n### Sumerians (~4500–2350 BCE)\n- Created cuneiform writing\n- Built the first cities (Uruk, Nippur)\n- Developed complex religion and mythology\n\n### Akkadians (~2350–2150 BCE)\n- Founded by **Sargon of Akkad** — the world's first empire builder\n- Adopted and spread Sumerian culture\n\n### Babylonians (~1894–539 BCE)\n- **Hammurabi** created a famous law code (282 laws)\n- Babylon became a major cultural and trade centre\n\n### Assyrians (~900–612 BCE)\n- Built one of history's most powerful military empires\n- Known for their brutal military tactics and grand libraries\n\n## Legacy\n\nMesopotamian innovations in writing, law, urban planning, and agriculture laid the foundations for virtually every major civilisation that followed.`,
              flashcards: [
                { question: 'What does "Mesopotamia" mean and where was it located?', answer: '"Land between rivers" — located between the Tigris and Euphrates rivers in modern-day Iraq.' },
                { question: 'What is cuneiform and when was it developed?', answer: 'Cuneiform was the world\'s first writing system, developed by the Sumerians around 3200 BCE. It used wedge-shaped marks on clay tablets.' },
                { question: 'What was the Code of Hammurabi?', answer: 'One of history\'s earliest and most complete law codes, created by Babylonian king Hammurabi around 1754 BCE. It contained 282 laws covering trade, property, and personal conduct.' },
                { question: 'Who was Sargon of Akkad?', answer: 'Sargon of Akkad (ruled ~2334–2279 BCE) founded the Akkadian Empire — considered the world\'s first empire. He united city-states under centralised rule.' },
              ],
              quiz: [
                { question: 'What was the significance of the Tigris and Euphrates rivers to Mesopotamia?', options: ['They provided protection from invaders', 'They enabled agriculture through irrigation and fertile soil', 'They were used exclusively for trade', 'They formed the empire\'s borders'], answer: 'They enabled agriculture through irrigation and fertile soil', explanation: 'The rivers provided water for irrigation, and annual flooding deposited nutrient-rich silt, making the land exceptionally fertile for farming.' },
                { question: 'Which civilisation created the Code of Hammurabi?', options: ['Sumerians', 'Assyrians', 'Babylonians', 'Akkadians'], answer: 'Babylonians', explanation: 'Hammurabi was a Babylonian king who created this famous law code around 1754 BCE to unify and govern his empire.' },
                { question: 'Approximately when was cuneiform writing developed?', options: ['1500 BCE', '5000 BCE', '3200 BCE', '500 BCE'], answer: '3200 BCE', explanation: 'Cuneiform, the world\'s earliest writing system, was developed by the Sumerians around 3200 BCE.' },
              ],
              notes: '## Mesopotamia Notes\n\n**Location:** Between Tigris + Euphrates (modern Iraq)\n**"Cradle of Civilisation"** because:\n- 🛞 Wheel (~3500 BCE)\n- ✍️ Cuneiform writing (~3200 BCE)\n- 🏙️ First cities (Uruk, Ur)\n- ⚖️ Code of Hammurabi (~1754 BCE)\n\n**4 Major Civs:** Sumerians → Akkadians → Babylonians → Assyrians',
              summary: 'Mesopotamia, between the Tigris and Euphrates rivers, is called the Cradle of Civilisation for its groundbreaking achievements: the wheel (~3500 BCE), cuneiform writing (~3200 BCE), the first cities, and Hammurabi\'s Code (~1754 BCE). Four major civilisations rose and fell: Sumerians, Akkadians, Babylonians, and Assyrians, each contributing to human progress.',
              glossary: [
                { term: 'Cuneiform', definition: 'The world\'s earliest writing system, developed by the Sumerians around 3200 BCE using wedge-shaped marks pressed into clay tablets.' },
                { term: 'Code of Hammurabi', definition: 'One of history\'s first legal codes, created by Babylonian king Hammurabi (~1754 BCE), containing 282 laws governing daily life.' },
                { term: 'Fertile Crescent', definition: 'An arc of fertile land stretching from the Persian Gulf through Mesopotamia to the Mediterranean, where early civilisations developed.' },
              ],
            },
          },
          {
            title: 'Ancient Egypt: Pharaohs & Pyramids',
            order: 2,
            contentSources: [{ type: 'text', value: 'Ancient Egypt thrived along the Nile River for over 3000 years (c.3100–30 BCE). The pharaoh was considered a divine ruler and god on earth. Major achievements include: the construction of pyramids (the Great Pyramid of Giza, ~2560 BCE), hieroglyphic writing, mummification, and a complex religious pantheon with gods like Ra, Osiris, Isis and Anubis. Egypt was unified under Narmer (~3100 BCE). The New Kingdom (1550–1070 BCE) was its height of power, with pharaohs like Ramesses II.' }],
            aiOutputs: {
              text: `# Ancient Egypt: Pharaohs & Pyramids\n\n## The Gift of the Nile\n\nAncient Egypt is one of history's most enduring civilisations, thriving for over **3,000 years** (c.3100–30 BCE). Its success was built on the **Nile River**, which provided annual floods that deposited rich silt for farming.\n\n## The Pharaoh\n\nThe pharaoh was not just a king but a **divine ruler** — considered a living god on earth, specifically an incarnation of **Horus** (and upon death, **Osiris**). The pharaoh controlled all land, resources, and religious affairs.\n\n## Key Achievements\n\n### The Pyramids\n- Built as royal tombs to ensure the pharaoh's eternal afterlife\n- **Great Pyramid of Giza** (~2560 BCE): built for Pharaoh Khufu, one of the Seven Wonders of the Ancient World\n- Required enormous state organisation and thousands of workers\n\n### Hieroglyphs\n- Complex writing system using pictorial symbols\n- Used for religious texts, royal decrees, and record keeping\n- Decoded in 1822 using the **Rosetta Stone**\n\n### Mummification\n- Preservation of the body for the afterlife\n- Organs removed and stored in **canopic jars**\n- Body wrapped in linen over 70 days\n\n## Major Gods\n\n| God | Domain |\n|---|---|\n| **Ra** | Sun god, king of the gods |\n| **Osiris** | God of the afterlife and resurrection |\n| **Isis** | Goddess of magic and motherhood |\n| **Anubis** | God of embalming and the dead |\n| **Horus** | God of the sky; associated with the pharaoh |\n\n## Periods of Egyptian History\n\n- **Old Kingdom** (~2686–2181 BCE): Age of pyramids\n- **Middle Kingdom** (~2055–1650 BCE): Stability and cultural flourishing\n- **New Kingdom** (~1550–1070 BCE): Height of imperial power; Ramesses II, Tutankhamun, Hatshepsut`,
              flashcards: [
                { question: 'What was the role of the pharaoh in Ancient Egypt?', answer: 'The pharaoh was both the political ruler and a divine figure — considered a living god (Horus incarnate) who controlled all land, religion, and government.' },
                { question: 'What was the Great Pyramid of Giza and when was it built?', answer: 'The Great Pyramid of Giza was built around 2560 BCE as the tomb of Pharaoh Khufu. It is one of the Seven Wonders of the Ancient World.' },
                { question: 'What is the Rosetta Stone and why is it significant?', answer: 'The Rosetta Stone is a decree written in three scripts (hieroglyphs, Demotic, and Greek), discovered in 1799 and used by Champollion in 1822 to decode hieroglyphic writing.' },
              ],
              quiz: [
                { question: 'Why was the Nile River essential to Ancient Egypt?', options: ['It provided military protection', 'Its annual floods deposited fertile silt enabling agriculture', 'It was used to build the pyramids', 'It separated Egypt from enemies'], answer: 'Its annual floods deposited fertile silt enabling agriculture', explanation: 'The Nile\'s predictable annual flooding deposited nutrient-rich silt on the floodplain, making the land incredibly fertile and sustaining Egyptian civilisation.' },
                { question: 'Who was Ramesses II?', options: ['The builder of the Great Pyramid', 'Egypt\'s most celebrated pharaoh of the New Kingdom', 'The first pharaoh to unify Egypt', 'The priest who decoded hieroglyphs'], answer: 'Egypt\'s most celebrated pharaoh of the New Kingdom', explanation: 'Ramesses II (ruled 1279–1213 BCE) is one of history\'s most celebrated pharaohs, known for military campaigns, massive building projects, and one of the longest reigns in Egyptian history.' },
              ],
              notes: '## Ancient Egypt Notes\n\n**Duration:** ~3100–30 BCE (3000+ years!)\n**3 Kingdoms:** Old (pyramids) → Middle (stability) → New (empire)\n**Pharaoh =** Divine ruler = living Horus\n\n**Achievements:**\n- Pyramids (Great Pyramid = Khufu, 2560 BCE)\n- Hieroglyphs (decoded 1822 via Rosetta Stone)\n- Mummification (70 days process)\n\n**Key Gods:** Ra, Osiris, Isis, Anubis, Horus',
              summary: 'Ancient Egypt thrived for 3,000+ years along the Nile River. The pharaoh was a divine ruler. Key achievements include pyramid construction (Great Pyramid ~2560 BCE), hieroglyphic writing (decoded via the Rosetta Stone in 1822), and mummification. The New Kingdom (1550–1070 BCE) marked Egypt\'s height of power.',
              glossary: [
                { term: 'Pharaoh', definition: 'The ruler of Ancient Egypt, considered both king and living god — an incarnation of Horus.' },
                { term: 'Hieroglyphs', definition: 'The writing system of Ancient Egypt, using pictorial symbols. Deciphered in 1822 using the Rosetta Stone.' },
                { term: 'Mummification', definition: 'The process of preserving a body for the afterlife through removal of organs, drying, and wrapping in linen over 70 days.' },
                { term: 'Canopic Jars', definition: 'Containers used during mummification to store the removed internal organs of the deceased.' },
              ],
            },
          },
        ],
      },
    ],
  },
];

export const DEMO_TEACHER = {
  email: 'demo.teacher@pocketschool.ai',
  name: 'Dr. Alex Morgan',
};
