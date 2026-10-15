export type SnapContext = 'study' | 'assessment';

export interface SnapGate {
  allowed: boolean;
  reason: 'ok' | 'assessment' | 'open_mock' | 'parent' | 'flag' | 'empty';
}

export function snapGate(input: {
  flagOn: boolean;
  context: SnapContext;
  openMock: boolean;
  parentAllows: boolean;
  hasInput: boolean;
}): SnapGate {
  if (!input.flagOn) return { allowed: false, reason: 'flag' };
  if (!input.hasInput) return { allowed: false, reason: 'empty' };
  if (input.context === 'assessment') return { allowed: false, reason: 'assessment' };
  if (input.openMock) return { allowed: false, reason: 'open_mock' };
  if (!input.parentAllows) return { allowed: false, reason: 'parent' };
  return { allowed: true, reason: 'ok' };
}

export interface WorkedSolution {
  answer: string;
  steps: string[];
  similar: string[];
}

const LINEAR = /^(-?\d*)\s*x\s*([+-])\s*(\d+)\s*=\s*(-?\d+)$/i;

function linearCoefficient(raw: string): number {
  if (raw === '' || raw === '+') return 1;
  if (raw === '-') return -1;
  return Number(raw);
}

/** A worked solution the route can return before a model is configured. */
export function explainQuestion(question: string): WorkedSolution {
  const text = question.trim();
  const linear = LINEAR.exec(text.replace(/\s+/g, ' '));
  if (linear) {
    const a = linearCoefficient(linear[1]);
    const sign = linear[2] === '-' ? -1 : 1;
    const b = sign * Number(linear[3]);
    const c = Number(linear[4]);
    const x = (c - b) / a;
    return {
      answer: `x = ${Number.isInteger(x) ? x : x.toFixed(2)}`,
      steps: [
        `Start with ${text}.`,
        `Move the constant to the other side: ${a}x = ${c} − (${b}) = ${c - b}.`,
        `Divide by ${a}: x = ${c - b}/${a}.`,
        'Check by substituting the value back into the original equation.',
      ],
      similar: [
        `${a}x ${b + 2 >= 0 ? '+' : '−'} ${Math.abs(b + 2)} = ${c + 3}`,
        `${a + 1}x + ${Math.abs(b)} = ${c + 5}`,
      ],
    };
  }

  return {
    answer: 'Work through the steps, then compare with your notes.',
    steps: [
      `Read the question carefully: “${text.slice(0, 280)}”.`,
      'Write down the facts you are given and the quantity you need.',
      'Name the rule or formula that connects them.',
      'Apply it one line at a time, keeping units.',
      'Check the result is the right size and answers what was asked.',
    ],
    similar: [
      'Restate the same question with the numbers changed.',
      'Ask what would happen if one given value doubled.',
    ],
  };
}
