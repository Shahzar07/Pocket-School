import type { GradeScaleId } from './types';

/**
 * Official exam packs: the real syllabus structure for each qualification,
 * topic by topic. Practice questions are written in the style of each
 * board's papers; the first topic of every pack is free to try.
 *
 * Questions are generated to the syllabus, not copied from past papers —
 * past papers are copyright of the exam boards. An admin-curated bank of
 * licensed past-paper questions can be layered on top later.
 */

export interface PackTopic { id: string; title: string; weight: number }
export interface PackUnit { id: string; title: string; topics: PackTopic[] }
export interface ExamPack {
  id: string;
  name: string;
  board: string;
  level: string;
  scale: GradeScaleId;
  blurb: string;
  accent: string;
  units: PackUnit[];
}

const t = (unit: string, titles: (string | [string, number])[]): PackTopic[] =>
  titles.map((x, i) => {
    const [title, weight] = Array.isArray(x) ? x : [x, 3];
    return { id: `${unit}-${i + 1}`, title, weight };
  });

export const EXAM_PACKS: ExamPack[] = [
  {
    id: 'spm-math',
    name: 'SPM Mathematics',
    board: 'National syllabus',
    level: 'SPM',
    scale: 'spm',
    blurb: 'The full Mathematics syllabus, with Paper 1 and Paper 2 style questions.',
    accent: 'var(--primary)',
    units: [
      { id: 'f4', title: 'Core', topics: t('f4', [
        ['Quadratic functions and equations in one variable', 5], 'Number bases', 'Logical reasoning', 'Operations on sets',
        'Network in graph theory', ['Linear inequalities in two variables', 4], ['Graphs of motion', 4],
        'Measures of dispersion for ungrouped data', ['Probability of combined events', 4], 'Consumer mathematics: financial management',
      ]) },
      { id: 'f5', title: 'Extension', topics: t('f5', [
        ['Variation', 4], ['Matrices', 4], 'Consumer mathematics: insurance', 'Consumer mathematics: taxation',
        ['Congruency, enlargement and combined transformations', 4], ['Ratios and graphs of trigonometric functions', 4],
        'Measures of dispersion for grouped data', 'Mathematical modelling',
      ]) },
    ],
  },
  {
    id: 'spm-addmath',
    name: 'SPM Additional Mathematics',
    board: 'National syllabus',
    level: 'SPM',
    scale: 'spm',
    blurb: 'Every Additional Mathematics chapter from functions to kinematics, with exam-style working and mark schemes.',
    accent: '#8B5CF6',
    units: [
      { id: 'f4', title: 'Core', topics: t('f4', [
        ['Functions', 5], ['Quadratic functions', 5], 'Systems of equations', ['Indices, surds and logarithms', 5],
        ['Progressions', 4], 'Linear law', ['Coordinate geometry', 4], 'Vectors', ['Solution of triangles', 4], 'Index numbers',
      ]) },
      { id: 'f5', title: 'Extension', topics: t('f5', [
        'Circular measure', ['Differentiation', 5], ['Integration', 5], 'Permutation and combination',
        ['Probability distribution', 4], ['Trigonometric functions', 5], 'Linear programming', ['Kinematics of linear motion', 4],
      ]) },
    ],
  },
  {
    id: 'igcse-0580',
    name: 'IGCSE Mathematics (0580)',
    board: 'International',
    level: 'Extended',
    scale: 'igcse',
    blurb: 'IGCSE Mathematics Extended — all nine syllabus areas at Paper 2 and Paper 4 standard.',
    accent: '#E5484D',
    units: [
      { id: 'num', title: 'Number', topics: t('num', ['Types of number, factors and primes', 'Fractions, decimals, percentages', ['Indices and standard form', 4], 'Ratio, proportion and rates', 'Bounds and estimation', ['Surds', 3], 'Percentage change and interest']) },
      { id: 'alg', title: 'Algebra and graphs', topics: t('alg', [['Algebraic manipulation and factorising', 5], ['Linear and quadratic equations', 5], 'Simultaneous equations', 'Inequalities', 'Sequences', ['Functions: composite and inverse', 4], ['Graphs of functions', 4], 'Differentiation and turning points']) },
      { id: 'coord', title: 'Coordinate geometry', topics: t('coord', ['Gradient, length and midpoint', 'Equation of a straight line', 'Parallel and perpendicular lines']) },
      { id: 'geo', title: 'Geometry', topics: t('geo', ['Angle properties and polygons', ['Circle theorems', 4], 'Similarity and congruence', 'Symmetry']) },
      { id: 'mens', title: 'Mensuration', topics: t('mens', ['Perimeter and area', ['Arc length and sector area', 4], 'Surface area and volume']) },
      { id: 'trig', title: 'Trigonometry', topics: t('trig', ['Pythagoras and right-angled trigonometry', ['Sine and cosine rules', 4], 'Trigonometric graphs', '3D trigonometry']) },
      { id: 'tv', title: 'Transformations and vectors', topics: t('tv', ['Transformations', 'Vectors']) },
      { id: 'prob', title: 'Probability', topics: t('prob', ['Probability basics', ['Tree diagrams and combined events', 4], 'Conditional probability']) },
      { id: 'stat', title: 'Statistics', topics: t('stat', ['Averages and spread', 'Cumulative frequency and box plots', 'Histograms', 'Scatter diagrams and correlation']) },
    ],
  },
  {
    id: 'igcse-0606',
    name: 'IGCSE Additional Mathematics (0606)',
    board: 'International',
    level: 'IGCSE',
    scale: 'igcse',
    blurb: 'IGCSE Additional Mathematics — the bridge to A Level, from polynomials to calculus.',
    accent: '#30A46C',
    units: [
      { id: 'a', title: 'Algebra', topics: t('a', [['Functions', 4], ['Quadratic functions', 4], 'Factors of polynomials', 'Equations, inequalities and graphs', 'Simultaneous equations', ['Logarithmic and exponential functions', 4]]) },
      { id: 'g', title: 'Geometry and trigonometry', topics: t('g', ['Straight-line graphs', 'Coordinate geometry of the circle', 'Circular measure', ['Trigonometry', 5]]) },
      { id: 'd', title: 'Discrete and series', topics: t('d', ['Permutations and combinations', ['Series and the binomial theorem', 4], 'Vectors in two dimensions']) },
      { id: 'c', title: 'Calculus', topics: t('c', [['Differentiation', 5], ['Integration', 5], 'Kinematics']) },
    ],
  },
  {
    id: 'alevel-9709',
    name: 'A Level Mathematics (9709)',
    board: 'International',
    level: 'AS & A Level',
    scale: 'alevel',
    blurb: 'Pure 1, Pure 3, Mechanics and Probability & Statistics 1 — the most common A Level route.',
    accent: '#E8A33D',
    units: [
      { id: 'p1', title: 'Pure Mathematics 1', topics: t('p1', [['Quadratics', 4], ['Functions', 4], 'Coordinate geometry', 'Circular measure', ['Trigonometry', 4], 'Series', ['Differentiation', 5], ['Integration', 5]]) },
      { id: 'p3', title: 'Pure Mathematics 3', topics: t('p3', ['Algebra', ['Logarithmic and exponential functions', 4], ['Trigonometry', 4], ['Differentiation', 5], ['Integration', 5], 'Numerical solution of equations', 'Vectors', ['Differential equations', 4], ['Complex numbers', 4]]) },
      { id: 'm1', title: 'Mechanics', topics: t('m1', ['Forces and equilibrium', 'Kinematics of motion in a straight line', 'Momentum', ['Newton’s laws of motion', 4], 'Energy, work and power']) },
      { id: 's1', title: 'Probability & Statistics 1', topics: t('s1', ['Representation of data', 'Permutations and combinations', 'Probability', 'Discrete random variables', ['The normal distribution', 4]]) },
    ],
  },
  {
    id: 'ib-aa',
    name: 'Mathematics: Analysis and Approaches',
    board: 'Diploma',
    level: 'SL & HL',
    scale: 'ib',
    blurb: 'All five AA topics, Paper 1 (no calculator) and Paper 2 style, scored on the 1–7 scale.',
    accent: '#0EA5E9',
    units: [
      { id: 'na', title: 'Number and algebra', topics: t('na', ['Sequences and series', 'Exponents and logarithms', ['Binomial theorem', 3], 'Proof']) },
      { id: 'fn', title: 'Functions', topics: t('fn', [['Properties of functions', 4], 'Transformations of graphs', 'Quadratic, rational, exponential and log functions', 'Inverse and composite functions']) },
      { id: 'gt', title: 'Geometry and trigonometry', topics: t('gt', ['3D geometry and volume', ['Trigonometric ratios and the unit circle', 4], 'Trigonometric identities and equations', 'Radian measure, arcs and sectors']) },
      { id: 'sp', title: 'Statistics and probability', topics: t('sp', ['Descriptive statistics', 'Regression and correlation', ['Probability and Venn diagrams', 4], ['Binomial and normal distributions', 4]]) },
      { id: 'ca', title: 'Calculus', topics: t('ca', [['Limits and differentiation', 5], 'Applications of differentiation', ['Integration', 5], 'Kinematics']) },
    ],
  },
];

export function getPack(id: string) {
  return EXAM_PACKS.find(p => p.id === id) ?? null;
}

export function packTopics(pack: ExamPack): (PackTopic & { unit: string })[] {
  return pack.units.flatMap(u => u.topics.map(tp => ({ ...tp, unit: u.title })));
}

/** The first topic of every pack is free. */
export function isFreeTopic(pack: ExamPack, topicId: string) {
  return pack.units[0]?.topics[0]?.id === topicId;
}

export interface PackQuestion {
  question: string;
  marks: number;
  answer: string;
  solution: string;
  paper: string;
}
