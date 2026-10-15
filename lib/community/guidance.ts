export interface GuidanceInput {
  interests: string[];
  predictedGrades: Record<string, string>;
}

export interface GuidanceCard {
  id: string;
  kind: 'university' | 'career';
  title: string;
  detail: string;
}

interface Pathway {
  id: string;
  interest: string;
  subjects: string[];
  minGrade: string;
  university: string;
  career: string;
}

const RANK = ['U', 'E', 'D', 'C', 'B', 'A', 'A*'];

const PATHWAYS: Pathway[] = [
  { id: 'medicine', interest: 'medicine', subjects: ['biology', 'chemistry'], minGrade: 'A', university: 'Medicine MBBS', career: 'Doctor' },
  { id: 'law', interest: 'law', subjects: ['english', 'history'], minGrade: 'B', university: 'Law LLB', career: 'Solicitor' },
  { id: 'engineering', interest: 'engineering', subjects: ['maths', 'physics'], minGrade: 'B', university: 'Engineering', career: 'Engineer' },
  { id: 'computing', interest: 'computing', subjects: ['maths', 'computer science'], minGrade: 'B', university: 'Computer Science', career: 'Software developer' },
  { id: 'business', interest: 'business', subjects: ['maths', 'economics'], minGrade: 'C', university: 'Business', career: 'Analyst' },
];

function rankOf(grade: string | undefined): number {
  const idx = RANK.indexOf((grade ?? 'U').toUpperCase());
  return idx === -1 ? 0 : idx;
}

export function guidanceFor(input: GuidanceInput): GuidanceCard[] {
  const interests = input.interests.map((i) => i.trim().toLowerCase()).filter(Boolean);
  const cards: GuidanceCard[] = [];
  for (const pathway of PATHWAYS) {
    const interestHit = interests.length === 0 || interests.some((i) => i.includes(pathway.interest) || pathway.interest.includes(i));
    if (!interestHit) continue;
    const strongEnough = pathway.subjects.every((subject) => {
      const grade = input.predictedGrades[subject] ?? input.predictedGrades[subject[0].toUpperCase() + subject.slice(1)];
      return rankOf(grade) >= rankOf(pathway.minGrade);
    });
    if (!strongEnough && interests.length === 0) continue;
    cards.push({
      id: `${pathway.id}-uni`,
      kind: 'university',
      title: pathway.university,
      detail: strongEnough
        ? `Your predicted grades meet a typical ${pathway.minGrade} offer in ${pathway.subjects.join(' and ')}.`
        : `A typical offer asks for ${pathway.minGrade} in ${pathway.subjects.join(' and ')}. Keep going — this is a direction, not a decision.`,
    });
    cards.push({
      id: `${pathway.id}-job`,
      kind: 'career',
      title: pathway.career,
      detail: `People who study ${pathway.university} often work as a ${pathway.career.toLowerCase()}.`,
    });
  }
  return cards.slice(0, 8);
}
